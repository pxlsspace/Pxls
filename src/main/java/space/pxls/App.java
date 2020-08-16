package space.pxls;

import com.google.gson.Gson;
import com.typesafe.config.*;
import org.apache.commons.jcs.JCS;
import org.apache.logging.log4j.Level;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;
import org.xnio.XnioWorker;
import space.pxls.data.DBChatMessage;
import space.pxls.data.DBPixelPlacement;
import space.pxls.data.DBRollbackPixel;
import space.pxls.data.Database;
import space.pxls.server.UndertowServer;
import space.pxls.server.packets.chat.Badge;
import space.pxls.server.packets.chat.ClientChatMessage;
import space.pxls.server.packets.socket.*;
import space.pxls.user.*;
import space.pxls.util.*;

import java.io.File;
import java.io.IOException;
import java.io.RandomAccessFile;
import java.nio.file.Files;
import java.nio.file.NoSuchFileException;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.*;
import java.util.Optional;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;

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
    private static boolean havePlacemap;

    private static PxlsTimer mapSaveTimer;
    private static PxlsTimer mapBackupTimer;
    private static UndertowServer server;

    private static String cachedWhoamiOrigin = null;
    private static int stackMultiplier;
    private static int stackMaxStacked;
    private static long userIdleTimeout;

    public static void main(String[] args) {
        gson = new Gson();

        loadConfig();

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

        loadMap();
        loadHeatmap();
        havePlacemap = loadPlacemap();
        loadVirginmap();

        database = new Database();
        userManager = new UserManager();

        loadRoles();

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
                    getLogger().info(String.format("Created missing backups dir at %s%n", backupsDir.toAbsolutePath().normalize()));
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
                try {
                    cachedWhoamiOrigin = null;
                    loadConfig();
                    System.out.println("Reloaded configuration");
                    loadRoles();
                    System.out.println("Reloaded roles configuration");
                    FactionManager.getInstance().invalidateAll();
                    System.out.println("Invalidated all factions");
                    userManager.reload();
                    System.out.println("Reloaded user manager");
                    System.out.println("Success!");
                } catch (Exception x) {
                    x.printStackTrace();
                }
            } else if (token[0].equalsIgnoreCase("save")) {
                try {
                    saveMapForce();
                    saveMapBackup();
                    System.out.println("Success!");
                } catch (Exception x) {
                    x.printStackTrace();
                }
            } else if (token[0].equalsIgnoreCase("roles") || token[0].equalsIgnoreCase("role")) {
                if (token.length < 2) {
                    System.out.println("Usage: roles <username> [role ID ...]");
                    return;
                }
                User user = userManager.getByName(token[1]);
                if (user == null) {
                    System.out.println("Cannot find user " + token[1]);
                    return;
                }
                if (token.length < 3) {
                    if (user.getRoles().isEmpty()) {
                        System.out.println("User " + user.getName() + " has no roles");
                    } else {
                        System.out.println("User " + user.getName() + " has roles " + user.getRolesString());
                    }
                    return;
                }
                var rest = Arrays.copyOfRange(token, 2, token.length);
                List<Role> roles = new ArrayList<>();
                if (!rest[0].equals("-")) {
                    roles = Role.fromMixed(List.of(rest));
                }
                if (roles.stream().anyMatch(role -> role.isGuest() || role.isDefault())) {
                    System.out.println("Guest/default roles cannot be assigned");
                    return;
                }
                user.setRoles(roles);
                database.setUserRoles(user.getId(), roles);
                String logMessage = "Set " + user.getName() + "'s roles to " + user.getRoleIDsString();
                if (roles.isEmpty()) {
                    logMessage = "Removed " + user.getName() + "'s roles";
                }
                database.insertServerAdminLog(logMessage);
                System.out.println(logMessage);
            } else if (token[0].equalsIgnoreCase("addroles") || token[0].equalsIgnoreCase("addrole")) {
                if (token.length < 2) {
                    System.out.println("Usage: addroles <username> [role ID ...]");
                    return;
                }
                User user = userManager.getByName(token[1]);
                if (user == null) {
                    System.out.println("Cannot find user " + token[1]);
                    return;
                }
                if (token.length < 3) {
                    System.out.println("Usage: addroles <username> <role ID ...>");
                    return;
                }
                var rest = Arrays.copyOfRange(token, 2, token.length);
                List<Role> roles = Role.fromMixed(List.of(rest));
                user.addRoles(roles);
                database.setUserRoles(user.getId(), user.getRoles());
                String message = "Added roles \"" + roles.stream().map(Role::getName).collect(Collectors.joining(", ")) + "\" to " + user.getName();
                database.insertServerAdminLog(message);
                System.out.println(message);
            } else if (token[0].equalsIgnoreCase("removeroles") || token[0].equalsIgnoreCase("removerole")) {
                if (token.length < 2) {
                    System.out.println("Usage: removeroles <username> [role ID ...]");
                    return;
                }
                User user = userManager.getByName(token[1]);
                if (user == null) {
                    System.out.println("Cannot find user " + token[1]);
                    return;
                }
                if (token.length < 3) {
                    System.out.println("Usage: removeroles <username> <role ID ...>");
                    return;
                }
                var rest = Arrays.copyOfRange(token, 2, token.length);
                List<Role> roles = Role.fromMixed(List.of(rest));
                user.removeRoles(roles);
                database.setUserRoles(user.getId(), user.getRoles());
                String message = "Removed roles \"" + roles.stream().map(Role::getName).collect(Collectors.joining(", ")) + "\" from " + user.getName();
                database.insertServerAdminLog(message);
                System.out.println(message);
            } else if (token[0].equalsIgnoreCase("alert")) {
                var rest = Arrays.copyOfRange(token, 1, token.length);
                String message = String.join(" ", rest);
                App.getDatabase().insertServerAdminLog(String.format("Sent a server-wide broadcast with the content: %s", message));
                server.broadcast(new ServerAlert("console", message));
            } else if (token[0].equalsIgnoreCase("ban")) {
                if (token.length < 2) {
                    System.out.println("Usage: ban <username> [reason]");
                    return;
                }
                var rest = Arrays.copyOfRange(token, 2, token.length);
                User user = userManager.getByName(token[1]);
                if (user != null) {
                    String reason = String.join(" ", rest);
                    if (reason.equals("")) reason = "Banned via console; no reason given";
                    user.ban(24 * 60 * 60, reason, null);
                    database.insertServerAdminLog(String.format("ban %s with reason: %s", user.getName(), reason));
                    System.out.println("Banned " + user.getName() + " for 24 hours.");
                } else {
                    System.out.println("Cannot find user " + token[1]);
                }
            } else if (token[0].equalsIgnoreCase("permaban")) {
                if (token.length < 2) {
                    System.out.println("Usage: permaban <username> [reason]");
                    return;
                }
                User user = userManager.getByName(token[1]);
                var rest = Arrays.copyOfRange(token, 2, token.length);
                if (user != null) {
                    String reason = String.join(" ", rest);
                    if (reason.equals("")) reason = "Banned via console; no reason given";
                    user.ban(0, reason, null);
                    database.insertServerAdminLog(String.format("permaban %s with reason: %s", user.getName(), reason));
                    System.out.println("Permabanned " + user.getName());
                } else {
                    System.out.println("Cannot find user " + token[1]);
                }
            } else if (token[0].equalsIgnoreCase("shadowban")) {
                if (token.length < 2) {
                    System.out.println("Usage: shadowban <username> [reason]");
                    return;
                }
                var rest = Arrays.copyOfRange(token, 2, token.length);
                User user = userManager.getByName(token[1]);
                if (user != null) {
                    String reason = String.join(" ", rest);
                    if (reason.equals("")) reason = "Banned via console; no reason given";
                    user.shadowBan(reason, null);
                    database.insertServerAdminLog(String.format("shadowban %s with reason: %s", user.getName(), reason));
                    System.out.println("Shadowbanned " + user.getName());
                } else {
                    System.out.println("Cannot find user " + token[1]);
                }
            } else if (token[0].equalsIgnoreCase("unban")) {
                if (token.length < 2) {
                    System.out.println("Usage: unban <username> [reason]");
                    return;
                }
                var rest = Arrays.copyOfRange(token, 2, token.length);
                User user = userManager.getByName(token[1]);
                if (user != null) {
                    String reason = String.join(" ", rest);
                    if (reason.equals("")) reason = "Unbanned via console; no reason given";
                    user.unban(null, reason);
                    database.insertServerAdminLog("unban " + user.getName());
                    System.out.println("Unbanned " + user.getName() + ".");
                } else {
                    System.out.println("Cannot find user " + token[1]);
                }
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
                    System.out.println(String.format("[%d] %s (%s) (num connections: %d)", user.getId(), user.getName(), user.getRoleIDsString(), user.getConnections().size()));
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
            } else if (token[0].equalsIgnoreCase("cd-override")) {
                //cd-override list|USERNAME[ STATE]
                //STATE=on|off
                if (token.length > 1) {
                    if (token[1].equalsIgnoreCase("list")) {
                        StringBuilder sb = new StringBuilder();
                        userManager.getAllUsersByToken().forEach((s, user) -> {
                            if (user.isOverridingCooldown()) sb.append("    ").append(user.getName()).append('\n');
                        });
                        System.out.println(sb);
                    } else if (token[1].equalsIgnoreCase("help")) {
                        System.out.println("cd-override list|USERNAME[ STATE]");
                        System.out.println("STATE=on|off");
                    } else {
                        User user = getUserManager().getByName(token[1]);
                        if (user == null) {
                            System.out.printf("Unknown user: %s%n", token[1]);
                        } else {
                            if (token.length >= 3) {
                                if (token[2].equalsIgnoreCase("on") || token[2].equalsIgnoreCase("off")) {
                                    user.setOverrideCooldown(token[2].equalsIgnoreCase("on"));
                                    System.out.printf("Updated %s's cd-override state to %s%n", user.getName(), token[2].toLowerCase());
                                } else {
                                    System.out.printf("Invalid state: %s%n", token[2]);
                                }
                            } else {
                                System.out.printf("User's CD Override state is: %s%n", user.isOverridingCooldown() ? "on" : "off");
                            }
                        }
                    }
                } else {
                    System.out.println("cd-override list|USERNAME[ STATE]");
                    System.out.println("STATE=on|off");
                }
            } else if (token[0].equalsIgnoreCase("broadcast")) {
                //broadcast MESSAGE
                if (token.length > 1) {
                    App.getServer().getPacketHandler().handleChatMessage(null, null, new ClientChatMessage(line.substring(token[0].length() + 1)));
                }
            } else if (token[0].equalsIgnoreCase("ChatBan")) {
                if (token.length > 4) {
                    User user = getUserManager().getByName(token[1]);
                    if (user == null) System.out.printf("Unknown user: %s%n", token[1]);
                    else {
                        Integer banLength = 600;
                        try {
                            banLength = Integer.valueOf(token[2]);
                        } catch (Exception e) {
                            System.out.printf("Failed to parse BAN_LENGTH '%s'. Defaulting to 600", token[2]);
                        }
                        Boolean messageRemoval = token[3].equals("1") || token[3].equalsIgnoreCase("yes") || token[3].equalsIgnoreCase("true");
                        String reason = line.substring(token[0].length() + token[1].length() + token[2].length() + token[3].length() + 4);
                        Chatban.TEMP(user, null, System.currentTimeMillis() + banLength * 1000L, reason, messageRemoval, Integer.MAX_VALUE).commit();
                    }
                } else {
                    System.out.println("chatban USER BAN_LENGTH MESSAGE_REMOVAL REASON\n    USER: The name of the user\n    BAN_LENGTH: The length in seconds of the chatban. For permas, see 'PermaChatBan' command.\n    MESSAGE_REMOVAL: Boolean (1|0) of whether or not to purge the user from chat.\n    REASON: The reason for the chatban. Will be displayed to the user");
                }
            } else if (token[0].equalsIgnoreCase("PermaChatBan")) {
                if (token.length > 3) {
                    User user = userManager.getByName(token[1]);
                    if (user == null) System.out.printf("Unknown user: %s%n", token[1]);
                    else {
                        Boolean messageRemoval = token[2].equals("1") || token[2].equalsIgnoreCase("yes") || token[2].equalsIgnoreCase("true");
                        String reason = line.substring(token[0].length() + token[1].length() + token[2].length() + 3);
                        Chatban.PERMA(user, null, reason, messageRemoval, Integer.MAX_VALUE).commit();
                    }
                } else {
                    System.out.println("PermaChatBan USER MESSAGE_REMOVAL REASON\n    USER: The name of the user\n    MESSAGE_REMOVAL: Boolean (1|0) of whether or not to purge the user from chat.\n    REASON: The reason for the chatban. Will be displayed to the user");
                }
            } else if (token[0].equalsIgnoreCase("UnChatBan")) {
                if (token.length > 2) {
                    User user = userManager.getByName(token[1]);
                    if (user == null) System.out.printf("Unknown user: %s%n", token[1]);
                    else {
                        Chatban.UNBAN(user, null, line.substring(token[0].length() + token[1].length() + 2)).commit();
                    }
                } else {
                    System.out.println("UnChatBan USER REASON");
                }
            } else if (token[0].equalsIgnoreCase("ChatPurge")) {
                if (token.length > 2) {
                    User user = userManager.getByName(token[1]);
                    if (user == null) System.out.printf("Unknown user: %s%n", token[1]);
                    else {
                        Integer toPurge = Integer.MAX_VALUE;
                        String reason = "";
                        try {
                            toPurge = Integer.valueOf(token[2]);
                        } catch (Exception e) {
                            System.out.printf("Failed to parse '%s' as a number, defaulting to %s%n", token[2], toPurge);
                        }

                        if (token.length >= 4) {
                            reason = line.substring(token[0].length() + token[1].length() + token[2].length() + 3);
                        } else {
                            reason = "";
                        }

                        if (toPurge > 0) {
                            App.getDatabase().purgeChat(user, null, toPurge, reason, true);
                        } else {
                            System.out.printf("Invalid toPurge. Should be >0, got %s%n", toPurge);
                        }

                    }
                } else {
                    System.out.println("ChatPurge USER [AMOUNT ]REASON");
                }
            } else if (token[0].equalsIgnoreCase("cf")) {
                String z = line.substring(token[0].length() + 1);
                System.out.printf("running chat filter against '%s'%nResult: %s%n", z, TextFilter.getInstance().filter(z, true));
            } else if (token[0].equalsIgnoreCase("reloadUsers")) {
                System.out.println("Working... (may cause some lag)");
                userManager.reload();
                System.out.println("Done.");
            } else if (token[0].equalsIgnoreCase("flagRename")) {
                //flagRename USERNAME [1|0]
                if (token.length >= 2) {
                    boolean flagState = token.length < 3 || (token[2].equalsIgnoreCase("1") || token[2].equalsIgnoreCase("true") || token[2].equalsIgnoreCase("yes") || token[2].equalsIgnoreCase("y"));
                    User toFlag = userManager.getByName(token[1]);
                    if (toFlag != null) {
                        System.out.printf("Flagging %s as %s%n", toFlag.getName(), flagState);
                        toFlag.setRenameRequested(flagState);
                    } else {
                        System.out.println("User doesn't exist");
                    }
                } else {
                    System.out.println("flagRename USERNAME [1|0]");
                }
            } else if (token[0].equalsIgnoreCase("setName") || token[0].equalsIgnoreCase("updateUsername")) {
                //setName USERNAME NEW_USERNAME
                if (token.length >= 3) {
                    User toRename = userManager.getByName(token[1]);
                    if (toRename != null) {
                        toRename.setRenameRequested(false);
                        if (toRename.updateUsername(token[2], true)) {
                            App.getServer().send(toRename, new ServerRenameSuccess(toRename.getName()));
                            System.out.println("Name updated");
                        } else {
                            System.out.println("Failed to update name (function returned false. name taken or an error occurred)");
                        }
                    } else {
                        System.out.println("User doesn't exist");
                    }
                } else {
                    System.out.printf("%s USERNAME NEW_USERNAME%n", token[0]);
                }
            } else if (token[0].equalsIgnoreCase("idleCheck")) {
                try {
                    checkUserTimeout();
                } catch (Exception e) {
                    e.printStackTrace();
                }
            } else if (token[0].equalsIgnoreCase("sendUserData")) {
                App.getServer().getPacketHandler().updateUserData();
            } else if (token[0].equalsIgnoreCase("addnotification")) {
                if (token.length < 4) {
                    System.out.printf("%s TITLE EXPIRY BODY%n", token[0]);
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
                    e.printStackTrace();
                    System.err.println("Invalid expiry.");
                    return;
                }
                String body = token[3];

                int id = App.getDatabase().createNotification(-1, title, body, expiry);
                App.getServer().broadcast(new ServerNotification(App.getDatabase().getNotification(id)));
                System.out.println("Notification sent");
            } else if (token[0].equalsIgnoreCase("bp")) {
                if (token.length == 1) {
                    System.out.printf("%s raw_packet%n", token[0]);
                    return;
                }
                App.getServer().broadcastRaw(line.substring(token[0].length() + 1).trim());
            } else if (token[0].equalsIgnoreCase("f")) {
                // f $FID [$ACTION[ $VALUE]]
                String subcommand;
                if (token.length == 1) {
                    subcommand = "help";
                } else {
                    subcommand = token[1].toLowerCase().trim();
                }
                switch(subcommand) {
                    case "reload": {
                        FactionManager.getInstance().invalidateAll();
                        System.out.println("Invalidated factions");
                        return;
                    }
                    case "mc": {
                        System.out.println(FactionManager.getInstance().getCachedFactions().getStats());
                        return;
                    }
                    case "help": {
                        System.out.println("f $FID [delete|tag|name[ $VALUE]]");
                        return;
                    }
                }
                int i;
                try {
                    i = Integer.parseInt(token[1]);
                } catch (NumberFormatException nfe) {
                    System.out.printf("Invalid ID: %s%n", token[1]);
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
                            System.out.printf("Delete invoked for faction %d%n", i);
                            break;
                        }
                        case "tag": {
                            if (_value == null) {
                                System.out.printf("Faction %d's tag: %s%n", i, faction.getTag());
                            } else {
                                faction.setTag(_value);
                                FactionManager.getInstance().update(faction, true);
                                System.out.println("Faction updated");
                            }
                            break;
                        }
                        case "name": {
                            if (_value == null) {
                                System.out.printf("Faction %d's name: %s%n", i, faction.getName());
                            } else {
                                faction.setName(_value);
                                FactionManager.getInstance().update(faction, true);
                                System.out.println("Faction updated");
                            }
                            break;
                        }
                        // TODO: ban, unban, owner, color
                        default: {
                            System.out.println(faction.toString());
                            break;
                        }
                    }
                } else {
                    System.out.printf("The faction %s does not exist.%n", i);
                }
            }
        } catch (RuntimeException e) {
            e.printStackTrace();
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

        try {
            Files.deleteIfExists(getStorageDir().resolve("index_cache.html"));
        } catch (IOException e) {
            // do nothing
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

    public static boolean getRegistrationEnabled() {
        return getConfig().getBoolean("oauth.enableRegistration");
    }

    public static void putPixel(int x, int y, int color, User user, boolean mod_action, String ip, boolean updateDatabase, String action) {
        if (x < 0 || x >= width || y < 0 || y >= height || (color >= getPalette().size() && !(color == 0xFF || color == -1))) return;
        String userName = user != null ? user.getName() : "<server>";

        if (action.trim().isEmpty()) {
            action = mod_action ? "mod overwrite" : "user place";
        }

        board[x + y * width] = (byte) color;
        heatmap[x + y * width] = (byte) 0xFF;
        virginmap[x + y * width] = (byte) 0x00;
        pixelLogger.log(Level.INFO, String.format("%s\t%d\t%d\t%d\t%s\t%s", userName, x, y, color, ip, action));
        if (updateDatabase) {
            database.placePixel(x, y, color, user, mod_action);
            if (!mod_action) {
                user.increasePixelCounts();
            }
        }
    }

    public static void logShadowbannedPixel(int x, int y, int color, String userName, String ip) {
        shadowbannedPixelLogger.info(String.format("%s\t%d\t%d\t%d\t%s", userName, x, y, color, ip));
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
                putPixel(rbPixel.toPixel.x, rbPixel.toPixel.y, rbPixel.toPixel.color, who, false, "", false, "rollback");
                forBroadcast.add(new ServerPlace.Pixel(rbPixel.toPixel.x, rbPixel.toPixel.y, rbPixel.toPixel.color));
                database.putRollbackPixel(who, rbPixel.fromId, rbPixel.toPixel.id);
            } else { //else rollback to blank canvas
                DBPixelPlacement fromPixel = database.getPixelByID(null, rbPixel.fromId);
                byte rollbackDefault = getDefaultColor(fromPixel.x, fromPixel.y);
                putPixel(fromPixel.x, fromPixel.y, rollbackDefault, who, false, "", false, "rollback");
                forBroadcast.add(new ServerPlace.Pixel(fromPixel.x, fromPixel.y, (int) rollbackDefault));
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
            putPixel(fromPixel.x, fromPixel.y, fromPixel.color, who, false, "", false, "rollback undo"); //in board[]
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
                    putPixel(x, y, c, null, true, "", false, "console nuke");
                    forBroadcast.add(new ServerPlace.Pixel(x, y, (int) c));
                    if (fromColor == 0xFF || fromColor == -1) {
                        database.putNukePixel(x, y, c);
                    } else if (pixelColor == fromColor) {
                        database.putNukePixel(x, y, (int) fromColor, c);
                    }
                }
            }
        }
        server.broadcastNoShadow(new ServerPlace(forBroadcast));
    }

    private static boolean loadMap() {
        Path path = getStorageDir().resolve("board.dat");
        if (!Files.exists(path)) {
            getLogger().warn("Cannot find board.dat in working directory, using blank board");
            for (int x = 0; x < width; x++) {
                for (int y = 0; y < height; y++) {
                    board[x + width * y] = getDefaultColor(x, y);
                }
            }
            saveMapToDir(path);
            return true;
        }

        try {
            byte[] bytes = Files.readAllBytes(path);
            System.arraycopy(bytes, 0, board, 0, width * height);
            return true;
        } catch (ArrayIndexOutOfBoundsException e) {
            getLogger().error("board.dat dimensions don't match the ones on pxls.conf");
            return false;
        } catch (IOException e) {
            e.printStackTrace();
            return false;
        }
    }

    private static boolean loadHeatmap() {
        Path path = getStorageDir().resolve("heatmap.dat");
        if (!Files.exists(path)) {
            getLogger().warn("Cannot find heatmap.dat in working directory, using heatmap");
            saveHeatmapToDir(path);
            return true;
        }

        try {
            byte[] bytes = Files.readAllBytes(path);
            System.arraycopy(bytes, 0, heatmap, 0, width * height);
            return true;
        } catch (ArrayIndexOutOfBoundsException e) {
            getLogger().error("heatmap.dat dimensions don't match the ones on pxls.conf");
            return false;
        } catch (IOException e) {
            e.printStackTrace();
            return false;
        }
    }

    private static boolean loadPlacemap() {
        Path path = getStorageDir().resolve("placemap.dat");
        if (!Files.exists(path)) {
            getLogger().warn("Cannot find placemap.dat in working directory, using blank placemap");
            return false;
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

    private static boolean loadVirginmap() {
        Path path = getStorageDir().resolve("virginmap.dat");
        if (!Files.exists(path)) {
            getLogger().warn("Cannot find virginmap.dat in working directory, using blank virginmap");

            for (int x = 0; x < width; x++) {
                for (int y = 0; y < height; y++) {
                    virginmap[x + width * y] = (byte) 0xFF;
                }
            }
            saveVirginmapToDir(path);
            return true;
        }

        try {
            byte[] bytes = Files.readAllBytes(path);
            System.arraycopy(bytes, 0, virginmap, 0, width * height);
            return true;
        } catch (ArrayIndexOutOfBoundsException e) {
            getLogger().error("virginmap.dat dimensions don't match the ones on pxls.conf");
            return false;
        } catch (IOException e) {
            e.printStackTrace();
            return false;
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
            Long delta = loopStart - toUse;
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
        Path path = getStorageDir().resolve("default_board.dat").toAbsolutePath();
        if (Files.exists(path)) {
            try {
                RandomAccessFile raf = new RandomAccessFile(path.toString(), "r");
                raf.seek(x + y * width);
                byte b = raf.readByte();
                raf.close();
                return b;
            } catch (NoSuchFileException e) {
            } catch (IOException e) {
            }
        }
        return (byte) config.getInt("board.defaultColor");
    }

    public static Database getDatabase() {
        return database;
    }

    public static UndertowServer getServer() {
        return server;
    }

    public static long getUserIdleTimeout() {
        return userIdleTimeout;
    }
}
