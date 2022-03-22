package space.pxls.util;

import com.google.gson.JsonElement;
import com.google.gson.JsonParser;
import io.undertow.server.HttpHandler;
import io.undertow.server.HttpServerExchange;
import io.undertow.server.handlers.BlockingHandler;
import io.undertow.util.AttachmentKey;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.Objects;
import java.util.stream.Collectors;

/**
 * A {@link HttpHandler} which attaches an {@link AttachmentKey} containing the
 *  request body's {@link JsonElement}, or {@code null} on parse failure.
 *  Chains through a {@link BlockingHandler}.
 *
 * @see JsonParser
 * @see BlockingHandler
 */
public class JsonReader implements HttpHandler {
    public static AttachmentKey<JsonElement> ATTACHMENT_KEY = AttachmentKey.create(JsonElement.class);
    private HttpHandler next;

    public JsonReader(HttpHandler next) {
        this.next = Objects.requireNonNull(next);
    }

    @Override
    public void handleRequest(HttpServerExchange exchange) throws Exception {
        new BlockingHandler(exchange1 -> { // we need to move into an nio thread. BlockingHandler will execute immediately if we're already in one.
            try {
                exchange1.putAttachment(JsonReader.ATTACHMENT_KEY, JsonParser.parseString(new BufferedReader(new InputStreamReader(exchange1.startBlocking().getInputStream(), StandardCharsets.UTF_8)).lines().collect(Collectors.joining(System.lineSeparator()))));
            } catch (Exception e) {
                /* probably a syntax error. not our problem */
            } finally { // ensure no matter what we continue the handler chain.
                next.handleRequest(exchange1);
            }
        }).handleRequest(exchange);
    }
}
