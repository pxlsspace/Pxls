const { board } = require('./board');
const { settings } = require('./settings');

const { webkitBased } = require('./helpers').flags;

// this attempts to fix a problem with chromium based browsers offsetting the canvas
// by a pixel when the window size is odd.
module.exports.chromeOffsetWorkaround = (function() {
  const self = {
    elements: {
      boardContainer: board.getContainer(),
      setting: $('#chrome-canvas-offset-setting')
    },
    init: () => {
      if (!webkitBased) {
        settings.fix.chrome.offset.enable.controls.remove(self.elements.setting.find('input'));
        self.elements.setting.parent().remove();
        return;
      }

      settings.fix.chrome.offset.enable.listen((value) => {
        if (value) {
          self.enable();
        } else {
          self.disable();
        }
      });
    },
    enable: () => {
      window.addEventListener('resize', self.updateContainer);
      self.updateContainer();
    },
    updateContainer: () => {
      const offsetWidth = (window.innerWidth + board.getWidth()) % 2;
      const offsetHeight = (window.innerHeight + board.getHeight()) % 2;

      self.elements.boardContainer.css('width', `${window.innerWidth - offsetWidth}px`);
      self.elements.boardContainer.css('height', `${window.innerHeight - offsetHeight}px`);
    },
    disable: () => {
      window.removeEventListener('resize', self.updateContainer);
      self.elements.boardContainer.css('width', '');
      self.elements.boardContainer.css('height', '');
    }
  };
  return {
    init: self.init,
    update: () => {
      if (settings.fix.chrome.offset.enable.get()) {
        self.updateContainer();
      }
    }
  };
}());
