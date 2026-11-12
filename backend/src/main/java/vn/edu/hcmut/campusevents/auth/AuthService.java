package vn.edu.hcmut.campusevents.auth;
import java.nio.charset.StandardCharsets;
import java.security.*;
import java.time.*;
import java.util.*;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.edu.hcmut.campusevents.users.*;
import vn.edu.hcmut.campusevents.common.ApiException;
@Service
public class AuthService {
 private final AccountRepository accounts; private final PasswordEncoder encoder;
 public AuthService(AccountRepository a,PasswordEncoder e){accounts=a;encoder=e;}
    /** Recheck the account/session while holding its lock through a business write. */
    @Transactional
    public void requireActiveOrganizer(AuthPrincipal principal) {
        accounts.lock(principal.userId());
        PublicUser user = accounts.find(principal.userId());
        if (!user.status().equals("ACTIVE") || !accounts.hasActiveSession(user.id(), principal.sessionId())) {
            throw new ApiException(401, "UNAUTHENTICATED", "Phiên đã hết hiệu lực. Vui lòng đăng nhập lại.");
        }
        if (!user.role().equals("ORGANIZER") || user.mustChangePassword()) {
            throw new ApiException(403, "FORBIDDEN",
                    "Cần tài khoản Người tổ chức đã đổi mật khẩu để quản lý sự kiện.");
        }
    }
 public static String digest(String raw){try{return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(raw.getBytes(StandardCharsets.UTF_8)));}catch(NoSuchAlgorithmException e){throw new IllegalStateException(e);}}
 public static String normalizeEmail(String email){return email.trim().toLowerCase(Locale.ROOT);}
 public static void checkPassword(String password){int n=password.getBytes(StandardCharsets.UTF_8).length;if(password.length()<8||n>72)throw new ApiException(400,"INVALID_PASSWORD","Mật khẩu cần ít nhất 8 ký tự và tối đa 72 byte UTF-8.",Map.of("password","Mật khẩu cần ít nhất 8 ký tự và tối đa 72 byte UTF-8."));}
 public static String randomToken(){byte[] bytes=new byte[32];new SecureRandom().nextBytes(bytes);return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);}
 @Transactional public PublicUser register(String name,String email,String password,String code,long department,int year){
  checkPassword(password);String normalized=normalizeEmail(email);String studentCode=code.trim().toUpperCase(Locale.ROOT);
  if(name.isBlank()||studentCode.isBlank())throw new ApiException(400,"VALIDATION_ERROR","Họ tên và MSSV không được trống.");
  if(!accounts.selectableDepartmentExists(department))throw new ApiException(400,"INVALID_DEPARTMENT","Khoa không hợp lệ.",Map.of("departmentId","Vui lòng chọn khoa hợp lệ."));
  Long id=accounts.jdbc().queryForObject("INSERT INTO campus.users(full_name,email,password_hash,role) VALUES(?,?,?,'STUDENT') RETURNING id",Long.class,name.trim(),normalized,encoder.encode(password));
  accounts.jdbc().update("INSERT INTO campus.student_profiles(user_id,student_code,department_id,study_year) VALUES(?,?,?,?)",id,studentCode,department,year);
  return accounts.find(id);
 }
 public record Login(String token,PublicUser user) {}
 @Transactional public Login login(String email,String password,String previousToken){
  String denied="Email hoặc mật khẩu không đúng hoặc tài khoản đã bị khóa. Nếu tài khoản bị khóa, vui lòng liên hệ quản trị viên.";
  PublicUser user=accounts.email(normalizeEmail(email)).orElseThrow(()->new ApiException(401,"INVALID_CREDENTIALS",denied));
  accounts.lock(user.id());user=accounts.find(user.id());
  if(!encoder.matches(password,accounts.hash(user.id()))||!user.status().equals("ACTIVE"))throw new ApiException(401,"INVALID_CREDENTIALS",denied);
  if(previousToken!=null)accounts.jdbc().update("UPDATE campus.auth_sessions SET revoked_at=clock_timestamp() WHERE token_hash=? AND revoked_at IS NULL",digest(previousToken));
  String raw=randomToken();accounts.jdbc().update("INSERT INTO campus.auth_sessions(user_id,token_hash,auth_version,expires_at) VALUES(?,?,?,clock_timestamp()+interval '8 hours')",user.id(),digest(raw),accounts.authVersion(user.id()));
  return new Login(raw,user);
 }
 public Optional<AuthPrincipal> authenticate(String raw){if(raw==null||raw.length()>256)return Optional.empty();return accounts.jdbc().query("SELECT u.id,s.id AS session_id,u.role,u.must_change_password FROM campus.auth_sessions s JOIN campus.users u ON u.id=s.user_id WHERE s.token_hash=? AND s.revoked_at IS NULL AND s.expires_at>clock_timestamp() AND u.status='ACTIVE' AND s.auth_version=u.auth_version",(rs,n)->new AuthPrincipal(rs.getLong("id"),rs.getLong("session_id"),rs.getString("role"),rs.getBoolean("must_change_password")),digest(raw)).stream().findFirst();}
 @Transactional public void logout(AuthPrincipal p){accounts.jdbc().update("UPDATE campus.auth_sessions SET revoked_at=clock_timestamp() WHERE id=? AND revoked_at IS NULL",p.sessionId());}
 @Transactional public void password(AuthPrincipal p,String oldPassword,String newPassword){
  checkPassword(newPassword);accounts.lock(p.userId());
  if(accounts.jdbc().queryForObject("SELECT count(*) FROM campus.auth_sessions s JOIN campus.users u ON u.id=s.user_id WHERE s.id=? AND s.user_id=? AND s.revoked_at IS NULL AND s.expires_at>clock_timestamp() AND u.status='ACTIVE' AND s.auth_version=u.auth_version",Integer.class,p.sessionId(),p.userId())==0)throw new ApiException(401,"UNAUTHENTICATED","Phiên đã hết hiệu lực.");
  if(!encoder.matches(oldPassword,accounts.hash(p.userId())))throw new ApiException(400,"INVALID_CURRENT_PASSWORD","Mật khẩu hiện tại không đúng.");
  if(encoder.matches(newPassword,accounts.hash(p.userId())))throw new ApiException(400,"PASSWORD_UNCHANGED","Mật khẩu mới phải khác mật khẩu cũ.");
  accounts.jdbc().update("UPDATE campus.users SET password_hash=?,must_change_password=false,auth_version=auth_version+1,version=version+1,updated_at=clock_timestamp() WHERE id=?",encoder.encode(newPassword),p.userId());
  accounts.jdbc().update("UPDATE campus.auth_sessions SET revoked_at=clock_timestamp() WHERE user_id=? AND revoked_at IS NULL",p.userId());
 }
}
