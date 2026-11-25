package vn.edu.hcmut.campusevents.exception;

public class RateLimitException extends ApiException {
    public final long retryAfterSeconds;

    public RateLimitException(long retryAfterSeconds) {
        super(429, "RATE_LIMITED", "Bạn đã thử quá nhiều lần. Vui lòng chờ rồi thử lại.");
        this.retryAfterSeconds = Math.max(1, retryAfterSeconds);
    }
}
