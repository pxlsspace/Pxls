package space.pxls.server.packets.http;

import space.pxls.user.ProfileFaction;

import java.util.List;

public record ProfileResponse (
        int id,
        String username,
        long signupTime,
        int pixelCount,
        int pixelCountAllTime,
        String roleNames,
        Integer displayedFactionId,
        List<ProfileFaction> factions,
        boolean isBanned,
        boolean isPermaBanned,
        Long banExpiry,
        boolean isChatBanned,
        boolean isPermaChatBanned,
        long chatBanExpiry,
        boolean isFactionRestricted,
        String discordName
) {}

