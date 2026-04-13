package space.pxls.auth;

import java.util.HashSet;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
import java.util.stream.Collectors;

import io.undertow.server.HttpServerExchange;
import io.undertow.server.session.Session;
import io.undertow.server.session.SessionConfig;
import io.undertow.server.session.SessionListener;
import io.undertow.server.session.SessionManager;
import io.undertow.server.session.SessionManagerStatistics;
import io.undertow.util.AttachmentKey;
import io.undertow.server.session.SessionListener.SessionDestroyedReason;
import space.pxls.App;
import space.pxls.util.Util;

public class DatabaseSessionManager implements SessionManager {
    
    private final ConcurrentMap<String, DatabaseSession> sessionCache = new ConcurrentHashMap<String, DatabaseSession>();
    private final Set<SessionListener> listeners = new HashSet<SessionListener>();
    private final AttachmentKey<DatabaseSession> NEW_SESSION = AttachmentKey.create(DatabaseSession.class);
    
    public void updateToken(String oldId, String newId) {
    }
    
    @Override
    public String getDeploymentName() {
        return "PxlsDatabaseSessionManager";
    }

    @Override
    public void start() {}

    @Override
    public void stop() {
        // TODO ([  ]): Clear sessions
    }

    @Override
    public Session createSession(HttpServerExchange exchange, SessionConfig config) {
        // NOTE ([  ]): Check if a session was already created for this exchange
        // and return it if it was. This is required because multiple calls to
        // findSessionId will stop returning the old session and start generating
        // new ones after the first call.
        var previouslyCreatedSession = exchange.getAttachment(NEW_SESSION);
        if (previouslyCreatedSession != null) {
            return previouslyCreatedSession;
        }
        
        var sessionId = config.findSessionId(exchange);
        if (sessionId == null || sessionId.length() > 32) {
            sessionId = Util.generateRandomToken();
            config.setSessionId(exchange, sessionId);
        }
        
        // NOTE ([  ]): The method documentation requires an IllegalStateException
        // be thrown when trying to create a session which already exists.
        // I am overruling this implementation advice because it causes bugs.
        // Consider the following:
        //
        // 1. Callers cannot atomically know if a session already exists
        // 2. This leads to multiple requests trying to create a session when a
        //    client with a valid session id sends multiple first requests at
        //    the same time.
        // 3. The exception gets thrown, causing all but one of the request to
        //    fail.
        //
        // Following from this, simply returning the already created session
        // seems entirely harmless. The documentation says:
        //
        // > This requirement exists to allow forwards across servlet contexts
        // > to work correctly.
        //
        // But this doesn't seem to work well in practice. That said, if strange
        // session bugs start manifesting involving duplicate states, this may
        // be the place to look.
        
        var session = this.sessionCache.computeIfAbsent(sessionId, k -> {
            var data = App.getDatabase().getSession(k)
                .orElseGet(() -> new SessionData());
            var s = new DatabaseSession(k, data);
            this.listeners.forEach(l -> l.sessionCreated(s, exchange));
            return s;
        });
        
        exchange.putAttachment(NEW_SESSION, session);
        
        return session;
    }

    @Override
    public Session getSession(HttpServerExchange exchange, SessionConfig config) {
        var sessionId = config.findSessionId(exchange);
        if (sessionId == null) {
            return null;
        } else {
            return this.getSession(sessionId);
        }
    }

    @Override
    public Session getSession(String sessionId) {
        return this.sessionCache.computeIfAbsent(sessionId, key -> {
            return App.getDatabase().getSession(key)
                .map(data -> new DatabaseSession(key, data))
                .orElse(null);
        });
    }

    @Override
    public void registerSessionListener(SessionListener listener) {
        this.listeners.add(listener);
    }

    @Override
    public void removeSessionListener(SessionListener listener) {
        this.listeners.remove(listener);
    }

    @Override
    public void setDefaultSessionTimeout(int timeout) {
        // TODO Auto-generated method stub
        throw new UnsupportedOperationException("Unimplemented method 'setDefaultSessionTimeout'");
    }

