package space.pxls.util;

import org.apache.logging.log4j.Level;

import space.pxls.App;
import java.util.TimerTask;

public class DatabaseTimer extends TimerTask {
	public void run () {
		App.getDatabase().cleanup();
	}
}
