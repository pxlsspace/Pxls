package space.pxls.server.packets.http;

import java.util.List;
import java.util.Map;

public class ProfileResponse {
    UserProfile user;
    UserProfile self;
    String palette;
    int maxFactionTagLength;
    int maxFactionNameLength;
    List<ProfileReport> canvasReports;
    List<ProfileReport> chatReports;
    boolean snipMode;
    Map<String, String> keys;

    public ProfileResponse(UserProfile user, UserProfile self, String palette, int maxFactionTagLength, int maxFactionNameLength, List<ProfileReport> canvasReports, List<ProfileReport> chatReports, boolean snipMode, Map<String, String> keys) {
        this.user = user;
        this.self = self;
        this.palette = palette;
        this.maxFactionTagLength = maxFactionTagLength;
        this.maxFactionNameLength = maxFactionNameLength;
        this.canvasReports = canvasReports;
        this.chatReports = chatReports;
        this.snipMode = snipMode;
        this.keys = keys;
    }
}
