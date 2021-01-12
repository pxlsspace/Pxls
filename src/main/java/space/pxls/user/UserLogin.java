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

	public String toString() {
		return serviceID + ":" + serviceUserID;
	}

	public static UserLogin fromDB(DBUserLogin login) {
		return new UserLogin(
			login.getServiceID(),
			login.getServiceUserID()
		);
	}

	public static UserLogin fromString(String input) {
		int splitIdx = input.indexOf(':');
		if (splitIdx == -1) {
			throw new IllegalArgumentException(String.format("Input string '%s' is not in the format '{serviceID}:{serviceUserID}'", input));
		}
		String serviceID = input.substring(0, splitIdx);
		if (serviceID.isEmpty()) {
			throw new IllegalArgumentException(String.format("Input string '%s' has an invalid service ID", input));
		}
		String serviceUserID = input.substring(splitIdx + 1);
		if (serviceUserID.isEmpty()) {
			throw new IllegalArgumentException(String.format("Input string '%s' has an invalid service user ID", input));
		}
		return new UserLogin(serviceID, serviceUserID);
	}
}
