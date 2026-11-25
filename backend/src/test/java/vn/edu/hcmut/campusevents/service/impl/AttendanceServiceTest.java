package vn.edu.hcmut.campusevents.service.impl;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import static vn.edu.hcmut.campusevents.support.EventFixtures.*;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.google.zxing.*;
import com.google.zxing.common.HybridBinarizer;

import org.junit.jupiter.api.Test;

import vn.edu.hcmut.campusevents.dto.attendance.AttendanceScanRequest;
import vn.edu.hcmut.campusevents.dto.attendance.CheckInRequest;
import vn.edu.hcmut.campusevents.dto.attendance.ManualAttendanceRequest;
import vn.edu.hcmut.campusevents.exception.ApiException;
import vn.edu.hcmut.campusevents.model.*;
import vn.edu.hcmut.campusevents.repository.*;
import vn.edu.hcmut.campusevents.security.*;
import vn.edu.hcmut.campusevents.service.IAuthService;
import vn.edu.hcmut.campusevents.validation.AttendanceRules;

import java.util.*;
import java.util.regex.Pattern;

class AttendanceServiceTest {
    private final IAttendanceRepository attendance = mock(IAttendanceRepository.class);
    private final IEventRepository events = mock(IEventRepository.class);
    private final IRegistrationRepository registrations = mock(IRegistrationRepository.class);
    private final IAuthService auth = mock(IAuthService.class);
    private final QrTokenCipher cipher =
            new QrTokenCipher(Base64.getEncoder().encodeToString(new byte[32]));
    private final AttendanceServiceImpl service =
            new AttendanceServiceImpl(
                    attendance,
                    events,
                    registrations,
                    auth,
                    new AttendanceRules(),
                    cipher,
                    new ObjectMapper());
    private final AuthPrincipal owner = new AuthPrincipal(7, 1, "ORGANIZER", false);

    @Test
    void actualSvgDecodesToTheIssuedPayload() throws Exception {
        var e = event(7, EventStatus.PUBLISHED);
        String token = cipher.generate();
        var session =
                new AttendanceSession(
                        1,
                        e.id(),
                        e.startsAt(),
                        e.startsAt().plusMinutes(10),
                        null,
                        cipher.hash(token),
                        cipher.encrypt(e.id(), token));
        when(events.find(10, false)).thenReturn(Optional.of(e));
        when(attendance.session(10, 1)).thenReturn(Optional.of(session));
        when(attendance.now()).thenReturn(e.startsAt().plusMinutes(1));
        String svg = service.svg(owner, 10, 1);
        var dimension = Pattern.compile("viewBox=\"0 0 (\\d+) (\\d+)\"").matcher(svg);
        assertTrue(dimension.find());
        int n = Integer.parseInt(dimension.group(1));
        int side = n * 5;
        int[] pixels = new int[side * side];
        Arrays.fill(pixels, 0xffffff);
        var points = Pattern.compile("M(\\d+) (\\d+)h1v1h-1z").matcher(svg);
        while (points.find()) {
            int x = Integer.parseInt(points.group(1)) * 5;
            int y = Integer.parseInt(points.group(2)) * 5;
            for (int dy = 0; dy < 5; dy++)
                for (int dx = 0; dx < 5; dx++) pixels[(y + dy) * side + x + dx] = 0;
        }
        var result =
                new MultiFormatReader()
                        .decode(
                                new BinaryBitmap(
                                        new HybridBinarizer(
                                                new RGBLuminanceSource(side, side, pixels))));
        var payload = new ObjectMapper().readTree(result.getText());
        assertEquals(token, payload.path("token").asText());
        assertEquals(10, payload.path("eventId").asLong());
        assertEquals(1, payload.path("sessionId").asLong());
    }

