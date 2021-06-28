module.exports.serviceWorkerHelper = (() => {
  const self = {
    isInit: false,
    messageListeners: {},
    hasSupport: 'serviceWorker' in window.navigator,
    init() {
      if (!self.hasSupport) {
        return;
      }

      if (navigator.serviceWorker.controller == null) {
        navigator.serviceWorker.register('/serviceWorker.js')
          .then(() => {
            self.isInit = true;
          })
          .catch((err) => {
            console.error('Failed to register Service Worker:', err);
          });
      } else {
        self.isInit = true;
      }

      navigator.serviceWorker.addEventListener('message', (ev) => {
        if (typeof ev.data !== 'object' || !('type' in ev.data)) {
          console.warn(`${self.tabId}: Received non-data message from ${ev.source.id} (${ev.source.type})`, ev.data);
          return;
        }

        if (ev.data.type in self.messageListeners) {
          for (const cb of self.messageListeners[ev.data.type]) {
            cb(ev);
          }
        }
        if ('*' in self.messageListeners) {
          for (const cb of self.messageListeners['*']) {
            cb(ev);
          }
        }
      });
    },
    addMessageListener(type, callback) {
      const callbacks = self.messageListeners[type] || [];
      if (callbacks.includes(callback)) {
        return;
      }
      callbacks.push(callback);
      self.messageListeners[type] = callbacks;
    },
    removeMessageListener(type, callback) {
      if (!(type in self.messageListeners)) {
        return;
      }

      const callbacks = self.messageListeners[type];
      const idx = callbacks.indexOf(callback);
      if (idx === -1) {
        return;
      }

      callbacks.splice(idx, 1);
    },
    postMessage(data) {
      if (!self.isInit) {
        return;
      }

      navigator.serviceWorker.ready.then(({ installing, waiting, active }) => {
        const worker = navigator.serviceWorker.controller || installing || waiting || active;
        worker.postMessage(data);
      });
    }
  };

  return {
    get hasSupport() {
      return self.hasSupport;
    },
    get readyPromise() {
      return navigator.serviceWorker.ready.then((v) => {
        // fail safe
        self.isInit = true;
        return v;
      });
    },
    init: self.init,
    addMessageListener: self.addMessageListener,
    removeMessageListener: self.removeMessageListener,
    postMessage: self.postMessage
  };
})();
