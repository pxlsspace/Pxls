package space.pxls.auth;

import org.pac4j.core.config.*;
import org.pac4j.core.context.CallContext;
import org.pac4j.core.credentials.Credentials;
import org.pac4j.core.credentials.TokenCredentials;
import org.pac4j.core.profile.UserProfile;
import org.pac4j.core.profile.creator.ProfileCreator;
import org.pac4j.core.client.*;
import org.pac4j.core.client.direct.AnonymousClient;
import org.pac4j.http.client.direct.HeaderClient;
import org.pac4j.http.client.direct.IpClient;
import org.pac4j.http.credentials.authenticator.IpRegexpAuthenticator;
import org.pac4j.oidc.client.*;
import org.pac4j.oidc.config.*;
import org.pac4j.oidc.credentials.OidcCredentials;
import org.pac4j.oidc.exceptions.OidcException;

import java.net.*;
import javax.net.ssl.*;
import java.security.SecureRandom;
import java.security.cert.X509Certificate;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import space.pxls.App;

public class OpenIDConfig implements ConfigFactory {
    public Config build(Object... parameters) {
        try {
            final URI discoveryUri = new URI(App.getConfig().getString("auth.issuer") + "/")
                .resolve(".well-known/openid-configuration");

            final URI callbackUri = new URI(App.getConfig().getString("auth.callback"));

			final OidcConfiguration oidcConfiguration = new OidcConfiguration();
			oidcConfiguration.setClientId(App.getConfig().getString("auth.client"));
			oidcConfiguration.setSecret(App.getConfig().getString("auth.secret"));
			oidcConfiguration.setDiscoveryURI(discoveryUri.toString());
			oidcConfiguration.setScope("openid profile connected_accounts");
			oidcConfiguration.setExpireSessionWithToken(true);

            boolean devmode;
            try {
                devmode = App.getConfig().getBoolean("auth.devmode");
            } catch(Exception e) {
                devmode = false;
            }

            if (devmode) {                
                var trustAllCerts = new TrustManager[] { 
                    new X509TrustManager() {
                        public X509Certificate[] getAcceptedIssuers() {
                            return new X509Certificate[0];
                        }
                
                        @Override
                        public void checkClientTrusted(X509Certificate[] certs, String authType) {}
                
                        @Override
                        public void checkServerTrusted(X509Certificate[] certs, String authType) {}
                    }
                };

                try {
                    var sc = SSLContext.getInstance("SSL");
                    sc.init(null, trustAllCerts, new SecureRandom());
                    oidcConfiguration.setSslSocketFactory(sc.getSocketFactory());
                } catch(Exception e) {
                    throw e;
                }
                
                oidcConfiguration.setHostnameVerifier(new HostnameVerifier() {
                    @Override
                    public boolean verify(String name, SSLSession session) {
                        return true;
                    }
                });
            }
            
            final OidcClient oidcClient = new OidcClient(oidcConfiguration);
            oidcClient.setCallbackUrl(App.getHost().resolve("callback").toString());
            oidcClient.init();
            
            var profileCreator = oidcClient.getProfileCreator();
            final HeaderClient bearerClient = new HeaderClient("Authorization", "Bearer", new ProfileCreator() {
                @Override
                public Optional<UserProfile> create(CallContext ctx, Credentials credentials) {
                    var token = ((TokenCredentials) credentials).getToken();
                    
                    try {
                        var cred = new OidcCredentials();
                        cred.setIdToken(token);
                        return profileCreator.create(ctx, cred);
                    } catch(OidcException e) {
                        return Optional.empty();
                    }
                }
            });

            final AnonymousClient anonymousClient = new AnonymousClient();
            final IpClient ipClient = new IpClient(new IpRegexpAuthenticator(".*"));

            final List<Client> clients = new ArrayList<>();

			if (App.getConfig().getBoolean("auth.useIp")) {
				clients.add(ipClient);
			} else {
				clients.add(bearerClient);
				clients.add(oidcClient);
			}

			clients.add(anonymousClient);

			final Config config = new Config(new Clients(
				callbackUri.toString(),
				clients.toArray(new Client[clients.size()])
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
