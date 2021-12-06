package space.pxls.auth;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.Optional;

import org.jdbi.v3.core.mapper.RowMapper;
import org.jdbi.v3.core.statement.StatementContext;

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

	public static class Mapper implements RowMapper<Provider> {
        @Override
        public Provider map(ResultSet r, StatementContext ctx) throws SQLException {
			return new Provider(
				r.getString("user_name"),
				r.getString("user_id"),
				r.getString("identity_provider")
			);
        }
    }
}
