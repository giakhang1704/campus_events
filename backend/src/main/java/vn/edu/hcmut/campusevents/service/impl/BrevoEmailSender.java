package vn.edu.hcmut.campusevents.service.impl;

import com.fasterxml.jackson.databind.ObjectMapper;

import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

import vn.edu.hcmut.campusevents.config.MailSettings;
import vn.edu.hcmut.campusevents.exception.EmailDeliveryException;
import vn.edu.hcmut.campusevents.model.OutboxMessage;
import vn.edu.hcmut.campusevents.service.IEmailSender;

import java.nio.charset.StandardCharsets;
import vn.edu.hcmut.campusevents.mapper.EmailTemplate;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class BrevoEmailSender implements IEmailSender {
    private final MailSettings settings;
    private final ObjectMapper json;
    private final RestClient client;
    private final EmailTemplate template;

    public BrevoEmailSender(MailSettings settings, ObjectMapper json, EmailTemplate template) {
        this.template = template;
        this.settings = settings;
        this.json = json;
        var factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(5000);
        factory.setReadTimeout(10000);
        client = RestClient.builder().baseUrl(settings.url()).requestFactory(factory).build();
    }

    @Override
    public String send(OutboxMessage m) {
        try {
            var p = json.readTree(m.payload());
            var content = template.render(m, p);
            String key =
                    UUID.nameUUIDFromBytes(m.dedupeKey().getBytes(StandardCharsets.UTF_8))
                            .toString();
            var result =
                    client.post()
                            .uri("/v3/smtp/email")
                            .header("api-key", settings.apiKey())
                            .header("idempotencyKey", key)
                            .body(
                                    Map.of(
                                            "sender",
                                            Map.of(
                                                    "email",
                                                    settings.senderEmail(),
                                                    "name",
                                                    settings.senderName()),
                                            "to",
                                            List.of(Map.of("email", m.recipient())),
                                            "subject",
                                            content.subject(),
                                            "textContent",
                                            content.text(),
                                            "htmlContent",
                                            content.html(),
                                            "headers",
                                            Map.of("idempotencyKey", key),
                                            "tags",
                                            List.of("BKevent", m.kind())))
                            .retrieve()
                            .body(com.fasterxml.jackson.databind.JsonNode.class);
            if (result == null || !result.hasNonNull("messageId"))
                throw new EmailDeliveryException("BREVO_MISSING_MESSAGE_ID", true);
            return result.get("messageId").asText();
        } catch (RestClientResponseException e) {
            // No response body/headers in logs or last_error: they can contain credentials or
            // personal data.
            if (e.getStatusCode().value() == 400 && duplicateResponse(e.getResponseBodyAsString()))
                return "deduplicated";
            throw new EmailDeliveryException(
                    "BREVO_HTTP_" + e.getStatusCode().value(),
                    e.getStatusCode().value() == 429 || e.getStatusCode().is5xxServerError());
        } catch (ResourceAccessException e) {
            throw new EmailDeliveryException("BREVO_NETWORK_ERROR", true);
        } catch (EmailDeliveryException e) {
            throw e;
        } catch (Exception e) {
            throw new EmailDeliveryException("INVALID_EMAIL_PAYLOAD", false);
        }
    }

    private boolean duplicateResponse(String response) {
        try {
            return json.readTree(response).path("code").asText().equals("duplicate_parameter");
        } catch (Exception ignored) {
            return false;
        }
    }
}
