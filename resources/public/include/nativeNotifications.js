const { settings } = require('./settings');
const { uiHelper } = require('./uiHelper');
const { template } = require('./template');

// this takes care of browser notifications
module.exports.nativeNotifications = (function() {
  const self = {
    elements: {},
    init: () => {
      settings.place.notification.enable.listen(function(value) {
        if (value) {
          self.request();
        }
      });
    },
    request: () => {
      try {
        Notification.requestPermission();
      } catch (e) {
        console.warn('Notifications not available');
      }
    },
    show: (body) => {
      let title = uiHelper.initTitle;
      const templateOpts = template.getOptions();
      if (templateOpts.use && templateOpts.title) {
        title = `${templateOpts.title} - ${title}`;
      }

      try {
        const notif = new Notification(title, {
          body,
          icon: 'favicon.ico'
        });
        notif.onclick = () => {
          parent.focus();
          window.focus();
          notif.close();
        };

        return notif;
      } catch (err) {
        console.warn('Notifications not available');
      }

      return null;
    },
    maybeShow: (body) => {
      if (settings.place.notification.enable.get() &&
          uiHelper.tabHasFocus() &&
          Notification.permission === 'granted') {
        return self.show(body);
      }
    }
  };
  return {
    init: self.init,
    maybeShow: self.maybeShow
  };
})();
