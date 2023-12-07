package space.pxls.user;

public record ProfileFaction(
        int id,
        String name,
        String tag,
        int color,
        int ownerId,
        String ownerName,
        String canvasCode,
        long created,
        int memberCount
) {}
