package vn.edu.hcmut.campusevents.auth;
import java.util.Map;
import jakarta.servlet.http.*;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.web.bind.annotation.*;
import vn.edu.hcmut.campusevents.security.SecurityConfig;
import vn.edu.hcmut.campusevents.users.*;
@RestController @RequestMapping("/api/auth")
public class AuthController {
 private final AuthService auth;private final AccountRepository users;private final boolean secure;
 public AuthController(AuthService a,AccountRepository u,@Value("${campus.auth.secure-cookie:false}")boolean secure){auth=a;users=u;this.secure=secure;}
 public record Register(@NotBlank @Size(max=150)String fullName,@NotBlank @Email @Size(max=254)String email,@NotBlank @Size(min=8,max=72)String password,@NotBlank @Size(max=30)String studentCode,@NotNull @Positive Long departmentId,@NotNull @Min(1) @Max(32767)Integer studyYear){}
 public record Credentials(@NotBlank @Email @Size(max=254)String email,@NotBlank @Size(max=72)String password){}
 public record Password(@NotBlank @Size(max=72)String currentPassword,@NotBlank @Size(min=8,max=72)String newPassword){}
 @GetMapping("/csrf") Map<String,String> csrf(CsrfToken token){return Map.of("token",token.getToken(),"headerName",token.getHeaderName());}
 @PostMapping("/register") ResponseEntity<PublicUser> register(@Valid @RequestBody Register r){return ResponseEntity.status(201).body(auth.register(r.fullName,r.email,r.password,r.studentCode,r.departmentId,r.studyYear));}
 @PostMapping("/login") PublicUser login(@Valid @RequestBody Credentials r,HttpServletRequest request,HttpServletResponse response){var login=auth.login(r.email,r.password,SecurityConfig.token(request));cookie(response,login.token(),28800);return login.user();}
 @GetMapping("/me") PublicUser me(@AuthenticationPrincipal AuthPrincipal p){return users.find(p.userId());}
 @PostMapping("/logout") ResponseEntity<?> logout(@AuthenticationPrincipal AuthPrincipal p,HttpServletResponse response){auth.logout(p);cookie(response,"",0);return ResponseEntity.noContent().build();}
 @PostMapping("/password") ResponseEntity<?> password(@AuthenticationPrincipal AuthPrincipal p,@Valid @RequestBody Password r,HttpServletResponse response){auth.password(p,r.currentPassword,r.newPassword);cookie(response,"",0);return ResponseEntity.noContent().build();}
 private void cookie(HttpServletResponse response,String token,int seconds){response.addHeader(HttpHeaders.SET_COOKIE,ResponseCookie.from(SecurityConfig.COOKIE,token).httpOnly(true).secure(secure).sameSite("Lax").path("/api").maxAge(seconds).build().toString());}
}
