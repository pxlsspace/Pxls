const { socket } = require('./socket');
const { ls } = require('./storage');
const { chat } = require('./chat');

module.exports.notifications = (function() {
  const self = {
    elems: {
      body: document.querySelector('.panel[data-panel="notifications"] .panel-body'),
      bell: document.getElementById('notifications-icon'),
      pingCounter: document.getElementById('notifications-ping-counter')
    },
    init() {
      $.get('/notifications', function(data) {
        if (Array.isArray(data) && data.length) {
          data.forEach((elem) => self._handleNotif(elem));
          self._checkLatest(data[0].id);
        }
      }).fail(function() {
        console.error('Failed to get initial notifications from server');
      });
      socket.on('notification', (data) => {
        const notif = data && data.notification ? data.notification : false;
        if (notif) {
          self._handleNotif(notif, true);
          self._checkLatest(notif.id);
        }
      });
      $(window).on('pxls:panel:opened', (e, which) => {
        if (which === 'notifications' && self.elems.body && self.elems.body.firstChild) {
          self.elems.bell.closest('.panel-trigger[data-panel]').classList.remove('has-ping');
          self.elems.bell.classList.remove('has-notification');
          ls.set('notifications.lastSeen', self.elems.body.firstChild.dataset.notificationId >> 0);
        }
      });
    },
    _checkLatest(id) {
      if (ls.get('notifications.lastSeen') >= id) return;
      if (self.elems.body.closest('.panel[data-panel]').classList.contains('open')) {
        ls.set('notifications.lastSeen', id);
      } else {
        self.elems.bell.closest('.panel-trigger[data-panel]').classList.add('has-ping');
        self.elems.bell.classList.add('has-notification');
      }
    },
    _handleNotif(notif, prepend = false) {
      if (notif === false) return;
      if (prepend && self.elems.body.firstChild) {
        self.elems.body.insertBefore(self.makeDomForNotification(notif), self.elems.body.firstChild);
      } else {
        crel(self.elems.body, self.makeDomForNotification(notif));
      }
    },
    makeDomForNotification(notification) {
      const expiry = notification.expiry ? moment.unix(notification.expiry).format('MMM DD YYYY') : null;

      return crel('article', { class: 'notification', 'data-notification-id': notification.id },
        crel('header', { class: 'notification-title' }, crel('h2', notification.title)),
        crel('div', { class: 'notification-body' }, chat.processMessage(notification.content)),
        crel('footer', { class: 'notification-footer' },
          notification.who ? document.createTextNode(__(`Posted by ${notification.who}`)) : null,
          notification.expiry !== 0 ? crel('span', { class: 'notification-expiry float-left' },
            crel('i', { class: 'far fa-clock fa-is-left' }),
            crel('span', { title: moment.unix(notification.expiry).format('MMMM DD, YYYY, hh:mm:ss A') }, __(`Expires ${expiry}`))
          ) : null
        )
      );
    }
  };
  return {
    init: self.init
  };
})();
