package space.pxls.server;

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
import space.pxls.data.DBPixelPlacement;
import space.pxls.data.DBPixelPlacementUser;
import space.pxls.user.Role;
import space.pxls.user.User;
import space.pxls.util.AuthReader;
import space.pxls.util.IPReader;

import java.io.File;
import java.io.FileReader;
import java.io.FileWriter;
import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.IOException;
import java.io.RandomAccessFile;
import java.nio.ByteBuffer;
import java.nio.file.Files;
import java.nio.file.NoSuchFileException;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Calendar;
import java.util.Deque;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;
import java.util.List;
import java.util.ArrayList;

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
        String[] replacements = {"title", "head", "info"};
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

    {
        services.put("reddit", new RedditAuthService("reddit"));
        services.put("google", new GoogleAuthService("google"));
        services.put("discord", new DiscordAuthService("discord"));
        services.put("vk", new VKAuthService("vk"));
        services.put("tumblr", new TumblrAuthService("tumblr"));
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
            if (user.getRole().lessThan(Role.MODERATOR) && Integer.parseInt(time) > (86400*2)) {
                exchange.setStatusCode(400);
                return;
            }
            if (doLog(exchange)) {
                App.getDatabase().adminLog("ban " + user.getName(), user_perform.getId());
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
                App.getDatabase().adminLog("unban " + user.getName(), user_perform.getId());
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
                App.getDatabase().adminLog("permaban " + user.getName(), user_perform.getId());
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
                App.getDatabase().adminLog("shadowban " + user.getName(), user_perform.getId());
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
                    new ServerUserInfo(user.getName(),
                            user.getRole().name(),
                            user.isBanned(),
                            user.getBanExpiryTime(),
                            user.getBanReason(),
                            user.getLogin().split(":")[0]
                    )));
        } else {
            exchange.setStatusCode(400);
        }
    }

    public void signUp(HttpServerExchange exchange) {
        FormData data = exchange.getAttachment(FormDataParser.FORM_DATA);
        FormData.FormValue nameVal = data.getFirst("username");
        FormData.FormValue tokenVal = data.getFirst("token");
        if (nameVal == null || tokenVal == null) {
            respond(exchange, StatusCodes.BAD_REQUEST, new Error("bad_params", "Missing parameters"));
            return;
        }

        String name = nameVal.getValue();
        String token = tokenVal.getValue();
        if (token.isEmpty()) {
            respond(exchange, StatusCodes.BAD_REQUEST, new Error("bad_token", "Missing signup token"));
            return;
        } else if (name.isEmpty()) {
            respond(exchange, StatusCodes.BAD_REQUEST, new Error("bad_username", "Username may not be empty"));
            return;
        } else if (!name.matches("[a-zA-Z0-9_\\-]+")) {
            respond(exchange, StatusCodes.BAD_REQUEST, new Error("bad_username", "Username contains invalid characters"));
            return;
        } else if (!App.getUserManager().isValidSignupToken(token)) {
            respond(exchange, StatusCodes.BAD_REQUEST, new Error("bad_token", "Invalid signup token"));
            return;
        }

        String ip = exchange.getAttachment(IPReader.IP);
        User user = App.getUserManager().signUp(name, token, ip);

        if (user == null) {
            respond(exchange, StatusCodes.BAD_REQUEST, new Error("bad_username", "Username taken, try another?"));
            return;
        }

        System.out.println("new user");
        System.out.println(ip);
        System.out.println(user.getId());

        // do additional checks for possible multi here
        List<String> reports = new ArrayList<String>();
        if (App.getDatabase().haveDupeIp(ip, user.getId())) {
            reports.add("Duplicate IP");
            System.out.println("dupe ip");
        }
        if (reports.size() > 0) {
            System.out.println("have reports");
            String msg = "Potential dupe user. Reasons:\n\n";
            for (String r : reports) {
                msg += r+"\n";
            }
            App.getDatabase().addServerReport(msg, user.getId());
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
        if (service != null) {

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
                    respond(exchange, StatusCodes.UNAUTHORIZED, new Error("oauth_error", error));
                }
                return;
            }

            if (!service.verifyState(state)) {
                respond(exchange, StatusCodes.BAD_REQUEST, new Error("bad_state", "Invalid state token"));
                return;
            }

            // Get the one-time authorization code from the request
            String code = extractOAuthCode(exchange);
            if (code == null) {
                if (redirect) {
                    redirect(exchange, "/auth_done.html?nologin=1");
                } else {
                    respond(exchange, StatusCodes.BAD_REQUEST, new Error("bad_code", "No OAuth code specified"));
                }
                return;
            }

            // Get a more persistent user token
            String token = service.getToken(code);
            if (token == null) {
                respond(exchange, StatusCodes.UNAUTHORIZED, new Error("bad_code", "OAuth code invalid"));
                return;
            }

            // And get an account identifier from that
            String identifier;
            try {
                identifier = service.getIdentifier(token);
            } catch (AuthService.InvalidAccountException e) {
                respond(exchange, StatusCodes.UNAUTHORIZED, new Error("invalid_account", e.getMessage()));
                return;
            }

            if (identifier != null) {
                String login = id + ":" + identifier;
                User user = App.getUserManager().getByLogin(login);
                // If there is no user with that identifier, we make a signup token and tell the client to sign up with that token
                if (user == null) {
                    String signUpToken = App.getUserManager().generateUserCreationToken(login);
                    if (redirect) {
                        redirect(exchange, "/auth_done.html?token=" + signUpToken + "&signup=true");
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
                        redirect(exchange, "/auth_done.html?token=" + loginToken + "&signup=false");
                    } else {
                        respond(exchange, StatusCodes.OK, new AuthResponse(loginToken, false));
                    }
                    return;
                }
            } else {
                respond(exchange, StatusCodes.BAD_REQUEST, new Error("bad_service", "No auth service named " + id));
                return;
            }
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
        exchange.getResponseHeaders().add(HttpString.tryFromString("Content-Type"), "application/json");
        exchange.getResponseSender().send(App.getGson().toJson(
                new CanvasInfo(
                        App.getWidth(),
                        App.getHeight(),
                        App.getConfig().getStringList("board.palette"),
                        App.getConfig().getString("captcha.key"),
                        (int) App.getConfig().getDuration("board.heatmapCooldown", TimeUnit.SECONDS),
                        (int) App.getConfig().getInt("stacking.maxStacked"),
                        services
                )));
    }

    public void data(HttpServerExchange exchange) {
        exchange.getResponseHeaders().put(Headers.CONTENT_TYPE, "application/binary");

        // let's also update the cookie, if present. This place will get called frequent enough
        Cookie tokenCookie = exchange.getRequestCookies().get("pxls-token");
        if (tokenCookie != null) {
            setAuthCookie(exchange, tokenCookie.getValue(), 24);
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

        setAuthCookie(exchange, "", -1);
        respond(exchange, StatusCodes.OK, new EmptyResponse());
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

        if (user == null || user.getRole().lessThan(Role.TRIALMOD)) {
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

        if (user.isBanned()) {
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
        App.getDatabase().addReport(user.getId(), pxl.userId, id, x, y, msgq.getValue());
        exchange.setStatusCode(200);
    }

    public void users(HttpServerExchange exchange) {
        exchange.getResponseHeaders().put(Headers.CONTENT_TYPE, "application/json");
        exchange.getResponseSender().send(App.getGson().toJson(new ServerUsers(App.getServer().getConnections().size())));
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
}
