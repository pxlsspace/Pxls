package space.pxls.server;

import com.google.gson.JsonObject;
import com.mashape.unirest.http.exceptions.UnirestException;
import io.undertow.server.HttpServerExchange;
import io.undertow.server.handlers.Cookie;
import io.undertow.server.handlers.CookieImpl;
import io.undertow.server.handlers.form.FormData;
import io.undertow.server.handlers.form.FormDataParser;
import io.undertow.server.handlers.resource.ClassPathResourceManager;
import io.undertow.util.Headers;
import io.undertow.util.HttpString;
import io.undertow.util.StatusCodes;
import space.pxls.App;
import space.pxls.auth.*;
import space.pxls.data.DBChatMessage;
import space.pxls.data.DBNotification;
import space.pxls.data.DBPixelPlacement;
import space.pxls.data.DBPixelPlacementUser;
import space.pxls.server.packets.http.*;
import space.pxls.server.packets.http.Error;
import space.pxls.server.packets.socket.*;
import space.pxls.user.Chatban;
import space.pxls.user.Role;
import space.pxls.user.User;
import space.pxls.util.AuthReader;
import space.pxls.util.IPReader;
import space.pxls.util.RateLimitFactory;
import space.pxls.util.SimpleDiscordWebhook;

import java.io.*;
import java.net.URLEncoder;
import java.nio.ByteBuffer;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;

public class WebHandler {
    private String fileToString (File f) {
        try {
            BufferedReader br = new BufferedReader(new FileReader(f));
            String s = "";
            String line;
            while ((line = br.readLine()) != null) {
                s += line + "\n";
            }
            br.close();
            return s;
        } catch (IOException e) {
            return "";
        }
    }
    private String fileToString (String s) {
        return fileToString(new File(s));
    }
    private String resourceToString (String r) {
        try {
            InputStream in = getClass().getResourceAsStream(r); 
            BufferedReader br = new BufferedReader(new InputStreamReader(in));
            String s = "";
            String line;
            while ((line = br.readLine()) != null) {
                s += line + "\n";
            }
            return s;
        } catch (IOException e) {
            return "";
        }
    }
    public void index(HttpServerExchange exchange) {
        File index_cache = new File(App.getStorageDir().resolve("index_cache.html").toString());
        if (index_cache.exists()) {
            exchange.getResponseHeaders().put(Headers.CONTENT_TYPE, "text/html");
            exchange.getResponseSender().send(fileToString(index_cache));
            return;
        }
        ClassPathResourceManager cprm = new ClassPathResourceManager(App.class.getClassLoader(), "public/");
        String s = resourceToString("/public/index.html");
        String[] replacements = {"title", "head", "info", "faq"};
        for (String p : replacements) {
            String r = App.getConfig().getString("html." + p);
            if (r == null) {
                r = "";
            }
            if (r.startsWith("resource:")) {
                r = resourceToString(r.substring(9));
            } else if (r.startsWith("file:")) {
                r = fileToString(App.getStorageDir().resolve(r.substring(5)).toString());
            }
            s = s.replace("{{" + p + "}}", r);
        }
        try {
            FileWriter fw = new FileWriter(index_cache);
            fw.write(s);
            fw.flush();
            fw.close();
            index(exchange); // we created the file, now output it!
        } catch (IOException e) {
            exchange.getResponseHeaders().put(Headers.CONTENT_TYPE, "text/html");
            exchange.getResponseSender().send("error");
            return;
        }
    }


    private Map<String, AuthService> services = new ConcurrentHashMap<>();

    private void addServiceIfAvailable(String key, AuthService service) {
        if (service.use()) {
            services.put(key, service);
        }
    }

    {
        addServiceIfAvailable("reddit", new RedditAuthService("reddit"));
        addServiceIfAvailable("google", new GoogleAuthService("google"));
        addServiceIfAvailable("discord", new DiscordAuthService("discord"));
        addServiceIfAvailable("vk", new VKAuthService("vk"));
        addServiceIfAvailable("tumblr", new TumblrAuthService("tumblr"));
    }

    private String getBanReason(HttpServerExchange exchange) {
        FormData data = exchange.getAttachment(FormDataParser.FORM_DATA);
        FormData.FormValue reason = data.getFirst("reason");
        String reason_str = "";
        if (reason != null) {
            reason_str = reason.getValue();
        }
        return reason_str;
    }

    private int getRollbackTime(HttpServerExchange exchange) {
        FormData data = exchange.getAttachment(FormDataParser.FORM_DATA);
        FormData.FormValue rollback = data.getFirst("rollback_time");
        String rollback_int = "0";
        if (rollback != null) {
            rollback_int = rollback.getValue();
        }
        return Integer.parseInt(rollback_int);
    }

    private boolean doLog(HttpServerExchange exchange) {
        FormData.FormValue nolog = exchange.getAttachment(FormDataParser.FORM_DATA).getFirst("nolog");
        return nolog == null;
    }

    private void setAuthCookie(HttpServerExchange exchange, String loginToken, int days) {
        Calendar cal2 = Calendar.getInstance();
        cal2.add(Calendar.DATE, -1);
        exchange.setResponseCookie(new CookieImpl("pxls-token", loginToken).setPath("/").setExpires(cal2.getTime()));
        Calendar cal = Calendar.getInstance();
        cal.add(Calendar.DATE, days);
        String hostname = App.getConfig().getString("host");
        exchange.setResponseCookie(new CookieImpl("pxls-token", loginToken).setHttpOnly(true).setPath("/").setDomain("." + hostname).setExpires(cal.getTime()));
        exchange.setResponseCookie(new CookieImpl("pxls-token", loginToken).setHttpOnly(true).setPath("/").setDomain(hostname).setExpires(cal.getTime()));
    }

