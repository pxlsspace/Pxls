package space.pxls.server.packets.http;

import space.pxls.data.DBFaction;
import space.pxls.user.Faction;
import space.pxls.user.User;

import java.util.List;
import java.util.stream.Collectors;

public class ExtendedUserFaction extends UserFaction {
    public List<String> members = null;

    public ExtendedUserFaction(DBFaction faction) {
        super(faction);
        _scaffold(new Faction(faction));
    }

    public ExtendedUserFaction(Faction faction) {
        super(faction);
        _scaffold(faction);
    }

    private void _scaffold(Faction f) {
        this.members = f.fetchMembers().stream().map(User::getName).collect(Collectors.toList());
    }
}
