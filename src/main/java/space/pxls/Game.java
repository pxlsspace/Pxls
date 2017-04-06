package space.pxls;

import com.typesafe.config.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.nio.charset.Charset;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

public class Game {
    private Logger pixelLogger;
    private Logger logger;
    private int width;
    private int height;
    private byte[] board;
    private List<String> palette;
    private int cooldown;

    private Map<String, Profile> profiles = new ConcurrentHashMap<>();
    private Config config;
    private Config userConf;

    private long lastSave;

    public Game() {
        loadConfig();
        loadUsers();

        // w/h can't be overwritten live, others go in loadConfig()
        width = config.getInt("board.width");
        height = config.getInt("board.height");
        board = new byte[width * height];

        try {
            loadBoard(getBoardFile());
        } catch (IOException e) {
            e.printStackTrace();
        }
    }

    public void initLogger() {
        pixelLogger = LoggerFactory.getLogger("PIXELS");
        logger = LoggerFactory.getLogger(Game.class);
    }

    public void loadConfig() {
        config = ConfigFactory.parseFile(Paths.get("pxls.conf").toFile()).withFallback(ConfigFactory.load());
        palette = config.getStringList("board.palette");
        cooldown = config.getInt("cooldown");
    }

    public void loadUsers() {
        userConf = ConfigFactory.parseFile(Paths.get("users.conf").toFile());

        for (String ip : userConf.root().keySet()) {
            getProfile(ip.replaceAll("-", ":").replaceAll("_", ".")).role = userConf.getEnum(Role.class, ip);
        }
    }

    private void saveUsers() {
        String conf = userConf.root().render(ConfigRenderOptions
                .defaults()
                .setJson(false)
                .setComments(true)
                .setFormatted(true)
                .setOriginComments(false));
        try {
            Files.write(Paths.get("users.conf"), conf.getBytes(Charset.forName("UTF-8")));
        } catch (IOException e) {
            e.printStackTrace();
        }
    }

    public Profile getProfile(String ip) {
        return profiles.computeIfAbsent(ip, (key) -> new Profile(ip));
    }

    public int getWidth() {
        return width;
    }

    public int getHeight() {
        return height;
    }

    public Config getConfig() {
        return config;
    }

    public byte[] getBoard() {
        return board;
    }

    public List<String> getPalette() {
        return palette;
    }

    public int getCooldown() {
        return cooldown;
    }

    public void setCooldown(int cooldown) {
        this.cooldown = cooldown;
    }

    public float getWaitTime(long lastPlace) {
        long nextPlace = lastPlace + cooldown * 1000;
        return Math.max(0, nextPlace - System.currentTimeMillis()) / 1000f;
    }

    private void loadBoard(Path boardFile) throws IOException {
        byte[] data = Files.readAllBytes(boardFile);
        System.arraycopy(data, 0, board, 0, Math.min(data.length, board.length));
    }

    public void saveBoard(Path boardFile) throws IOException {
        Files.createDirectories(boardFile.getParent());
        Files.write(boardFile, board);
    }

    public void saveBoard() {
        saveBoard(false);
    }

    public void saveBoard(boolean force) {
        long currTime = System.currentTimeMillis();

        if (!force && lastSave > 0 && lastSave + (180 * 1000) > currTime) return;
        lastSave = currTime;

        try {
            saveBoard(getBoardFile());
            saveBoard(getBoardFile().getParent().resolve("backups").resolve("board." + currTime + ".dat"));

            logger.info("Saved board to {} and backups/board.{}.dat", getBoardFile().getFileName(), currTime);
        } catch (IOException e) {
            logger.error("Error while saving board", e);
        }
    }

    public Path getBoardFile() {
        return Paths.get(config.getString("server.storage")).resolve("board.dat");
    }

    public void setPixelRaw(int x, int y, byte color) {
        board[x + y * width] = color;
    }

    public void setPixel(int x, int y, byte color, String byWhom) {
        pixelLogger.info("{} at ({},{}) by {}", palette.get(color), x, y, byWhom);
        setPixelRaw(x, y, color);
        saveBoard();
    }

    public int getPixel(int x, int y) {
        return board[x + y * width];
    }

    public void setRole(Profile p, Role role) {
        p.role = role;

        userConf = userConf.withValue(p.ip.replaceAll(":", "-").replaceAll("\\.", "_"), ConfigValueFactory.fromAnyRef(role.name()));
        saveUsers();
    }
}
