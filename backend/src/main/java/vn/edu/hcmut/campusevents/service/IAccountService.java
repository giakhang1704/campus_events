package vn.edu.hcmut.campusevents.service;

import vn.edu.hcmut.campusevents.dto.account.*;
import vn.edu.hcmut.campusevents.security.AuthPrincipal;

public interface IAccountService {
    AccountPageResponse list(String query, String role, String status, int page, int size);

    AccountResponse create(AuthPrincipal actor, CreateOrganizerRequest request);

    AccountChangePreviewResponse previewStatus(
            AuthPrincipal actor, long id, ChangeAccountStatusRequest request);

    AccountResponse status(AuthPrincipal actor, long id, ChangeAccountStatusRequest request);
}
