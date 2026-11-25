package vn.edu.hcmut.campusevents.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public class MailSettings {
    private final boolean enabled, allowTestRecipients;
    private final String apiKey, senderEmail, senderName, url;
    private final int maxAttempts;

    public MailSettings(
            @Value("${campus.mail.enabled:false}") boolean enabled,
            @Value("${campus.mail.api-key:}") String apiKey,
            @Value("${campus.mail.sender-email:}") String senderEmail,
            @Value("${campus.mail.sender-name:BKevent}") String senderName,
            @Value("${campus.mail.brevo-url:https://api.brevo.com}") String url,
            @Value("${campus.mail.max-attempts:5}") int maxAttempts,
            @Value("${campus.mail.allow-test-recipients:false}") boolean allowTestRecipients) {
        this.allowTestRecipients = allowTestRecipients;
        this.enabled = enabled;
        this.apiKey = apiKey;
        this.senderEmail = senderEmail;
        this.senderName = senderName;
        this.url = url;
        this.maxAttempts = maxAttempts;
        if (maxAttempts < 1 || maxAttempts > 10)
            throw new IllegalStateException("MAIL_MAX_ATTEMPTS must be 1..10");
        if (enabled && (apiKey.isBlank() || senderEmail.isBlank()))
            throw new IllegalStateException(
                    "Enabled email requires Brevo key and verified sender configuration");
    }

    public boolean allowTestRecipients() {
        return allowTestRecipients;
    }

    public boolean enabled() {
        return enabled;
    }

    public String apiKey() {
        return apiKey;
    }

    public String senderEmail() {
        return senderEmail;
    }

    public String senderName() {
        return senderName;
    }

    public String url() {
        return url;
    }

    public int maxAttempts() {
        return maxAttempts;
    }
}
