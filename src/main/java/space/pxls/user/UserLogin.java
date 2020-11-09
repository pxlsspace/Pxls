package space.pxls.user;

import space.pxls.App;
import space.pxls.auth.AuthService;
import space.pxls.data.DBUserLogin;

public class UserLogin {
	private String serviceID;
	private String serviceUserID;

	public UserLogin(String serviceID, String serviceUserID) {
		this.serviceID = serviceID;
		this.serviceUserID = serviceUserID;
	}

	public String getServiceID() {
		return serviceID;
	}

	public String getServiceUserID() {
		return serviceUserID;
	}

	public AuthService getService() {
		return App.getServer().getWebHandler().getAuthServiceByID(serviceID);
	}

	public static UserLogin fromDB(DBUserLogin login) {
		return new UserLogin(
			login.getServiceID(),
			login.getServiceUserID()
		);
	}
}
