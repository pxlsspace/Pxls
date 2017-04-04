package space.pxls;

import com.google.gson.Gson;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.Response;
import org.eclipse.jetty.websocket.api.Session;
import org.eclipse.jetty.websocket.api.annotations.OnWebSocketClose;
import org.eclipse.jetty.websocket.api.annotations.OnWebSocketConnect;
import org.eclipse.jetty.websocket.api.annotations.OnWebSocketMessage;
import org.eclipse.jetty.websocket.api.annotations.WebSocket;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import spark.ResponseTransformer;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentLinkedQueue;

import static spark.Spark.*;

public class App {
    public static final String TOR_BAN_MSG = "Due to widespread abuse, Tor IPs are banned from placing pixels.";

    private static int width = 1000;
    private static int height = 1000;
    private static byte[] board = new byte[width * height];
    private static List<String> palette = Arrays.asList("#FFFFFF", "#E4E4E4", "#888888", "#222222", "#FFA7D1", "#E50000", "#E59500", "#A06A42", "#E5D900", "#94E044", "#02BE01", "#00D3DD", "#0083C7", "#0000EA", "#CF6EE4", "#820080");
    private static int cooldown = 180;
    private static WSHandler handler;
    private static long startTime = System.currentTimeMillis();
    private static Set<String> torIps = ConcurrentHashMap.newKeySet();

    private static long lastSave;

    private static Logger pixelLogger = LoggerFactory.getLogger("pixels");
    private static Logger appLogger = LoggerFactory.getLogger(App.class);

    @WebSocket
    public static class EchoHandler {
        @OnWebSocketMessage
        public void message(Session session, String message) throws IOException {
            session.getRemote().sendStringByFuture(message);
        }
    }

    public static void main(String[] args) {
        try {
            loadBoard();
        } catch (IOException e) {
            appLogger.error("Error while loading board", e);
        }

        try {
            banTorNodes();
        } catch (IOException e) {
            appLogger.error("Error while banning Tor exit nodes", e);
        }

        port(Integer.parseInt(getEnv("PORT", "4567")));

        handler = new WSHandler();
        webSocket("/ws", handler);
        webSocket("/echo", new EchoHandler());

        staticFiles.location("/public");

        get("/boardinfo", (req, res) -> {
            res.type("application/json");
            return new BoardInfo(width, height, palette);

        }, new JsonTransformer());
        get("/boarddata", (req, res) -> {
            if (req.headers("Accept-Encoding") != null && req.headers("Accept-Encoding").contains("gzip")) {
                res.header("Content-Encoding", "gzip");
            }
            res.type("application/octet-stream");
            return board;
        });
        get("/users", (req, res) -> handler.sessions.size());

        Runtime.getRuntime().addShutdownHook(new Thread(() -> {
            try {
                saveBoard();
            } catch (IOException e) {
                appLogger.error("Error while saving board", e);
            }
        }));

        Scanner scanner = new Scanner(System.in);
        while (true) {
            String command = scanner.nextLine();
            handleCommand(command);
        }
    }

    private static void banTorNodes() throws IOException {
        OkHttpClient client = new OkHttpClient();

        Response resp = client.newCall(
                new Request.Builder()
                        .url("https://check.torproject.org/cgi-bin/TorBulkExitList.py?ip=1.1.1.1&port=80").build()).execute();
        String ips = resp.body().string();
        for (String s : ips.split("\n")) {
            if (!s.startsWith("#")) {
                torIps.add(s);
            }
        }
    }

    private static void handleCommand(String command) {
        try {
            String[] tokens = command.split(" ");
            appLogger.info("> {}", command);
            if (tokens[0].equalsIgnoreCase("cooldown")) {
                cooldown = Integer.parseInt(tokens[1]);
                appLogger.info("Changed cooldown to {} seconds", tokens[1]);

                for (Session sess : handler.sessions) {
                    float time = handler.getWaitTime(sess);
                    handler.send(sess, new WaitResponse((int) time));
                }
            } else if (tokens[0].equalsIgnoreCase("alert")) {
                String rest = command.substring(tokens[0].length() + 1);
                handler.broadcast(new AlertResponse(rest));
                appLogger.info("Alerted {} to clients", rest);
            }
        } catch (Exception e) {
            appLogger.error("Error while executing command {}", command, e);
        }
    }

    private static void loadBoard() throws IOException {
        byte[] data = Files.readAllBytes(getBoardFile());
        System.arraycopy(data, 0, board, 0, Math.min(data.length, board.length));
    }

