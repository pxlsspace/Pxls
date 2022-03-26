package space.pxls.util;

import kong.unirest.HttpResponse;
import kong.unirest.Unirest;

/**
 * A simple Discord webhook builder. Used for basic text webhooks, doesn't provide support for more advanced things like file uploads.
 */
public class SimpleDiscordWebhook {
    private String webhookURL = "";
    private WebhookPayload payload = new WebhookPayload();

    private SimpleDiscordWebhook(String webhookURL) {
        this.webhookURL = webhookURL;
    }

    public static SimpleDiscordWebhook forWebhookURL(String url) {
        return new SimpleDiscordWebhook(url);
    }

    public SimpleDiscordWebhook content(String content) {
        if (content.length() > 2000) content = content.substring(0, 1997).concat("...");
        this.payload.content = content;
        return this;
    }

    public boolean execute() {
        try {
            HttpResponse<String> response = Unirest.post(this.webhookURL)
                    .header("User-Agent", "pxls.space")
                    .field("content", payload.content)
                    .asString();
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    private static class WebhookPayload {
        public String content = "";
    }
}
