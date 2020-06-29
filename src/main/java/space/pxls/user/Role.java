package space.pxls.user;

import org.jdbi.v3.core.mapper.RowMapper;
import org.jdbi.v3.core.statement.StatementContext;
import space.pxls.server.packets.chat.Badge;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.stream.Collectors;
import java.util.stream.Stream;

public class Role {
    private final String id;
    private final String name;
    private final Boolean guest;
    private final Boolean defaultRole;
    private List<Role> inherits = new ArrayList<>();
    private final List<Badge> badges;
    private final List<String> permissions;

    private static final HashMap<String, Role> canonicalRoles = new HashMap<>();

    public Role(String id, String name, Boolean guest, Boolean defaultRole, List<Badge> badges, List<String> permissions) {
        this.id = id;
        this.name = name;
        this.guest = guest;
        this.defaultRole = defaultRole;
        this.badges = badges;
        this.permissions = permissions;
    }

    public String getID() {
        return this.id;
    }

    public String getName() {
        return this.name;
    }

    public Boolean isGuest() {
        return this.guest;
    }

    public Boolean isDefault() {
        return this.defaultRole;
    }

    public List<Role> getInherits() {
        return this.inherits;
    }

    public void setInherits(List<Role> inherits) {
        this.inherits = inherits;
    }

    public List<Badge> getBadges() {
        return this.badges;
    }

    public List<String> getPermissions() {
        Stream<String> inherited = inherits.stream()
                .map(Role::getPermissions)
                .flatMap(List::stream);
        return Stream.concat(permissions.stream(), inherited)
                .collect(Collectors.toList());
    }

    public boolean hasPermission(String node) {
        return getPermissions().contains(node);
    }

    public static void makeCanonical(Role role) {
        canonicalRoles.put(role.id, role);
    }

    public static Role fromID(String id) {
        return canonicalRoles.get(id);
    }

    public static List<Role> fromIDs(List<String> ids) {
        List<Role> found = new ArrayList<>();
        for (String id : ids) {
            found.add(canonicalRoles.get(id));
        }
        return found;
    }

    public static List<Role> fromIDs(String ids) {
        return fromIDs(Arrays.asList(ids.split(",")));
    }

    public static List<Role> fromNames(List<String> ids) {
        return canonicalRoles.values().stream()
                .filter(role -> ids.contains(role.getName()))
                .collect(Collectors.toUnmodifiableList());
    }

    public static List<Role> fromNames(String names) {
        return fromNames(Arrays.asList(names.split(",")));
    }

    public static List<Role> fromMixed(List<String> mixed) {
        return canonicalRoles.values().stream()
                .filter(role -> mixed.contains(role.getID()) || mixed.contains(role.getName()))
                .collect(Collectors.toUnmodifiableList());
    }

    public static List<Role> fromMixed(String mixed) {
        return fromMixed(Arrays.asList(mixed.split(",")));
    }

    public static List<Role> getGuestRoles() {
        return canonicalRoles.values().stream().filter(Role::isGuest).collect(Collectors.toList());
    }

    public static List<Role> getDefaultRoles() {
        return canonicalRoles.values().stream().filter(Role::isDefault).collect(Collectors.toList());
    }

    public static class Mapper implements RowMapper<Role> {
        @Override
        public Role map(ResultSet rs, StatementContext ctx) throws SQLException {
            return Role.fromIDs(rs.getString("role")).get(0);
        }
    }
}
