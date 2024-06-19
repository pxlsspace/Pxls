package space.pxls.server.packets.http;

public record ProfileReport(
        Integer x,
        Integer y,
        String target,
        long time,
        String message,
        boolean closed
) {}
