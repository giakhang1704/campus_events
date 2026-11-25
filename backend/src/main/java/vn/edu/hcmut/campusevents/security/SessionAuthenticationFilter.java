package vn.edu.hcmut.campusevents.security;

import com.fasterxml.jackson.databind.ObjectMapper;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import org.springframework.dao.DataAccessException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

import vn.edu.hcmut.campusevents.service.IAuthService;

import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

/** Installed only in Spring Security's chain, not auto-registered as a servlet filter. */
public class SessionAuthenticationFilter extends OncePerRequestFilter {
    private static final Set<String> PASSWORD_CHANGE_PATHS =
            Set.of(
                    "/api/auth/me",
                    "/api/auth/password",
                    "/api/auth/logout",
                    "/api/auth/csrf",
                    "/api/health");
    private final IAuthService auth;

    public SessionAuthenticationFilter(IAuthService auth) {
        this.auth = auth;
    }

    @Override
    protected void doFilterInternal(
            HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        Optional<AuthPrincipal> principal;
        try {
            principal = auth.authenticate(SessionCookieManager.token(request));
        } catch (DataAccessException error) {
            writeError(
                    response,
                    503,
                    "SERVICE_UNAVAILABLE",
                    "Dịch vụ dữ liệu tạm thời gián đoạn. Vui lòng thử lại.");
            return;
        }
        if (principal.isPresent()) {
            AuthPrincipal actor = principal.get();
            SecurityContextHolder.getContext()
                    .setAuthentication(
                            new UsernamePasswordAuthenticationToken(
                                    actor,
                                    null,
                                    List.of(new SimpleGrantedAuthority("ROLE_" + actor.role()))));
            if (actor.mustChangePassword()
                    && !PASSWORD_CHANGE_PATHS.contains(request.getRequestURI())) {
                writeError(
                        response,
                        403,
                        "PASSWORD_CHANGE_REQUIRED",
                        "Vui lòng đổi mật khẩu trước khi tiếp tục.");
                return;
            }
        }
        chain.doFilter(request, response);
    }

    static void writeError(HttpServletResponse response, int status, String code, String message)
            throws IOException {
        response.setStatus(status);
        response.setContentType("application/json;charset=UTF-8");
        response.getWriter()
                .write(
                        new ObjectMapper()
                                .writeValueAsString(Map.of("code", code, "message", message)));
    }
}
