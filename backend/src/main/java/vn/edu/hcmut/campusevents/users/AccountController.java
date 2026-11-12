package vn.edu.hcmut.campusevents.users;
import java.util.*;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;
import vn.edu.hcmut.campusevents.auth.AuthPrincipal;
@RestController @Validated @RequestMapping("/api/admin/users")
public class AccountController {
 private final AccountRepository users;private final AccountService service;
 public AccountController(AccountRepository u,AccountService s){users=u;service=s;}
 public record Create(@NotBlank @Size(max=150)String fullName,@NotBlank @Email @Size(max=254)String email,@NotBlank @Size(min=8,max=72)String temporaryPassword,@NotNull @Positive Long organizationUnitId,@NotBlank @Size(max=1000)String reason){}
 public record Status(@NotNull @Pattern(regexp="ACTIVE|LOCKED")String status,@Min(1)int version,@NotBlank @Size(max=1000)String reason){}
 @GetMapping Map<String,Object> list(@RequestParam(defaultValue="") @Size(max=100)String q,@RequestParam(defaultValue="") @Pattern(regexp="|STUDENT|ORGANIZER|ADMIN")String role,@RequestParam(defaultValue="") @Pattern(regexp="|ACTIVE|LOCKED")String status,@RequestParam(defaultValue="0") @Min(0) @Max(100000)int page,@RequestParam(defaultValue="20") @Min(1) @Max(100)int size){var items=users.list(q,role,status,page,size);return Map.of("items",items.size()>size?items.subList(0,size):items,"page",page,"size",size,"hasNext",items.size()>size);}
 @PostMapping("/{id}/status/preview") AccountService.ChangePreview previewStatus(@AuthenticationPrincipal AuthPrincipal p,@PathVariable long id,@Valid @RequestBody Status r){return service.previewStatus(p,id,r.status,r.version,r.reason);}
 @PostMapping ResponseEntity<PublicUser> create(@AuthenticationPrincipal AuthPrincipal p,@Valid @RequestBody Create r){return ResponseEntity.status(201).body(service.create(p,r.fullName,r.email,r.temporaryPassword,r.organizationUnitId,r.reason));}
 @PatchMapping("/{id}/status") PublicUser status(@AuthenticationPrincipal AuthPrincipal p,@PathVariable long id,@Valid @RequestBody Status r){return service.status(p,id,r.status,r.version,r.reason);}
}
