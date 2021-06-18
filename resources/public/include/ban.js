const { socket } = require('./socket');

// this object is responsible for detecting pxls placement and banning them
module.exports.ban = (function() {
  const self = {
    bad_src: [/^https?:\/\/[^/]*raw[^/]*git[^/]*\/(metonator|Deklost|NomoX|RogerioBlanco)/gi,
      /.*pxlsbot(\.min)?\.js/gi,
      /^chrome-extension:\/\/lmleofkkoohkbgjikogbpmnjmpdedfil/gi,
      /^https?:\/\/.*mlpixel\.org/gi],
    bad_events: ['mousedown', 'mouseup', 'click'],
    checkSrc: function(src) {
      // as naive as possible to make injection next to impossible
      for (let i = 0; i < self.bad_src.length; i++) {
        if (src.match(self.bad_src[i])) {
          self.shadow('checkSrc pattern #' + i);
        }
      }
    },
    init: function() {
      setInterval(self.update, 5000);

      const _WebSocket = WebSocket;
      // don't allow new websocket connections
      // eslint-disable-next-line no-global-assign
      WebSocket = function(a, b) {
        self.shadow('new WebSocket instance');
        return new _WebSocket(a, b);
      };

      // don't even try to generate mouse events. I am being nice
      window.MouseEvent = function() {
        self.me('new MouseEvent instance');
      };

      const _Event = Event;
      // enough of being nice
      // eslint-disable-next-line no-global-assign
      Event = function(e, s) {
        if (self.bad_events.indexOf(e.toLowerCase()) !== -1) {
          self.shadow('bad Event ' + self.bad_events[self.bad_events.indexOf(e.toLowerCase())]);
        }
        return new _Event(e, s);
      };
      const _CustomEvent = CustomEvent;
      // eslint-disable-next-line no-global-assign
      CustomEvent = function(e, s) {
        if (self.bad_events.indexOf(e.toLowerCase()) !== -1) {
          self.shadow('bad CustomEvent ' + self.bad_events[self.bad_events.indexOf(e.toLowerCase())]);
        }
        return new _CustomEvent(e, s);
      };
      const createEvent = document.createEvent;
      // eslint-disable-next-line no-global-assign
      document.createEvent = function(e, s) {
        if (self.bad_events.indexOf(e.toLowerCase()) !== -1) {
          self.shadow('bad document.createEvent ' + self.bad_events[self.bad_events.indexOf(e.toLowerCase())]);
        }
        return createEvent(e, s);
      };

      // listen to script insertions
      $(window).on('DOMNodeInserted', function(evt) {
        if (evt.target.nodeName !== 'SCRIPT') {
          return;
        }
        self.checkSrc(evt.target.src);
      });
      $('script').map(function() {
        self.checkSrc(this.src);
      });
    },
    shadow: function(reason) {
      socket.send(`{"type": "shadowbanme", "reason": "${reason}"}`);
    },
    me: function(reason) {
      socket.send(`{"type": "banme", "reason": "${reason}"}`);
      socket.close();
      window.location.href = 'https://www.youtube.com/watch?v=QHvKSo4BFi0';
    },
    update: function() {
      window.App.attemptPlace = () => self.me('window.App.attemptPlace');
      window.App.doPlace = () => self.me('window.App.doPlace');

      // AutoPXLS by p0358 (who, by the way, will never win this battle)
      if (document.autoPxlsScriptRevision != null) self.shadow('document.autoPxlsScriptRevision');
      if (document.autoPxlsScriptRevision_ != null) self.shadow('document.autoPxlsScriptRevision_');
      if (document.autoPxlsRandomNumber != null) self.shadow('document.autoPxlsRandomNumber');
      if (document.RN != null) self.shadow('document.RN');
      if (window.AutoPXLS != null) self.shadow('window.AutoPXLS');
      if (window.AutoPXLS2 != null) self.shadow('window.AutoPXLS2');
      if (document.defaultCaptchaFaviconSource != null) self.shadow('document.defaultCaptchaFaviconSource');
      if (window.CFS != null) self.shadow('window.CFS');
      if ($('div.info').find('#autopxlsinfo').length) self.shadow('#autopxlsinfo');

      // Modified AutoPXLS
      if (window.xD != null) self.shadow('window.xD (autopxls2)');
      if (window.vdk != null) self.shadow('window.vdk (autopxls2)');

      // Notabot
      if ($('.botpanel').length) self.shadow('.botpanel (notabot/generic)');
      if (window.Notabot != null) self.shadow('window.Notabot (notabot)');

      // "Botnet" by (unknown, obfuscated)
      if (window.Botnet != null) self.shadow('window.Botnet');

      // ???
      if (window.DrawIt != null) self.shadow('window.DrawIt');

      // NomoXBot
      if (window.NomoXBot != null) self.shadow('window.NomoXBot (nomo)');
      if (window.UBot != null) self.shadow('window.UBot (nomo)');
      if (document.querySelector('.xbotpanel') != null) self.shadow('.xbotpanel (nomo)');
      if (document.querySelector('.botalert') != null) self.shadow('.botalert (nomo)');
      if (document.getElementById('restartbot') != null) self.shadow('#restartbot (nomo)');
    }
  };
  return {
    init: self.init,
    shadow: self.shadow,
    me: self.me
  };
})();
