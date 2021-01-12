package space.pxls.server.packets.chat;

import java.util.HashMap;
import java.util.Optional;

import space.pxls.user.User;

public class ServerChatUserUpdateBuilder {
	private String username;
	private HashMap<String, Object> updates;

	public ServerChatUserUpdateBuilder(String username) {
		this.username = username;
		this.updates = new HashMap<String, Object>();
	}

	public ServerChatUserUpdateBuilder(User user) {
		this(user.getName());
	}

	public String getUsername() {
		return username;
	}

	public ServerChatUserUpdateBuilder setUsername(String username) {
		this.username = username;
		return this;
	}

	public ServerChatUserUpdateBuilder set(String name, Object value) {
		this.updates.put(name, value);
		return this;
	}

	public boolean has(String name) {
		return this.updates.containsKey(name);
	}

	public Optional<Object> get(String name) {
		if (!has(name)) {
			return Optional.empty();
		}

		return Optional.of(this.updates.get(name));
	}

	public ServerChatUserUpdate build() {
		return new ServerChatUserUpdate(this.username, this.updates);
	}
}
