package vn.edu.hcmut.campusevents.config;
import java.util.*;
import org.springframework.boot.*;
import org.springframework.core.env.Environment;
import org.springframework.core.annotation.Order;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import vn.edu.hcmut.campusevents.auth.AuthService;
import vn.edu.hcmut.campusevents.users.*;
@Component
@Order(10)
public class SeedRunner implements ApplicationRunner {
 private final Environment env;private final AccountRepository users;private final PasswordEncoder encoder;
 public SeedRunner(Environment env,AccountRepository users,PasswordEncoder encoder){this.env=env;this.users=users;this.encoder=encoder;}
 private long user(String email,String name,String role,String password,Long unit,String status){
  var existing=users.email(email);if(existing.isPresent())return existing.get().id();
  return users.jdbc().queryForObject("INSERT INTO campus.users(full_name,email,password_hash,role,organization_unit_id,status) VALUES(?,?,?,?,?,?) RETURNING id",Long.class,name,email,encoder.encode(password),role,unit,status);
 }
 @Override @Transactional public void run(ApplicationArguments args){
  boolean bootstrap=env.getProperty("campus.bootstrap.enabled",Boolean.class,false),seed=env.getProperty("campus.dev-seed.enabled",Boolean.class,false);
  if(!bootstrap&&!seed)return;users.adminLock();
  if(bootstrap){String email=env.getRequiredProperty("campus.bootstrap.email"),password=env.getRequiredProperty("campus.bootstrap.password");AuthService.checkPassword(password);
   if(users.jdbc().queryForObject("SELECT count(*) FROM campus.users WHERE role='ADMIN' AND status='ACTIVE'",Integer.class)==0){
    if(users.email(AuthService.normalizeEmail(email)).isPresent())throw new IllegalStateException("Bootstrap email already exists; no account was overwritten. Review the existing account manually.");
    user(AuthService.normalizeEmail(email),"Quản trị viên","ADMIN",password,null,"ACTIVE");
   }}
  if(!seed)return;
  String password=env.getRequiredProperty("campus.dev-seed.password");AuthService.checkPassword(password);
  users.jdbc().update("INSERT INTO campus.organization_units(name) VALUES('Đơn vị thử nghiệm I1') ON CONFLICT(name) DO NOTHING");
  long department=users.jdbc().queryForObject("SELECT id FROM campus.departments WHERE code='CSE'",Long.class),unit=users.jdbc().queryForObject("SELECT id FROM campus.organization_units WHERE name='Đơn vị thử nghiệm I1'",Long.class);
  user("admin.i1@example.test","Admin I1","ADMIN",password,null,"ACTIVE");user("admin2.i1@example.test","Admin 2 I1","ADMIN",password,null,"ACTIVE");
  long organizer=user("organizer.i1@example.test","Người tổ chức I1","ORGANIZER",password,unit,"ACTIVE");
  for(String prefix:List.of("student","locked")){
   long student=user(prefix+".i1@example.test",prefix.equals("student")?"Sinh viên I1":"Sinh viên bị khóa","STUDENT",password,null,prefix.equals("locked")?"LOCKED":"ACTIVE");
   users.jdbc().update("INSERT INTO campus.student_profiles(user_id,student_code,department_id,study_year) VALUES(?,?,?,2) ON CONFLICT(user_id) DO NOTHING",student,prefix.equals("student")?"I10001":"I10002",department);
  }
  for(String state:List.of("DRAFT","PUBLISHED")){
   String title="I1 - "+state;
   users.jdbc().update("INSERT INTO campus.events(organizer_id,organization_unit_id,title,description,location,registration_opens_at,registration_closes_at,starts_at,ends_at,capacity,status,published_at) SELECT ?,?,?,?,'Phòng thử nghiệm',clock_timestamp()-interval '1 day',clock_timestamp()+interval '6 days',clock_timestamp()+interval '7 days',clock_timestamp()+interval '7 days 2 hours',30,?,CASE WHEN ?='PUBLISHED' THEN clock_timestamp() ELSE NULL END WHERE NOT EXISTS(SELECT 1 FROM campus.events WHERE title=? AND organizer_id=?)",organizer,unit,title,"Dữ liệu giả lập I1",state,state,title,organizer);
  }
 }
}
