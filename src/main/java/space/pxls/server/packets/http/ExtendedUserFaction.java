package space.pxls.server.packets.http;

import space.pxls.data.DBFaction;
import space.pxls.user.User;

import java.util.List;
import java.util.stream.Collectors;

public class ExtendedUserFaction extends UserFaction {
    public final List<String> members;

    public ExtendedUserFaction(DBFaction faction) {
        super(faction);
        this.members = faction.fetchMembers().stream().map(User::getName).collect(Collectors.toList());
    }
}
