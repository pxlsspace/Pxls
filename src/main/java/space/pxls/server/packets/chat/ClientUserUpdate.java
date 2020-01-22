package space.pxls.server.packets.chat;

import java.util.Map;

public class ClientUserUpdate {
    public Map<String, String> updates;

    public Map<String, String> getUpdates() {
        return updates;
    }
}
