package space.pxls.user;

public record ProfileFaction(
        int id,
        String name,
        String tag,
        int color,
        String owner,
        String canvasCode,
        long created,
        int memberCount
) {}
