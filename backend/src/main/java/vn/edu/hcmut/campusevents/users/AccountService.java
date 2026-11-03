package vn.edu.hcmut.campusevents.users;
import java.util.*;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.edu.hcmut.campusevents.auth.*;
import vn.edu.hcmut.campusevents.common.ApiException;
@Service
public class AccountService {
 private final AccountRepository users;private final PasswordEncoder encoder;private final ObjectMapper json;
 public AccountService(AccountRepository u,PasswordEncoder e,ObjectMapper j){users=u;encoder=e;json=j;}
 private void actor(AuthPrincipal p){PublicUser user=users.find(p.userId());if(!user.role().equals("ADMIN")||!user.status().equals("ACTIVE"))throw new ApiException(403,"FORBIDDEN","Quyền quản trị đã thay đổi.");}
 private PublicUser target(AuthPrincipal actor,long id,int version){
  users.adminLock();actor(actor);if(actor.userId()==id)throw new ApiException(409,"SELF_MODIFICATION","Không được tự khóa hoặc tự đổi vai trò.");
  PublicUser before=users.find(id);users.lock(id);before=users.find(id);
  if(before.version()!=version)throw new ApiException(409,"VERSION_CONFLICT","Tài khoản đã được cập nhật. Vui lòng tải lại.");return before;
 }
 private void lastAdmin(PublicUser before){if(before.role().equals("ADMIN")&&before.status().equals("ACTIVE")&&users.jdbc().queryForObject("SELECT count(*) FROM campus.users WHERE role='ADMIN' AND status='ACTIVE' AND id<>?",Integer.class,before.id())==0)throw new ApiException(409,"LAST_ACTIVE_ADMIN","Phải giữ ít nhất một Admin đang hoạt động.");}
 private void organizer(PublicUser before){if(before.role().equals("ORGANIZER")&&users.jdbc().queryForObject("SELECT count(*) FROM campus.events WHERE organizer_id=? AND (status='DRAFT' OR ends_at>clock_timestamp())",Integer.class,before.id())>0)throw new ApiException(409,"ORGANIZER_HAS_EVENTS","Người tổ chức còn sự kiện nháp hoặc chưa kết thúc.");}
 private void invalidate(long id){users.jdbc().update("UPDATE campus.auth_sessions SET revoked_at=clock_timestamp() WHERE user_id=? AND revoked_at IS NULL",id);}
 private String snapshot(Object value){try{return json.writeValueAsString(value);}catch(JsonProcessingException e){throw new IllegalStateException(e);}}
 private void audit(long id,long actor,String action,PublicUser before,PublicUser after,String reason){users.jdbc().update("INSERT INTO campus.account_history(target_user_id,actor_id,action,before_data,after_data,reason) VALUES(?,?,?,?::jsonb,?::jsonb,?)",id,actor,action,before==null?null:snapshot(before),snapshot(after),reason.trim());}
 @Transactional public PublicUser create(AuthPrincipal actor,String name,String email,String password,long unit,String reason){
  AuthService.checkPassword(password);if(name.isBlank())throw new ApiException(400,"VALIDATION_ERROR","Họ tên không được trống.");users.adminLock();actor(actor);
  if(users.jdbc().queryForObject("SELECT count(*) FROM campus.organization_units WHERE id=?",Integer.class,unit)==0)throw new ApiException(400,"INVALID_UNIT","Đơn vị không hợp lệ.");
  Long id=users.jdbc().queryForObject("INSERT INTO campus.users(full_name,email,password_hash,role,organization_unit_id,must_change_password) VALUES(?,?,?,'ORGANIZER',?,true) RETURNING id",Long.class,name.trim(),AuthService.normalizeEmail(email),encoder.encode(password),unit);
  PublicUser after=users.find(id);audit(id,actor.userId(),"CREATE_ORGANIZER",null,after,reason);return after;
 }
 @Transactional public PublicUser status(AuthPrincipal actor,long id,String status,int version,String reason){
  PublicUser before=target(actor,id,version);if(before.status().equals(status))return before;
  if(status.equals("LOCKED")){lastAdmin(before);organizer(before);}
  users.jdbc().update("UPDATE campus.users SET status=?,version=version+1,auth_version=auth_version+1,updated_at=clock_timestamp() WHERE id=?",status,id);invalidate(id);
  PublicUser after=users.find(id);audit(id,actor.userId(),status.equals("LOCKED")?"LOCK":"UNLOCK",before,after,reason);return after;
 }
 @Transactional public PublicUser role(AuthPrincipal actor,long id,String role,Long unit,int version,String reason){
  PublicUser before=target(actor,id,version);if(before.role().equals(role))return before;lastAdmin(before);organizer(before);
  if(role.equals("STUDENT")&&before.studentCode()==null)throw new ApiException(409,"STUDENT_PROFILE_REQUIRED","Cần hồ sơ sinh viên đầy đủ trước khi đổi vai trò.");
  Long selected=unit==null?before.organizationUnitId():unit;
  if(role.equals("ORGANIZER")&&(selected==null||users.jdbc().queryForObject("SELECT count(*) FROM campus.organization_units WHERE id=?",Integer.class,selected)==0))throw new ApiException(400,"INVALID_UNIT","Cần chọn đơn vị tổ chức hợp lệ.");
  users.jdbc().update("UPDATE campus.users SET role=?,organization_unit_id=?,version=version+1,auth_version=auth_version+1,updated_at=clock_timestamp() WHERE id=?",role,selected,id);invalidate(id);
  PublicUser after=users.find(id);audit(id,actor.userId(),"CHANGE_ROLE",before,after,reason);return after;
 }
}
