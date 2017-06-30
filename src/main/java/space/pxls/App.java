package space.pxls;

import com.google.gson.Gson;
import com.typesafe.config.Config;
import com.typesafe.config.ConfigFactory;
import io.undertow.websockets.core.WebSocketChannel;
import org.apache.logging.log4j.Level;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.xnio.XnioWorker;
import space.pxls.data.DBPixelPlacement;
import space.pxls.data.DBRollbackPixel;
import space.pxls.data.Database;
import space.pxls.server.ServerAlert;
import space.pxls.server.ServerPlace;
import space.pxls.server.UndertowServer;
import space.pxls.user.Role;
import space.pxls.user.User;
import space.pxls.user.UserManager;
import space.pxls.util.PxlsTimer;
import space.pxls.util.SessionTimer;
import space.pxls.util.DatabaseTimer;
import space.pxls.util.HeatmapTimer;


import java.io.File;
import java.io.IOException;
import java.io.RandomAccessFile;
import java.nio.file.Files;
import java.nio.file.NoSuchFileException;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.*;
import java.util.concurrent.TimeUnit;

public class App {
    private static Gson gson;
    private static Config config;
    private static Database database;
    private static UserManager userManager;
    private static Logger pixelLogger;

    private static int width;
    private static int height;
    private static byte[] board;
    private static byte[] heatmap;

    private static PxlsTimer mapSaveTimer;
    private static PxlsTimer mapBackupTimer;
    private static UndertowServer server;

    public static void main(String[] args) {
        gson = new Gson();

        loadConfig();

        pixelLogger = LogManager.getLogger("Pixels");

        width = config.getInt("board.width");
        height = config.getInt("board.height");
        board = new byte[width * height];
        heatmap = new byte[width * height];

        if (!loadMap()) {
            for (int x = 0; x < width; x++) {
                for (int y = 0; y < height; y++) {
                    board[x + width * y] = getDefaultColor(x, y);
                }
            }
        }

        loadHeatmap();

        database = new Database();
        userManager = new UserManager();

        new Thread(() -> {
            Scanner s = new Scanner(System.in);
            while (true) {
                handleCommand(s.nextLine());
            }
        }).start();

        new Timer().schedule(new SessionTimer(), 0, 1000 * 3600); // execute once every hour

        new Timer().schedule(new DatabaseTimer(), 0, 1000 * 60 * 2);

        int heatmap_timer_cd = (int) App.getConfig().getDuration("board.heatmapCooldown", TimeUnit.SECONDS);
        new Timer().schedule(new HeatmapTimer(), 0, heatmap_timer_cd * 1000 / 256);

        Runtime.getRuntime().addShutdownHook(new Thread(() -> {
            saveMapBackup();
            saveMapForce();
        }));

        server = new UndertowServer(config.getInt("server.port"));
        server.start();

        saveMap();
    }

