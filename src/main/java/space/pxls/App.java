package space.pxls;

import com.google.gson.Gson;
import com.typesafe.config.Config;
import com.typesafe.config.ConfigFactory;
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
import java.time.Instant;
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
    private static byte[] placemap;
    private static byte[] virginmap;
    private static boolean havePlacemap;

    private static PxlsTimer mapSaveTimer;
    private static PxlsTimer mapBackupTimer;
    private static UndertowServer server;

    private static String cachedWhoamiOrigin = null;
    public static void main(String[] args) {
        gson = new Gson();

        loadConfig();

        pixelLogger = LogManager.getLogger("Pixels");

        width = config.getInt("board.width");
        height = config.getInt("board.height");
        board = new byte[width * height];
        heatmap = new byte[width * height];
        placemap = new byte[width * height];
        virginmap = new byte[width * height];

        if (!loadMap()) {
            for (int x = 0; x < width; x++) {
                for (int y = 0; y < height; y++) {
                    board[x + width * y] = getDefaultColor(x, y);
                }
            }
        }

        loadHeatmap();
        loadPlacemap();
        loadVirginmap();

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

        new Timer().schedule(new TimerTask(){
            @Override
            public void run() {
                tickStackedPixels();
            }
        }, 0, 5000);

        try {
            Path backupsDir = getStorageDir().resolve("backups/");
            if (!Files.exists(backupsDir)) {
                if (!backupsDir.toFile().mkdirs()) {
                    System.err.println("Failed to make backup dirs");
                } else {
                    System.out.printf("Created missing backups dir at %s%n", backupsDir.toAbsolutePath().normalize());
                }
            }
        } catch (Exception e) {
            System.err.println(new Error("Failed to create backup directories", e));
        }
        saveMap();
    }

    private static void handleCommand(String line) {
        try {
            String[] token = line.split(" ");
            if (token[0].equalsIgnoreCase("reload")) {
                cachedWhoamiOrigin = null;
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
                    database.adminLogServer(String.format("ban %s with reason: %s", user.getName(), reason));
                    System.out.println("Banned " + user.getName() + " for 24 hours.");
                } else {
                    System.out.println("Cannot find user " + token[1]);
                }
            } else if (token[0].equalsIgnoreCase("permaban")) {
                User user = userManager.getByName(token[1]);
                if (user != null) {
                    String reason = line.substring(token[0].length() + token[1].length() + 2).trim();
                    user.permaban(reason);
                    database.adminLogServer(String.format("permaban %s with reason: %s", user.getName(), reason));
                    System.out.println("Permabanned " + user.getName());
                } else {
                    System.out.println("Cannot find user " + token[1]);
                }
            } else if (token[0].equalsIgnoreCase("shadowban")) {
                User user = userManager.getByName(token[1]);
                if (user != null) {
                    String reason = line.substring(token[0].length() + token[1].length() + 2).trim();
                    user.shadowban(reason);
                    database.adminLogServer(String.format("shadowban %s with reason: %s", user.getName(), reason));
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
                nuke(fromX, fromY, toX, toY, (byte) 0xFF, toColor);
            } else if (token[0].equalsIgnoreCase("replace")) {
                int fromX = Integer.parseInt(token[1]);
                int fromY = Integer.parseInt(token[2]);
                int toX = Integer.parseInt(token[3]);
                int toY = Integer.parseInt(token[4]);
                byte fromColor = (byte) Integer.parseInt(token[5]);
                byte toColor = (byte) (token.length >= 7 ? Integer.parseInt(token[6]) : 0xFF);
                nuke(fromX, fromY, toX, toY, fromColor, toColor);
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
            } else if (token[0].equalsIgnoreCase("stack")) {
                //stack USERNAME[ set AMOUNT]
                if (token.length > 1) {
                    User user = userManager.getByName(token[1]);
                    if (user != null) {
                        if (token.length == 2) {
                            System.out.printf("User %s has %d stacked%n", user.getName(), user.getStacked());
                        } else {
                            if (token[2].equalsIgnoreCase("set")) {
                                try {
                                    Integer toSet = Integer.valueOf(token[3]);
                                    user.setStacked(toSet);
                                    server.getPacketHandler().sendAvailablePixels(user, "override");
                                } catch (NumberFormatException ignored) {
                                    System.out.printf("Invalid value: %s%n", token[3]);
                                }
                            }
                        }
                    } else {
                        System.out.printf("Unknown user: %s%n", token[1]);
                    }
                }
            }
        } catch (RuntimeException e) {
            e.printStackTrace();
        }
    }

    private static int stackMultiplier;
    private static int stackMaxStacked;

    private static void loadConfig() {
        config = ConfigFactory.parseFile(new File("pxls.conf")).withFallback(ConfigFactory.load());
        config.checkValid(ConfigFactory.load());

        mapSaveTimer = new PxlsTimer(config.getDuration("board.saveInterval", TimeUnit.SECONDS));
        mapBackupTimer = new PxlsTimer(config.getDuration("board.backupInterval", TimeUnit.SECONDS));
        stackMultiplier = App.getConfig().getInt("stacking.cooldownMultiplier");
        stackMaxStacked = App.getConfig().getInt("stacking.maxStacked");
        
        try {
            Files.deleteIfExists(getStorageDir().resolve("index_cache.html"));
        } catch (IOException e) {
            // do nothing
        }
    }

    public static int getStackMultiplier() {
        return stackMultiplier;
    }

    public static int getStackMaxStacked() {
        return stackMaxStacked;
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

    public static byte[] getVirginmapData() {
        return virginmap;
    }

    public static byte[] getBoardData() {
        return board;
    }

    public static boolean getHavePlacemap() {
        return havePlacemap;
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

    public static String getWhoamiAllowedOrigin() {
        if (cachedWhoamiOrigin == null) cachedWhoamiOrigin = config.getString("whoamiAllowedOrigin");
        return cachedWhoamiOrigin;
    }

    public static int getPixel(int x, int y) {
        return board[x + y * width];
    }

    public static int getPlacemap(int x, int y) {
        return placemap[x + y * width];
    }

    public static int getVirginmap(int x, int y) {
        return virginmap[x + y * width];
    }

    public static boolean getRegistrationEnabled() { return getConfig().getBoolean("oauth.enableRegistration"); }

    public static void putPixel(int x, int y, int color, User user, boolean mod_action, String ip, boolean updateDatabase) {
        if (x < 0 || x >= width || y < 0 || y >= height || (color >= getPalette().size() && !(color == 0xFF || color == -1))) return;
        String userName = user != null ? user.getName() : "<server>";

        board[x + y * width] = (byte) color;
        heatmap[x + y * width] = (byte) 0xFF;
        virginmap[x + y * width] = (byte) 0x00;
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

    private static void nuke(int fromX, int fromY, int toX, int toY, byte fromColor, byte toColor) {
        XnioWorker worker = server.getServer().getWorker();
        worker.execute(() -> nuke_(fromX, fromY, toX, toY, fromColor, toColor));
    }

    private static void nuke_(int fromX, int fromY, int toX, int toY, byte fromColor, byte toColor) {
        List<ServerPlace.Pixel> forBroadcast = new ArrayList<>();
        for (int x = Math.min(fromX, toX); x <= Math.max(fromX, toX); x++) {
            for (int y = Math.min(fromY, toY); y <= Math.max(fromY, toY); y++) {
                byte c = toColor;
                if (toColor == 0xFF || toColor == -1) {
                    c = getDefaultColor(x, y);
                }
                int pixelColor = getPixel(x, y);
                // fromColor is 0xFF or -1 if we're nuking
                if (pixelColor != toColor) {
                    putPixel(x, y, c, null, true, "<nuke action>", false);
                    forBroadcast.add(new ServerPlace.Pixel(x, y, c));
                    if (fromColor == 0xFF || fromColor == -1) {
                        database.putNukePixel(x, y, c);
                    } else if (pixelColor == fromColor) {
                        database.putNukePixel(x, y, fromColor, c);
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

    private static void loadPlacemap() {
        try {
            byte[] bytes = Files.readAllBytes(getStorageDir().resolve("placemap.dat"));
            System.arraycopy(bytes, 0, placemap, 0, width * height);
            havePlacemap = true;
        } catch (NoSuchFileException e) {
            System.out.println("Warning: Cannot find placemap.dat in working directory, using blank placemap");
            havePlacemap = false;
        } catch (IOException e) {
            e.printStackTrace();
        }
    }

    private static void loadVirginmap() {
        try {
            byte[] bytes = Files.readAllBytes(getStorageDir().resolve("virginmap.dat"));
            System.arraycopy(bytes, 0, virginmap, 0, width * height);
        } catch (NoSuchFileException e) {
            System.out.println("Warning: Cannot find virginmap.dat in working directory, using blank virginmap");
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

    public static void tickStackedPixels() {
        for (User user : server.getAuthedUsers().values()) {
            user.tickStack();
        }
    }

    public static void saveMap() {
        mapSaveTimer.run(App::saveMapForce);
        mapBackupTimer.run(App::saveMapBackup);
    }

    private static void saveMapForce() {
        saveMapToDir(getStorageDir().resolve("board.dat"));
        saveHeatmapToDir(getStorageDir().resolve("heatmap.dat"));
        saveVirginmapToDir(getStorageDir().resolve("virginmap.dat"));
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

    private static void saveVirginmapToDir(Path path) {
        try {
            Files.write(path, virginmap);
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
