package space.pxls.util;

import space.pxls.App;
import java.util.TimerTask;

public class HeatmapTimer extends TimerTask {
	public void run () {
		App.updateHeatmap();
	}
}
