package vn.edu.hcmut.campusevents.security;

import static org.junit.jupiter.api.Assertions.*;

import org.junit.jupiter.api.Test;

import vn.edu.hcmut.campusevents.exception.ApiException;

import java.util.Base64;

class QrTokenCipherTest {
    private final String key = Base64.getEncoder().encodeToString(new byte[32]);

    @Test
    void encryptsWithFreshIvAndAuthenticatesEventContext() {
        var cipher = new QrTokenCipher(key);
        String token = cipher.generate();
        assertTrue(token.matches("[A-Za-z0-9_-]{43}"));
        var first = cipher.encrypt(1, token);
        var second = cipher.encrypt(1, token);
        assertNotEquals(first, second);
        assertFalse(first.contains(token));
        assertEquals(token, cipher.decrypt(1, first));
        assertThrows(ApiException.class, () -> cipher.decrypt(2, first));
        byte[] tampered = Base64.getDecoder().decode(first);
        tampered[tampered.length - 1] ^= 1;
        assertThrows(
                ApiException.class,
                () -> cipher.decrypt(1, Base64.getEncoder().encodeToString(tampered)));
        assertTrue(cipher.matches(token, cipher.hash(token)));
        assertFalse(cipher.matches(cipher.generate(), cipher.hash(token)));
    }

    @Test
    void refusesMissingAndInvalidKeyWithoutAnInsecureFallback() {
        var missing = new QrTokenCipher("");
        assertEquals(
                "QR_KEY_NOT_CONFIGURED",
                assertThrows(ApiException.class, () -> missing.encrypt(1, "anything")).code);
        assertThrows(IllegalStateException.class, () -> new QrTokenCipher("not base64"));
        assertThrows(
                IllegalStateException.class,
                () -> new QrTokenCipher(Base64.getEncoder().encodeToString(new byte[16])));
    }
}
