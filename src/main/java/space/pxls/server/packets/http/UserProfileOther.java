package space.pxls.server.packets.http;

import space.pxls.user.ProfileFaction;
import space.pxls.user.ProfileFactionOther;
import space.pxls.user.Role;

import java.util.List;

public record UserProfileOther(
        int id,
        String name,
        long signupTime,
        int pixelCount,
        int pixelCountAllTime,
        List<Role> roles,
        Integer displayedFactionId,
        List<ProfileFactionOther> factions,
        boolean isBanned,
        boolean isPermaBanned,
        Long banExpiry,
        boolean isChatBanned,
        boolean isPermaChatBanned,
        long chatBanExpiry,
        boolean isFactionRestricted
) {}
