package space.pxls.server.packets.chat;

import space.pxls.server.packets.http.UserFaction;

public class ServerFactionUpdate {
    private String type = "faction_update";
    private UserFaction faction;

    public ServerFactionUpdate(UserFaction faction) {
        this.faction = faction;
    }

    public String getType() {
        return type;
    }

    public UserFaction getFaction() {
        return faction;
    }
}
