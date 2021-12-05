package space.pxls.auth;

import java.util.Optional;

import net.minidev.json.JSONObject;

public class Provider {
	public final String userName;	
	public final String userId;	
	public final String identityProvider;

	private Provider(String userName, String userId, String identityProvider) {
		this.userName = userName;
		this.userId = userId;
		this.identityProvider = identityProvider;
	}

	public static Optional<Provider> fromJSON(JSONObject json) {
		final Object maybeName = json.getAsString("userName");
		final Object maybeId = json.getAsString("userId");
		final Object maybeProvider = json.getAsString("identityProvider");

		if (maybeName instanceof String && maybeId instanceof String && maybeProvider instanceof String) {
			final String userName = (String) maybeName;
			final String userId = (String) maybeId;
			final String identityProvider = (String) maybeProvider;

			return Optional.of(new Provider(userName, userId, identityProvider));
		} else {
			return Optional.empty();
		}
	}

	@Override
	public String toString() {
		return "Provider {userName=" + userName +
			",userId=" + userId +
			",identityProvider=" + identityProvider +
			"}";
	}
}
