package space.pxls.auth;

import org.pac4j.core.config.*;
import org.pac4j.core.client.*;
import org.pac4j.core.client.direct.AnonymousClient;
import org.pac4j.http.client.direct.HeaderClient;
import org.pac4j.http.client.direct.IpClient;
import org.pac4j.http.credentials.authenticator.IpRegexpAuthenticator;
import org.pac4j.oidc.client.*;
import org.pac4j.oidc.config.*;
import org.pac4j.oidc.credentials.authenticator.UserInfoOidcAuthenticator;

import java.net.*;
import java.util.ArrayList;
import java.util.List;

import space.pxls.App;

public class OpenIDConfig implements ConfigFactory {
    public Config build(Object... parameters) {
		try {
			final URI discoveryUri = new URL(App.getConfig().getString("auth.issuer") + "/")
					.toURI()
					.resolve(".well-known/openid-configuration");

			final URI callbackUri = new URL(App.getConfig().getString("auth.callback"))
					.toURI();

			final OidcConfiguration oidcConfiguration = new OidcConfiguration();
			oidcConfiguration.setClientId(App.getConfig().getString("auth.client"));
			oidcConfiguration.setSecret(App.getConfig().getString("auth.secret"));
			oidcConfiguration.setDiscoveryURI(discoveryUri.toString());
			oidcConfiguration.setScope("openid profile");
			final OidcClient<OidcConfiguration> oidcClient = new OidcClient<>(oidcConfiguration);

			final UserInfoOidcAuthenticator headerAuthenticator = new UserInfoOidcAuthenticator(oidcConfiguration);
			final HeaderClient bearerClient = new HeaderClient("Authorization", "Bearer", headerAuthenticator);

			final AnonymousClient anonymousClient = new AnonymousClient();

			final IpClient ipClient = new IpClient(new IpRegexpAuthenticator(".*"));

			System.out.println(ipClient.getName());

			final List<Client<?>> clients = new ArrayList<>();

			if (App.getConfig().getBoolean("auth.useIp")) {
				clients.add(ipClient);
			} else {
				clients.add(bearerClient);
				clients.add(oidcClient);
			}

			clients.add(anonymousClient);

			final Config config = new Config(new Clients(
				callbackUri.toString(),
				clients.toArray(new Client<?>[clients.size()])
			));

			return config;
		} catch(Exception e) {
			System.err.println("Invalid auth config:");
			e.printStackTrace();
			System.exit(1);
			return null;
		}
    }
}
