package vn.edu.hcmut.campusevents.common;
import java.util.Map;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.*;
@RestControllerAdvice
public class ApiErrors {
 @ExceptionHandler(ApiException.class) ResponseEntity<?> api(ApiException e){return ResponseEntity.status(e.status).body(Map.of("code",e.code,"message",e.getMessage()));}
 @ExceptionHandler(MethodArgumentNotValidException.class) ResponseEntity<?> validation(MethodArgumentNotValidException e){return ResponseEntity.badRequest().body(Map.of("code","VALIDATION_ERROR","message","Dữ liệu không hợp lệ.","fields",e.getBindingResult().getFieldErrors().stream().map(f->f.getField()+": "+f.getDefaultMessage()).toList()));}
 @ExceptionHandler(org.springframework.http.converter.HttpMessageNotReadableException.class) ResponseEntity<?> malformed(Exception e){return ResponseEntity.badRequest().body(Map.of("code","INVALID_JSON","message","JSON hoặc kiểu dữ liệu không hợp lệ."));}
 @ExceptionHandler({jakarta.validation.ConstraintViolationException.class,org.springframework.web.method.annotation.HandlerMethodValidationException.class}) ResponseEntity<?> parameters(Exception e){return ResponseEntity.badRequest().body(Map.of("code","VALIDATION_ERROR","message","Tham số truy vấn không hợp lệ."));}
 @ExceptionHandler(DataIntegrityViolationException.class) ResponseEntity<?> conflict(Exception e){return ResponseEntity.status(409).body(Map.of("code","DATA_CONFLICT","message","Dữ liệu bị trùng hoặc tham chiếu không còn hợp lệ."));}
}