    public void ban(HttpServerExchange exchange) {
        User user = parseUserFromForm(exchange);
        User user_perform = exchange.getAttachment(AuthReader.USER);
        if (user != null && user.getRole().lessThan(user_perform.getRole())) {
            String time = "86400";
            FormData data = exchange.getAttachment(FormDataParser.FORM_DATA);
            FormData.FormValue time_form = data.getFirst("time");
            if (time_form != null) {
                time = time_form.getValue();
            }
            if (doLog(exchange)) {
                App.getDatabase().insertAdminLog(user_perform.getId(), String.format("ban %s with reason: %s", user.getName(), getBanReason(exchange)));
            }
            user.ban(Integer.parseInt(time), getBanReason(exchange), getRollbackTime(exchange), user_perform);
            exchange.getResponseHeaders().put(Headers.CONTENT_TYPE, "application/text");
            exchange.setStatusCode(200);
        } else {
            exchange.setStatusCode(400);
        }
    }

    public void unban(HttpServerExchange exchange) {
        User user_perform = exchange.getAttachment(AuthReader.USER);
        FormData data = exchange.getAttachment(FormDataParser.FORM_DATA);
        if (data.contains("username")) {
            User unbanTarget = App.getUserManager().getByName(data.getFirst("username").getValue());
            if (unbanTarget != null) {
                String reason = "";
                if (data.contains("reason")) {
                    reason = data.getFirst("reason").getValue();
                }
                unbanTarget.unban(user_perform, reason);
                if (doLog(exchange)) {
                    App.getDatabase().insertAdminLog(user_perform.getId(), String.format("unban %s with reason %s", unbanTarget.getName(), reason.isEmpty() ? "(no reason provided)" : reason));
                }
                send(200, exchange, "User unbanned");
            } else {
                sendBadRequest(exchange, "Invalid user specified");
            }
        } else {
            sendBadRequest(exchange, "Missing username field");
        }
    }

    public void permaban(HttpServerExchange exchange) {
        User user = parseUserFromForm(exchange);
        User user_perform = exchange.getAttachment(AuthReader.USER);
        if (user != null && user.getRole().lessThan(user_perform.getRole())) {
            user.permaban(getBanReason(exchange), getRollbackTime(exchange), user_perform);
            exchange.getResponseHeaders().put(Headers.CONTENT_TYPE, "application/text");
            if (doLog(exchange)) {
                App.getDatabase().insertAdminLog(user_perform.getId(), String.format("permaban %s with reason: %s", user.getName(), getBanReason(exchange)));
            }
            exchange.setStatusCode(200);
        } else {
            exchange.setStatusCode(400);
        }
    }

    public void shadowban(HttpServerExchange exchange) {
        User user = parseUserFromForm(exchange);
        User user_perform = exchange.getAttachment(AuthReader.USER);
        if (user != null && user.getRole().lessThan(user_perform.getRole())) {
            user.shadowban(getBanReason(exchange), getRollbackTime(exchange), user_perform);
            exchange.getResponseHeaders().put(Headers.CONTENT_TYPE, "application/text");
            if (doLog(exchange)) {
                App.getDatabase().insertAdminLog(user_perform.getId(), String.format("shadowban %s with reason: %s", user.getName(), getBanReason(exchange)));
            }
            exchange.setStatusCode(200);
        } else {
            exchange.setStatusCode(400);
        }
    }

    public void chatReport(HttpServerExchange exchange) {
        exchange.getResponseHeaders().put(Headers.CONTENT_TYPE, "application/json");

        User user = exchange.getAttachment(AuthReader.USER);
        if (user == null) {
            sendBadRequest(exchange);
            return;
        }

        if (user.isBanned()) {
            sendBadRequest(exchange);
            return;
        }

        FormData data = exchange.getAttachment(FormDataParser.FORM_DATA);
        FormData.FormValue chatNonce = null;
        FormData.FormValue reportMessage = null;

        try {
            chatNonce = data.getFirst("nonce");
            reportMessage = data.getFirst("report_message");
        } catch (NullPointerException npe) {
            sendBadRequest(exchange);
            return;
        }

        if (chatNonce == null) {
            sendBadRequest(exchange);
            return;
        }

        DBChatMessage chatMessage = App.getDatabase().getChatMessageByNonce(chatNonce.getValue());
        if (chatMessage == null || reportMessage == null) {
            sendBadRequest(exchange);
            return;
        }

        String _reportMessage = reportMessage.getValue().trim();
        if (_reportMessage.length() > 2048) _reportMessage = _reportMessage.substring(0, 2048);
        App.getDatabase().insertChatReport(chatMessage.nonce, chatMessage.author_uid, user.getId(), _reportMessage);

        exchange.setStatusCode(200);
        exchange.getResponseSender().send("{}");
        exchange.endExchange();
    }

