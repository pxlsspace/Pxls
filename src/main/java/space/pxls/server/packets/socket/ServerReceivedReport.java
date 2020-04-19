package space.pxls.server.packets.socket;

public class ServerReceivedReport {
    public static final String REPORT_TYPE_CHAT = "CHAT";
    public static final String REPORT_TYPE_CANVAS = "CANVAS";

    private Integer report_id;
    private String type = "received_report";
    private String report_type;

    public ServerReceivedReport(Integer report_id, String report_type) {
        this.report_id = report_id;
        this.report_type = report_type;
    }
}
