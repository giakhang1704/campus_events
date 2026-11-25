package vn.edu.hcmut.campusevents.security;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import vn.edu.hcmut.campusevents.exception.ApiException;

import java.nio.charset.StandardCharsets;
import java.security.*;
import java.util.*;

import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;

@Component
public class QrTokenCipher {
    private final SecretKeySpec key;
    private final SecureRandom random = new SecureRandom();

    public QrTokenCipher(@Value("${campus.attendance.token-key:}") String encoded) {
        try {
            byte[] bytes = encoded.isBlank() ? null : Base64.getDecoder().decode(encoded);
            if (bytes != null && bytes.length != 32) throw new IllegalArgumentException();
            key = bytes == null ? null : new SecretKeySpec(bytes, "AES");
        } catch (IllegalArgumentException e) {
            throw new IllegalStateException(
                    "ATTENDANCE_TOKEN_KEY must be Base64 of 32 random bytes");
        }
    }

    public String generate() {
        byte[] bytes = new byte[32];
        random.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    public String hash(String token) {
        try {
            return HexFormat.of()
                    .formatHex(
                            MessageDigest.getInstance("SHA-256")
                                    .digest(token.getBytes(StandardCharsets.UTF_8)));
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException("SHA-256 unavailable");
        }
    }

    public boolean matches(String token, String storedHash) {
        return MessageDigest.isEqual(
                hash(token).getBytes(StandardCharsets.US_ASCII),
                storedHash.getBytes(StandardCharsets.US_ASCII));
    }

    public String encrypt(long eventId, String token) {
        return crypt(eventId, token, true);
    }

    public String decrypt(long eventId, String ciphertext) {
        return crypt(eventId, ciphertext, false);
    }

    private String crypt(long eventId, String value, boolean encrypt) {
        if (key == null)
            throw new ApiException(
                    503,
                    "QR_KEY_NOT_CONFIGURED",
                    "Chưa cấu hình khóa bảo vệ phiên QR trên backend.");
        try {
            byte[] iv = new byte[12], data;
            if (encrypt) {
                random.nextBytes(iv);
                data = value.getBytes(StandardCharsets.UTF_8);
            } else {
                var bytes = Base64.getDecoder().decode(value);
                if (bytes.length < 29) throw new GeneralSecurityException();
                System.arraycopy(bytes, 0, iv, 0, 12);
                data = Arrays.copyOfRange(bytes, 12, bytes.length);
            }
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(
                    encrypt ? Cipher.ENCRYPT_MODE : Cipher.DECRYPT_MODE,
                    key,
                    new GCMParameterSpec(128, iv));
            cipher.updateAAD(("BKevent:attendance:" + eventId).getBytes(StandardCharsets.UTF_8));
            byte[] output = cipher.doFinal(data);
            if (!encrypt) return new String(output, StandardCharsets.UTF_8);
            byte[] combined = Arrays.copyOf(iv, iv.length + output.length);
            System.arraycopy(output, 0, combined, iv.length, output.length);
            return Base64.getEncoder().encodeToString(combined);
        } catch (GeneralSecurityException | IllegalArgumentException e) {
            throw new ApiException(
                    503,
                    "QR_KEY_ERROR",
                    "Không thể đọc khóa phiên QR. Kiểm tra cấu hình backend hoặc đóng phiên cũ.");
        }
    }
}
