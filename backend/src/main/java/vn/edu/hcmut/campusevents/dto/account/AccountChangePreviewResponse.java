package vn.edu.hcmut.campusevents.dto.account;

public record AccountChangePreviewResponse(
        AccountResponse before,
        String role,
        String status,
        Long organizationUnitId,
        String reason,
        boolean changed,
        String impact) {}
