package space.pxls.server.packets.http;

import java.util.List;
import java.util.Map;

public record ProfileResponseOther(
    UserProfileOther user,
    UserProfileMinimal self,
    String palette,
    boolean snipMode
) {}
