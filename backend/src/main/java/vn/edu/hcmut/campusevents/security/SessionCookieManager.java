package vn.edu.hcmut.campusevents.security;

import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Component;

@Component
public class SessionCookieManager {
    public static final String COOKIE = "CAMPUS_SESSION";
    private final boolean secure;

    public SessionCookieManager(@Value("${campus.auth.secure-cookie:false}") boolean secure) {
        this.secure = secure;
    }

    public static String token(HttpServletRequest request) {
        if (request.getCookies() != null) {
            for (Cookie cookie : request.getCookies()) {
                if (COOKIE.equals(cookie.getName())) return cookie.getValue();
            }
        }
        return null;
    }

    public void write(HttpServletResponse response, String token, int maxAge) {
        response.addHeader(
                HttpHeaders.SET_COOKIE,
                ResponseCookie.from(COOKIE, token)
                        .httpOnly(true)
                        .secure(secure)
                        .sameSite("Lax")
                        .path("/api")
                        .maxAge(maxAge)
                        .build()
                        .toString());
    }
}
