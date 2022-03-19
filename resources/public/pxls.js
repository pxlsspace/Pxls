'use strict';
crel.attrMap.onmousemiddledown = function(element, value) {
  element.addEventListener('mousedown', function(e) {
    if (e.button === 1) {
      value.call(this, e);
    }
  });
};
crel.attrMap.dataset = function(element, value) {
  for (const key in value) {
    if (value[key]) {
      element.dataset[key] = value[key];
    }
  }
};

let instaban = false;
if (window.App !== undefined) {
  instaban = true;
}
window.__ = (translatableString) => translatableString;
window.App = (function() {
  const { ls, ss } = require('./include/storage');

  const { TH } = require('./include/typeahead');
  const { settings } = require('./include/settings');
  const { query } = require('./include/query');
  const { ban } = require('./include/ban');
  const { board } = require('./include/board');
  const { overlays } = require('./include/overlays');
  const { template } = require('./include/template');
  const { grid } = require('./include/grid');
  const { place } = require('./include/place');
  const { lookup } = require('./include/lookup');
  const { serviceWorkerHelper } = require('./include/serviceworkers');
  const { uiHelper } = require('./include/uiHelper');
  const { panels } = require('./include/panels');
  const { chat } = require('./include/chat');
  const { timer } = require('./include/timer');
  const { coords } = require('./include/coords');
  const { user } = require('./include/user');
  const { nativeNotifications } = require('./include/nativeNotifications');
  const { notifications } = require('./include/notifications');
  const { chromeOffsetWorkaround } = require('./include/chromeOffsetWorkaround');
  const { modal } = require('./include/modal');

  // init progress
  query.init();
  board.init();
  lookup.init();
  template.init();
  ban.init();
  grid.init();
  place.init();
  timer.init();
  serviceWorkerHelper.init();
  uiHelper.init();
  panels.init();
  coords.init();
  user.init(instaban);
  nativeNotifications.init();
  notifications.init();
  chat.init();
  chromeOffsetWorkaround.init();
  // and here we finally go...
  board.start();

  window.TH = window.TH || TH;

  return {
    ls: ls,
    ss: ss,
    settings: settings,
    query: query,
    overlays: {
      add: overlays.add,
      remove: overlays.remove,
      get heatmap() {
        return {
          clear: overlays.heatmap.clear,
          reload: overlays.heatmap.reload
        };
      },
      get heatbackground() {
        return {
          reload: overlays.heatbackground.reload
        };
      },
      get virginmap() {
        return {
          clear: overlays.virginmap.clear,
          reload: overlays.virginmap.reload
        };
      },
      get virginbackground() {
        return {
          reload: overlays.virginbackground.reload
        };
      }
    },
    uiHelper: {
      get tabId() {
        return uiHelper.tabId;
      },
      tabHasFocus: uiHelper.tabHasFocus,
      updateAudio: uiHelper.updateAudio,
      handleFile: uiHelper.handleFile
    },
    template: {
      update: function(t) {
        template.queueUpdate(t);
      },
      normalize: function(obj, dir = true) {
        return template.normalizeTemplateObj(obj, dir);
      }
    },
    lookup: {
      registerHook: function() {
        return lookup.registerHook(...arguments);
      },
      replaceHook: function() {
        return lookup.replaceHook(...arguments);
      },
      unregisterHook: function() {
        return lookup.unregisterHook(...arguments);
      }
    },
    centerBoardOn: function(x, y) {
      board.centerOn(x, y);
    },
    updateTemplate: function(t) {
      template.queueUpdate(t);
    },
    alert: function(s) {
      modal.showText(s, { title: __('Alert'), modalOpts: { closeExisting: false } });
    },
    doPlace: function() {
      ban.me('call to doPlace()');
    },
    attemptPlace: function() {
      ban.me('call to attemptPlace()');
    },
    chat,
    typeahead: chat.typeahead,
    user: {
      getUsername: user.getUsername,
      getPixelCount: user.getPixelCount,
      getPixelCountAllTime: user.getPixelCountAllTime,
      getRoles: user.getRoles,
      isLoggedIn: user.isLoggedIn,
      isStaff: user.isStaff,
      isDonator: user.isDonator,
      getPermissions: user.getPermissions,
      hasPermission: user.hasPermission
    },
    modal
  };
})();
