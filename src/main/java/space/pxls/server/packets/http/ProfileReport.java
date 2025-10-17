package space.pxls.server.packets.http;

public record ProfileReport(
        Integer x,
        Integer y,
        Integer chatMessageId,
        String target,
        long time,
        String message,
        boolean closed
) {}