    @Override
    public Set<String> getTransientSessions() {
        return this.sessionCache.entrySet().stream()
            .filter(e -> e.getValue().isTransient())
            .map(e -> e.getKey())
            .collect(Collectors.toSet());
    }

    @Override
    public Set<String> getActiveSessions() {
        return this.sessionCache.keySet();
    }

    @Override
    public Set<String> getAllSessions() {
        var storedSessions = App.getDatabase().getAllSessions();
        storedSessions.addAll(this.sessionCache.keySet());
        return storedSessions;
    }

    @Override
    public SessionManagerStatistics getStatistics() {
        return null;
    }

    public class DatabaseSession implements Session {    

        private final SessionData data;
        private String id;
        
        DatabaseSession(String id, SessionData data) {
            this.id = id;
            this.data = data;
        }
        
        public boolean isTransient() {
            return !this.data.isStored();
        }
        
        @Override
        public String getId() {
            return this.id;
        }
    
        @Override
        public void requestDone(HttpServerExchange serverExchange) {
            this.data.save(this.id);
        }
    
        @Override
        public long getCreationTime() {
            // TODO Auto-generated method stub
            throw new UnsupportedOperationException("Unimplemented method 'getCreationTime'");
        }
    
        @Override
        public long getLastAccessedTime() {
            // TODO Auto-generated method stub
            throw new UnsupportedOperationException("Unimplemented method 'getLastAccessedTime'");
        }
    
        @Override
        public void setMaxInactiveInterval(int interval) {
            // TODO Auto-generated method stub
            throw new UnsupportedOperationException("Unimplemented method 'setMaxInactiveInterval'");
        }
    
        @Override
        public int getMaxInactiveInterval() {
            // TODO Auto-generated method stub
            throw new UnsupportedOperationException("Unimplemented method 'getMaxInactiveInterval'");
        }
    
        @Override
        public Object getAttribute(String name) {
            return this.data.get(name);
        }
    
        @Override
        public Set<String> getAttributeNames() {
            return this.data.keys();
        }
    
        @Override
        public Object setAttribute(String name, Object value) {
            if (value == null) {
                return this.removeAttribute(name);
            } else {
                var previous = this.data.set(name, value);
                
                var manager = DatabaseSessionManager.this;
                if (previous == null) {
                    manager.listeners.forEach(l -> l.attributeAdded(this, name, value));
                } else {
                    manager.listeners.forEach(l -> l.attributeUpdated(this, name, value, previous));
                }
                
                return previous;
            }
        }
    
        @Override
        public Object removeAttribute(String name) {
            var removed = this.data.remove(name);
            
            var manager = DatabaseSessionManager.this;
            manager.listeners.forEach(l -> l.attributeRemoved(this, name, removed));
            
            return removed;
        }
    
        @Override
        public void invalidate(HttpServerExchange exchange) {
            var manager = DatabaseSessionManager.this;
            synchronized (this.id) {                
                var session = manager.sessionCache.remove(id);
                var reason = SessionDestroyedReason.INVALIDATED;
                manager.listeners.forEach(l -> l.sessionDestroyed(session, exchange, reason));
                
                if (this.data.isStored()) {
                    App.getDatabase().deleteSession(this.id);
                }
            }
        }
    
        @Override
        public SessionManager getSessionManager() {
            return DatabaseSessionManager.this;
        }
    
        @Override
        public String changeSessionId(HttpServerExchange exchange, SessionConfig config) {
            var newId = Util.generateRandomToken();
            synchronized (this.id) {
                var oldId = this.id;
                App.getDatabase().changeSessionToken(oldId, newId);
                var manager = DatabaseSessionManager.this;
                var session = manager.sessionCache.remove(oldId);
                manager.sessionCache.put(newId, session);
                this.id = newId;
                
                manager.listeners.forEach(l -> l.sessionIdChanged(this, oldId));
            }
            return newId;
        }
    }    
}