    private static void saveBoard() throws IOException {
        if (lastSave + 1000 > System.currentTimeMillis()) return;
        lastSave = System.currentTimeMillis();
        Files.write(getBoardFile(), board);
        Files.write(getBoardFile().getParent().resolve(getBoardFile().getFileName() + "." + startTime), board);
    }

    private static Path getStorageDir() {
        return Paths.get(getEnv("STORAGE", "."));
    }

    private static Path getBoardFile() {
        return getStorageDir().resolve("board.dat");
    }

    private static String getEnv(String key, String def) {
        String val = System.getenv(key);
        if (val != null) return val;
        return def;
    }

    @WebSocket
    public static class WSHandler {
        private Gson gson = new Gson();
        private final Queue<Session> sessions = new ConcurrentLinkedQueue<>();

        private ConcurrentHashMap<String, Long> lastPlaceTime = new ConcurrentHashMap<>();

        @OnWebSocketConnect
        public void connected(Session session) throws IOException {
            String ip = getIp(session);

            if (torIps.contains(ip)) {
                send(session, new AlertResponse(TOR_BAN_MSG));
            }

            sessions.add(session);

            float waitTime = getWaitTime(session);
            broadcast(new UsersResponse((int) handler.sessions.size());
            send(session, new WaitResponse((int) Math.floor(waitTime)));
        }

        @OnWebSocketClose
        public void closed(Session session, int statusCode, String reason) {
            sessions.remove(session);
            broadcast(new UsersResponse((int) handler.sessions.size());
        }

        @OnWebSocketMessage
        public void message(Session session, String message) throws IOException {
            String ip = getIp(session);
            if (torIps.contains(ip)) {
                send(session, new AlertResponse(TOR_BAN_MSG));
                return;
            }

            PlaceRequest req = gson.fromJson(message, PlaceRequest.class);
            int x = req.x;
            int y = req.y;
            int color = req.color;

            if (x < 0 || x >= width || y < 0 || y >= height || color < 0 || color >= palette.size()) return;

            float waitTime = getWaitTime(session);
            if (waitTime <= 0) {
                lastPlaceTime.put(ip, System.currentTimeMillis());
                board[coordsToIndex(x, y)] = (byte) color;
                BoardUpdate update = new BoardUpdate(x, y, color);

                broadcast(update);

                saveBoard();
                waitTime = cooldown;

                log(session, x, y, color);
            }

            send(session, new WaitResponse((int) Math.floor(waitTime)));
        }

        private void broadcast(Object obj) {
            for (Session loopSess : sessions) {
                send(loopSess, obj);
            }
        }

        private void log(Session session, int x, int y, int color) throws IOException {
            pixelLogger.info("{} at ({},{}) by {}", palette.get(color), x, y, getIp(session));
        }

        private String getIp(Session sess) {
            String ip = sess.getRemoteAddress().getAddress().getHostAddress();
            if (sess.getUpgradeRequest().getHeader("X-Forwarded-For") != null) {
                ip = sess.getUpgradeRequest().getHeader("X-Forwarded-For");
            }
            return ip;
        }

        private float getWaitTime(Session sess) {
            if (!lastPlaceTime.containsKey(getIp(sess))) return 0;

            long lastPlace = lastPlaceTime.get(getIp(sess));
            long nextPlace = lastPlace + cooldown * 1000;
            return Math.max(0, nextPlace - System.currentTimeMillis()) / 1000;
        }

        private void send(Session sess, Object obj) {
            sess.getRemote().sendStringByFuture(gson.toJson(obj));
        }
    }

    private static int coordsToIndex(int x, int y) {
        return y * width + x;
    }

    public static class PlaceRequest {
        int x;
        int y;
        int color;
    }

    public static class UsersResponse {
        String type = "users";
        int count;

        public UsersResponse(int count) {
            this.count = count;
        }
    }

    public static class WaitResponse {
        String type = "cooldown";
        int wait;

        public WaitResponse(int wait) {
            this.wait = wait;
        }
    }

    public static class AlertResponse {
        String type = "alert";
        String message;

        public AlertResponse(String message) {
            this.message = message;
        }
    }

    public static class BoardUpdate {
        String type = "pixel";
        int x;
        int y;
        int color;

        public BoardUpdate(int x, int y, int color) {
            this.x = x;
            this.y = y;
            this.color = color;
        }
    }

    public static class BoardInfo {
        int width;
        int height;
        List<String> palette;

        public BoardInfo(int width, int height, List<String> palette) {
            this.width = width;
            this.height = height;
            this.palette = palette;
        }
    }

    public static class JsonTransformer implements ResponseTransformer {
        private Gson gson = new Gson();

        @Override
        public String render(Object model) {
            return gson.toJson(model);
        }
    }
}
