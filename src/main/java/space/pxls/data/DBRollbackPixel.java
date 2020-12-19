package space.pxls.data;


/**
 * Created by Endrik on 05-May-17.
 */
public class DBRollbackPixel{
    public final DBPixelPlacementFull toPixel;
    public final int fromId;

    public DBRollbackPixel(DBPixelPlacementFull toPixel, int fromId){
        this.toPixel = toPixel;
        this.fromId = fromId;
    }
}
