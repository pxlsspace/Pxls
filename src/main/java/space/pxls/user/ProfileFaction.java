package space.pxls.user;

import space.pxls.server.packets.http.UserProfileMinimal;

import java.util.List;

public record ProfileFaction(
        int id,
        String name,
        String tag,
        int color,
        int ownerId,
        String ownerName,
        String canvasCode,
        long created,
        List<UserProfileMinimal> members
) {}