    public void chatban(HttpServerExchange exchange) {
        User user = exchange.getAttachment(AuthReader.USER);
        if (user == null) {
            sendBadRequest(exchange);
            return;
        }
        if (user.isBanned() || user.getRole().lessEqual(Role.USER)) {
            sendBadRequest(exchange);
            return;
        }
        FormData data = exchange.getAttachment(FormDataParser.FORM_DATA);

        FormData.FormValue nonceData;
        FormData.FormValue whoData;
        FormData.FormValue typeData;
        FormData.FormValue reasonData;
        FormData.FormValue removalData;
        FormData.FormValue banlengthData;

        String nonce = "";
        String who = "";
        String type = "";
        String reason = "";
        Integer removal = 0;
        Integer banLength = 0;

        boolean isPerma = false,
                isUnban = false;

        try {
            nonceData = data.getFirst("nonce");
            whoData = data.getFirst("who");
            typeData = data.getFirst("type");
            reasonData = data.getFirst("reason");
            removalData = data.getFirst("removalAmount");
            banlengthData = data.getFirst("banLength");
        } catch (NullPointerException npe) {
            sendBadRequest(exchange);
            return;
        }

        if (nonceData == null && whoData == null) {
            sendBadRequest(exchange);
            return;
        }

        if (typeData == null || reasonData == null || removalData == null || banlengthData == null) {
            sendBadRequest(exchange);
            return;
        }

        try {
            nonce = nonceData == null ? null : nonceData.getValue();
            who = whoData == null ? null : whoData.getValue();
            type = typeData.getValue();
            reason = reasonData.getValue();
            removal = Integer.parseInt(removalData.getValue());
            banLength = Integer.parseInt(banlengthData.getValue());
        } catch (Exception e) {
            sendBadRequest(exchange);
            return;
        }

        isPerma = type.trim().equalsIgnoreCase("perma");
        isUnban = type.trim().equalsIgnoreCase("unban");
        User target = null;

        if (nonce != null) {
            DBChatMessage chatMessage = App.getDatabase().getChatMessageByNonce(nonce);
            if (chatMessage == null) {
                sendBadRequest(exchange);
                return;
            }

            target = App.getUserManager().getByID(chatMessage.author_uid);
        } else if (who != null) {
            target = App.getUserManager().getByName(who);
        }

        if (target == null) {
            sendBadRequest(exchange);
            return;
        }

        boolean _removal = removal == -1 || removal > 0;

        Chatban chatban;
        if (isUnban) {
            chatban = Chatban.UNBAN(target, user, reason);
        } else {
            chatban = isPerma ?
                    Chatban.PERMA(target, user, reason, _removal, removal == -1 ? Integer.MAX_VALUE : removal) :
                    Chatban.TEMP(target, user, System.currentTimeMillis() + (banLength * 1000L), reason, _removal, removal == -1 ? Integer.MAX_VALUE : removal);
        }

        chatban.commit();

        exchange.getResponseHeaders().put(Headers.CONTENT_TYPE, "application/json");
        exchange.setStatusCode(200);
        exchange.getResponseSender().send("{}");
        exchange.endExchange();
    }

    public void deleteChatMessage(HttpServerExchange exchange) {
        exchange.getResponseHeaders().put(Headers.CONTENT_TYPE, "application/json");

        User user = exchange.getAttachment(AuthReader.USER);
        if (user == null) {
            send(StatusCodes.FORBIDDEN, exchange, "");
            return;
        }

        if (user.isBanned()) {
            send(StatusCodes.FORBIDDEN, exchange, "");
            return;
        }

        FormData data = exchange.getAttachment(FormDataParser.FORM_DATA);
        FormData.FormValue chatNonce = null;
        String reason = null;

        try {
            chatNonce = data.getFirst("nonce");
        } catch (NullPointerException npe) {
            sendBadRequest(exchange, "Message nonce invalid/missing");
            return;
        }

        if (chatNonce == null) {
            sendBadRequest(exchange, "Message nonce missing");
            return;
        }

        DBChatMessage chatMessage = App.getDatabase().getChatMessageByNonce(chatNonce.getValue());
        if (chatMessage == null) {
            sendBadRequest(exchange, "Message didn't exist");
            return;
        }

        User author = App.getUserManager().getByID(chatMessage.author_uid);
        if (author == null) {
            sendBadRequest(exchange, "Author was null");
            return;
        }

        try {
            FormData.FormValue formReason = data.getFirst("reason");
            reason = formReason.getValue();
        } catch (NullPointerException npe) {
            reason = "";
        }

        App.getDatabase().purgeChat(author, user, chatMessage.nonce, reason, true);

        send(StatusCodes.OK, exchange, "");
    }

    public void chatPurge(HttpServerExchange exchange) {
        exchange.getResponseHeaders().put(Headers.CONTENT_TYPE, "application/json");

        User user = exchange.getAttachment(AuthReader.USER);
        if (user == null) {
            sendBadRequest(exchange);
            return;
        }

        if (user.isBanned()) {
            sendBadRequest(exchange);
            return;
        }

        FormData data = exchange.getAttachment(FormDataParser.FORM_DATA);
        FormData.FormValue targetData = null;
        FormData.FormValue reasonData = null;

        try {
            targetData = data.getFirst("who");
            reasonData = data.getFirst("reason");
        } catch (NullPointerException npe) {
            sendBadRequest(exchange);
            return;
        }

        if (targetData == null) {
            sendBadRequest(exchange);
            return;
        }

        User target = App.getUserManager().getByName(targetData.getValue());
        if (target == null) {
            sendBadRequest(exchange);
            return;
        }

        String purgeReason = "$No reason provided.";
        if (data.contains("reason")) {
            purgeReason = data.getFirst("reason").getValue();
        }

        App.getDatabase().purgeChat(target, user, Integer.MAX_VALUE, reasonData.getValue(), true);

        exchange.setStatusCode(200);
        exchange.getResponseSender().send("{}");
        exchange.endExchange();
    }

    public void forceNameChange(HttpServerExchange exchange) { //this is the admin endpoint which targets another user.
        exchange.getResponseHeaders().put(Headers.CONTENT_TYPE, "application/json");
        User user = exchange.getAttachment(AuthReader.USER);
        if (user == null) {
            sendBadRequest(exchange, "No authenticated users found");
            return;
        }

        FormData data = exchange.getAttachment(FormDataParser.FORM_DATA);
        String userName = null;
        String newName = null;
        try {
            userName = data.getFirst("user").getValue();
            newName = data.getFirst("newName").getValue();
        } catch (Exception npe) {
            sendBadRequest(exchange, "Missing either 'user' or 'newName' fields");
            return;
        }

        if (!validateUsername(userName)) {
            sendBadRequest(exchange, "Username failed validation");
            return;
        }

        User toUpdate = App.getUserManager().getByName(userName);
        if (toUpdate == null) {
            sendBadRequest(exchange, "Invalid user provided");
            return;
        }

        String oldName = toUpdate.getName();
        if (toUpdate.updateUsername(newName, true)) {
            App.getDatabase().insertAdminLog(user.getId(), String.format("Changed %s's name to %s (uid: %d)", oldName, newName, toUpdate.getId()));
            toUpdate.setRenameRequested(false);
            App.getServer().send(toUpdate, new ServerRenameSuccess(toUpdate.getName()));
            exchange.setStatusCode(200);
            exchange.getResponseSender().send("{}");
            exchange.endExchange();
        } else {
            sendBadRequest(exchange, "Failed to update username. Possible reasons for this include the new username is already taken, the user being updated was not flagged for rename, or an internal error occurred.");
        }
    }

