package vn.edu.hcmut.campusevents.common;
import java.util.Map;
import java.util.stream.Collectors;
import org.springframework.dao.DataAccessException;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.*;
@RestControllerAdvice
public class ApiErrors {
 @ExceptionHandler(ApiException.class) ResponseEntity<?> api(ApiException e){return ResponseEntity.status(e.status).body(Map.of("code",e.code,"message",e.getMessage(),"fields",e.fields));}
 @ExceptionHandler(MethodArgumentNotValidException.class) ResponseEntity<?> validation(MethodArgumentNotValidException e){return ResponseEntity.badRequest().body(Map.of("code","VALIDATION_ERROR","message","Vui lòng kiểm tra các trường được đánh dấu.","fields",e.getBindingResult().getFieldErrors().stream().collect(Collectors.toMap(f->f.getField(),f->"Giá trị không hợp lệ hoặc còn thiếu.",(a,b)->a))));}
 @ExceptionHandler(org.springframework.http.converter.HttpMessageNotReadableException.class) ResponseEntity<?> malformed(Exception e){return ResponseEntity.badRequest().body(Map.of("code","INVALID_JSON","message","JSON hoặc kiểu dữ liệu không hợp lệ."));}
 @ExceptionHandler(org.springframework.web.method.annotation.MethodArgumentTypeMismatchException.class)
 ResponseEntity<?> parameterType(org.springframework.web.method.annotation.MethodArgumentTypeMismatchException e){
  return ResponseEntity.badRequest().body(Map.of("code","INVALID_PARAMETER","message","Tham số truy vấn hoặc đường dẫn không hợp lệ.","fields",Map.of(e.getName(),"Giá trị không đúng kiểu dữ liệu.")));
 }
 @ExceptionHandler({jakarta.validation.ConstraintViolationException.class,org.springframework.web.method.annotation.HandlerMethodValidationException.class}) ResponseEntity<?> parameters(Exception e){return ResponseEntity.badRequest().body(Map.of("code","VALIDATION_ERROR","message","Tham số truy vấn không hợp lệ."));}
 @ExceptionHandler(DataIntegrityViolationException.class) ResponseEntity<?> conflict(Exception e){return ResponseEntity.status(409).body(Map.of("code","DATA_CONFLICT","message","Dữ liệu bị trùng hoặc tham chiếu không còn hợp lệ."));}
 @ExceptionHandler(DuplicateKeyException.class) ResponseEntity<?> duplicate(DuplicateKeyException e){
  String detail=e.getMostSpecificCause().getMessage();
  if(detail!=null&&detail.contains("users_email_key"))return api(new ApiException(409,"EMAIL_EXISTS","Email đã có tài khoản. Hãy đăng nhập hoặc liên hệ quản trị viên. Mỗi tài khoản giữ một vai trò cố định.",Map.of("email","Email đã được sử dụng.")));
  if(detail!=null&&detail.contains("student_profiles_student_code_key"))return api(new ApiException(409,"STUDENT_CODE_EXISTS","MSSV đã có tài khoản. Hãy đăng nhập hoặc liên hệ quản trị viên.",Map.of("studentCode","MSSV đã được sử dụng.")));
  return conflict(e);
 }
 @ExceptionHandler(DataAccessException.class) ResponseEntity<?> unavailable(DataAccessException e){return ResponseEntity.status(503).body(Map.of("code","SERVICE_UNAVAILABLE","message","Dịch vụ dữ liệu tạm thời gián đoạn. Vui lòng thử lại."));}
}
