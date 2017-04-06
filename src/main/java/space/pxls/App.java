package space.pxls;

import com.google.gson.Gson;
import com.mashape.unirest.http.Unirest;
import com.mashape.unirest.http.exceptions.UnirestException;
import org.eclipse.jetty.websocket.api.Session;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import spark.ResponseTransformer;
import spark.staticfiles.StaticFilesConfiguration;

import java.io.IOException;
import java.nio.file.Files;
import java.util.List;
import java.util.Scanner;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

import static spark.Spark.*;

public class App {
    private static Game game;

    private static WebSocketHandler handler;
    private static Set<String> torIps = ConcurrentHashMap.newKeySet();

    private static Logger appLogger;

    public static void main(String[] args) {
        game = new Game();

        // Done before logger init so it shows up in logger conf
        System.setProperty("STORAGE", game.getConfig().getString("server.storage"));
        appLogger = LoggerFactory.getLogger(App.class);
        game.initLogger();

        if (shouldBanTor()) {
            banTorNodes();
        }

        if (game.getConfig().getString("captcha.key").isEmpty() || game.getConfig().getString("captcha.secret").isEmpty()) {
            appLogger.warn("No ReCaptcha key specified (captcha.key/captcha.secret), ReCaptcha will be disabled");
        }

        handler = new WebSocketHandler();

        port(Integer.parseInt(getEnv("PORT", "4567")));
        webSocket("/ws", handler);

        StaticFilesConfiguration staticHandler = new StaticFilesConfiguration();
        staticHandler.configure("/public");
        before((req, resp) -> {
            Profile profile = game.getProfile(handler.getIP(req));
            if (req.uri().startsWith("/admin/") && profile.role.ordinal() <= Role.DEFAULT.ordinal()) {
                resp.redirect("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
                resp.status(401);
                return;
            }
            staticHandler.consume(req.raw(), resp.raw());
        });

        get("/info", App::boardInfo, new JsonTransformer());
        get("/boarddata", App::boardData);

        Runtime.getRuntime().addShutdownHook(new Thread(game::saveBoard));

        //rewriteBoardFromLogs(500000);

        Scanner scanner = new Scanner(System.in);
        while (true) {
            String command = scanner.nextLine();
            handleCommand(command);
        }
    }

    public static boolean shouldBanTor() {
        return getEnv("BAN_TOR", "true").equals("true");
    }

    private static void rewriteBoardFromLogs(int count) {
        // For when something (inevitably) breaks and you have to recreate the board from the pixel logs
        try {
            List<String> lines = Files.readAllLines(game.getBoardFile().getParent().resolve("pixels.log"));
            int start = Math.max(0, lines.size() - count);
            for (int i = start; i < lines.size(); i++) {
                String s = lines.get(i);
                String[] toks = s.split(" ");
                String col = toks[2];
                String[] coord = toks[4].split(",");

                int x = Integer.parseInt(coord[0].substring(1));
                int y = Integer.parseInt(coord[1].substring(0, coord[1].length() - 1));

                int cc = -1;
                List<String> palette = game.getPalette();
                for (int pal = 0; pal < palette.size(); pal++) {
                    String s1 = palette.get(pal);
                    if (s1.equals(col)) {
                        cc = pal;
                    }
                }
                game.setPixelRaw(x, y, (byte) cc);
            }
        } catch (IOException e) {
            e.printStackTrace();
        }

        game.saveBoard(true);
    }

    private static Data.BoardInfo boardInfo(spark.Request req, spark.Response res) {
        res.type("application/json");
        return new Data.BoardInfo(game.getWidth(), game.getHeight(), game.getPalette());
    }

    private static byte[] boardData(spark.Request req, spark.Response res) {
        if (req.headers("Accept-Encoding") != null && req.headers("Accept-Encoding").contains("gzip")) {
            res.header("Content-Encoding", "gzip");
        }
        res.type("application/octet-stream");
        return game.getBoard();
    }

    private static void banTorNodes() {
        try {
            String ips = Unirest.get("http://check.torproject.org/cgi-bin/TorBulkExitList.py?ip=1.1.1.1&port=80").asString().getBody();

            for (String s : ips.split("\n")) {
                if (!s.startsWith("#")) {
                    torIps.add(s);
                }
            }
        } catch (UnirestException e) {
            appLogger.error("Error while banning Tor exit nodes", e);
        }
    }

    private static void handleCommand(String command) {
        try {
            String[] tokens = command.split(" ");
            appLogger.info("> {}", command);
            if (tokens[0].equalsIgnoreCase("cooldown")) {
                game.setCooldown(Integer.parseInt(tokens[1]));
                appLogger.info("Changed cooldown to {} seconds", tokens[1]);

                for (Session sess : handler.getSessions()) {
                    Profile data = handler.getSessionData(sess);
                    handler.send(sess, new Data.ServerCooldown(game.getWaitTime(data.lastPlace)));
                }
            } else if (tokens[0].equalsIgnoreCase("alert")) {
                String rest = command.substring(tokens[0].length() + 1);
                handler.broadcast(new Data.ServerAlert(rest));

                appLogger.info("Alerted \"{}\" to clients", rest);
            } else if (tokens[0].equalsIgnoreCase("blank")) {
                int x1 = Integer.parseInt(tokens[1]);
                int y1 = Integer.parseInt(tokens[2]);
                int x2 = Integer.parseInt(tokens[3]);
                int y2 = Integer.parseInt(tokens[4]);

                game.saveBoard(game.getBoardFile().getParent().resolve(game.getBoardFile().getFileName() + ".preblank." + System.currentTimeMillis()));

                for (int xx = Math.min(x1, x2); xx <= Math.max(x2, x1); xx++) {
                    for (int yy = Math.min(y1, y2); yy <= Math.max(y2, y1); yy++) {
                        game.setPixel(xx, yy, (byte) 0, "<blank operation>");

                        /*BoardUpdate update = new BoardUpdate(xx, yy, 0);
                        handler.broadcast(update);*/
                    }
                }
            } else if (tokens[0].equalsIgnoreCase("save")) {
                game.saveBoard(true);
            } else if (tokens[0].equalsIgnoreCase("reload")) {
                game.loadConfig();
                game.loadUsers();
            } else if (tokens[0].equalsIgnoreCase("role")) {
                String ip = tokens[1];
                String role = tokens[2];

                game.setRole(game.getProfile(ip), Role.valueOf(role));
                appLogger.info("Changed {} 's role to {}", ip, role);
            }
        } catch (Exception e) {
            appLogger.error("Error while executing command {}", command, e);
        }
    }

    private static String getEnv(String key, String def) {
        String val = System.getenv(key);
        if (val != null) return val;
        return def;
    }

    public static Set<String> getTorIps() {
        return torIps;
    }

    public static Game getGame() {
        return game;
    }

    public static Logger getLogger() {
        return appLogger;
    }

    public static class JsonTransformer implements ResponseTransformer {
        private Gson gson = new Gson();

        @Override
        public String render(Object model) {
            return gson.toJson(model);
        }
    }
}
