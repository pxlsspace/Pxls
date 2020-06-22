package space.pxls.user;

import java.util.*;
import java.util.stream.Collectors;

public class RoleManager {
    private final HashMap<String, Role> roles;

    public RoleManager() {
        roles = new HashMap<>();
    }

    public void register(Role role) {
        this.roles.put(role.getID(), role);
    }

    public Role get(Role role) {
        return this.roles.get(role.getID());
    }

    public Role getByID(String id) {
        return this.roles.get(id);
    }

    public List<Role> getByIDs(List<String> ids) {
        List<Role> foundRoles = new ArrayList<>();
        for (String id : ids) {
            foundRoles.add(getByID(id));
        }
        return foundRoles;
    }

    public List<Role> getByIDs(String ids) {
        return getByIDs(Arrays.asList(ids.split(",")));
    }

    public List<Role> getRoles() {
        return (List<Role>) roles.values();
    }

    public List<Role> getGuestRoles() {
        return roles.values().stream().filter(Role::isGuest).collect(Collectors.toList());
    }

    public List<Role> getDefaultRoles() {
        return roles.values().stream().filter(Role::isDefault).collect(Collectors.toList());
    }
}
