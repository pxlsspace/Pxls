package space.pxls;

import com.google.gson.Gson;
import com.typesafe.config.Config;
import com.typesafe.config.ConfigFactory;
import org.apache.logging.log4j.Level;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import space.pxls.data.Database;
import space.pxls.server.UndertowServer;
import space.pxls.user.User;
import space.pxls.user.UserManager;
import space.pxls.util.Timer;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.List;
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

    private static Timer mapSaveTimer;
    private static Timer mapBackupTimer;

    public static void main(String[] args) {
        gson = new Gson();

        loadConfig();
        loadMap();

        pixelLogger = LogManager.getLogger("Pixels");

        width = config.getInt("board.width");
        height = config.getInt("board.height");
        board = new byte[width * height];

        database = new Database();
        userManager = new UserManager();

        new UndertowServer(config.getInt("server.port")).start();

        Runtime.getRuntime().addShutdownHook(new Thread(() -> {
            saveMapBackup();
            saveMapForce();
        }));
        saveMap();
    }

    private static void loadConfig() {
        config = ConfigFactory.parseFile(new File("pxls.conf")).withFallback(ConfigFactory.load());
        config.checkValid(ConfigFactory.load());

        mapSaveTimer = new Timer(config.getDuration("board.saveInterval", TimeUnit.SECONDS));
        mapBackupTimer = new Timer(config.getDuration("board.backupInterval", TimeUnit.SECONDS));
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
        return config.hasPath("captcha.key") && config.hasPath("captcha.secret");
    }


    public static int getPixel(int x, int y) {
        return board[x + y * width];
    }

    public static void putPixel(int x, int y, int color, User user) {
        if (x < 0 || x >= width || y < 0 || y >= height || color < 0 || color >= getPalette().size()) return;
        board[x + y * width] = (byte) color;
        pixelLogger.log(Level.INFO, user.getName() + " " + x + " " + y + " " + color);
        database.placePixel(x, y, color, user);
    }

    private static void loadMap() {
        try {
            board = Files.readAllBytes(getStorageDir().resolve("board.dat"));
        } catch (IOException e) {
            e.printStackTrace();
        }
    }

    public static void saveMap() {
        mapSaveTimer.run(App::saveMapForce);
        mapBackupTimer.run(App::saveMapBackup);
    }

    private static void saveMapForce() {
        saveMapToDir(getStorageDir().resolve("board.dat"));
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

    public static UserManager getUserManager() {
        return userManager;
    }

    public static Database getDatabase() {
        return database;
    }
}