    public void execNameChange(HttpServerExchange exchange) { //this is the endpoint for normal users
        exchange.getResponseHeaders().put(Headers.CONTENT_TYPE, "application/json");
        User user = exchange.getAttachment(AuthReader.USER);
        if (user == null) {
            sendBadRequest(exchange, "No authenticated users found");
            return;
        }
        FormData data = exchange.getAttachment(FormDataParser.FORM_DATA);
        String newName = null;
        try {
            newName = data.getFirst("newName").getValue();
        } catch (Exception npe) {
            sendBadRequest(exchange, "Missing either 'user' or 'newName' fields");
            return;
        }

        if (!validateUsername(newName)) {
            sendBadRequest(exchange, "Username failed validation");
            return;
        }

        String oldName = user.getName();
        if (user.updateUsername(newName)) {
            App.getDatabase().insertServerReport(user.getId(), String.format("User %s just changed their name to %s.", oldName, user.getName()));
            user.setRenameRequested(false);
            App.getServer().send(user, new ServerRenameSuccess(user.getName()));
            exchange.setStatusCode(200);
            exchange.getResponseSender().send("{}");
            exchange.endExchange();
        } else {
            sendBadRequest(exchange, "Failed to update username. Possible reasons for this include the new username is already taken, the user being updated was not flagged for rename, or an internal error occurred.");
        }
    }

    public void flagNameChange(HttpServerExchange exchange) {
        exchange.getResponseHeaders().put(Headers.CONTENT_TYPE, "application/json");
        User user = exchange.getAttachment(AuthReader.USER);
        if (user == null) {
            sendBadRequest(exchange, "No authenticated user could be found");
            return;
        }

        FormData data = exchange.getAttachment(FormDataParser.FORM_DATA);
        String userName = null;
        boolean isRequested = true;
        try {
            userName = data.getFirst("user").getValue();
        } catch (Exception npe) {
            npe.printStackTrace();
            sendBadRequest(exchange, "Missing 'user' field");
            return;
        }
        try {
            isRequested = data.getFirst("flagState").getValue().equalsIgnoreCase("true");
        } catch (Exception e) {
            //ignored
        }

        User toFlag = App.getUserManager().getByName(userName);
        if (toFlag == null) {
            sendBadRequest(exchange, "Invalid user provided");
            return;
        }

        toFlag.setRenameRequested(isRequested);
        App.getDatabase().insertAdminLog(user.getId(), String.format("Flagged %s (%d) for name change", toFlag.getName(), toFlag.getId()));

        exchange.setStatusCode(200);
        exchange.getResponseSender().send("{}");
        exchange.endExchange();
    }

    public void discordNameChange(HttpServerExchange exchange) {
        exchange.getResponseHeaders().put(Headers.CONTENT_TYPE, "application/json");
        User user = exchange.getAttachment(AuthReader.USER);
        if (user == null) {
            sendBadRequest(exchange, "No authenticated user could be found");
            return;
        }

        FormData data = exchange.getAttachment(FormDataParser.FORM_DATA);
        String discordName = null;
        try {
            discordName = data.getFirst("discordName").getValue();
            if (discordName.equalsIgnoreCase("")) {
                discordName = null;
            }
        } catch (Exception npe) {
            npe.printStackTrace();
            sendBadRequest(exchange, "Missing 'discordName' field");
            return;
        }
        boolean isDeleteRequest = discordName == null;

        if (isDeleteRequest && user.getDiscordName() == null) {
            send(StatusCodes.CONFLICT, exchange, "Discord name is already unset.");
            return;
        }

        if (!isDeleteRequest && user.getDiscordName() != null && user.getDiscordName().equals(discordName)) {
            send(StatusCodes.CONFLICT, exchange, "Discord name is already set to the requested name.");
            return;
        }

        if (discordName != null && !discordName.matches("^.{2,32}#\\d{4}$")) {
            sendBadRequest(exchange, "name isn't in the format '{name}#{discriminator}'");
            return;
        }

        if (discordName == null) { //user is deleting name, bypass ratelimit check
            user.setDiscordName(null);
            send(StatusCodes.OK, exchange, "Name removed");
        } else {
            int remaining = RateLimitFactory.getTimeRemaining("http:discordName", exchange.getAttachment(IPReader.IP));
            if (remaining == 0) {
                user.setDiscordName(discordName);
                send(StatusCodes.OK, exchange, "Name updated");
            } else {
                send(StatusCodes.TOO_MANY_REQUESTS, exchange, "Hit max attempts. Try again in " + remaining + "s");
            }
        }
    }

    public void createNotification(HttpServerExchange exchange) {
        exchange.getResponseHeaders().put(Headers.CONTENT_TYPE, "application/json");

        User user = exchange.getAttachment(AuthReader.USER);
        if (user == null) {
            sendBadRequest(exchange, "No authenticated users found");
            return;
        }
        if (user.getRole().lessThan(Role.DEVELOPER)) {
            send(StatusCodes.FORBIDDEN, exchange, "Invalid permissions");
            return;
        }
        FormData data = exchange.getAttachment(FormDataParser.FORM_DATA);
        String title = null;
        String body = null;
        Long expiry = 0L;
        boolean discord = false;
        try {
            title = data.getFirst("txtTitle").getValue();
            body = data.getFirst("txtBody").getValue();
            expiry = 0L;
        } catch (Exception npe) {
            sendBadRequest(exchange, "Missing either 'txtTitle' or 'txtBody' fields");
            return;
        }
        if (data.contains("discord")) {
            try {
                discord = data.getFirst("discord").getValue().trim().equalsIgnoreCase("true");
            } catch (Exception e) {
                sendBadRequest(exchange, "Invalid discord value");
                return;
            }
        }
        if (data.contains("expiry")) {
            try {
                expiry = Long.parseLong(data.getFirst("expiry").getValue().trim());
            } catch (Exception e) {
                sendBadRequest(exchange, "Invalid expiry value");
                return;
            }
        }
        try {
            int notifID = App.getDatabase().createNotification(user.getId(), title, body, Instant.ofEpochMilli(expiry).getEpochSecond());
            App.getServer().broadcast(new ServerNotification(App.getDatabase().getNotification(notifID))); //re-fetch to ensure we're returning exact time and expiry 'n whatnot from the database.
        } catch (Exception e) {
            e.printStackTrace();
            send(StatusCodes.INTERNAL_SERVER_ERROR, exchange, "Failed to create notification");
            return;
        }
        if (discord) {
            handleNotificationWebhook(exchange, title, body);
        } else {
            send(StatusCodes.OK, exchange, "");
        }
    }

