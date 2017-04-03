package space.pxls;

import com.google.gson.Gson;
import org.eclipse.jetty.websocket.api.Session;
import org.eclipse.jetty.websocket.api.annotations.OnWebSocketClose;
import org.eclipse.jetty.websocket.api.annotations.OnWebSocketConnect;
import org.eclipse.jetty.websocket.api.annotations.OnWebSocketMessage;
import org.eclipse.jetty.websocket.api.annotations.WebSocket;
import spark.ResponseTransformer;

import java.io.FileWriter;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.text.SimpleDateFormat;
import java.time.Instant;
import java.util.Arrays;
import java.util.Date;
import java.util.List;
import java.util.Queue;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentLinkedQueue;

import static spark.Spark.*;

public class App {
    private static int width = 1000;
    private static int height = 1000;
    private static byte[] board = new byte[width * height];
    private static List<String> palette = Arrays.asList("#FFFFFF", "#E4E4E4", "#888888", "#222222", "#FFA7D1", "#E50000", "#E59500", "#A06A42", "#E5D900", "#94E044", "#02BE01", "#00D3DD", "#0083C7", "#0000EA", "#CF6EE4", "#820080");
    private static int cooldown = 300;

    public static void main(String[] args) {
        try {
            loadBoard();
        } catch (IOException e) {
            e.printStackTrace();
        }

        port(Integer.parseInt(System.getProperty("port", "4567")));

        webSocket("/ws", new WSHandler());

        staticFiles.location("/public");

        get("/boardinfo", (req, res) -> {
            res.type("application/json");
            return new BoardInfo(width, height, palette);
        }, new JsonTransformer());

        get("/boarddata", (req, res) -> {
            res.header("Content-Encoding", "gzip");
            return board;
        });
    }

    private static void loadBoard() throws IOException {
        byte[] data = Files.readAllBytes(getBoardFile());
        System.arraycopy(data, 0, board, 0, Math.min(data.length, board.length));
    }

    private static void saveBoard() throws IOException {
        Files.write(getBoardFile(), board);
    }

    private static Path getBoardFile() {
        return Paths.get(System.getProperty("boardFile", "board.dat"));
    }

    private static Path getLogFile() {
        return Paths.get(System.getProperty("logFile", "pixels.log"));
    }

    @WebSocket
    public static class WSHandler {
        private Gson gson = new Gson();
        private final Queue<Session> sessions = new ConcurrentLinkedQueue<>();

        private ConcurrentHashMap<String, Long> lastPlaceTime = new ConcurrentHashMap<>();

        @OnWebSocketConnect
        public void connected(Session session) {
            sessions.add(session);
        }

        @OnWebSocketClose
        public void closed(Session session, int statusCode, String reason) {
            sessions.remove(session);
        }

        @OnWebSocketMessage
        public void message(Session session, String message) throws IOException {
            session.getRemote().sendString(message);

            PlaceRequest req = gson.fromJson(message, PlaceRequest.class);
            int x = req.x;
            int y = req.y;
            int color = req.color;

            if (x < 0 || x >= width || y < 0 || y >= width || color < 0 || color > palette.size()) return;

            float waitTime = getWaitTime(session);
            if (waitTime <= 0) {
                lastPlaceTime.put(getIp(session), System.currentTimeMillis());
                board[coordsToIndex(x, y)] = (byte) color;
                for (Session loopSess : sessions) {
                    loopSess.getRemote().sendString(gson.toJson(new BoardUpdate(x, y, color)));
                }

                saveBoard();
                waitTime = cooldown;

                log(session, x, y, color);
            }

            session.getRemote().sendString(gson.toJson(new WaitResponse((int) Math.floor(waitTime))));
        }

        private void log(Session session, int x, int y, int color) throws IOException {
            FileWriter fw = new FileWriter(getLogFile().toFile(), true);
            fw.append(String.valueOf(Instant.now().toEpochMilli())).append(" ").append(String.valueOf(x)).append(",").append(String.valueOf(y)).append(",").append(palette.get(color)).append(" by ").append(getIp(session)).append("\n");
            fw.close();
        }

        private String getIp(Session sess) {
            String ip = sess.getRemoteAddress().getHostName();
            if (sess.getUpgradeRequest().getHeader("X-Forwarded-For") != null) {
                ip = sess.getUpgradeRequest().getHeader("X-Forwarded-For");
            }
            return ip;
        }

        private float getWaitTime(Session sess) {
            if (!lastPlaceTime.containsKey(getIp(sess))) return 0;

            long lastPlace = lastPlaceTime.get(getIp(sess));
            long nextPlace = lastPlace + cooldown * 1000;
            return Math.max(0, nextPlace - System.currentTimeMillis());
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

    public static class WaitResponse {
        String type = "cooldown";
        int wait;

        public WaitResponse(int wait) {
            this.wait = wait;
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
