package space.pxls.util;

import io.undertow.websockets.core.WebSocketChannel;
import space.pxls.App;
import space.pxls.user.User;

import java.util.List;

public class UserDupeIPTask implements Runnable {
    private final User user;
    private final WebSocketChannel channel;

    public UserDupeIPTask(WebSocketChannel channel, User user) {
        this.user = user;
        this.channel = channel;
    }

    @Override
    public void run() {
        if (!App.getDatabase().hasUserFlaggedLastIPAlert(user.getId())) {
            List<Integer> uids = App.getDatabase().getDupedUsers(channel.getSourceAddress().getHostName(), user.getId());
            if (uids != null && uids.size() > 0) {
                StringBuilder toReport = new StringBuilder(String.format("User has %d IP matches in the database. Matched accounts:", uids.size()));
                for (int i = 0; i < uids.size(); i++) {
                    User fetched = App.getUserManager().getByID(uids.get(i));
                    if (fetched != null) {
                        toReport.append(String.format(" %s (ID: %d)%s", fetched.getName(), fetched.getId(), (i == uids.size()-1) ? "" : ", "));
                    } else {
                        System.err.printf("    ID from database (%d) resulted in a null user lookup (triggered by UserDupeIP task for %s (ID: %d))%n", uids.get(i), user.getName(), user.getId());
                    }
                }
                App.getDatabase().addServerReport(toReport.toString(), user.getId());
                App.getDatabase().flagLastIPAlert(user.getId());
            }
        }
    }
}