    public void sendNotificationToDiscord(HttpServerExchange exchange) {
        exchange.getResponseHeaders().put(Headers.CONTENT_TYPE, "application/json");
        User user = exchange.getAttachment(AuthReader.USER);
        if (user == null) {
            sendBadRequest(exchange, "No authenticated users found");
            return;
        }
        if (user.getRole().lessThan(Role.DEVELOPER)) {
            send(StatusCodes.FORBIDDEN, exchange, "Invalid permissions");
            return;
        }
        FormData data = exchange.getAttachment(FormDataParser.FORM_DATA);
        int notificationID = -1;
        if (!data.contains("id")) {
            sendBadRequest(exchange, "Missing notification id");
            return;
        }
        try {
            notificationID = Integer.parseInt(data.getFirst("id").getValue().trim());
        } catch (Exception e) {
            sendBadRequest(exchange, "Invalid notification id");
        }
        DBNotification notif = App.getDatabase().getNotification(notificationID);
        if (notif == null) {
            send(StatusCodes.NOT_FOUND, exchange, "Notification doesn't exist");
        } else {
            handleNotificationWebhook(exchange, notif.title, notif.content);
        }
    }

    public void setNotificationExpired(HttpServerExchange exchange) {
        exchange.getResponseHeaders().put(Headers.CONTENT_TYPE, "application/json");
        User user = exchange.getAttachment(AuthReader.USER);
        if (user == null) {
            sendBadRequest(exchange, "No authenticated users found");
            return;
        }
        if (user.getRole().lessThan(Role.DEVELOPER)) {
            send(StatusCodes.FORBIDDEN, exchange, "Invalid permissions");
            return;
        }
        FormData data = exchange.getAttachment(FormDataParser.FORM_DATA);
        int notificationID = -1;
        boolean shouldBeExpired = false;
        if (!data.contains("id")) {
            sendBadRequest(exchange, "Missing notification id");
            return;
        }
        try {
            notificationID = Integer.parseInt(data.getFirst("id").getValue().trim());
        } catch (Exception e) {
            sendBadRequest(exchange, "Invalid notification id");
        }
        try {
            notificationID = Integer.parseInt(data.getFirst("id").getValue().trim());
        } catch (Exception e) {
            sendBadRequest(exchange, "Invalid notification id");
        }
        if (App.getDatabase().getNotification(notificationID) == null) {
            send(StatusCodes.NOT_FOUND, exchange, "Notification doesn't exist");
            return;
        }
        try {
            shouldBeExpired = data.getFirst("expired").getValue().trim().equalsIgnoreCase("true");
        } catch (Exception e) {
            sendBadRequest(exchange, "Invalid 'expired'");
            return;
        }
        App.getDatabase().setNotificationExpiry(notificationID, shouldBeExpired ? 1L : 0L);
        send(StatusCodes.OK, exchange, "");
    }

    private void handleNotificationWebhook(HttpServerExchange exchange, String title, String body) {
        String webhookURL = App.getConfig().getString("webhooks.announcements");
        if (webhookURL.isEmpty()) {
            send(StatusCodes.INTERNAL_SERVER_ERROR, exchange, "No announcement webhook is configured");
        } else {
            if (SimpleDiscordWebhook.forWebhookURL(webhookURL).content(String.format("**%s**\n\n%s", title, body)).execute()) {
                send(StatusCodes.OK, exchange, "");
            } else {
                send(StatusCodes.INTERNAL_SERVER_ERROR, exchange, "Failed to execute discord webhook");
            }
        }
    }

    public void notificationsList(HttpServerExchange exchange) {
        exchange.getResponseHeaders().put(Headers.CONTENT_TYPE, "application/json");
        exchange.setStatusCode(200);
        exchange.getResponseSender().send(App.getGson().toJson(App.getDatabase().getNotifications(false)));
        exchange.endExchange();
    }

    private void sendBadRequest(HttpServerExchange exchange) {
        sendBadRequest(exchange, "");
    }
    private void sendBadRequest(HttpServerExchange exchange, String details) {
        send(StatusCodes.BAD_REQUEST, exchange, details);
    }

    private void send(int statusCode, HttpServerExchange exchange, String details) {
        boolean isSuccess = statusCode >= 200 && statusCode < 300;

        JsonObject toSend = new JsonObject();
        toSend.addProperty("success", isSuccess);
        toSend.addProperty("message", StatusCodes.getReason(statusCode));
        toSend.addProperty("details", details);

        exchange.setStatusCode(statusCode);
        exchange.getResponseSender().send(App.getGson().toJson(toSend));
        exchange.endExchange();
    }

    public void check(HttpServerExchange exchange) {
        User user = parseUserFromForm(exchange);
        if (user != null) {
            exchange.getResponseHeaders().put(Headers.CONTENT_TYPE, "application/json");
            exchange.getResponseSender().send(App.getGson().toJson(
                    new ServerUserInfo(user.getName(),
                            user.getRole().name(),
                            user.isBanned(),
                            user.getBanExpiryTime(),
                            user.getBanReason(),
                            user.getLogin().split(":")[0],
                            user.isOverridingCooldown(),
                            user.isChatbanned(),
                            App.getDatabase().getChatBanReason(user.getId()),
                            user.isPermaChatbanned(),
                            user.getChatbanExpiryTime(),
                            user.isRenameRequested(true),
                            user.getDiscordName(),
                            user.getChatNameColor()
                    )));
        } else {
            exchange.setStatusCode(400);
        }
    }

