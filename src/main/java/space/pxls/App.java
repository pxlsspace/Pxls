package space.pxls;

import com.google.gson.Gson;
import com.typesafe.config.Config;
import com.typesafe.config.ConfigException;
import com.typesafe.config.ConfigFactory;
import com.typesafe.config.ConfigList;
import com.typesafe.config.ConfigValue;
import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.Optional;
import java.util.Scanner;
import java.util.Timer;
import java.util.TimerTask;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;
import org.apache.commons.jcs.JCS;
import org.apache.logging.log4j.Level;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.xnio.XnioWorker;
import space.pxls.data.DBChatMessage;
import space.pxls.data.DBPixelPlacementFull;
import space.pxls.data.DBRollbackPixel;
import space.pxls.data.Database;
import space.pxls.palette.Color;
import space.pxls.palette.Palette;
import space.pxls.server.UndertowServer;
import space.pxls.server.packets.chat.Badge;
import space.pxls.server.packets.chat.ClientChatMessage;
import space.pxls.server.packets.socket.ClientUndo;
import space.pxls.server.packets.socket.ServerAlert;
import space.pxls.server.packets.socket.ServerNotification;
import space.pxls.server.packets.socket.ServerPlace;
import space.pxls.server.packets.socket.ServerRenameSuccess;
import space.pxls.user.Chatban;
import space.pxls.user.Faction;
import space.pxls.user.FactionManager;
import space.pxls.user.PlacementOverrides;
import space.pxls.user.Role;
import space.pxls.user.User;
import space.pxls.user.UserLogin;
import space.pxls.user.UserManager;
import space.pxls.util.HeatmapTimer;
import space.pxls.util.PxlsTimer;
import space.pxls.util.RateLimitFactory;
import space.pxls.util.SessionTimer;
import space.pxls.util.TextFilter;
import space.pxls.util.Util;

public class App {

    private static Gson gson;
    private static Config config;
    private static Database database;
    private static UserManager userManager;
    private static Logger pixelLogger;
    private static Logger shadowbannedPixelLogger;
    private static Logger appLogger;

    private static String canvasCode;

    private static int width;
    private static int height;
    private static byte[] board;
    private static byte[] heatmap;
    private static byte[] placemap;
    private static byte[] virginmap;
    private static byte[] defaultBoard;
    private static boolean havePlacemap;
    private static Palette palette;

    private static PxlsTimer mapSaveTimer;
    private static PxlsTimer mapBackupTimer;
    private static UndertowServer server;

    
    private static int stackMultiplier;
    private static int stackMaxStacked;
    private static long userIdleTimeout;

    public static final String STATE_ON_OFF = "STATE=on|off";
    public static final String USER_NOT_EXISTS = "User doesn't exist";
    public static final String UNKNOWN_USER = "Unknown user: {}";
    public static final String AUTHENTICATED_CONNECTIONS_COUNT = "Authenticated connections count: {}";
    public static final String BANNED_VIA_CONSOLE_NO_REASON_GIVEN = "Banned via console; no reason given";
    public static final String CANT_FIND_USER = "Cannot find user {}";

    public static void main(String[] args) {
        gson = new Gson();

        loadConfig();
        loadPalette();

        // ensure JCS reads our configs
        JCS.getInstance("factions");
        JCS.getInstance("users");

        pixelLogger = LogManager.getLogger("Pixels");
        shadowbannedPixelLogger = LogManager.getLogger("ShadowbannedPixels");
        appLogger = LogManager.getLogger("App");

        canvasCode = config.getString("canvascode");

        width = config.getInt("board.width");
        height = config.getInt("board.height");
        board = new byte[width * height];
        heatmap = new byte[width * height];
        placemap = new byte[width * height];
        virginmap = new byte[width * height];
        defaultBoard = null;

        initStorage();
        loadDefaultMap();
        loadMap();
        loadHeatmap();
        havePlacemap = loadPlacemap();
        loadVirginmap();

        database = new Database();
        userManager = new UserManager();

        loadRoles();

        new Thread(() -> {
            Scanner s = new Scanner(System.in);
            try {
                while (true) {
                    handleCommand(s.nextLine());
                }
            } catch (NoSuchElementException ex) {
                // System.in closed, program is shutting down.
                s.close();
            }
        }).start();

        new Timer().schedule(new SessionTimer(), 0, 1000 * 3600); // execute once every hour

        int heatmapTimerCd = (int) App.getConfig().getDuration("board.heatmapCooldown", TimeUnit.SECONDS);
        new Timer().schedule(new HeatmapTimer(), 0, heatmapTimerCd * 1000L / 256);

        Runtime.getRuntime().addShutdownHook(new Thread(() -> {
            getLogger().info("Saving map before shutdown...");
            saveMapBackup();
            saveMapForce();
        }));

        server = new UndertowServer(config.getInt("server.port"));
        server.start();

        new Timer().schedule(new TimerTask() {
            @Override
            public void run() {
                tickStackedPixels();
                checkUserTimeout();
            }
        }, 0, 5000);
        new Timer().schedule(new TimerTask() {
            @Override
            public void run() {
                getServer().getPacketHandler().updateUserData();
            }
        }, 0, 600000); //10 minutes

        try {
            Path backupsDir = getStorageDir().resolve("backups/");
            if (!Files.exists(backupsDir)) {
                if (!backupsDir.toFile().mkdirs()) {
                    getLogger().error("Failed to make backup dirs");
                } else {
                    getLogger().info("Created missing backups dir at {}", backupsDir.toAbsolutePath().normalize());
                }
            }
        } catch (Exception e) {
            getLogger().error(new Error("Failed to create backup directories", e));
        }
        saveMap();
    }

