package space.pxls.util;

import org.apache.logging.log4j.Level;

import space.pxls.App;
import java.util.TimerTask;

public class SessionTimer extends TimerTask {
	public void run () {
		App.getLogger().log(Level.INFO, "Clearing old sessions....");
		App.getDatabase().clearOldSessions();
	}
}