    public void signUp(HttpServerExchange exchange) {
        if (!App.getRegistrationEnabled()) {
            respond(exchange, StatusCodes.UNAUTHORIZED, new space.pxls.server.packets.http.Error("registration_disabled", "Registration has been disabled"));
            return;
        }
        FormData data = exchange.getAttachment(FormDataParser.FORM_DATA);
        FormData.FormValue nameVal = data.getFirst("username");
        FormData.FormValue tokenVal = data.getFirst("token");
        if (nameVal == null || tokenVal == null) {
            respond(exchange, StatusCodes.BAD_REQUEST, new space.pxls.server.packets.http.Error("bad_params", "Missing parameters"));
            return;
        }

        String name = nameVal.getValue();
        String token = tokenVal.getValue();
        if (token.isEmpty()) {
            respond(exchange, StatusCodes.BAD_REQUEST, new space.pxls.server.packets.http.Error("bad_token", "Missing signup token"));
            return;
        } else if (name.isEmpty()) {
            respond(exchange, StatusCodes.BAD_REQUEST, new space.pxls.server.packets.http.Error("bad_username", "Username may not be empty"));
            return;
        } else if (!name.matches("[a-zA-Z0-9_\\-]+")) {
            respond(exchange, StatusCodes.BAD_REQUEST, new space.pxls.server.packets.http.Error("bad_username", "Username contains invalid characters"));
            return;
        } else if (!App.getUserManager().isValidSignupToken(token)) {
            respond(exchange, StatusCodes.BAD_REQUEST, new space.pxls.server.packets.http.Error("bad_token", "Invalid signup token"));
            return;
        }

        String ip = exchange.getAttachment(IPReader.IP);
        User user = App.getUserManager().signUp(name, token, ip);

        if (user == null) {
            respond(exchange, StatusCodes.BAD_REQUEST, new space.pxls.server.packets.http.Error("bad_username", "Username taken, try another?"));
            return;
        }

        // do additional checks for possible multi here
        List<String> reports = new ArrayList<String>(); //left in `reports` here for future use, however signup IP checks have been moved to dupe IP checks on auth.
        if (reports.size() > 0) {
            String msg = "Potential dupe user. Reasons:\n\n";
            for (String r : reports) {
                msg += r+"\n";
            }
            App.getDatabase().insertServerReport(user.getId(), msg);
        }

        String loginToken = App.getUserManager().logIn(user, ip);
        setAuthCookie(exchange, loginToken, 24);
        respond(exchange, StatusCodes.OK, new SignUpResponse(loginToken));
    }

    public void auth(HttpServerExchange exchange) throws UnirestException {
        if (exchange.isInIoThread()) {
            exchange.dispatch(this::auth);
            return;
        }

        String id = exchange.getRelativePath().substring(1);

        AuthService service = services.get(id);
        if (service != null && service.use()) {

            // Verify the given OAuth state, to make sure people don't double-send requests
            Deque<String> stateQ = exchange.getQueryParameters().get("state");

            String state_ = "";
            if (stateQ != null) {
                state_ = stateQ.element();
            }
            String[] stateArray = state_.split("\\|");
            String state = stateArray[0];
            boolean redirect = false;
            if (stateArray.length > 1) {
                redirect = stateArray[1].equals("redirect");
            } else {
                // check for cookie...
                Cookie redirectCookie = exchange.getRequestCookies().get("pxls-auth-redirect");
                redirect = redirectCookie != null;
            }
            // let's just delete the redirect cookie
            Calendar cal = Calendar.getInstance();
            cal.add(Calendar.DATE, -1);
            exchange.setResponseCookie(new CookieImpl("pxls-auth-redirect", "").setPath("/").setExpires(cal.getTime()));

            if (!redirect && exchange.getQueryParameters().get("json") == null) {
                exchange.getResponseHeaders().put(Headers.CONTENT_TYPE, "text/html");
                exchange.getResponseSender().send("<!DOCTYPE html><html><head><title>Pxls Login</title><meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=0\"/></head><body><a style=\"font-size:2em;font-weight:bold;\" href=\"" + exchange.getRequestURI() + "?" + exchange.getQueryString() + "\">Finish Login</a><br>Hold down long on that link and select to open with pxls app.</body>");

                return;
            }

            // Check for errors reported by server
            if (exchange.getQueryParameters().containsKey("error")) {
                String error = exchange.getQueryParameters().get("error").element();
                if (error.equals("access_denied")) error = "Authentication denied by user";
                if (redirect) {
                    redirect(exchange, "/auth_done.html?nologin=1");
                } else {
                    respond(exchange, StatusCodes.UNAUTHORIZED, new space.pxls.server.packets.http.Error("oauth_error", error));
                }
                return;
            }

            if (!service.verifyState(state)) {
                respond(exchange, StatusCodes.BAD_REQUEST, new space.pxls.server.packets.http.Error("bad_state", "Invalid state token"));
                return;
            }

            // Get the one-time authorization code from the request
            String code = extractOAuthCode(exchange);
            if (code == null) {
                if (redirect) {
                    redirect(exchange, "/auth_done.html?nologin=1");
                } else {
                    respond(exchange, StatusCodes.BAD_REQUEST, new space.pxls.server.packets.http.Error("bad_code", "No OAuth code specified"));
                }
                return;
            }

            // Get a more persistent user token
            String token = service.getToken(code);
            if (token == null) {
                respond(exchange, StatusCodes.UNAUTHORIZED, new space.pxls.server.packets.http.Error("bad_code", "OAuth code invalid"));
                return;
            }

            // And get an account identifier from that
            String identifier;
            try {
                identifier = service.getIdentifier(token);
            } catch (AuthService.InvalidAccountException e) {
                respond(exchange, StatusCodes.UNAUTHORIZED, new space.pxls.server.packets.http.Error("invalid_account", e.getMessage()));
                return;
            }

            if (identifier != null) {
                String login = id + ":" + identifier;
                User user = App.getUserManager().getByLogin(login);
                // If there is no user with that identifier, we make a signup token and tell the client to sign up with that token
                if (user == null) {
                    String signUpToken = App.getUserManager().generateUserCreationToken(login);
                    if (redirect) {
                        redirect(exchange, String.format("/auth_done.html?token=%s&signup=true", encodedURIComponent(signUpToken)));
                    } else {
                        respond(exchange, StatusCodes.OK, new AuthResponse(signUpToken, true));
                    }
                    return;
                } else {
                    // We need the IP for logging/db purposes
                    String ip = exchange.getAttachment(IPReader.IP);
                    String loginToken = App.getUserManager().logIn(user, ip);
                    setAuthCookie(exchange, loginToken, 24);
                    if (redirect) {
                        redirect(exchange, String.format("/auth_done.html?token=%s&signup=false", encodedURIComponent(loginToken)));
                    } else {
                        respond(exchange, StatusCodes.OK, new AuthResponse(loginToken, false));
                    }
                    return;
                }
            } else {
                respond(exchange, StatusCodes.BAD_REQUEST, new space.pxls.server.packets.http.Error("bad_service", "No auth service named " + id));
                return;
            }
        } else {
            respond(exchange, StatusCodes.BAD_REQUEST, new Error("bad_service", "No auth service named " + id));
            return;
        }
    }