    private static void handleCommand(String line) {
        try {
            String[] token = line.split(" ");
            if (token[0].equalsIgnoreCase("reload")) {
                loadConfig();
            } else if (token[0].equalsIgnoreCase("save")) {
                saveMapForce();
                saveMapBackup();
            } else if (token[0].equalsIgnoreCase("role")) {
                User user = userManager.getByName(token[1]);
                if (user != null) {
                    Role role = Role.valueOf(token[2].toUpperCase());
                    user.setRole(role);
                    database.setUserRole(user, role);
                    database.adminLogServer("Set "+user.getName()+"'s role to "+role.name());
                    System.out.println("Set " + user.getName() + "'s role to " + role.name());
                } else {
                    System.out.println("Cannot find user " + token[1]);
                }
            } else if (token[0].equalsIgnoreCase("alert")) {
                String rest = line.substring(token[0].length() + 1).trim();
                server.broadcast(new ServerAlert(rest));
            } else if (token[0].equalsIgnoreCase("ban")) {
                User user = userManager.getByName(token[1]);
                if (user != null) {
                    String reason = line.substring(token[0].length() + token[1].length() + 2).trim();
                    user.ban(24 * 60 * 60, reason);
                    database.adminLogServer("ban "+user.getName());
                    System.out.println("Banned " + user.getName() + " for 24 hours.");
                } else {
                    System.out.println("Cannot find user " + token[1]);
                }
            } else if (token[0].equalsIgnoreCase("permaban")) {
                User user = userManager.getByName(token[1]);
                if (user != null) {
                    String reason = line.substring(token[0].length() + token[1].length() + 2).trim();
                    user.permaban(reason);
                    database.adminLogServer("permaban "+user.getName());
                    System.out.println("Permabanned " + user.getName());
                } else {
                    System.out.println("Cannot find user " + token[1]);
                }
            } else if (token[0].equalsIgnoreCase("shadowban")) {
                User user = userManager.getByName(token[1]);
                if (user != null) {
                    String reason = line.substring(token[0].length() + token[1].length() + 2).trim();
                    user.shadowban(reason);
                    database.adminLogServer("shadowban "+user.getName());
                    System.out.println("Shadowbanned " + user.getName());
                } else {
                    System.out.println("Cannot find user " + token[1]);
                }
            } else if (token[0].equalsIgnoreCase("unban")) {
                User user = userManager.getByName(token[1]);
                if (user != null) {
                    user.unban();
                    database.adminLogServer("unban "+user.getName());
                    System.out.println("Unbanned " + user.getName() + ".");
                } else {
                    System.out.println("Cannot find user " + token[1]);
                }
            } else if (token[0].equalsIgnoreCase("nuke")) {
                int fromX = Integer.parseInt(token[1]);
                int fromY = Integer.parseInt(token[2]);
                int toX = Integer.parseInt(token[3]);
                int toY = Integer.parseInt(token[4]);
                byte toColor = (byte)(token.length >= 6 ? Integer.parseInt(token[5]) : 0xFF);
                nuke(fromX, fromY, toX, toY, toColor);
            } else if (token[0].equalsIgnoreCase("cons")) {
                if (token.length > 1) {
                    if (token[1].equalsIgnoreCase("authed") || token[1].equalsIgnoreCase("authd")) {
                        System.out.println("Authenticated connections count: " + server.getAuthedUsers().size());
                    } else {
                        System.out.println("All connections count: " + server.getPacketHandler().getNumAllCons());
                        System.out.println("Authenticated connections count: " + server.getAuthedUsers().size());
                    }
                } else {
                    System.out.println("All connections count: " + server.getPacketHandler().getNumAllCons());
                    System.out.println("Authenticated connections count: " + server.getAuthedUsers().size());
                }
            } else if (token[0].equalsIgnoreCase("users")) {
                System.out.println("Number of authenticated users: " + server.getAuthedUsers().size());
                for (User user : server.getAuthedUsers().values()) {
                    System.out.println(String.format("[%d] %s (%s) (num connections: %d)", user.getId(), user.getName(), user.getRole().name(), user.getConnections().size()));
                }
            }
        } catch (RuntimeException e) {
            e.printStackTrace();
        }
    }

    private static void loadConfig() {
        config = ConfigFactory.parseFile(new File("pxls.conf")).withFallback(ConfigFactory.load());
        config.checkValid(ConfigFactory.load());

        mapSaveTimer = new PxlsTimer(config.getDuration("board.saveInterval", TimeUnit.SECONDS));
        mapBackupTimer = new PxlsTimer(config.getDuration("board.backupInterval", TimeUnit.SECONDS));
        try {
            Files.deleteIfExists(getStorageDir().resolve("index_cache.html"));
        } catch (IOException e) {
            // do nothing
        }
    }


    public static Gson getGson() {
        return gson;
    }

    public static Config getConfig() {
        return config;
    }

    public static int getWidth() {
        return width;
    }

    public static int getHeight() {
        return height;
    }

