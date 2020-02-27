package space.pxls.tasks;

import io.undertow.websockets.core.WebSocketChannel;
import space.pxls.App;
import space.pxls.server.packets.socket.ServerReceivedReport;
import space.pxls.user.User;

import java.util.List;

public class UserAuthedTask implements Runnable {
    private final User user;
    private final WebSocketChannel channel;
    private final String authIP;

    public UserAuthedTask(WebSocketChannel channel, User user, String authIP) {
        this.user = user;
        this.channel = channel;
        this.authIP = authIP;

        if (authIP == null) throw new IllegalArgumentException("The 'authIP' parameter was null!");
    }

    @Override
    public void run() {
        lastIPAlert();
        updateLastIP();
        maybeLogLastIP();
    }

    private void lastIPAlert() {
        if (!App.getDatabase().hasLastIPAlertFlag(user.getId())) {
            List<Integer> uids = App.getDatabase().getDuplicateUsers(user.getId(), authIP);
            if (uids != null && uids.size() > 0) {
                StringBuilder toReport = new StringBuilder(String.format("User has %d IP matches (AuthIP: %s) in the database. Matched accounts:", uids.size(), authIP));
                for (int i = 0; i < uids.size(); i++) {
                    User fetched = App.getUserManager().getByID(uids.get(i));
                    if (fetched != null) {
                        toReport.append(String.format(" %s (ID: %d)%s", fetched.getName(), fetched.getId(), (i == uids.size()-1) ? "" : ", "));
                    } else {
                        System.err.printf("    ID from database (%d) resulted in a null user lookup (triggered by UserDupeIP task for %s (ID: %d))%n", uids.get(i), user.getName(), user.getId());
                    }
                }
                Integer rid = App.getDatabase().insertServerReport(user.getId(), toReport.toString());
                if (rid != null)
                    App.getServer().broadcastToStaff(new ServerReceivedReport(rid, ServerReceivedReport.REPORT_TYPE_CANVAS));
                App.getDatabase().setLastIPAlertFlag(user.getId(), true);
            }
        }
    }

    private void updateLastIP() {
        App.getDatabase().updateUserIP(this.user, this.authIP);
    }

    private void maybeLogLastIP() {
        App.getDatabase().insertOrUpdateIPLog(this.user.getId(), this.authIP);
    }
}