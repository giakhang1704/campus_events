package vn.edu.hcmut.campusevents.exception;

public class EmailDeliveryException extends RuntimeException {
    private final boolean retryable;

    public EmailDeliveryException(String safeCode, boolean retryable) {
        super(safeCode);
        this.retryable = retryable;
    }

    public boolean retryable() {
        return retryable;
    }
}
