package space.pxls.server.packets.http;

import space.pxls.data.DBFaction;
import space.pxls.data.DBFactionSearch;
import space.pxls.user.Faction;

public class UserFaction {
    public int id;
    public int color;
    public String name;
    public String tag;
    public String owner;
    public String canvasCode;
    public long creation_ms;
    public Integer memberCount;
    public Boolean userJoined;

    public UserFaction(DBFaction faction) {
        _scaffold(new Faction(faction));
        this.memberCount = null;
        this.userJoined = null;
    }

    public UserFaction(DBFactionSearch dbFactionSearch) {
        _scaffold(new Faction(dbFactionSearch));
        this.memberCount = dbFactionSearch.memberCount;
        this.userJoined = dbFactionSearch.userJoined;
    }

    public UserFaction(Faction faction) {
        _scaffold(faction);
        this.memberCount = null;
        this.userJoined = null;
    }

    private void _scaffold(Faction faction) {
        this.id = faction.getId();
        this.color = faction.getColor();
        this.name = faction.getName();
        this.tag = faction.getTag();
        this.owner = faction.fetchOwner().getName();
        this.creation_ms = faction.getCreated().toInstant().toEpochMilli();
        this.canvasCode = faction.getCanvasCode();
    }
}
