package vn.edu.hcmut.campusevents.users;
import java.util.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;
@Repository
public class AccountRepository {
 private final JdbcTemplate db;
 public JdbcTemplate jdbc(){return db;}
 public AccountRepository(JdbcTemplate db){this.db=db;}
 private static final String SELECT="SELECT u.*,p.student_code,p.department_id,p.study_year FROM campus.users u LEFT JOIN campus.student_profiles p ON p.user_id=u.id ";
 public static final RowMapper<PublicUser> PUBLIC=(rs,n)->new PublicUser(rs.getLong("id"),rs.getString("full_name"),rs.getString("email"),rs.getString("role"),rs.getString("status"),rs.getBoolean("must_change_password"),rs.getInt("version"),(Long)rs.getObject("organization_unit_id"),rs.getString("student_code"),(Long)rs.getObject("department_id"),rs.getObject("study_year")==null?null:rs.getInt("study_year"));
 public PublicUser find(long id){return db.query(SELECT+"WHERE u.id=?",PUBLIC,id).stream().findFirst().orElseThrow(()->new vn.edu.hcmut.campusevents.common.ApiException(404,"USER_NOT_FOUND","Không tìm thấy tài khoản."));}
 public Optional<PublicUser> email(String email){return db.query(SELECT+"WHERE u.email=?",PUBLIC,email).stream().findFirst();}
 public String hash(long id){return db.queryForObject("SELECT password_hash FROM campus.users WHERE id=?",String.class,id);}
 public int authVersion(long id){return db.queryForObject("SELECT auth_version FROM campus.users WHERE id=?",Integer.class,id);}
 public void adminLock(){db.queryForObject("SELECT pg_advisory_xact_lock(3011001)",(rs,n)->true);}
 public void lock(long id){db.queryForObject("SELECT id FROM campus.users WHERE id=? FOR UPDATE",Long.class,id);}
 public List<PublicUser> list(String q,int page,int size){String pattern="%"+q.replace("!","!!").replace("%","!%").replace("_","!_")+"%";return db.query(SELECT+"WHERE u.full_name ILIKE ? ESCAPE '!' OR u.email ILIKE ? ESCAPE '!' OR p.student_code ILIKE ? ESCAPE '!' ORDER BY u.id LIMIT ? OFFSET ?",PUBLIC,pattern,pattern,pattern,size+1,page*size);}
}
