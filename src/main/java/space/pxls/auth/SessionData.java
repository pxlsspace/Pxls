package space.pxls.auth;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.Date;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.atomic.AtomicBoolean;

import org.apache.logging.log4j.Level;
import org.jdbi.v3.core.mapper.RowMapper;
import org.jdbi.v3.core.statement.StatementContext;
import org.pac4j.core.util.Pac4jConstants;
import org.pac4j.oidc.profile.OidcProfile;

import com.nimbusds.oauth2.sdk.token.RefreshToken;

import space.pxls.App;

public class SessionData {
    private Map<String, Object> attributes = new HashMap<String, Object>();
    private boolean isStored = false;
    private AtomicBoolean dirty = new AtomicBoolean(false);
    
    static String PROFILES_KEY = Pac4jConstants.USER_PROFILES;
    static String PROFILE_TYPE = "OidcClient";
    
    SessionData(String sub, Optional<String> refresh, Date expiry) {
        isStored = true;
        var profile = new OidcProfile();
        profile.setId(sub);
        if (refresh.isPresent()) {
            profile.setRefreshToken(new RefreshToken(refresh.get()));
        }
        profile.setExpiration(expiry);
        var profiles = new LinkedHashMap<String, Object>();
        profiles.put(PROFILE_TYPE, profile);
        this.attributes.put(PROFILES_KEY, profiles);
    }
    
    public SessionData() {}
    
    public boolean isStored() {
        return this.isStored;
    }
    
    public Set<String> keys() {
        return this.attributes.keySet();
    }
    
    public Object get(String key) {
        return this.attributes.get(key);
    }
        
    public Object set(String key, Object value) {
        var previous = attributes.put(key, value);
        if (PROFILES_KEY.equals(key)) {
            if (previous != value) {
                this.dirty.set(true);
            }
        }
        return previous;
    }

    public Object remove(String key) {
        var previous = attributes.remove(key);
        if (PROFILES_KEY.equals(key)) {
            if (previous != null) {
                this.dirty.set(true);
            }
        }
        return previous;
    }
    
    public void save(String token) {
        if (this.dirty.getAndSet(false)) {
            var profiles = this.attributes.get(PROFILES_KEY);
            if (!(profiles instanceof Map)) {
                App.getLogger().log(Level.ERROR, "Invalid session profiles map type");
                return;
            }
            var profile = ((Map<?, ?>) profiles).get(PROFILE_TYPE);
            var db = App.getDatabase();
            if (profile instanceof OidcProfile) {
                var oidcProfile = (OidcProfile) profile;
                var user = db.getUserByLogin(oidcProfile.getId()).get();
                var refresh = oidcProfile.getRefreshToken().toString();
                var expiry = oidcProfile.getExpiration();
                db.saveSession(token, user.id, Optional.ofNullable(refresh), expiry);
                this.isStored = true;
            } else {
                db.deleteSession(token);
                this.isStored = false;
            }
        }
    }
    
    public static class Mapper implements RowMapper<SessionData> {
        @Override
        public SessionData map(ResultSet r, StatementContext ctx) throws SQLException {
            return new SessionData(
                r.getString("sub"),
                Optional.ofNullable(r.getString("refresh")),
                r.getTimestamp("expiry")
            );
        }
    }
}
