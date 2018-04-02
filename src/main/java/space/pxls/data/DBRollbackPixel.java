package space.pxls.data;

public class DBRollbackPixel{
    public final DBPixelPlacement toPixel;
    public final int fromId;

    public DBRollbackPixel(DBPixelPlacement toPixel, int fromId){
        this.toPixel = toPixel;
        this.fromId = fromId;
    }
}
