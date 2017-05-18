package space.pxls.server;

import com.mashape.unirest.http.exceptions.UnirestException;
import io.undertow.server.HttpServerExchange;
import io.undertow.server.handlers.Cookie;
import io.undertow.server.handlers.CookieImpl;
import io.undertow.server.handlers.form.FormData;
import io.undertow.server.handlers.form.FormDataParser;
import io.undertow.util.Headers;
import io.undertow.util.HttpString;
import io.undertow.util.StatusCodes;
import space.pxls.App;
import space.pxls.auth.AuthService;
import space.pxls.auth.DiscordAuthService;
import space.pxls.auth.GoogleAuthService;
import space.pxls.auth.RedditAuthService;
import space.pxls.data.DBPixelPlacement;
import space.pxls.data.DBPixelPlacementUser;
import space.pxls.user.Role;
import space.pxls.user.User;
import space.pxls.util.AuthReader;
import space.pxls.util.IPReader;

import java.nio.ByteBuffer;
import java.util.Deque;
import java.util.Map;
import java.util.Calendar;
import java.util.Date;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;

public class WebHandler {
    private Map<String, AuthService> services = new ConcurrentHashMap<>();

    {
        services.put("reddit", new RedditAuthService("reddit"));
        services.put("google", new GoogleAuthService("google"));
        services.put("discord", new DiscordAuthService("discord"));
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

    private void pxlsTokenCookie(HttpServerExchange exchange, String loginToken, int days) {
        Calendar cal2 = Calendar.getInstance();
        cal2.add(Calendar.DATE, -1);
        exchange.setResponseCookie(new CookieImpl("pxls-token", loginToken).setPath("/").setExpires(cal2.getTime()));
        Calendar cal = Calendar.getInstance();
        cal.add(Calendar.DATE, days);
        String hostname = App.getConfig().getString("host");
        exchange.setResponseCookie(new CookieImpl("pxls-token", loginToken).setHttpOnly(true).setPath("/").setDomain("."+hostname).setExpires(cal.getTime()));
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
                App.getDatabase().adminLog("ban "+user.getName(), user_perform.getId());
            }
            user.ban(Integer.parseInt(time), getBanReason(exchange), getRollbackTime(exchange));
            exchange.getResponseHeaders().put(Headers.CONTENT_TYPE, "application/text");
            exchange.setStatusCode(200);
        } else {
            exchange.setStatusCode(400);
        }
    }

    public void unban(HttpServerExchange exchange) {
        User user = parseUserFromForm(exchange);
        User user_perform = exchange.getAttachment(AuthReader.USER);
        if (user != null) {
            user.unban();
            exchange.getResponseHeaders().put(Headers.CONTENT_TYPE, "application/text");
            if (doLog(exchange)) {
                App.getDatabase().adminLog("unban "+user.getName(), user_perform.getId());
            }
            exchange.setStatusCode(200);
        } else {
            exchange.setStatusCode(400);
        }
    }

    public void permaban(HttpServerExchange exchange) {
        User user = parseUserFromForm(exchange);
        User user_perform = exchange.getAttachment(AuthReader.USER);
        if (user != null && user.getRole().lessThan(user_perform.getRole())) {
            user.permaban(getBanReason(exchange), getRollbackTime(exchange));
            exchange.getResponseHeaders().put(Headers.CONTENT_TYPE, "application/text");
            if (doLog(exchange)) {
                App.getDatabase().adminLog("permaban "+user.getName(), user_perform.getId());
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
            user.shadowban(getBanReason(exchange), getRollbackTime(exchange));
            exchange.getResponseHeaders().put(Headers.CONTENT_TYPE, "application/text");
            if (doLog(exchange)) {
                App.getDatabase().adminLog("shadowban "+user.getName(), user_perform.getId());
            }
            exchange.setStatusCode(200);
        } else {
            exchange.setStatusCode(400);
        }
    }

    public void check(HttpServerExchange exchange) {
        User user = parseUserFromForm(exchange);
        if (user != null) {
            exchange.getResponseHeaders().put(Headers.CONTENT_TYPE, "application/json");
            exchange.getResponseSender().send(App.getGson().toJson(
                new Packet.UserInfo(user.getName(),
                user.getLogin(),
                user.getRole().name(),
                user.isBanned(),
                user.getBanReason(),
                user.getBanExpiryTime()
            )));
        } else {
            exchange.setStatusCode(400);
        }
    }

    public void signUp(HttpServerExchange exchange) {
        boolean returnJustToken = exchange.getQueryParameters().containsKey("rawToken");

        String ip = exchange.getAttachment(IPReader.IP);
        FormData data = exchange.getAttachment(FormDataParser.FORM_DATA);

        FormData.FormValue nameVal = data.getFirst("name");
        FormData.FormValue tokenVal = data.getFirst("token");
        if (nameVal == null || tokenVal == null) {
            exchange.setStatusCode(StatusCodes.FOUND);
            exchange.getResponseHeaders().put(Headers.LOCATION, "/");
            exchange.getResponseSender().send("");
            return;
        }

        String name = nameVal.getValue();
        String token = tokenVal.getValue();
        if (token.isEmpty()) {
            exchange.setStatusCode(StatusCodes.FOUND);
            exchange.getResponseHeaders().put(Headers.LOCATION, "/");
            exchange.getResponseSender().send("");
            return;
        } else if (name.isEmpty()) {
            exchange.setStatusCode(StatusCodes.FOUND);
            exchange.getResponseHeaders().put(Headers.LOCATION, "/signup.html?token=" + token + "&error=Username%20cannot%20be%20empty.");
            exchange.getResponseSender().send("");
            return;
        } else if (!name.matches("[a-zA-Z0-9_\\-]+")) {
            exchange.setStatusCode(StatusCodes.FOUND);
            exchange.getResponseHeaders().put(Headers.LOCATION, "/signup.html?token=" + token + "&error=Name%20contains%20invalid%20characters.");
            exchange.getResponseSender().send("");
            return;
        } else if (!App.getUserManager().isValidSignupToken(token)) {
            exchange.setStatusCode(StatusCodes.FOUND);
            exchange.getResponseHeaders().put(Headers.LOCATION, "/signup.html?token=" + token + "&error=Invalid%20signup%20token.");
            exchange.getResponseSender().send("");
            return;
        }

        User user = App.getUserManager().signUp(name, token, ip);

        if (user == null) {
            if (returnJustToken) {
                exchange.getResponseSender().send("null");
                return;
            }
            exchange.setStatusCode(StatusCodes.FOUND);
            exchange.getResponseHeaders().put(Headers.LOCATION, "/signup.html?token=" + token + "&error=Username%20is%20taken,%20try%20another%3F");
            exchange.getResponseSender().send("");
            return;
        }

        String loginToken = App.getUserManager().logIn(user, ip);
        if (!returnJustToken) {
            exchange.setStatusCode(StatusCodes.FOUND);
            exchange.getResponseHeaders().put(Headers.LOCATION, "/");
            pxlsTokenCookie(exchange, loginToken, 24);
            exchange.getResponseSender().send("");
        } else {
            exchange.getResponseSender().send(loginToken);
        }
    }

    public void auth(HttpServerExchange exchange) throws UnirestException {
        if (exchange.isInIoThread()) {
            exchange.dispatch(this::auth);
            return;
        }

        String id = exchange.getRelativePath().substring(1);
        String ip = exchange.getAttachment(IPReader.IP);

        AuthService service = services.get(id);
        if (service != null) {
            boolean returnJustToken = exchange.getQueryParameters().containsKey("rawToken");

            Deque<String> code = exchange.getQueryParameters().get("code");
            if (code == null) {
                exchange.setStatusCode(StatusCodes.FOUND);
                exchange.getResponseHeaders().put(Headers.LOCATION, "/");
                exchange.getResponseSender().send("");

                return;
            }
            String token = service.getToken(code.element());
            String identifier;
            try {
                identifier = service.getIdentifier(token);
            } catch (AuthService.InvalidAccountException e) {
                exchange.setStatusCode(StatusCodes.FOUND);
                exchange.getResponseHeaders().put(Headers.LOCATION, "/error.html?error=" + e.getMessage());
                exchange.getResponseSender().send("");
                return;
            }

            if (token != null && identifier != null) {
                String login = id + ":" + identifier;
                User user = App.getUserManager().getByLogin(login);
                if (user == null) {
                    String signUpToken = App.getUserManager().generateUserCreationToken(login);

                    if (returnJustToken) {
                        exchange.getResponseSender().send("pxls-signup-token=" + signUpToken);
                    } else {
                        exchange.setStatusCode(StatusCodes.FOUND);
                        String hostname = App.getConfig().getString("host");
                        exchange.setResponseCookie(new CookieImpl("pxls-signup-token", signUpToken).setPath("/").setDomain("." + hostname));
                        exchange.getResponseHeaders().put(Headers.LOCATION, "/signup.html?token=" + signUpToken);
                        exchange.getResponseSender().send("");
                    }
                } else {
                    String loginToken = App.getUserManager().logIn(user, ip);

                    if (returnJustToken) {
                        exchange.getResponseSender().send("pxls-token=" + loginToken);
                    } else {
                        exchange.setStatusCode(StatusCodes.FOUND);
                        exchange.getResponseHeaders().put(Headers.LOCATION, "/");
                        pxlsTokenCookie(exchange, loginToken, 24);
                        exchange.getResponseSender().send("");
                    }
                }
            } else {
                exchange.setStatusCode(StatusCodes.FOUND);
                exchange.getResponseHeaders().put(Headers.LOCATION, "/");
                exchange.getResponseSender().send("");
            }
        }
    }

    public void signIn(HttpServerExchange exchange) {
        String id = exchange.getRelativePath().substring(1);

        AuthService service = services.get(id);
        if (service != null) {
            exchange.setStatusCode(StatusCodes.FOUND);
            exchange.getResponseHeaders().put(Headers.LOCATION, service.getRedirectUrl());
            pxlsTokenCookie(exchange, "", -1); // make sure that we don't have one...
            exchange.getResponseSender().send("");
        }
    }

    public void info(HttpServerExchange exchange) {
        exchange.getResponseHeaders().add(HttpString.tryFromString("Content-Type"), "application/json");
        exchange.getResponseSender().send(App.getGson().toJson(
                new Packet.HttpInfo(
                    App.getWidth(),
                    App.getHeight(),
                    App.getConfig().getStringList("board.palette"),
                    App.getConfig().getString("captcha.key"),
                    (int) App.getConfig().getDuration("board.heatmapCooldown", TimeUnit.SECONDS)
                )));
    }

    public void data(HttpServerExchange exchange) {
        exchange.getResponseHeaders().put(Headers.CONTENT_TYPE, "application/binary");

        // let's also update the cookie, if present. This place will get called frequent enough
        Cookie tokenCookie = exchange.getRequestCookies().get("pxls-token");
        if (tokenCookie != null) {
            pxlsTokenCookie(exchange, tokenCookie.getValue(), 24);
        }

        exchange.getResponseSender().send(ByteBuffer.wrap(App.getBoardData()));
    }

    public void heatmap(HttpServerExchange exchange) {
        exchange.getResponseHeaders().put(Headers.CONTENT_TYPE, "application/binary");
        exchange.getResponseSender().send(ByteBuffer.wrap(App.getHeatmapData()));
    }

    public void logout(HttpServerExchange exchange) {
        Cookie tokenCookie = exchange.getRequestCookies().get("pxls-token");

        if (tokenCookie != null) {
            App.getUserManager().logOut(tokenCookie.getValue());
        }

        exchange.setStatusCode(StatusCodes.FOUND);
        exchange.getResponseHeaders().put(Headers.LOCATION, "/");
        pxlsTokenCookie(exchange, "", -1);
        exchange.getResponseSender().send("");
    }

    public void lookup(HttpServerExchange exchange) {
        User user = exchange.getAttachment(AuthReader.USER);

        Deque<String> xq = exchange.getQueryParameters().get("x");
        Deque<String> yq = exchange.getQueryParameters().get("y");

        if (xq.isEmpty() || yq.isEmpty()) {
            exchange.setStatusCode(StatusCodes.BAD_REQUEST);
            exchange.endExchange();
            return;
        }

        int x = Integer.parseInt(xq.element());
        int y = Integer.parseInt(yq.element());
        if (x < 0 || x >= App.getWidth() || y < 0 || y >= App.getHeight()) {
            exchange.setStatusCode(StatusCodes.BAD_REQUEST);
            exchange.endExchange();
            return;
        }

        exchange.getResponseHeaders().put(Headers.CONTENT_TYPE, "application/json");

        if (user == null || user.getRole().lessThan(Role.MODERATOR)) {
            DBPixelPlacementUser pp = App.getDatabase().getPixelAtUser(x, y);
            exchange.getResponseSender().send(App.getGson().toJson(pp));
        } else {
            DBPixelPlacement pp = App.getDatabase().getPixelAt(x, y);
            exchange.getResponseSender().send(App.getGson().toJson(pp));
        }
    }

    public void report(HttpServerExchange exchange) {
        User user = exchange.getAttachment(AuthReader.USER);

        if (user == null) {
            exchange.setStatusCode(StatusCodes.BAD_REQUEST);
            exchange.endExchange();
            return;
        }

        FormData data = exchange.getAttachment(FormDataParser.FORM_DATA);
        
        FormData.FormValue xq = data.getFirst("x");
        FormData.FormValue yq = data.getFirst("y");
        FormData.FormValue idq = data.getFirst("id");
        FormData.FormValue msgq = data.getFirst("message");

        if (xq == null || yq == null || idq == null || msgq == null) {
            exchange.setStatusCode(StatusCodes.BAD_REQUEST);
            exchange.endExchange();
            return;
        }
        int x = Integer.parseInt(xq.getValue());
        int y = Integer.parseInt(yq.getValue());
        int id = Integer.parseInt(idq.getValue());
        if (x < 0 || x >= App.getWidth() || y < 0 || y >= App.getHeight()) {
            exchange.setStatusCode(StatusCodes.BAD_REQUEST);
            exchange.endExchange();
            return;
        }
        DBPixelPlacement pxl = App.getDatabase().getPixelByID(id);
        if (pxl.x != x || pxl.y != y) {
            exchange.setStatusCode(StatusCodes.BAD_REQUEST);
            exchange.endExchange();
            return;
        }
        App.getDatabase().addReport(user.getId(), id, x, y, msgq.getValue());
        exchange.setStatusCode(200);
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
}
