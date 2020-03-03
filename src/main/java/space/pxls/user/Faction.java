package space.pxls.user;

import com.typesafe.config.Config;
import space.pxls.App;
import space.pxls.data.DBFaction;
import space.pxls.util.TextFilter;

import java.sql.Timestamp;
import java.util.List;
import java.util.stream.Collectors;

public class Faction {
    private int id;
    private String name;
    private String tag;
    private int owner;
    private Timestamp created;
    private transient List<User> _cachedMembers = null;
    private transient List<User> _cachedBans = null;
    private transient User _cachedOwner = null;

    public Faction(int id, String name, String tag, int owner, Timestamp created) {
        this.id = id;
        this.name = name;
        this.tag = tag;
        this.owner = owner;
        this.created = created;
    }

    public Faction(DBFaction from) {
        this.id = from.id;
        this.name = from.name;
        this.tag = from.tag;
        this.owner = from.owner;
        this.created = from.created;
    }

    public void reloadFromDb() {
        DBFaction dbf = App.getDatabase().getFactionByID(id);
        this.id = dbf.id;
        this.name = dbf.name;
        this.owner = dbf.owner;
        this.created = dbf.created;
    }

    public User fetchOwner() {
        if (_cachedOwner == null) {
            _cachedOwner = App.getUserManager().getByID(this.owner);
        }

        return _cachedOwner;
    }

    public List<User> fetchMembers() {
        if (_cachedMembers == null) {
            _cachedMembers = App.getDatabase().getUsersForFID(this.id).stream().map(User::fromDBUser).collect(Collectors.toList());
        }

        return _cachedMembers;
    }

    public List<User> fetchBans() {
        if (_cachedBans == null) {
            _cachedBans = App.getDatabase().getBansForFID(this.id).stream().map(User::fromDBUser).collect(Collectors.toList());
        }

        return _cachedBans;
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

    public static boolean ValidateTag(String tag) {
        if (tag.length() < 1 || tag.length() > App.getConfig().getInt("factions.maxTagLength")) {
            return false;
        }
        //noinspection RedundantIfStatement - leaving room for future checks.
        if (App.getConfig().getBoolean("textFilter.enabled") && TextFilter.getInstance().filterHit(tag)) {
            return false;
        }
        return true;
    }

    public static boolean ValidateName(String name) {
        if (name.length() < 1 || name.length() > App.getConfig().getInt("factions.maxNameLength")) {
            return false;
        }
        //noinspection RedundantIfStatement - leaving room for future checks.
        if (App.getConfig().getBoolean("textFilter.enabled") && TextFilter.getInstance().filterHit(name)) {
            return false;
        }
        return true;
    }
}