    public static byte[] getHeatmapData() {
        return heatmap;
    }

    public static byte[] getBoardData() {
        return board;
    }

    public static Path getStorageDir() {
        return Paths.get(config.getString("server.storage"));
    }

    public static List<String> getPalette() {
        return config.getStringList("board.palette");
    }

    public static boolean isCaptchaEnabled() {
        return !config.getString("captcha.key").isEmpty() && !config.getString("captcha.secret").isEmpty();
    }

    public static int getPixel(int x, int y) {
        return board[x + y * width];
    }

    public static void putPixel(int x, int y, int color, User user, boolean mod_action, String ip, boolean updateDatabase) {
        if (x < 0 || x >= width || y < 0 || y >= height || (color >= getPalette().size() && !(color == 0xFF || color == -1))) return;
        String userName = user != null ? user.getName() : "<server>";

        board[x + y * width] = (byte) color;
        heatmap[x + y * width] = (byte) 0xFF;
        pixelLogger.log(Level.INFO, String.format("%s %d %d %d %s %s", userName, x, y, color, ip, mod_action ? " (mod)" : ""));
        if (updateDatabase) {
            database.placePixel(x, y, color, user, mod_action);
        }
    }

    public static void rollbackAfterBan(User who, int seconds) {
        if (seconds <= 0) {
            return;
        }

        XnioWorker worker = server.getServer().getWorker();
        worker.execute(() -> rollbackAfterBan_(who, seconds));
    }

    private static void rollbackAfterBan_(User who, int seconds) {
        List<DBRollbackPixel> pixels = database.getRollbackPixels(who, seconds); //get all pixels that can and need to be rolled back
        List<ServerPlace.Pixel> forBroadcast = new ArrayList<>();
        for (DBRollbackPixel rbPixel : pixels) {
            //This is same for both instances
            //  putPixel() logs and updates the board[]
            //  forBroadcast.add() adds the pixel and later broadcasts it via websocket
            //  putRollbackPixel() adds rollback pixel to database (TABLE pixels) for undo and timelapse purposes
            if (rbPixel.toPixel != null) { //if previous pixel (the one we are rolling back to) exists
                putPixel(rbPixel.toPixel.x, rbPixel.toPixel.y, rbPixel.toPixel.color, who, false, "(rollback)", false);
                forBroadcast.add(new ServerPlace.Pixel(rbPixel.toPixel.x, rbPixel.toPixel.y, rbPixel.toPixel.color));
                database.putRollbackPixel(who, rbPixel.fromId, rbPixel.toPixel.id);
            } else { //else rollback to blank canvas
                DBPixelPlacement fromPixel = database.getPixelByID(rbPixel.fromId);
                byte rollbackDefault = getDefaultColor(fromPixel.x, fromPixel.y);
                putPixel(fromPixel.x, fromPixel.y, rollbackDefault, who, false, "(rollback)", false);
                forBroadcast.add(new ServerPlace.Pixel(fromPixel.x, fromPixel.y, rollbackDefault));
                database.putRollbackPixelNoPrevious(fromPixel.x, fromPixel.y, who, fromPixel.id);
            }
        }
        server.broadcastNoShadow(new ServerPlace(forBroadcast));
    }


    public static void undoRollback(User who) {
        XnioWorker worker = server.getServer().getWorker();
        worker.execute(() -> undoRollback_(who));
    }

    private static void undoRollback_(User who) {
        List<DBPixelPlacement> pixels = database.getUndoPixels(who); //get all pixels that can and need to be undone
        List<ServerPlace.Pixel> forBroadcast = new ArrayList<>();
        for (DBPixelPlacement fromPixel : pixels) {
            //restores original pixel
            putPixel(fromPixel.x, fromPixel.y, fromPixel.color, who, false, "(undo)", false); //in board[]
            forBroadcast.add(new ServerPlace.Pixel(fromPixel.x, fromPixel.y, fromPixel.color)); //in websocket
            database.putUndoPixel(fromPixel.x, fromPixel.y, fromPixel.color, who, fromPixel.id); //in database
        }
        server.broadcastNoShadow(new ServerPlace(forBroadcast));
    }

