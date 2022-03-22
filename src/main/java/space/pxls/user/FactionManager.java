package space.pxls.user;

import org.apache.commons.jcs3.JCS;
import org.apache.commons.jcs3.access.CacheAccess;
import space.pxls.App;
import space.pxls.data.DBFaction;
import space.pxls.server.packets.chat.ServerFactionClear;
import space.pxls.server.packets.chat.ServerFactionUpdate;
import space.pxls.server.packets.http.UserFaction;

import java.util.Optional;

public class FactionManager {
    private static FactionManager _instance;
    private final CacheAccess<Integer, Faction> cachedFactions;

    private FactionManager() {
        cachedFactions = JCS.getInstance("factions");
    }

    public static FactionManager getInstance() {
        if (_instance == null) _instance = new FactionManager();
        return _instance;
    }

    /**
     * Attempts to get the requested faction if it exists. The cache is checked
     * first, and if the faction does not exist,
     * then it is fetched from the database.
     *
     * @param fid The faction's ID.
     *
     * @return The faction, if it exists.
     */
    public Optional<Faction> getByID(Integer fid) {
        if (fid == null) return Optional.empty();

        Faction cached = cachedFactions.get(fid);
        if (cached == null) {
            DBFaction f = App.getDatabase().getFactionByID(fid);
            if (f != null) {
                cached = new Faction(f);
                cachedFactions.put(cached.getId(), cached);
            }
        }

        return Optional.ofNullable(cached);
    }

    /**
     * Attempts to create and return the database. No validation is done, it is
     * assumed all validation was handled prior to calling this method.
     *
     * @param name  The name of the faction
     * @param tag   The tag of the faction
     * @param owner The owner's ID of the faction
     * @param color The color of the faction
     *
     * @return The created faction, if successful.
     *
     * @see Faction#ValidateColor(Integer)
     * @see Faction#ValidateName(String)
     * @see Faction#ValidateTag(String)
     */
    public Optional<Faction> create(String name, String tag, int owner, Integer color) {
        DBFaction f = App.getDatabase().createFaction(name, tag, owner, color);
        if (f != null) {
            return Optional.of(new Faction(f));
        }
        return Optional.empty();
    }

    /**
     * Removes this faction from our cache and calls
     * {@link space.pxls.data.Database#deleteFactionByFID(int)}.
     *
     * @param fid The faction's ID.
     */
    public void deleteByID(int fid) {
        invalidate(fid);
        App.getDatabase().deleteFactionByFID(fid);
        App.getServer().broadcast(new ServerFactionClear(fid));
    }

    /**
     * Removes the faction from our cache, forcing a refetch on next request.
     *
     * @param fid The faction's ID
     *
     * @return The {@link FactionManager} for chaining.
     */
    public FactionManager invalidate(int fid) {
        cachedFactions.remove(fid);
        return this;
    }

    /**
     * Removes all factions from our cache.
     *
     * @return The {@link FactionManager} for chaining.
     */
    public FactionManager invalidateAll() {
        cachedFactions.clear();
        return this;
    }

    /**
     * Updates the faction in our cache and optionally updates the
     * database/broadcasts the update.
     *
     * @param faction      The faction to update. It is assumed the object has been
     *                     mutated already and values from getters are the most
     *                     up-to-date.
     * @param handleExtras Whether or not to call
     *                     {@link space.pxls.data.Database#updateFaction(Faction)}
     *                     and broadcast a {@link ServerFactionUpdate}.
     */
    public void update(Faction faction, boolean handleExtras) {
        cachedFactions.put(faction.getId(), faction);
        if (handleExtras) {
            if (faction.isDirty().get()) {
                App.getDatabase().updateFaction(faction);
                faction.setDirty(false);
            }
            App.getServer().broadcast(new ServerFactionUpdate(new UserFaction(faction)));
        }
    }

    public void banMemberFromFaction(int fid, int uid) {
        Faction f = getByID(fid).orElse(null);
        User u = App.getUserManager().getByID(uid);

        if (f != null && u != null) {
            boolean wasDisplayed = false;
            if (u.getDisplayedFaction() != null && u.getDisplayedFaction() == fid) {
                wasDisplayed = true;
            }

            App.getDatabase().addFactionBanForUID(uid, fid);
            f.invalidate();
            update(f, false);

            if (wasDisplayed)
                u.setDisplayedFaction(null, true, true);
        }
    }

    public void unbanMemberFromFaction(int fid, int uid) {
        Faction f = getByID(fid).orElse(null);

        if (f != null) {
            App.getDatabase().removeFactionBanForUID(uid, fid);
            f.invalidate();
            update(f, false);
        }
    }

    public void joinFaction(int fid, int uid) {
        App.getDatabase().joinFaction(fid, uid);
        invalidate(fid);
    }

    public void leaveFaction(int fid, int uid) {
        App.getDatabase().leaveFaction(fid, uid);
        invalidate(fid);
    }

    public CacheAccess<Integer, Faction> getCachedFactions() {
        return cachedFactions;
    }
}