    private static void handleCommand(String line) {
        try {
            String[] token = line.split(" ");
            if (token[0].equalsIgnoreCase("reload")) {
                handleConfigReload();
            } else if (token[0].equalsIgnoreCase("save")) {
                handleSave();
            } else if (token[0].equalsIgnoreCase("logins") || token[0].equalsIgnoreCase("login")) {
                handleLogin(token);
            } else if (token[0].equalsIgnoreCase("addlogins") || token[0].equalsIgnoreCase("addlogin")) {
                handleAddLogin(token);
            } else if (token[0].equalsIgnoreCase("removelogins") || token[0].equalsIgnoreCase("removelogin")) {
                handleRemoveLogin(token);
            } else {
                if (token[0].equalsIgnoreCase("roles") || token[0].equalsIgnoreCase("role")) {
                    handleRoles(token);
                } else if (token[0].equalsIgnoreCase("addroles") || token[0].equalsIgnoreCase("addrole")) {
                    handleAddRoles(token);
                } else if (token[0].equalsIgnoreCase("removeroles") || token[0].equalsIgnoreCase("removerole")) {
                    handleRemoveRoles(token);
                } else if (token[0].equalsIgnoreCase("alert")) {
                    var rest = Arrays.copyOfRange(token, 1, token.length);
                    String message = String.join(" ", rest);
                    App.getDatabase().insertServerAdminLog(String.format("Sent a server-wide broadcast with the content: %s", message));
                    server.broadcast(new ServerAlert("console", message));
                    getLogger().info("Alert sent");
                } else if (token[0].equalsIgnoreCase("ban")) {
                    handleBan(token);
                } else if (token[0].equalsIgnoreCase("permaban")) {
                    handlePermaban(token);
                } else if (token[0].equalsIgnoreCase("shadowban")) {
                    handleShadowBan(token);
                } else if (token[0].equalsIgnoreCase("unban")) {
                    handleUnban(token);
                } else if (token[0].equalsIgnoreCase("nuke")) {
                    int fromX = Integer.parseInt(token[1]);
                    int fromY = Integer.parseInt(token[2]);
                    int toX = Integer.parseInt(token[3]);
                    int toY = Integer.parseInt(token[4]);
                    byte toColor = (byte) (token.length >= 6 ? Integer.parseInt(token[5]) : 0xFF);
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
                        if (!token[1].equalsIgnoreCase("authed") && !token[1].equalsIgnoreCase("authd")) {
                            getLogger().info("All connections count: {}", server.getPacketHandler().getNumAllCons());
                        }
                    } else {
                        getLogger().info("All connections count: {}", server.getPacketHandler().getNumAllCons());
                    }
                    getLogger().info(AUTHENTICATED_CONNECTIONS_COUNT, server.getAuthedUsers().size());
                } else if (token[0].equalsIgnoreCase("users")) {
                    getLogger().log(Level.INFO, "Number of authenticated users: {}", server.getAuthedUsers().size());
                    for (User user : server.getAuthedUsers().values()) {
                        getLogger().info("[{}] {} ({}) (num connections: {})", user.getId(), user.getName(), user.getRoleIDsString(), user.getConnections().size());
                    }
                } else if (token[0].equalsIgnoreCase("stack")) {
                    handleStack(token);
                } else if (token[0].equalsIgnoreCase("placementOverride") || token[0].equalsIgnoreCase("placementOverrides")) {
                    //placementOverride list|USERNAME[ NAME STATE]
                    //NAME=placeanycolor|ignorecooldown|ignoreplacemap
                    //STATE=on|off
                    if (token.length > 1 && !token[1].equalsIgnoreCase("help")) {
                        handleHelp(token);
                    } else {
                        getLogger().info("placementOverride list|USERNAME[ NAME STATE]");
                        getLogger().info("NAME=placeAnyColor|ignoreCooldown|ignorePlacemap");
                        getLogger().info(STATE_ON_OFF);
                    }
                } else if (token[0].equalsIgnoreCase("captchaOverride")) {
                    handleCaptchaOverride(token);
                } else if (token[0].equalsIgnoreCase("broadcast")) {
                    //broadcast MESSAGE
                    if (token.length > 1) {
                        App.getServer().getPacketHandler().handleChatMessage(null, null, new ClientChatMessage(line.substring(token[0].length() + 1)));
                    }
                } else if (token[0].equalsIgnoreCase("ChatBan")) {
                    handleChatBan(line, token);
                } else if (token[0].equalsIgnoreCase("PermaChatBan")) {
                    handlePermaChatBan(line, token);
                } else if (token[0].equalsIgnoreCase("UnChatBan")) {
                    if (token.length > 2) {
                        User user = userManager.getByName(token[1]);
                        if (user == null) getLogger().info(UNKNOWN_USER, token[1]);
                        else {
                            Chatban.UNBAN(user, null, line.substring(token[0].length() + token[1].length() + 2)).commit();
                        }
                    } else {
                        getLogger().info("UnChatBan USER REASON");
                    }
                } else if (token[0].equalsIgnoreCase("ChatPurge")) {
                    handleChatPurge(line, token);
                } else if (token[0].equalsIgnoreCase("cf")) {
                    String z = line.substring(token[0].length() + 1);
                    getLogger().info("running chat filter against '{}'Result: {}", z, TextFilter.getInstance().filter(z, true));
                } else if (token[0].equalsIgnoreCase("reloadUsers")) {
                    getLogger().info("Working... (may cause some lag)");
                    userManager.reload();
                    getLogger().info("Done.");
                } else if (token[0].equalsIgnoreCase("flagRename")) {
                    //flagRename USERNAME [1|0]
                    if (token.length >= 2) {
                        boolean flagState = token.length < 3 || (token[2].equalsIgnoreCase("1") || token[2].equalsIgnoreCase("true") || token[2].equalsIgnoreCase("yes") || token[2].equalsIgnoreCase("y"));
                        User toFlag = userManager.getByName(token[1]);
                        if (toFlag != null) {
                            getLogger().info("Flagging {} as {}", toFlag.getName(), flagState);
                            toFlag.setRenameRequested(flagState);
                            App.getDatabase().insertServerAdminLog(String.format("%s %s (%d) for name change", flagState ? "Flagged" : "Unflagged", toFlag.getName(), toFlag.getId()));
                        } else {
                            getLogger().info(USER_NOT_EXISTS);
                        }
                    } else {
                        getLogger().info("flagRename USERNAME [1|0]");
                    }
                } else if (token[0].equalsIgnoreCase("setName") || token[0].equalsIgnoreCase("updateUsername")) {
                    handleSetUserName(token);
                } else if (token[0].equalsIgnoreCase("idleCheck")) {
                    try {
                        checkUserTimeout();
                    } catch (Exception e) {
                        e.printStackTrace();
                    }
                } else if (token[0].equalsIgnoreCase("sendUserData")) {
                    App.getServer().getPacketHandler().updateUserData();
                } else if (token[0].equalsIgnoreCase("addnotification")) {
                    handleAddNotification(token);
                } else if (token[0].equalsIgnoreCase("bp")) {
                    if (token.length == 1) {
                        getLogger().info("{} raw_packet", token[0]);
                        return;
                    }
                    String raw = line.substring(token[0].length() + 1);
                    App.getServer().broadcastRaw(raw);
                    getLogger().info("Packet broadcast sent.");
                } else if (token[0].equalsIgnoreCase("up")) {
                    if (token.length < 3) {
                        getLogger().info("{} username raw_packet", token[0]);
                        return;
                    }
                    User user = userManager.getByName(token[1]);
                    if (user == null) {
                        getLogger().info(USER_NOT_EXISTS);
                        return;
                    }
                    String raw = line.substring(token[0].length() + token[1].length() + 2);
                    App.getServer().sendRaw(user, raw);
                    getLogger().info("Packet sent to {} (UID {})'s connections (#{}).", user.getName(), user.getId(), user.getConnections().size());
                } else if (token[0].equalsIgnoreCase("f")) {
                    handleF(line, token);
                }
            }
        } catch (RuntimeException e) {
            e.printStackTrace();
        }
    }

    private static void handleSetUserName(String[] token) {
        //setName USERNAME NEW_USERNAME
        if (token.length >= 3) {
            User toRename = userManager.getByName(token[1]);
            if (toRename != null) {
                toRename.setRenameRequested(false);
                if (toRename.updateUsername(token[2], true)) {
                    App.getServer().send(toRename, new ServerRenameSuccess(toRename.getName()));
                    App.getDatabase().insertServerAdminLog(String.format("Changed %s's name to %s (uid: %d)", token[1], token[2], toRename.getId()));
                    getLogger().info("Name updated");
                } else {
                    getLogger().info("Failed to update name (function returned false. name taken or an error occurred)");
                }
            } else {
                getLogger().info(USER_NOT_EXISTS);
            }
        } else {
            getLogger().info("{} USERNAME NEW_USERNAME", token[0]);
        }
    }

    private static void handleAddNotification(String[] token) {
        if (token.length < 4) {
            getLogger().info("{} TITLE EXPIRY BODY", token[0]);
            return;
        }

        String title = token[1];
        long expiry;
        try {
            if (token[2].startsWith("+")) {
                expiry = (new Date().getTime() / 1000) + Long.parseUnsignedLong(token[2].substring(1));
            } else {
                expiry = Long.parseUnsignedLong(token[2]);
            }
        } catch (NumberFormatException e) {
            getLogger().warn("Invalid expiry.", e);
            return;
        }
        String body = token[3];

        int id = App.getDatabase().createNotification(-1, title, body, expiry);
        App.getServer().broadcast(new ServerNotification(App.getDatabase().getNotification(id)));
        getLogger().info("Notification sent");
    }

    private static void handleF(String line, String[] token) {
        // f $FID [$ACTION[ $VALUE]]
        String subcommand;
        if (token.length == 1) {
            subcommand = "help";
        } else {
            subcommand = token[1].toLowerCase().trim();
        }
        if ("reload".equals(subcommand)) {
            FactionManager.getInstance().invalidateAll();
            getLogger().info("Invalidated factions");
            return;
        } else if ("mc".equals(subcommand)) {
            getLogger().info(FactionManager.getInstance().getCachedFactions().getStats());
            return;
        } else if ("help".equals(subcommand)) {
            getLogger().info("f $FID [delete|tag|name[ $VALUE]]");
            return;
        }
        int i;
        try {
            i = Integer.parseInt(token[1]);
        } catch (NumberFormatException nfe) {
            getLogger().info("Invalid ID: {}", token[1]);
            return;
        }
        Optional<Faction> f = FactionManager.getInstance().getByID(i);
        if (f.isPresent()) {
            Faction faction = f.get();
            String _action = "list";
            String _value = null;
            if (token.length > 2) {
                _action = token[2].toLowerCase().trim();
                if (token.length > 3) {
                    _value = line.substring(token[0].length() + token[1].length() + token[2].length() + 3).toLowerCase().trim();
                }
            }
            switch(_action) {
                case "delete": {
                    FactionManager.getInstance().deleteByID(i);
                    getLogger().info("Delete invoked for faction {}", i);
                    break;
                }
                case "tag": {
                    if (_value == null) {
                        getLogger().info("Faction {}'s tag: {}", i, faction.getTag());
                    } else {
                        faction.setTag(_value);
                        FactionManager.getInstance().update(faction, true);
                        getLogger().info("Faction updated");
                    }
                    break;
                }
                case "name": {
                    if (_value == null) {
                        getLogger().info("Faction {}'s name: {}", i, faction.getName());
                    } else {
                        faction.setName(_value);
                        FactionManager.getInstance().update(faction, true);
                        getLogger().info("Faction updated");
                    }
                    break;
                }
                // TODO: ban, unban, owner, color
                default: {
                    getLogger().info(faction);
                    break;
                }
            }
        } else {
            getLogger().info("The faction {} does not exist.", i);
        }
    }

    private static void handleChatPurge(String line, String[] token) {
        if (token.length > 2) {
            User user = userManager.getByName(token[1]);
            if (user == null) getLogger().info(UNKNOWN_USER, token[1]);
            else {
                var toPurge = Integer.MAX_VALUE;
                String reason = "";
                try {
                    toPurge = Integer.parseInt(token[2]);
                } catch (Exception e) {
                    getLogger().info("Failed to parse '{}' as a number, defaulting to {}", token[2], toPurge);
                }

                if (token.length >= 4) {
                    reason = line.substring(token[0].length() + token[1].length() + token[2].length() + 3);
                } else {
                    reason = "";
                }

                if (toPurge > 0) {
                    App.getDatabase().purgeChat(user, null, toPurge, reason, true);
                } else {
                    getLogger().info("Invalid toPurge. Should be >0, got {}", toPurge);
                }

            }
        } else {
            getLogger().info("ChatPurge USER [AMOUNT ]REASON");
        }
    }

    private static void handlePermaChatBan(String line, String[] token) {
        if (token.length > 3) {
            User user = userManager.getByName(token[1]);
            if (user == null) getLogger().info(UNKNOWN_USER, token[1]);
            else {
                var messageRemoval = token[2].equals("1") || token[2].equalsIgnoreCase("yes") || token[2].equalsIgnoreCase("true");
                String reason = line.substring(token[0].length() + token[1].length() + token[2].length() + 3);
                Chatban.PERMA(user, null, reason, messageRemoval, Integer.MAX_VALUE).commit();
            }
        } else {
            getLogger().info("PermaChatBan USER MESSAGE_REMOVAL REASON\n    USER: The name of the user\n    MESSAGE_REMOVAL: Boolean (1|0) of whether or not to purge the user from chat.\n    REASON: The reason for the chatban. Will be displayed to the user");
        }
    }

    private static void handleChatBan(String line, String[] token) {
        if (token.length > 4) {
            User user = getUserManager().getByName(token[1]);
            if (user == null) getLogger().info(UNKNOWN_USER, token[1]);
            else {
                var banLength = 600;
                try {
                    banLength = Integer.parseInt(token[2]);
                } catch (Exception e) {
                    getLogger().info("Failed to parse BAN_LENGTH '{}'. Defaulting to 600", token[2]);
                }
                var messageRemoval = token[3].equals("1") || token[3].equalsIgnoreCase("yes") || token[3].equalsIgnoreCase("true");
                String reason = line.substring(
                    token[0].length() + token[1].length() + token[2].length() + token[3].length() + 4);
                Chatban.TEMP(user, null, System.currentTimeMillis() + banLength * 1000L, reason, messageRemoval, Integer.MAX_VALUE).commit();
            }
        } else {
            getLogger().info("chatban USER BAN_LENGTH MESSAGE_REMOVAL REASON\n    USER: The name of the user\n    BAN_LENGTH: The length in seconds of the chatban. For permas, see 'PermaChatBan' command.\n    MESSAGE_REMOVAL: Boolean (1|0) of whether or not to purge the user from chat.\n    REASON: The reason for the chatban. Will be displayed to the user");
        }
    }

    private static void handleCaptchaOverride(String[] token) {
        //captchaOverride list|USERNAME[ STATE]
        //STATE=on|off
        if (!isCaptchaConfigured()) {
            getLogger().info(
                "NOTE: captcha is not configured (missing key and/or secret). " +
                "Users with captchaOverride on won't receive any captchas."
            );
        }
        if (token.length > 1) {
            if (token[1].equalsIgnoreCase("list")) {
                StringBuilder sb = new StringBuilder();
                userManager.getAllUsersByToken().forEach((s, user) -> {
                    if (user.isOverridingCaptcha()) sb.append("    ").append(user.getName()).append('\n');
                });
                getLogger().info(sb);
            } else if (token[1].equalsIgnoreCase("help")) {
                getLogger().info("captchaOverride list|USERNAME[ STATE]");
                getLogger().info(STATE_ON_OFF);
            } else {
                User user = getUserManager().getByName(token[1]);
                if (user == null) {
                    getLogger().info(UNKNOWN_USER, token[1]);
                } else {
                    if (token.length >= 3) {
                        if (token[2].equalsIgnoreCase("on") || token[2].equalsIgnoreCase("off")) {
                            user.setOverrideCaptcha(token[2].equalsIgnoreCase("on"));
                            getLogger().info("Updated {}'s captchaOverride state to {}", user.getName(), token[2]);
                        } else {
                            getLogger().info("Invalid state: {}", token[2]);
                        }
                    } else {
                        getLogger().info("User's Captcha Override state is: {}", user.isOverridingCaptcha() ? "on" : "off");
                    }
                }
            }
        } else {
            getLogger().info("captchaOverride list|USERNAME[ STATE]");
            getLogger().info(STATE_ON_OFF);
        }
    }

    private static boolean handleHelp(String[] token) {
        if (token[1].equalsIgnoreCase("list")) {
            StringBuilder sb = new StringBuilder();
            userManager.getAllUsersByToken().forEach((s, user) -> {
                PlacementOverrides po = user.getPlaceOverrides();
                ArrayList<String> enabledPOs = new ArrayList<>();
                if (po.getCanPlaceAnyColor()) {
                    enabledPOs.add("placeAnyColor");
                }
                if (po.hasIgnoreCooldown()) {
                    enabledPOs.add("ignoreCooldown");
                }
                if (po.hasIgnorePlacemap()) {
                    enabledPOs.add("ignorePlacemap");
                }

                if (!enabledPOs.isEmpty()) {
                    sb.append("    ").append(user.getName()).append(": ").append(String.join(", ", enabledPOs)).append("\n");
                }
            });

            getLogger().info(sb.length() > 0 ? sb.toString().trim() : "    <no one has any Placement Overrides enabled>");
        } else {
            User user = getUserManager().getByName(token[1]);
            if (user == null) {
                getLogger().info(UNKNOWN_USER, token[1]);
            } else {
                PlacementOverrides po = user.getPlaceOverrides();
                if (token.length >= 4) {
                    boolean state = token[3].equalsIgnoreCase("on");
                    if (token[3].equalsIgnoreCase("on")) {
                        state = true;
                    } else if (token[3].equalsIgnoreCase("off")) {
                        state = false;
                    } else {
                        getLogger().info("Invalid state: {}", token[3]);
                        return true;
                    }

                    if (token[2].equalsIgnoreCase("placeAnyColor")) {
                        po.setCanPlaceAnyColor(state);
                    } else if (token[2].equalsIgnoreCase("ignoreCooldown")) {
                        po.setIgnoreCooldown(state);
                    } else if (token[2].equalsIgnoreCase("ignorePlacemap")) {
                        po.setIgnorePlacemap(state);
                    } else {
                        getLogger().info("Invalid placement override name: {}", token[2]);
                        return true;
                    }

                    getLogger().info("Updated {}'s {} state to {}", user.getName(), token[2], state ? "on" : "off");
                    server.getPacketHandler().sendPlacementOverrides(user);
                } else {
                    getLogger().info(
                        "User's Placement Overrides:%n    Ignore cooldown: {}%n    Ignore placemap: {}%n    Place any color: {}",
                        po.hasIgnoreCooldown() ? "on" : "off",
                        po.hasIgnorePlacemap() ? "on" : "off",
                        po.getCanPlaceAnyColor() ? "on" : "off"
                    );
                }
            }
        }
        return false;
    }

    private static void handleStack(String[] token) {
        //stack USERNAME[ set AMOUNT]
        if (token.length > 1) {
            User user = userManager.getByName(token[1]);
            if (user != null) {
                if (token.length == 2) {
                    getLogger().info("User {} has {} stacked", user.getName(), user.getStacked());
                } else {
                    if (token[2].equalsIgnoreCase("set")) {
                        try {
                            var toSet = Integer.parseInt(token[3]);
                            user.setStacked(toSet);
                            server.getPacketHandler().sendAvailablePixels(user, "override");
                        } catch (NumberFormatException ignored) {
                            getLogger().info("Invalid value: {}", token[3]);
                        }
                    }
                }
            } else {
                getLogger().info(UNKNOWN_USER, token[1]);
            }
        }
    }

    private static void handleUnban(String[] token) {
        if (token.length < 2) {
            getLogger().info("Usage: unban <username> [true/false] [reason]");
            return;
        }
        String[] rest = Arrays.copyOfRange(token, 2, token.length);
        var shouldRevert = true;
        if (token.length >= 3) {
            if ("true".equalsIgnoreCase(token[2]) || "false".equalsIgnoreCase(token[2])) {
                shouldRevert = Boolean.parseBoolean(token[2]);
                rest = Arrays.copyOfRange(token, 3, token.length);
            }
        }
        User user = userManager.getByName(token[1]);
        if (user != null) {
            String reason = String.join(" ", rest);
            if (reason.equals("")) reason = "Unbanned via console; no reason given";
            getLogger().info(reason);
            user.unban(null, reason, shouldRevert);
            database.insertServerAdminLog("unban " + user.getName());
            getLogger().info("Unbanned {}.", user.getName());
        } else {
            getLogger().info(CANT_FIND_USER, token[1]);
        }
    }

    private static void handleShadowBan(String[] token) {
        if (token.length < 2) {
            getLogger().info("Usage: shadowban <username> [reason]");
            return;
        }
        var rest = Arrays.copyOfRange(token, 2, token.length);
        User user = userManager.getByName(token[1]);
        if (user != null) {
            String reason = String.join(" ", rest);
            if (reason.equals("")) reason = BANNED_VIA_CONSOLE_NO_REASON_GIVEN;
            user.shadowBan(reason, null);
            database.insertServerAdminLog(String.format("shadowban %s with reason: %s", user.getName(), reason));
            getLogger().info("Shadowbanned {}", user.getName());
        } else {
            getLogger().info(CANT_FIND_USER, token[1]);
        }
    }

    private static void handlePermaban(String[] token) {
        if (token.length < 2) {
            getLogger().info("Usage: permaban <username> [reason]");
            return;
        }
        User user = userManager.getByName(token[1]);
        var rest = Arrays.copyOfRange(token, 2, token.length);
        if (user != null) {
            String reason = String.join(" ", rest);
            if (reason.equals("")) reason = BANNED_VIA_CONSOLE_NO_REASON_GIVEN;
            user.ban(0, reason, null);
            database.insertServerAdminLog(String.format("permaban %s with reason: %s", user.getName(), reason));
            getLogger().info("Permabanned {}", user.getName());
        } else {
            getLogger().info(CANT_FIND_USER, token[1]);
        }
    }

    private static void handleBan(String[] token) {
        if (token.length < 2) {
            getLogger().info("Usage: ban <username> [reason]");
            return;
        }
        var rest = Arrays.copyOfRange(token, 2, token.length);
        User user = userManager.getByName(token[1]);
        if (user != null) {
            String reason = String.join(" ", rest);
            if (reason.equals("")) reason = BANNED_VIA_CONSOLE_NO_REASON_GIVEN;
            user.ban(24 * 60 * 60, reason, null);
            database.insertServerAdminLog(String.format("ban %s with reason: %s", user.getName(), reason));
            getLogger().info("Banned {}  for 24 hours.", user.getName());
        } else {
            getLogger().info(CANT_FIND_USER, token[1]);
        }
    }

    private static void handleRemoveRoles(String[] token) {
        if (token.length < 2) {
            getLogger().info("Usage: removeroles <username> [role ID ...]");
            return;
        }
        User user = userManager.getByName(token[1]);
        if (user == null) {
            getLogger().info(CANT_FIND_USER, token[1]);
            return;
        }
        if (token.length < 3) {
            getLogger().info("Usage: removeroles <username> <role ID ...>");
            return;
        }
        var rest = Arrays.copyOfRange(token, 2, token.length);
        List<Role> roles = Role.fromMixed(List.of(rest));
        user.removeRoles(roles);
        database.setUserRoles(user.getId(), user.getRoles());
        String message = "Removed roles \"" + roles.stream().map(Role::getName).collect(Collectors.joining(", ")) + "\" from " + user.getName();
        database.insertServerAdminLog(message);
        getLogger().info(message);
    }

    private static void handleAddRoles(String[] token) {
        if (token.length < 2) {
            getLogger().info("Usage: addroles <username> [role ID ...]");
            return;
        }
        User user = userManager.getByName(token[1]);
        if (user == null) {
            getLogger().info(CANT_FIND_USER, token[1]);
            return;
        }
        if (token.length < 3) {
            getLogger().info("Usage: addroles <username> <role ID ...>");
            return;
        }
        var rest = Arrays.copyOfRange(token, 2, token.length);
        List<Role> roles = Role.fromMixed(List.of(rest));
        user.addRoles(roles);
        database.setUserRoles(user.getId(), user.getRoles());
        String message = "Added roles \"" + roles.stream().map(Role::getName).collect(Collectors.joining(", ")) + "\" to " + user.getName();
        database.insertServerAdminLog(message);
        getLogger().info(message);
    }

    private static void handleRoles(String[] token) {
        if (token.length < 2) {
            getLogger().info("Usage: roles <username> [role ID ...]");
            return;
        }
        User user = userManager.getByName(token[1]);
        if (user == null) {
            getLogger().info(CANT_FIND_USER, token[1]);
            return;
        }
        if (token.length < 3) {
            if (user.getRoles().isEmpty()) {
                getLogger().info("User {} has no roles", user.getName());
            } else {
                getLogger().info("User {} has roles {}", user.getName(), user.getRolesString());
            }
        }
        var rest = Arrays.copyOfRange(token, 2, token.length);
        List<Role> roles = new ArrayList<>();
        if (!rest[0].equals("-")) {
            roles = Role.fromMixed(List.of(rest));
        }
        if (roles.stream().anyMatch(role -> role.isGuest() || role.isDefault())) {
            getLogger().info("Guest/default roles cannot be assigned");
            return;
        }
        user.setRoles(roles);
        database.setUserRoles(user.getId(), roles);
        String logMessage = "Set " + user.getName() + "'s roles to " + user.getRoleIDsString();
        if (roles.isEmpty()) {
            logMessage = "Removed " + user.getName() + "'s roles";
        }
        database.insertServerAdminLog(logMessage);
        getLogger().info(logMessage);
    }

    private static void handleRemoveLogin(String[] token) {
        if (token.length < 3) {
            getLogger().info("Usage: removelogins <username> [service ID ...]");
            return;
        }
        User user = userManager.getByName(token[1]);
        if (user == null) {
            getLogger().info("Cannot find user {}", token[1]);
            return;
        }
        var rest = Arrays.copyOfRange(token, 2, token.length);
        database.bulkRemoveUserLoginServices(user.getId(), List.of(rest));
        String message = "Removed login methods \"" + String.join(", ", rest) + "\" from " + user.getName();
        database.insertServerAdminLog(message);
        getLogger().info(message);
    }

    private static void handleAddLogin(String[] token) {
        if (token.length < 3) {
            getLogger().info("Usage: addlogins <username> [{service ID}:{service user ID} ...]");
            return;
        }
        User user = userManager.getByName(token[1]);
        if (user == null) {
            getLogger().info(CANT_FIND_USER, token[1]);
            return;
        }
        var rest = Arrays.copyOfRange(token, 2, token.length);
        List<UserLogin> addedLogins;
        try {
            addedLogins = Arrays.stream(rest)
                .distinct()
                .map(UserLogin::fromString)
                .collect(Collectors.toList());
        } catch (IllegalArgumentException ex) {
            getLogger().info(ex);
            return;
        }
        String prettyLogins = addedLogins.stream().map(UserLogin::toString).collect(Collectors.joining(", "));
        database.bulkAddUserLogins(user.getId(), addedLogins);
        String message = "Added login methods \"" + prettyLogins + "\" to " + user.getName();
        database.insertServerAdminLog(message);
        getLogger().info(message);
    }

    private static void handleLogin(String[] token) {
        if (token.length < 2) {
            getLogger().info("Usage: logins <username> [{service ID}:{service user ID} ...]");
            return;
        }
        User user = userManager.getByName(token[1]);
        if (user == null) {
            getLogger().info(CANT_FIND_USER, token[1]);
            return;
        }
        if (token.length < 3) {
            var logins = user.getLogins();
            if (logins.isEmpty()) {
                getLogger().info("User {} has no logins", user.getName());
            } else {
                String prettyLogins = logins.stream()
                    .map(UserLogin::toString)
                    .collect(Collectors.joining(", "));
                getLogger().info("User {} has logins {}", user.getName(), prettyLogins);
            }
            return;
        }
        var rest = Arrays.copyOfRange(token, 2, token.length);
        List<UserLogin> logins = new ArrayList<>();
        if (!rest[0].equals("-")) {
            try {
                logins = Arrays.stream(rest)
                    .distinct()
                    .map(UserLogin::fromString)
                    .collect(Collectors.toList());
            } catch (IllegalArgumentException ex) {
                getLogger().info(ex.toString());
                return;
            }
        }
        database.setUserLogins(user.getId(), logins);
        String prettyLogins = logins.stream()
            .map(UserLogin::toString)
            .collect(Collectors.joining(", "));
        String logMessage = "Set " + user.getName() + "'s login methods to " + prettyLogins;
        if (logins.isEmpty()) {
            logMessage = "Removed " + user.getName() + "'s login methods";
        }
        database.insertServerAdminLog(logMessage);
        getLogger().info(logMessage);
    }

    private static void handleSave() {
        try {
            saveMapForce();
            saveMapBackup();
            getLogger().info("Success!");
        } catch (Exception x) {
            x.printStackTrace();
        }
    }

    private static void handleConfigReload() {
        try {
            loadConfig();
            getLogger().info("Reloaded configuration");
            loadPalette();
            getLogger().info("Reloaded palette configuration");
            loadRoles();
            getLogger().info("Reloaded roles configuration");
            FactionManager.getInstance().invalidateAll();
            getLogger().info("Invalidated all factions");
            userManager.reload();
            getLogger().info("Reloaded user manager");
            getLogger().info("Success!");
        } catch (Exception x) {
            x.printStackTrace();
        }
    }

    private static void loadConfig() {
        config = ConfigFactory.parseFile(new File("pxls.conf")).withFallback(ConfigFactory.load());
        config.checkValid(ConfigFactory.load());

        RateLimitFactory.registerBucketHolder(ClientUndo.class, new RateLimitFactory.BucketConfig(((int) App.getConfig().getDuration("server.limits.undo.time", TimeUnit.SECONDS)), App.getConfig().getInt("server.limits.undo.count")));
        RateLimitFactory.registerBucketHolder(DBChatMessage.class, new RateLimitFactory.BucketConfig(((int) App.getConfig().getDuration("server.limits.chat.time", TimeUnit.SECONDS)), App.getConfig().getInt("server.limits.chat.count")));
        RateLimitFactory.registerBucketHolder("http:discordName", new RateLimitFactory.BucketConfig((int) App.getConfig().getDuration("server.limits.discordNameChange.time", TimeUnit.SECONDS), App.getConfig().getInt("server.limits.discordNameChange.count")));

        mapSaveTimer = new PxlsTimer(config.getDuration("board.saveInterval", TimeUnit.SECONDS));
        mapBackupTimer = new PxlsTimer(config.getDuration("board.backupInterval", TimeUnit.SECONDS));
        stackMultiplier = App.getConfig().getInt("stacking.cooldownMultiplier");
        stackMaxStacked = App.getConfig().getInt("stacking.maxStacked");
        userIdleTimeout = App.getConfig().getDuration("userIdleTimeout", TimeUnit.MILLISECONDS);

        TextFilter.getInstance().reload();

        if (server != null) {
            server.getWebHandler().reloadServicesEnabledState();
        }

        for (Locale locale : Util.SUPPORTED_LOCALES) {
            try {
                Files.deleteIfExists(getStorageDir().resolve("index_" + locale.toLanguageTag() + "_cache.html"));
            } catch (IOException e) {
                // do nothing
            }
        }
    }
    private static void loadRoles() {
        // NOTE: This differs from the way pxls.conf is handled, as we don't merge the roles-reference.conf
        // file into roles.conf, but use it as a default in case roles.conf doesn't exist or is invalid.
        var roleConfigFile = new File("roles.conf");
        var roleConfig = ConfigFactory.parseFile(roleConfigFile.exists() ? roleConfigFile : new File("resources/roles-reference.conf"));

        HashMap<Role, List<String>> inheritanceMap = new HashMap<>();
        for (var id : roleConfig.root().keySet()) {
            var name = roleConfig.getString(id + ".name");
            var guest = Util.defaultConfigVal(() -> roleConfig.getBoolean(id + ".guest"), false);
            var defaultRole = Util.defaultConfigVal(() -> roleConfig.getBoolean(id + ".default"), false);

            ArrayList<Badge> badges = new ArrayList<>();
            try {
                ConfigList badgeList = roleConfig.getList(id + ".badges");
                for (var value : badgeList) {
                    HashMap<String, String> badgeHashMap = (HashMap<String, String>) value.unwrapped();
                    String badgeName = badgeHashMap.get("name");
                    String badgeTooltip = badgeHashMap.get("tooltip");
                    String badgeType = badgeHashMap.get("type");
                    String badgeCSSIcon = badgeHashMap.get("cssIcon");
                    badges.add(new Badge(badgeName, badgeTooltip, badgeType, badgeCSSIcon));
                }
            } catch (ConfigException ex) {
                // If there're no badges for this role
            }

            List<String> permissionNodes = Util.defaultConfigVal(() -> roleConfig.getStringList(id + ".permissions"), Collections.emptyList());

            var role = new Role(id, name, guest, defaultRole, badges, permissionNodes);
            Role.makeCanonical(role);

            // Queue up the inherited role strings for later.
            inheritanceMap.put(role, Util.defaultConfigVal(() -> roleConfig.getStringList(id + ".inherits"), Collections.emptyList()));
        }

        // After all of the roles are registered, handle inheritance mappings.
        inheritanceMap.forEach((role, inheritStrings) -> {
            List<Role> inherits = Role.fromIDs(inheritStrings);
            role.setInherits(inherits);
        });
    }
    public static void loadPalette() {
        // NOTE: This differs from the way pxls.conf is handled, as we don't merge the palette-reference.conf
        // file into roles.conf, but use it as a default in case palette.conf doesn't exist or is invalid.
        var paletteConfigFile = new File("palette.conf");
        var paletteConfig = ConfigFactory.parseFile(paletteConfigFile.exists() ? paletteConfigFile : new File("resources/palette-reference.conf"));

        ArrayList<Color> colors = new ArrayList<>();
        int defaultIdx = -1;
        for (ConfigValue colorConfig : paletteConfig.getList("colors")) {
            Map<String, Object> color = (Map<String, Object>) colorConfig.unwrapped();
            colors.add(new Color((String) color.get("name"), (String) color.get("value")));
        }

        if (paletteConfig.hasPath("backgroundColor")) {
            var backgroundColor = paletteConfig.getAnyRef("backgroundColor");
            if (backgroundColor instanceof Integer) {
                defaultIdx = (int) backgroundColor;
                if (defaultIdx < 0 || defaultIdx >= colors.size()) {
                    defaultIdx = -1;
                    getLogger().warn("Background color index {} is out of bounds", backgroundColor);
                }
            } else if (backgroundColor instanceof String) {
                for (int i = 0; i < colors.size(); i++) {
                    if (colors.get(i).getName().equalsIgnoreCase((String) backgroundColor)) {
                        defaultIdx = i;
                        break;
                    }
                }

                if (defaultIdx == -1) {
                    getLogger().warn("Background color \"{}\" not found", backgroundColor);
                }
            }
        }

        if (defaultIdx == -1) {
            defaultIdx = 0;
            Color first = colors.get(defaultIdx);
            getLogger().warn("Defaulting background color to the first color: \"{}\" (#{})", first.getName(), first.getValue());
        }

        palette = new Palette(colors, (byte) defaultIdx);
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

    public static String getCanvasCode() {
        return canvasCode;
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

    public static byte[] getPlacemapData() {
        return placemap;
    }

    public static byte[] getBoardData() {
        return board;
    }

    public static byte[] getDefaultBoardData() {
        return defaultBoard;
    }

    public static boolean getHavePlacemap() {
        return havePlacemap;
    }

    public static Path getStorageDir() {
        return Paths.get(config.getString("server.storage"));
    }

    public static boolean isCaptchaEnabled() {
        return config.getBoolean("captcha.enabled");
    }

    public static boolean isCaptchaConfigured() {
        return !config.getString("captcha.key").isEmpty() && !config.getString("captcha.secret").isEmpty();
    }

    public static List<String> getWhoamiAllowedOrigins() {
        return config.getStringList("whoamiAllowedOrigins");
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

    public static boolean getSnipMode() {
        return getConfig().getBoolean("oauth.snipMode");
    }

    public static boolean getRegistrationEnabled() {
        return getConfig().getBoolean("oauth.enableRegistration");
    }

    public static boolean isChatEnabled() {
        return getConfig().getBoolean("chat.enabled");
    }

    public static void putPixel(int x, int y, int color, User user, boolean modAction,
        boolean updateDatabase, String action) {
        if (x < 0 || x >= width || y < 0 || y >= height || (color >= getPalette().getColors().size() && !(color == 0xFF || color == -1))) return;
        String userName = user != null ? user.getName() : "<server>";

        if (action.trim().isEmpty()) {
            action = modAction ? "mod overwrite" : "user place";
        }

        board[x + y * width] = (byte) color;
        heatmap[x + y * width] = (byte) 0xFF;
        virginmap[x + y * width] = (byte) 0x00;
        pixelLogger.log(Level.INFO,"{}\t{}\t{}\t{}\t{}", userName, x, y, color, action);
        if (updateDatabase) {
            database.placePixel(x, y, color, user, modAction);
            if (!modAction) {
                if (user != null) {
                    user.increasePixelCounts();
                }
            }
        }
    }

    public static void logShadowbannedPixel(int x, int y, int color, String userName, String ip) {
        shadowbannedPixelLogger.info("{}\t{}\t{}\t{}\t{}", userName, x, y, color, ip);
    }

    public static void rollbackAfterBan(User who, int seconds) {
        if (seconds <= 0) {
            return;
        }

        XnioWorker worker = server.getServer().getWorker();
        worker.execute(() -> doRollbackAfterBan(who, seconds));
    }

    private static void doRollbackAfterBan(User who, int seconds) {
        List<DBRollbackPixel> pixels = database.getRollbackPixels(who, seconds); //get all pixels that can and need to be rolled back
        List<ServerPlace.Pixel> forBroadcast = new ArrayList<>();
        for (DBRollbackPixel rbPixel : pixels) {
            //This is same for both instances
            //  putPixel() logs and updates the board[]
            //  forBroadcast.add() adds the pixel and later broadcasts it via websocket
            //  putRollbackPixel() adds rollback pixel to database (TABLE pixels) for undo and timelapse purposes
            if (rbPixel.toPixel != null) { //if previous pixel (the one we are rolling back to) exists
                putPixel(rbPixel.toPixel.x, rbPixel.toPixel.y, rbPixel.toPixel.color, who, false, false, "rollback");
                forBroadcast.add(new ServerPlace.Pixel(rbPixel.toPixel.x, rbPixel.toPixel.y, rbPixel.toPixel.color));
                database.putRollbackPixel(who, rbPixel.fromId, rbPixel.toPixel.id);
            } else { //else rollback to blank canvas
                DBPixelPlacementFull fromPixel = database.getPixelByID(null, rbPixel.fromId);
                byte rollbackDefault = getDefaultColor(fromPixel.x, fromPixel.y);
                putPixel(fromPixel.x, fromPixel.y, rollbackDefault, who, false, false, "rollback");
                forBroadcast.add(new ServerPlace.Pixel(fromPixel.x, fromPixel.y, (int) rollbackDefault));
                database.putRollbackPixelNoPrevious(fromPixel.x, fromPixel.y, who, fromPixel.id);
            }
        }
        server.broadcastNoShadow(new ServerPlace(forBroadcast));
    }


    public static void undoRollback(User who) {
        XnioWorker worker = server.getServer().getWorker();
        worker.execute(() -> doUndoRollback(who));
    }

    private static void doUndoRollback(User who) {
        List<DBPixelPlacementFull> pixels = database.getUndoPixels(who); //get all pixels that can and need to be undone
        List<ServerPlace.Pixel> forBroadcast = new ArrayList<>();
        for (DBPixelPlacementFull fromPixel : pixels) {
            //restores original pixel
            putPixel(fromPixel.x, fromPixel.y, fromPixel.color, who, false, false, "rollback undo"); //in board[]
            forBroadcast.add(new ServerPlace.Pixel(fromPixel.x, fromPixel.y, fromPixel.color)); //in websocket
            database.putUndoPixel(fromPixel.x, fromPixel.y, fromPixel.color, who, fromPixel.id); //in database
        }
        server.broadcastNoShadow(new ServerPlace(forBroadcast));
    }

    private static void nuke(int fromX, int fromY, int toX, int toY, byte fromColor, byte toColor) {
        XnioWorker worker = server.getServer().getWorker();
        worker.execute(() -> doNuke(fromX, fromY, toX, toY, fromColor, toColor));
    }

    private static void doNuke(int fromX, int fromY, int toX, int toY, byte fromColor, byte toColor) {
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
                    putPixel(x, y, c, null, true, false, "console nuke");
                    forBroadcast.add(new ServerPlace.Pixel(x, y, (int) c));
                    if (fromColor == -1) {
                        database.putNukePixel(x, y, c);
                    } else if (pixelColor == fromColor) {
                        database.putNukePixel(x, y, (int) fromColor, c);
                    }
                }
            }
        }
        server.broadcastNoShadow(new ServerPlace(forBroadcast));
    }

    private static void initStorage() {
        new File(getStorageDir().toString()).mkdirs();
    }

    private static void loadDefaultMap() {
        Path path = getStorageDir().resolve("default_board.dat").toAbsolutePath();
        if (!Files.exists(path)) {
            defaultBoard = null;
        }

        try {
            byte[] bytes = Files.readAllBytes(path);
            defaultBoard = new byte[width * height];
            System.arraycopy(bytes, 0, defaultBoard, 0, width * height);
        } catch (ArrayIndexOutOfBoundsException e) {
            getLogger().error("board.dat dimensions don't match the ones on pxls.conf");
        } catch (IOException e) {
            e.printStackTrace();
        }
    }

    private static void loadMap() {
        Path path = getStorageDir().resolve("board.dat");
        if (!Files.exists(path)) {
            getLogger().warn("Cannot find board.dat in working directory, using blank board");
            for (int x = 0; x < width; x++) {
                for (int y = 0; y < height; y++) {
                    board[x + width * y] = getDefaultColor(x, y);
                }
            }
            saveMapToDir(path);
        }

        try {
            byte[] bytes = Files.readAllBytes(path);
            System.arraycopy(bytes, 0, board, 0, width * height);
        } catch (ArrayIndexOutOfBoundsException e) {
            getLogger().error("board.dat dimensions don't match the ones on pxls.conf");
        } catch (IOException e) {
            e.printStackTrace();
        }
    }

    private static void loadHeatmap() {
        Path path = getStorageDir().resolve("heatmap.dat");
        if (!Files.exists(path)) {
            getLogger().warn("Cannot find heatmap.dat in working directory, using heatmap");
            saveHeatmapToDir(path);
        }

        try {
            byte[] bytes = Files.readAllBytes(path);
            System.arraycopy(bytes, 0, heatmap, 0, width * height);
        } catch (ArrayIndexOutOfBoundsException e) {
            getLogger().error("heatmap.dat dimensions don't match the ones on pxls.conf");
        } catch (IOException e) {
            e.printStackTrace();
        }
    }

    private static boolean loadPlacemap() {
        Path path = getStorageDir().resolve("placemap.dat");
        if (!Files.exists(path)) {
            getLogger().warn("Cannot find placemap.dat in working directory, assuming transparent pixels are unplaceable");
        }

        try {
            byte[] bytes = Files.readAllBytes(path);
            System.arraycopy(bytes, 0, placemap, 0, width * height);
            return true;
        } catch (ArrayIndexOutOfBoundsException e) {
            getLogger().error("placemap.dat dimensions don't match the ones on pxls.conf");
            return false;
        } catch (IOException e) {
            e.printStackTrace();
            return false;
        }
    }

    private static void loadVirginmap() {
        Path path = getStorageDir().resolve("virginmap.dat");
        if (!Files.exists(path)) {
            getLogger().warn("Cannot find virginmap.dat in working directory, using blank virginmap");

            for (int x = 0; x < width; x++) {
                for (int y = 0; y < height; y++) {
                    virginmap[x + width * y] = (byte) 0xFF;
                }
            }
            saveVirginmapToDir(path);
        }

        try {
            byte[] bytes = Files.readAllBytes(path);
            System.arraycopy(bytes, 0, virginmap, 0, width * height);
        } catch (ArrayIndexOutOfBoundsException e) {
            getLogger().error("virginmap.dat dimensions don't match the ones on pxls.conf");
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

    public static void checkUserTimeout() {
        Long loopStart = System.currentTimeMillis();
        boolean anyIdled = false;
        for (User user : server.getAuthedUsers().values()) {
            if (user.isIdled()) continue;

            Long toUse = user.getLastPixelTime() == 0L ? user.getInitialAuthTime() : user.getLastPixelTime();
            var delta = loopStart - toUse;
            boolean isIdled = userIdleTimeout - delta <= 0;

            if (isIdled) {
                anyIdled = true;
                user.setIdled(true);
            }
        }
        if (anyIdled) {
            App.getServer().getPacketHandler().updateUserData();
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

    public static boolean shouldIncreaseSomePixelCount() {
        return App.getConfig().getBoolean("pixelCounts.countTowardsAlltime") || App.getConfig().getBoolean("pixelCounts.countTowardsCurrent");
    }

    public static Logger getLogger() {
        return appLogger;
    }

    public static UserManager getUserManager() {
        return userManager;
    }

    public static byte getDefaultColor(int x, int y) {
        return App.defaultBoard != null
            ? App.defaultBoard[x + y * App.width]
            : palette.getDefaultColorIndex();
    }

    public static Database getDatabase() {
        return database;
    }

    public static UndertowServer getServer() {
        return server;
    }

    public static Palette getPalette() {
        return palette;
    }

    public static long getUserIdleTimeout() {
        return userIdleTimeout;
    }
}