    private String extractOAuthCode(HttpServerExchange exchange) {
        // Most implementations just add a "code" parameter
        Deque<String> code = exchange.getQueryParameters().get("code");
        if (code != null && !code.isEmpty()) return code.element();

        // OAuth 1 still uses these parameters
        Deque<String> oauthToken = exchange.getQueryParameters().get("oauth_token");
        Deque<String> oauthVerifier = exchange.getQueryParameters().get("oauth_verifier");

        if (oauthToken == null || oauthVerifier == null || oauthToken.isEmpty() || oauthVerifier.isEmpty()) return null;
        return oauthToken.element() + "|" + oauthVerifier.element();
    }

    public void signIn(HttpServerExchange exchange) {
        String id = exchange.getRelativePath().substring(1);
        boolean redirect = exchange.getQueryParameters().get("redirect") != null;

        AuthService service = services.get(id);
        if (service != null) {
            String state = service.generateState();
            if (redirect) {
                exchange.setResponseCookie(new CookieImpl("pxls-auth-redirect", "1").setPath("/"));
                redirect(exchange, service.getRedirectUrl(state+"|redirect"));
            } else {
                respond(exchange, StatusCodes.OK, new SignInResponse(service.getRedirectUrl(state+"|json")));
            }
        } else {
            respond(exchange, StatusCodes.BAD_REQUEST, new Error("bad_service", "No auth method named " + id));
        }
    }

    public void info(HttpServerExchange exchange) {
        exchange.getResponseHeaders()
                .add(HttpString.tryFromString("Content-Type"), "application/json")
                .add(HttpString.tryFromString("Access-Control-Allow-Origin"), "*");
        exchange.getResponseSender().send(App.getGson().toJson(new CanvasInfo(
            App.getCanvasCode(),
            App.getWidth(),
            App.getHeight(),
            App.getConfig().getStringList("board.palette"),
            App.getConfig().getString("captcha.key"),
            (int) App.getConfig().getDuration("board.heatmapCooldown", TimeUnit.SECONDS),
            (int) App.getConfig().getInt("stacking.maxStacked"),
            services,
            App.getRegistrationEnabled(),
            Math.min(App.getConfig().getInt("chat.characterLimit"), 2048)
        )));
    }

    public void data(HttpServerExchange exchange) {
        exchange.getResponseHeaders()
                .put(Headers.CONTENT_TYPE, "application/binary")
                .put(HttpString.tryFromString("Access-Control-Allow-Origin"), "*");

        // let's also update the cookie, if present. This place will get called frequent enough
        Cookie tokenCookie = exchange.getRequestCookies().get("pxls-token");
        if (tokenCookie != null) {
            setAuthCookie(exchange, tokenCookie.getValue(), 24);
        }

        exchange.getResponseSender().send(ByteBuffer.wrap(App.getBoardData()));
    }

    public void heatmap(HttpServerExchange exchange) {
        exchange.getResponseHeaders()
                .put(Headers.CONTENT_TYPE, "application/binary")
                .put(HttpString.tryFromString("Access-Control-Allow-Origin"), "*");
        exchange.getResponseSender().send(ByteBuffer.wrap(App.getHeatmapData()));
    }

    public void virginmap(HttpServerExchange exchange) {
        exchange.getResponseHeaders()
                .put(Headers.CONTENT_TYPE, "application/binary")
                .put(HttpString.tryFromString("Access-Control-Allow-Origin"), "*");
        exchange.getResponseSender().send(ByteBuffer.wrap(App.getVirginmapData()));
    }

    public void placemap(HttpServerExchange exchange) {
        exchange.getResponseHeaders()
                .put(Headers.CONTENT_TYPE, "application/binary")
                .put(HttpString.tryFromString("Access-Control-Allow-Origin"), "*");
        exchange.getResponseSender().send(ByteBuffer.wrap(App.getPlacemapData()));
    }

    public void logout(HttpServerExchange exchange) {
        Cookie tokenCookie = exchange.getRequestCookies().get("pxls-token");

        if (tokenCookie != null) {
            App.getUserManager().logOut(tokenCookie.getValue());
        }

        setAuthCookie(exchange, "", -1);
        respond(exchange, StatusCodes.OK, new EmptyResponse());
    }

