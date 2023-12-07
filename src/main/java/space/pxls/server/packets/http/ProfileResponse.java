package space.pxls.server.packets.http;

import java.util.List;
import java.util.Map;

public record ProfileResponse(
    UserProfile user,
    UserProfileMinimal self,
    String palette,
    int newFactionMinPixels,
    int maxFactionTagLength,
    int maxFactionNameLength,
    List<ProfileReport> canvasReports,
    List<ProfileReport> chatReports,
    boolean snipMode,
    Map<String, String> keys
) {}
