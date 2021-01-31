package space.pxls.server;

import java.util.Optional;

import io.undertow.websockets.core.WebSocketChannel;

import space.pxls.user.User;

public class PxlsWebSocketChannel {
	private WebSocketChannel underlyingChannel;
	private User user;

	PxlsWebSocketChannel(WebSocketChannel underlyingChannel, User user) {
		this.underlyingChannel = underlyingChannel;
		this.user = user;
	}

	public WebSocketChannel getUnderlyingChannel() {
		return underlyingChannel;
	}

	public Optional<User> getUser() {
		return Optional.ofNullable(user);
	}
}
