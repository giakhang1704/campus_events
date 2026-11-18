package vn.edu.hcmut.campusevents.exception;

import static org.junit.jupiter.api.Assertions.*;

import org.junit.jupiter.api.Test;
import org.springframework.jdbc.UncategorizedSQLException;

import java.sql.SQLException;
import java.util.Map;

class QrDatabaseErrorTest {
    @Test
    void qrExpiryDuringWriteIsAConflictRatherThanAnOutage() {
        var error =
                new UncategorizedSQLException(
                        "attendance write", "", new SQLException("QR expired", "PQR01"));
        var response = new GlobalExceptionHandler().unavailable(error);
        assertEquals(409, response.getStatusCode().value());
        assertEquals("QR_SESSION_INVALID", ((Map<?, ?>) response.getBody()).get("code"));
    }

    @Test
    void otherDatabaseFailuresKeepTheirServiceUnavailableResponse() {
        var error =
                new UncategorizedSQLException(
                        "attendance write", "", new SQLException("database unavailable", "08006"));
        assertEquals(503, new GlobalExceptionHandler().unavailable(error).getStatusCode().value());
    }
}
