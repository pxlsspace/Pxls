package space.pxls.server;

import java.util.Optional;

import io.undertow.websockets.core.WebSocketChannel;

import space.pxls.user.User;

public class PxlsWebSocketConnection {
	private WebSocketChannel channel;
	private User user;

	PxlsWebSocketConnection(WebSocketChannel channel, User user) {
		this.channel = channel;
		this.user = user;
	}

	public WebSocketChannel getChannel() {
		return channel;
	}

	public Optional<User> getUser() {
		return Optional.ofNullable(user);
	}
}
