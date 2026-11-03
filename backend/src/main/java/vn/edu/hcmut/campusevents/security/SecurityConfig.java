package vn.edu.hcmut.campusevents.security;
import java.io.IOException;
import java.util.*;
import jakarta.servlet.*;
import jakarta.servlet.http.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.*;
import org.springframework.http.HttpMethod;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.*;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.security.web.csrf.*;
import org.springframework.web.filter.OncePerRequestFilter;
import vn.edu.hcmut.campusevents.auth.AuthService;
@Configuration
public class SecurityConfig {
 public static final String COOKIE="CAMPUS_SESSION";
 public static String token(HttpServletRequest request){if(request.getCookies()!=null)for(Cookie cookie:request.getCookies())if(COOKIE.equals(cookie.getName()))return cookie.getValue();return null;}
 @Bean PasswordEncoder passwordEncoder(){return new BCryptPasswordEncoder(12);}
 @Bean SecurityFilterChain security(HttpSecurity http,AuthService auth,@Value("${campus.auth.secure-cookie:false}") boolean secure) throws Exception {
  CookieCsrfTokenRepository csrf=new CookieCsrfTokenRepository();csrf.setCookieCustomizer(c->c.path("/").httpOnly(false).sameSite("Lax").secure(secure));
  http.sessionManagement(s->s.sessionCreationPolicy(SessionCreationPolicy.STATELESS)).requestCache(c->c.disable())
   .csrf(c->c.csrfTokenRepository(csrf).csrfTokenRequestHandler(new CsrfTokenRequestAttributeHandler()))
   .formLogin(c->c.disable()).httpBasic(c->c.disable()).logout(c->c.disable())
   .exceptionHandling(c->c.authenticationEntryPoint((req,res,e)->error(res,401,"UNAUTHENTICATED","Vui lòng đăng nhập."))
    .accessDeniedHandler((req,res,e)->error(res,403,"FORBIDDEN","Không có quyền hoặc CSRF token không hợp lệ.")))
   .authorizeHttpRequests(c->c.requestMatchers("/api/health","/api/auth/csrf").permitAll()
    .requestMatchers(HttpMethod.POST,"/api/auth/login","/api/auth/register").permitAll()
    .requestMatchers(HttpMethod.GET,"/api/catalog/**").permitAll()
    .requestMatchers("/api/admin/**").hasRole("ADMIN")
    .requestMatchers("/api/**").authenticated().anyRequest().denyAll())
   .addFilterBefore(new OncePerRequestFilter(){
    @Override protected void doFilterInternal(HttpServletRequest req,HttpServletResponse res,FilterChain chain) throws ServletException,IOException {
     var principal=auth.authenticate(token(req));
     if(principal.isPresent()){
      var p=principal.get();
      SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(p,null,List.of(new SimpleGrantedAuthority("ROLE_"+p.role()))));
      if(p.mustChangePassword()&&!Set.of("/api/auth/me","/api/auth/password","/api/auth/logout","/api/auth/csrf","/api/health").contains(req.getRequestURI())){error(res,403,"PASSWORD_CHANGE_REQUIRED","Vui lòng đổi mật khẩu trước khi tiếp tục.");return;}
     }
     chain.doFilter(req,res);
    }
   },UsernamePasswordAuthenticationFilter.class);
  return http.build();
 }
 private static void error(HttpServletResponse response,int status,String code,String message)throws IOException{response.setStatus(status);response.setContentType("application/json;charset=UTF-8");response.getWriter().write(new com.fasterxml.jackson.databind.ObjectMapper().writeValueAsString(Map.of("code",code,"message",message)));}
}
