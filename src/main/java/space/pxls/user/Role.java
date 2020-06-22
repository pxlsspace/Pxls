package space.pxls.user;

import space.pxls.App;
import space.pxls.server.packets.chat.Badge;

import java.util.ArrayList;
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
    private final List<Permission> permissions;

    public Role(String id, String name, Boolean guest, Boolean defaultRole, List<Badge> badges, List<Permission> permissions) {
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

    public List<Permission> getPermissions() {
        Stream<Permission> inherited = inherits.stream()
                .map(Role::getPermissions)
                .flatMap(List::stream);
        return Stream.concat(permissions.stream(), inherited)
                .collect(Collectors.toList());
    }

    public boolean hasPermission(Permission permission) {
        return getPermissions().contains(permission);
    }

    public boolean hasPermission(String node) {
        return hasPermission(App.getPermissionManager().resolve(node));
    }
}
