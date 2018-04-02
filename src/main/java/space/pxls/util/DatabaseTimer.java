package space.pxls.util;

import space.pxls.App;
import java.util.TimerTask;

public class DatabaseTimer extends TimerTask {
	public void run () {
		App.getDatabase().cleanup();
	}
}