    private static void nuke(int fromX, int fromY, int toX, int toY, byte toColor) {
        XnioWorker worker = server.getServer().getWorker();
        worker.execute(() -> nuke_(fromX, fromY, toX, toY, toColor));
    }

    private static void nuke_(int fromX, int fromY, int toX, int toY, byte toColor) {
        List<ServerPlace.Pixel> forBroadcast = new ArrayList<>();
        for (int x = Math.min(fromX, toX); x <= Math.max(fromX, toX); x++) {
            for (int y = Math.min(fromY, toY); y <= Math.max(fromY, toY); y++) {
                byte c = toColor;
                if (toColor == 0xFF || toColor == -1) {
                    c = getDefaultColor(x, y);
                }
                System.out.println(c);
                if (getPixel(x, y) != c) {
                    putPixel(x, y, c, null, true, "<nuke action>", false);
                    forBroadcast.add(new ServerPlace.Pixel(x, y, c));
                    if (c != 0xFF && c != -1) {
                        database.putNukePixel(x, y, c);
                    }
                }
            }
        }
        server.broadcastNoShadow(new ServerPlace(forBroadcast));
    }

    private static boolean loadMap() {
        try {
            byte[] bytes = Files.readAllBytes(getStorageDir().resolve("board.dat"));
            System.arraycopy(bytes, 0, board, 0, width * height);
        } catch (NoSuchFileException e) {
            System.out.println("Warning: Cannot find board.dat in working directory, using blank board");
            return false;
        } catch (IOException e) {
            e.printStackTrace();
        }
        return true;
    }

    private static void loadHeatmap() {
        try {
            byte[] bytes = Files.readAllBytes(getStorageDir().resolve("heatmap.dat"));
            System.arraycopy(bytes, 0, heatmap, 0, width * height);
        } catch (NoSuchFileException e) {
            System.out.println("Warning: Cannot find heatmap.dat in working directory, using blank heatmap");
        } catch (IOException e) {
            e.printStackTrace();
        }
    }

    public static void updateHeatmap() {
        for (int i = 0; i < width * height; i++) {
            if (heatmap[i] != 0) {
                heatmap[i]--;
            }
        }
    }

    public static void saveMap() {
        mapSaveTimer.run(App::saveMapForce);
        mapBackupTimer.run(App::saveMapBackup);
    }

    private static void saveMapForce() {
        saveMapToDir(getStorageDir().resolve("board.dat"));
        saveHeatmapToDir(getStorageDir().resolve("heatmap.dat"));
    }

    private static void saveMapBackup() {
        saveMapToDir(getStorageDir().resolve("backups/board." + System.currentTimeMillis() + ".dat"));
    }

    private static void saveMapToDir(Path path) {
        try {
            Files.write(path, board);
        } catch (IOException e) {
            e.printStackTrace();
        }
    }

    private static void saveHeatmapToDir(Path path) {
        try {
            Files.write(path, heatmap);
        } catch (IOException e) {
            e.printStackTrace();
        }
    }

    public static Logger getLogger() {
        return pixelLogger;
    }

    public static UserManager getUserManager() {
        return userManager;
    }

    public static byte getDefaultColor(int x, int y) {
        try {
            RandomAccessFile raf = new RandomAccessFile(getStorageDir().resolve("default_board.dat").toAbsolutePath().toString(), "r");
            raf.seek(x + y*width);
            byte b = raf.readByte();
            raf.close();
            return b;
        } catch (NoSuchFileException e) {
        } catch (IOException e) {
        }
        return (byte) config.getInt("board.defaultColor");
    }

    public static Database getDatabase() {
        return database;
    }

    public static UndertowServer getServer() {
        return server;
    }
}
