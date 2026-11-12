package vn.edu.hcmut.campusevents.security;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.security.web.csrf.CookieCsrfTokenRepository;
import org.springframework.security.web.csrf.CsrfTokenRequestAttributeHandler;

import vn.edu.hcmut.campusevents.service.IAuthService;

@Configuration
public class SecurityConfig {
    @Bean
    PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder(12);
    }

    @Bean
    SecurityFilterChain security(
            HttpSecurity http,
            IAuthService auth,
            @Value("${campus.auth.secure-cookie:false}") boolean secure)
            throws Exception {
        CookieCsrfTokenRepository csrf = new CookieCsrfTokenRepository();
        csrf.setCookieCustomizer(
                cookie -> cookie.path("/").httpOnly(false).sameSite("Lax").secure(secure));
        http.sessionManagement(
                        session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .requestCache(cache -> cache.disable())
                .csrf(
                        config ->
                                config.csrfTokenRepository(csrf)
                                        .csrfTokenRequestHandler(
                                                new CsrfTokenRequestAttributeHandler()))
                .formLogin(config -> config.disable())
                .httpBasic(config -> config.disable())
                .logout(config -> config.disable())
                .exceptionHandling(
                        config ->
                                config.authenticationEntryPoint(
                                                (request, response, error) ->
                                                        SessionAuthenticationFilter.writeError(
                                                                response,
                                                                401,
                                                                "UNAUTHENTICATED",
                                                                "Vui lòng đăng nhập."))
                                        .accessDeniedHandler(
                                                (request, response, error) ->
                                                        SessionAuthenticationFilter.writeError(
                                                                response,
                                                                403,
                                                                "FORBIDDEN",
                                                                "Không có quyền hoặc CSRF token"
                                                                        + " không hợp lệ.")))
                .authorizeHttpRequests(
                        config ->
                                config.requestMatchers("/api/health", "/api/auth/csrf")
                                        .permitAll()
                                        .requestMatchers(
                                                HttpMethod.POST,
                                                "/api/auth/login",
                                                "/api/auth/register",
                                                "/api/auth/logout")
                                        .permitAll()
                                        .requestMatchers(HttpMethod.GET, "/api/catalog/**")
                                        .permitAll()
                                        .requestMatchers(
                                                "/api/admin/users/*/role",
                                                "/api/admin/users/*/role/preview")
                                        .denyAll()
                                        .requestMatchers("/api/admin/**")
                                        .hasRole("ADMIN")
                                        .requestMatchers("/api/organizer/**")
                                        .hasRole("ORGANIZER")
                                        .requestMatchers(
                                                HttpMethod.POST,
                                                "/api/events",
                                                "/api/events/*/publish")
                                        .hasRole("ORGANIZER")
                                        .requestMatchers(HttpMethod.PATCH, "/api/events/*")
                                        .hasRole("ORGANIZER")
                                        .requestMatchers(
                                                HttpMethod.GET, "/api/events", "/api/events/*")
                                        .authenticated()
                                        .requestMatchers("/api/**")
                                        .authenticated()
                                        .anyRequest()
                                        .denyAll())
                .addFilterBefore(
                        new SessionAuthenticationFilter(auth),
                        UsernamePasswordAuthenticationFilter.class);
        return http.build();
    }
}
