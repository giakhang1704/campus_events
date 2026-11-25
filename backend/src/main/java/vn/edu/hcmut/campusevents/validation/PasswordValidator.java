package vn.edu.hcmut.campusevents.validation;

import vn.edu.hcmut.campusevents.exception.ApiException;

import java.nio.charset.StandardCharsets;
import java.util.Locale;
import java.util.Map;

public final class PasswordValidator {
    private PasswordValidator() {}

    public static String normalizeEmail(String email) {
        return email.trim().toLowerCase(Locale.ROOT);
    }

    public static void check(String password) {
        if (password.length() < 8 || password.getBytes(StandardCharsets.UTF_8).length > 72) {
            throw new ApiException(
                    400,
                    "INVALID_PASSWORD",
                    "Mật khẩu cần ít nhất 8 ký tự và tối đa 72 byte UTF-8.",
                    Map.of("password", "Mật khẩu cần ít nhất 8 ký tự và tối đa 72 byte UTF-8."));
        }
    }
}
