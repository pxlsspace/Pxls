package space.pxls.user;

import space.pxls.App;
import space.pxls.data.DBFaction;

import java.sql.Timestamp;

public class Faction {
    private int id;
    private String name;
    private String tag;
    private int owner;
    private Timestamp created;

    public Faction(int id, String name, String tag, int owner, Timestamp created) {
        this.id = id;
        this.name = name;
        this.tag = tag;
        this.owner = owner;
        this.created = created;
    }

    public void reloadFromDb() {
        DBFaction dbf = App.getDatabase().getFactionByID(id);
        this.id = dbf.id;
        this.name = dbf.name;
        this.owner = dbf.owner;
        this.created = dbf.created;
    }

    public int getId() {
        return id;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getTag() {
        return tag;
    }

    public void setTag(String tag) {
        if (tag.length() > 4) tag = tag.substring(0, 4);

        this.tag = tag;
    }

    public int getOwner() {
        return owner;
    }

    public void setOwner(int owner) {
        this.owner = owner;
    }

    public Timestamp getCreated() {
        return created;
    }

    public void setCreated(Timestamp created) {
        this.created = created;
    }
}
