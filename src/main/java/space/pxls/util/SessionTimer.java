package space.pxls.util;

import org.apache.logging.log4j.Level;

import space.pxls.App;
import java.util.TimerTask;

public class SessionTimer extends TimerTask {
	AuthReader auth;

	public SessionTimer(AuthReader auth) {
		this.auth = auth;
	}

	public void run () {
		App.getLogger().log(Level.INFO, "Clearing old sessions....");
		auth.expireSessions();
	}
}
