package space.pxls.server.packets.http;

import space.pxls.data.DBFaction;
import space.pxls.user.Faction;

public class UserFaction {
    public final int id;
    public final int color;
    public final String name;
    public final String tag;
    public final String owner;
    public final long creation_ms;

    public UserFaction(DBFaction faction) {
        this(new Faction(faction));
    }

    public UserFaction(Faction faction) {
        this.id = faction.getId();
        this.color = faction.getColor();
        this.name = faction.getName();
        this.tag = faction.getTag();
        this.owner = faction.fetchOwner().getName();
        this.creation_ms = faction.getCreated().toInstant().toEpochMilli();
    }
}