    @Test
    void oldRegistrationVersionCannotChangeAttendanceOnNewAdmission() {
        var e = event(7, EventStatus.PUBLISHED);
        when(events.find(10, true)).thenReturn(Optional.of(e));
        when(attendance.now()).thenReturn(e.startsAt());
        when(attendance.registration(10, 8))
                .thenReturn(
                        Optional.of(
                                new Registration(
                                        8, 10, 9, "REGISTERED", null, e.startsAt(), null, 3)));
        when(attendance.attendance(8)).thenReturn(Optional.empty());
        var error =
                assertThrows(
                        ApiException.class,
                        () ->
                                service.manual(
                                        owner,
                                        10,
                                        8,
                                        new ManualAttendanceRequest(
                                                "PRESENT", 0, 1, "stale form")));
        assertEquals("VERSION_CONFLICT", error.code);
        verify(attendance, never()).save(any(), any(), any(), any(), any(), anyLong(), any());
    }

    @Test
    void anotherOrganizerCannotObtainQrSecret() {
        when(events.find(10, false)).thenReturn(Optional.of(event(8, EventStatus.PUBLISHED)));
        assertEquals(
                404, assertThrows(ApiException.class, () -> service.current(owner, 10)).status);
        verifyNoInteractions(attendance);
    }

    @Test
    void scanPreviewDoesNotCreateAttendanceOrAudit() {
        var e = event(7, EventStatus.PUBLISHED);
        String token = cipher.generate();
        var s =
                new AttendanceSession(
                        1,
                        10,
                        e.startsAt(),
                        e.startsAt().plusMinutes(10),
                        null,
                        cipher.hash(token),
                        cipher.encrypt(10, token));
        when(events.find(10, false)).thenReturn(Optional.of(e));
        when(attendance.now()).thenReturn(e.startsAt());
        when(attendance.session(10, 1)).thenReturn(Optional.of(s));
        when(registrations.find(10, 9))
                .thenReturn(
                        Optional.of(
                                new Registration(
                                        8, 10, 9, "REGISTERED", null, e.startsAt(), null, 3)));
        when(attendance.attendance(8)).thenReturn(Optional.empty());
        var result =
                service.preview(
                        new AuthPrincipal(9, 1, "STUDENT", false),
                        10,
                        new AttendanceScanRequest(1, token));
        assertEquals(3, result.registrationVersion());
        assertEquals(e.version(), result.eventVersion());
        assertFalse(result.alreadyPresent());
        verify(attendance, never()).save(any(), any(), any(), any(), any(), anyLong(), any());
        verify(attendance, never()).history(any(), any(), anyLong(), any());
        verifyNoInteractions(auth);
    }

    @Test
    void staleStudentConfirmationCannotMarkANewAdmissionPresent() {
        var e = event(7, EventStatus.PUBLISHED);
        String token = cipher.generate();
        var student =
                new User(
                        9,
                        "Student",
                        "student@example.test",
                        "STUDENT",
                        "ACTIVE",
                        false,
                        1,
                        null,
                        "S9",
                        1L,
                        2,
                        "internal",
                        1);
        when(events.find(10, true)).thenReturn(Optional.of(e));
        when(auth.requireActiveStudent(any())).thenReturn(student);
        when(attendance.now()).thenReturn(e.startsAt());
        when(attendance.session(10, 1))
                .thenReturn(
                        Optional.of(
                                new AttendanceSession(
                                        1,
                                        10,
                                        e.startsAt(),
                                        e.startsAt().plusMinutes(10),
                                        null,
                                        cipher.hash(token),
                                        cipher.encrypt(10, token))));
        when(registrations.find(10, 9))
                .thenReturn(
                        Optional.of(
                                new Registration(
                                        8, 10, 9, "REGISTERED", null, e.startsAt(), null, 3)));
        var error =
                assertThrows(
                        ApiException.class,
                        () ->
                                service.checkIn(
                                        new AuthPrincipal(9, 1, "STUDENT", false),
                                        10,
                                        new CheckInRequest(1, token, e.version(), 1, 0)));
        assertEquals("CONFIRMATION_STALE", error.code);
        verify(attendance, never()).save(any(), any(), any(), any(), any(), anyLong(), any());
    }
}
