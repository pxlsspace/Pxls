package space.pxls.user;

import com.typesafe.config.Config;
import com.typesafe.config.ConfigList;
import com.typesafe.config.ConfigValueType;

import space.pxls.App;
import space.pxls.data.DBFaction;
import space.pxls.data.DBFactionSearch;
import space.pxls.util.TextFilter;

import java.sql.Timestamp;
import java.util.Arrays;
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
    private int canvasCode;
    private Timestamp created;
    private transient List<User> _cachedMembers = null;
    private transient List<User> _cachedBans = null;
    private transient User _cachedOwner = null;
    private transient AtomicBoolean dirty = new AtomicBoolean(false);

    public Faction(int id, String name, String tag, int color, int owner, Timestamp created, int canvasCode) {
        this.id = id;
        this.name = name;
        this.tag = tag;
        this.color = color;
        this.owner = owner;
        this.created = created;
        this.canvasCode = canvasCode;
    }

    public Faction(DBFaction from) {
        this.id = from.id;
        this.name = from.name;
        this.tag = from.tag;
        this.color = from.color;
        this.owner = from.owner;
        this.created = from.created;
        this.canvasCode = from.canvasCode;
    }

    public Faction(DBFactionSearch from) {
        this.id = from.id;
        this.name = from.name;
        this.tag = from.tag;
        this.color = from.color;
        this.owner = from.owner;
        this.created = from.created;
        this.canvasCode = from.canvasCode;
    }

    @SuppressWarnings("RedundantIfStatement") // validation blocks have been left separate for future expansion.
    public static boolean ValidateTag(String tag) {
        if (tag.trim().length() < 1 || tag.trim().length() > App.getConfig().getInt("factions.maxTagLength")) {
            return false;
        }
        tag = tag.trim();
        if (!checkCodepoints(tag)) {
            return false;
        }
        if (App.getConfig().getBoolean("textFilter.enabled") && TextFilter.getInstance().filterHit(tag)) {
            return false;
        }
        return true;
    }

    @SuppressWarnings("RedundantIfStatement") // validation blocks have been left separate for future expansion.
    public static boolean ValidateName(String name) {
        if (name.trim().length() < 1 || name.trim().length() > App.getConfig().getInt("factions.maxNameLength")) {
            return false;
        }
        name = name.trim();
        if (!checkCodepoints(name)) {
            return false;
        }
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

    public void invalidateMembers() {
        _cachedMembers = null;
    }

    public void invalidateBans() {
        _cachedBans = null;
    }

    public void invalidateOwner() {
        _cachedOwner = null;
    }

    public void invalidate() {
        invalidateBans();
        invalidateMembers();
        invalidateOwner();
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

    public int getCanvasCode() {
        return canvasCode;
    }

    /**
     * Sets the canvas code.<br>
     * This really shouldn't be modified as it's only ever set by
     *  Database#createFaction using the current config value, however it's
     *  exposed for POJO reasons if needed in the future.
     *
     * @param canvasCode The canvas code
     */
    public void setCanvasCode(int canvasCode) {
        if (canvasCode != this.canvasCode) dirty.set(true);
        this.canvasCode = canvasCode;
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

    private static boolean checkCodepoints(String input) {
        List<List<Number>> codePoints = App.getConfig().getList("factions.allowedCharacterRanges").stream()
          .map(sublist -> ((ConfigList) sublist).stream()
              .map(value -> value.valueType() == ConfigValueType.STRING ? (Number) Integer.decode((String) value.unwrapped()) : (Number) value.unwrapped())
              .collect(Collectors.toList())
          ).collect(Collectors.toList());
        
        return input.codePoints().allMatch(i -> codePoints.stream()
            .anyMatch(pair -> (pair.size() == 1)
                ? (i == pair.get(0).intValue())
                : ((i >= pair.get(0).intValue()) && (i <= pair.get(1).intValue()))));
    }
}
