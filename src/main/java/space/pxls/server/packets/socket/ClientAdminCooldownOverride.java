package space.pxls.server.packets.socket;

public class ClientAdminCooldownOverride {
    public Boolean override;

    public ClientAdminCooldownOverride(Boolean override) {
        this.override = override;
    }

    public Boolean getOverride() {
        return override;
    }
}
