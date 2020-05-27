function broadcast(msg) {
  self.clients.matchAll({
    type: 'window',
    includeUncontrolled: true
  }).then((clients) => {
    for (const client of clients) {
      client.postMessage(msg);
    }
  });
}

let lastFocusedClientId = null;
self.addEventListener('message', async (ev) => {
  const { source, data } = ev;
  if (typeof data !== 'object' || !('type' in data)) {
    console.warn(`serviceWorker: Received non-data message from ${source.id} (${source.type})`, data);
    return;
  }

  switch (data.type) {
    case 'request-id': {
      ev.source.postMessage({ type: 'request-id', id: source.id });
      break;
    }
    case 'focus': {
      broadcast({ type: 'focus', id: source.id });
      lastFocusedClientId = source.id;
      break;
    }
    case 'leave': {
      if (source.id === lastFocusedClientId) {
        const clients = await self.clients.matchAll({
          type: 'window',
          includeUncontrolled: true
        });
        if (clients.length === 0) {
          return;
        }

        const focusedClientId = clients[clients.length - 1].id;
        broadcast({ type: 'focus', id: focusedClientId });
        lastFocusedClientId = focusedClientId;
      }
      break;
    }
  }
});