    public void lookup(HttpServerExchange exchange) {
        User user = exchange.getAttachment(AuthReader.USER);

        /*if (user == null || user.getRole().lessThan(Role.USER)) {
            exchange.setStatusCode(StatusCodes.UNAUTHORIZED);
            exchange.endExchange();
            return;
        }*/

        Deque<String> xq = exchange.getQueryParameters().get("x");
        Deque<String> yq = exchange.getQueryParameters().get("y");

        if (xq.isEmpty() || yq.isEmpty()) {
            exchange.setStatusCode(StatusCodes.BAD_REQUEST);
            exchange.endExchange();
            return;
        }

        int x = (int) Math.floor(Float.parseFloat(xq.element()));
        int y = (int) Math.floor(Float.parseFloat(yq.element()));
        if (x < 0 || x >= App.getWidth() || y < 0 || y >= App.getHeight()) {
            exchange.setStatusCode(StatusCodes.BAD_REQUEST);
            exchange.endExchange();
            return;
        }

        exchange.getResponseHeaders()
                .put(Headers.CONTENT_TYPE, "application/json")
                .put(HttpString.tryFromString("Access-Control-Allow-Origin"), "*");
        if (user == null) {
            App.getDatabase().insertLookup(null, exchange.getAttachment(IPReader.IP));
        } else {
            App.getDatabase().insertLookup(user.getId(), exchange.getAttachment(IPReader.IP));
        }

        if (user == null || user.getRole().lessThan(Role.TRIALMOD)) {
            Optional<DBPixelPlacementUser> pp = App.getDatabase().getPixelAtUser(x, y);
            exchange.getResponseSender().send(App.getGson().toJson(pp.orElse(null)));
        } else {
            Optional<DBPixelPlacement> pp = App.getDatabase().getPixelAt(x, y);
            exchange.getResponseSender().send(App.getGson().toJson(pp.orElse(null)));
        }
    }

    public void report(HttpServerExchange exchange) {
        User user = exchange.getAttachment(AuthReader.USER);

        if (user == null) {
            exchange.setStatusCode(StatusCodes.BAD_REQUEST);
            exchange.endExchange();
            return;
        }

        if (user.isBanned()) {
            exchange.setStatusCode(StatusCodes.BAD_REQUEST);
            exchange.endExchange();
            return;
        }

        FormData data = exchange.getAttachment(FormDataParser.FORM_DATA);

        FormData.FormValue xq;
        FormData.FormValue yq;
        FormData.FormValue idq;
        FormData.FormValue msgq;

        try {
            xq = data.getFirst("x");
            yq = data.getFirst("y");
            idq = data.getFirst("id");
            msgq = data.getFirst("message");
        } catch (NullPointerException ex) {
            exchange.setStatusCode(StatusCodes.BAD_REQUEST);
            exchange.endExchange();
            return;
        }

        if (xq == null || yq == null || idq == null || msgq == null) {
            exchange.setStatusCode(StatusCodes.BAD_REQUEST);
            exchange.endExchange();
            return;
        }
        int x = (int) Math.floor(Float.parseFloat(xq.getValue()));
        int y = (int) Math.floor(Float.parseFloat(yq.getValue()));
        int id = Integer.parseInt(idq.getValue());
        if (x < 0 || x >= App.getWidth() || y < 0 || y >= App.getHeight()) {
            exchange.setStatusCode(StatusCodes.BAD_REQUEST);
            exchange.endExchange();
            return;
        }
        DBPixelPlacement pxl = App.getDatabase().getPixelByID(null, id);
        if (pxl.x != x || pxl.y != y) {
            exchange.setStatusCode(StatusCodes.BAD_REQUEST);
            exchange.endExchange();
            return;
        }
        App.getDatabase().insertReport(user.getId(), pxl.userId, id, x, y, msgq.getValue());
        exchange.setStatusCode(200);
    }

    public void users(HttpServerExchange exchange) {
        exchange.getResponseHeaders()
                .put(Headers.CONTENT_TYPE, "application/json")
                .put(HttpString.tryFromString("Access-Control-Allow-Origin"), "*");
        exchange.getResponseSender().send(App.getGson().toJson(new ServerUsers(App.getServer().getNonIdledUsersCount())));
    }

    public void whoami(HttpServerExchange exchange) {
        exchange.getResponseHeaders()
                .put(Headers.CONTENT_TYPE, "application/json")
                .put(HttpString.tryFromString("Access-Control-Allow-Origin"), App.getWhoamiAllowedOrigin())
                .put(HttpString.tryFromString("Access-Control-Allow-Credentials"), "true");
        User user = exchange.getAttachment(AuthReader.USER);
        if (user != null) {
            exchange.getResponseSender().send(App.getGson().toJson(new WhoAmI(user.getName(), user.getId())));
        } else {
            exchange.getResponseSender().send(App.getGson().toJson(new WhoAmI("unauthed", -1)));
        }
    }

    private User parseUserFromForm(HttpServerExchange exchange) {
        FormData data = exchange.getAttachment(FormDataParser.FORM_DATA);
        if (data != null) {
            FormData.FormValue username = data.getFirst("username");
            if (username != null) {
                return App.getUserManager().getByName(username.getValue());
            }
        }
        return null;
    }

    private void respond(HttpServerExchange exchange, int code, Object obj) {
        exchange.getResponseHeaders().put(Headers.CONTENT_TYPE, "application/json");
        exchange.setStatusCode(code);
        exchange.getResponseSender().send(App.getGson().toJson(obj));
        exchange.endExchange();
    }

    private void redirect(HttpServerExchange exchange, String url) {
        exchange.setStatusCode(StatusCodes.FOUND);
        exchange.getResponseHeaders().put(Headers.LOCATION, url);
        exchange.getResponseSender().send("");
    }

    private String encodedURIComponent(String toEncode) {
        //https://stackoverflow.com/a/611117
        String result = "";
        try {
            result = URLEncoder.encode(toEncode, "UTF-8")
                    .replaceAll("\\+", "%20")
                    .replaceAll("\\%21", "!")
                    .replaceAll("\\%27", "'")
                    .replaceAll("\\%28", "(")
                    .replaceAll("\\%29", ")")
                    .replaceAll("\\%7E", "~");
        } catch (UnsupportedEncodingException e) {
            result = toEncode;
        }
        return result;
    }

    private boolean validateUsername(String username) {
        return !username.isEmpty() && username.matches("[a-zA-Z0-9_\\-]+");
    }
}
