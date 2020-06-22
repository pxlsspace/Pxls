package space.pxls.user;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

public class PermissionManager {
    private final HashMap<String, Permission> permissions;

    public PermissionManager() {
        permissions = new HashMap<>();
    }

    public void register(Permission permission) {
        this.permissions.put(permission.getNode(), permission);
    }

    public Permission resolve(String node) {
        Permission permission = permissions.get(node);
        if (permission == null) {
            permission = new Permission(node);
            permissions.put(node, permission);
        }
        return permission;
    }

    public Permission resolve(Permission permission) {
        permissions.putIfAbsent(permission.getNode(), permission);
        return permission;
    }

    public List<Permission> resolve(List<String> nodes) {
        ArrayList<Permission> resolved = new ArrayList<>();
        for (String node : nodes) {
            resolved.add(resolve(node));
        }
        return resolved;
    }
}
