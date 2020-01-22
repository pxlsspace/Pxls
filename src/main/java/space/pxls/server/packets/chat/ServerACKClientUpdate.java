package space.pxls.server.packets.chat;

public class ServerACKClientUpdate {
    public String type = "ack_client_update";
    public Boolean success;
    public String message;
    public String updateType;
    public String updateValue;

    public ServerACKClientUpdate(Boolean success, String message, String updateType, String updateValue) {
        this.success = success;
        this.message = message;
        this.updateType = updateType;
        this.updateValue = updateValue;
    }

    public String getType() {
        return type;
    }

    public Boolean getSuccess() {
        return success;
    }

    public String getMessage() {
        return message;
    }

    public String getUpdateType() {
        return updateType;
    }

    public String getUpdateValue() {
        return updateValue;
    }
}