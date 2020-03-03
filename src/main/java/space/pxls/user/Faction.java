package space.pxls.user;

import space.pxls.App;
import space.pxls.data.DBFaction;
import space.pxls.util.TextFilter;

import java.sql.Timestamp;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.stream.Collectors;

public class Faction {
    private int id;
    private String name;
    private String tag;
    private int color;
    private int owner;
    private Timestamp created;
    private transient List<User> _cachedMembers = null;
    private transient List<User> _cachedBans = null;
    private transient User _cachedOwner = null;
    private transient AtomicBoolean dirty = new AtomicBoolean(false);

    public Faction(int id, String name, String tag, int color, int owner, Timestamp created) {
        this.id = id;
        this.name = name;
        this.tag = tag;
        this.color = color;
        this.owner = owner;
        this.created = created;
    }

    public Faction(DBFaction from) {
        this.id = from.id;
        this.name = from.name;
        this.tag = from.tag;
        this.color = from.color;
        this.owner = from.owner;
        this.created = from.created;
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

    public static boolean ValidateColor(Integer color) {
        return color != null && color >= 0x000000 && color <= 0xffffff;
    }

    public void reloadFromDb() {
        Optional<Faction> dbf = FactionManager.getInstance().invalidate(this.id).getByID(this.id);
        if (dbf.isPresent()) {
            this.id = dbf.get().getId();
            this.name = dbf.get().getName();
            this.owner = dbf.get().getOwner();
            this.created = dbf.get().getCreated();
        }
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
        if (!name.equals(this.name)) dirty.set(true);
        this.name = name;
    }

    public String getTag() {
        return tag;
    }

    public void setTag(String tag) {
        if (!tag.equals(this.tag)) dirty.set(true);
        this.tag = tag;
    }

    public int getOwner() {
        return owner;
    }

    public void setOwner(int owner) {
        if (owner != this.owner) dirty.set(true);
        this.owner = owner;
    }

    public Timestamp getCreated() {
        return created;
    }

    public void setCreated(Timestamp created) {
        if (!created.equals(this.created)) dirty.set(true);
        this.created = created;
    }

    public int getColor() {
        return color;
    }

    public void setColor(int color) {
        if (color != this.color) dirty.set(true);
        this.color = color;
    }

    public AtomicBoolean isDirty() {
        return dirty;
    }

    public void setDirty(boolean dirty) {
        this.dirty.set(dirty);
    }

    @Override
    public String toString() {
        return "Faction{" +
            "id=" + id +
            ", name='" + name + '\'' +
            ", tag='" + tag + '\'' +
            ", color=" + color +
            ", owner=" + owner +
            ", created=" + created +
            '}';
    }
}
