package space.pxls.server.packets.http;

public record UserProfileMinimal(
        int id,
        String name,
        int pixelCountAllTime
) {}
