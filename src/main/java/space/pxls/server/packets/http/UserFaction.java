package space.pxls.server.packets.http;

import space.pxls.data.DBFaction;
import space.pxls.user.Faction;

public class UserFaction {
    public final int id;
    public final String name;
    public final String tag;
    public final String owner;
    public final long creation_ms;

    public UserFaction(DBFaction faction) {
        this.id = faction.id;
        this.name = faction.name;
        this.tag = faction.tag;
        this.owner = new Faction(faction).fetchOwner().getName();
        this.creation_ms = faction.created.toInstant().toEpochMilli();
    }
}
