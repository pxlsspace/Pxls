const { uiHelper } = require('./uiHelper');
const { socket } = require('./socket');
const { settings } = require('./settings');
const { createImageData, binaryAjax } = require('./helpers');

module.exports.overlays = (function() {
  const overlay = function(name, fetchData, onLazyInit = () => {}) {
    const self = {
      name: name,
      elements: {
        overlay: crel('canvas', { id: name, class: 'pixelate noselect overlay transparent' })
      },
      ctx: null,
      width: null,
      height: null,
      isShown: false,
      previouslyLazyInited: false,
      lazyInitStarted: false,
      lazyInitDone: false,
      lazyInit: async function() {
        if (self.lazyInitStarted) {
          return;
        }

        self.lazyInitStarted = true;

        const imageData = await fetchData();

        $(self.elements.overlay).attr({
          width: self.width = imageData.width,
          height: self.height = imageData.height
        });
        self.ctx = self.elements.overlay.getContext('2d');
        self.ctx.mozImageSmoothingEnabled = self.ctx.webkitImageSmoothingEnabled = self.ctx.msImageSmoothingEnabled = self.ctx.imageSmoothingEnabled = false;
        self.setImageData(imageData);
        self.lazyInitDone = true;
        onLazyInit(self.width, self.height, self.previouslyLazyInited);
        self.previouslyLazyInited = true;
        uiHelper.setLoadingBubbleState(self.name, false);
        self.setShown();
      },
      setPixel: function(x, y, color) {
        if (self.ctx !== null) {
          self.ctx.fillStyle = color;
          self.ctx.fillRect(x, y, 1, 1);
        }
      },
      getImageData: function() {
        return self.ctx && self.ctx.getImageData(0, 0, self.width, self.height);
      },
      setImageData: function(imageData) {
        if (self.ctx !== null) {
          self.ctx.putImageData(imageData, 0, 0);
        }
      },
      clear: function() {
        if (self.lazyInitDone) {
          self.setImageData(createImageData(self.width, self.height));
        }
      },
      setOpacity: function(opacity) {
        $(self.elements.overlay).css('opacity', opacity);
      },
      setShown: function(value = self.isShown) {
        self.isShown = value === true;

        if (!self.lazyInitStarted) {
          self.lazyInit();
        }

        if (!self.lazyInitDone) {
          uiHelper.setLoadingBubbleState(self.name, self.isShown);
          return;
        }

        $(self.elements.overlay).toggleClass('transparent', !self.isShown);
      },
      remove: function() {
        self.elements.overlay.remove();
      },
      reload: function() {
        if (self.lazyInitStarted && !self.lazyInitDone) {
          return;
        }
        self.lazyInitStarted = self.lazyInitDone = false;
        self.lazyInit();
      }
    };

    $('#board').before(self.elements.overlay);

    return {
      get name() {
        return self.name;
      },
      get isShown() {
        return self.isShown;
      },
      setPixel: self.setPixel,
      getImageData: self.getImageData,
      setImageData: self.setImageData,
      clear: self.clear,
      setOpacity: self.setOpacity,
      show: function() {
        self.setShown(true);
      },
      hide: function() {
        self.setShown(false);
      },
      toggle: function() {
        self.setShown(!self.isShown);
      },
      setShown: self.setShown,
      remove: self.remove,
      reload: self.reload,
      setPixelated: function(pixelate = true) {
        $(self.elements.overlay).toggleClass('pixelate', pixelate);
      }
    };
  };

  const self = {
    overlays: {},
    add: function(name, fetchData, onLazyInit) {
      if (name in self.overlays) {
        throw new Error(`Overlay '${name}' already exists.`);
      }
      const o = overlay(name, fetchData, onLazyInit);
      self.overlays[name] = o;
      return o;
    },
    remove: function(name) {
      if (!(name in self.overlays)) {
        return;
      }
      self.overlays[name].remove();
      delete self.overlays[name];
    },
    webinit: function(data) {
      const width = data.width;
      const height = data.height;

      // create default overlays

      async function createOverlayImageData(basepath, placepath, color, dataXOR = 0) {
        // we use xhr directly because of jquery being weird on raw binary
        const overlayData = await binaryAjax(basepath + '?_' + (new Date()).getTime());
        const imageData = createImageData(width, height);
        const placemapData = await binaryAjax(placepath + '?_' + (new Date()).getTime());

        const intView = new Uint32Array(imageData.data.buffer);
        for (let i = 0; i < width * height; i++) {
          if (placemapData[i] === 255) {
            intView[i] = 0x00000000;
          } else {
            // this assignment uses the data as the alpha channel for the color
            intView[i] = ((overlayData[i] ^ dataXOR) << 24) | color;
          }
        }

        return imageData;
      }

      // virginmap stuff
      const virginbackground = self.add('virginbackground', () => createOverlayImageData('/virginmap', '/placemap', 0x0000FF00, 0x00));
      const virginmap = self.add('virginmap', () => createOverlayImageData('/virginmap', '/placemap', 0x00000000, 0xff), (width, height, isReload) => {
        if (isReload) {
          return;
        }
        socket.on('pixel', (data) => {
          $.map(data.pixels, (px) => {
            virginmap.setPixel(px.x, px.y, '#000000');
          });
        });

        $(window).keydown(function(evt) {
          if (['INPUT', 'TEXTAREA'].includes(evt.target.nodeName)) {
            // prevent inputs from triggering shortcuts
            return;
          }

          if (evt.key === 'u' || evt.key === 'U' || evt.which === 117 || evt.which === 85) { // U key
            virginmap.clear();
          }
        });
      });

      settings.board.virginmap.opacity.listen(function(value) {
        virginbackground.setOpacity(value);
      });
      $('#vmapClear').click(function() {
        virginmap.clear();
      });

      settings.board.virginmap.enable.listen(function(value) {
        if (value) {
          virginmap.show();
          virginbackground.show();
        } else {
          virginmap.hide();
          virginbackground.hide();
        }
      });

      // heatmap stuff
      const heatbackground = self.add('heatbackground', () => createOverlayImageData('/heatmap', '/placemap', 0xFF000000));
      const heatmap = self.add('heatmap', () => createOverlayImageData('/heatmap', '/placemap', 0x005C5CCD), (width, height, isReload) => {
        // Ran when lazy init finshes
        if (isReload) {
          return;
        }
        setInterval(() => {
          const imageData = heatmap.getImageData();
          const intView = new Uint32Array(imageData.data.buffer);
          for (let i = 0; i < width * height; i++) {
            let opacity = intView[i] >> 24;
            if (opacity) {
              opacity--;
              intView[i] = (opacity << 24) | 0x005C5CCD;
            }
          }
          heatmap.setImageData(imageData);
        }, data.heatmapCooldown * 1000 / 256);

        socket.on('pixel', (data) => {
          $.map(data.pixels, (px) => {
            heatmap.setPixel(px.x, px.y, '#CD5C5C');
          });
        });

        $(window).keydown((evt) => {
          if (['INPUT', 'TEXTAREA'].includes(evt.target.nodeName)) {
            // prevent inputs from triggering shortcuts
            return;
          }

          if (evt.key === 'o' || evt.key === 'O' || evt.which === 111 || evt.which === 79) {
            heatmap.clear();
          }
        });
      });

      settings.board.heatmap.opacity.listen(function(value) {
        heatbackground.setOpacity(value);
      });
      $('#hmapClear').click(function() {
        heatmap.clear();
      });
      settings.board.heatmap.enable.listen(function(value) {
        if (value) {
          heatmap.show();
          heatbackground.show();
        } else {
          heatmap.hide();
          heatbackground.hide();
        }
      });

      let HKeyPressed = false;
      // `e` is a key event.
      // True if h key is the focus of the event.
      const testForH = (e) => e.key === 'h' || e.key === 'H' || e.which === 72;

      $(window).keydown(function(e) {
        if (['INPUT', 'TEXTAREA'].includes(e.target.nodeName)) {
          // prevent inputs from triggering shortcuts
          return;
        }

        if (testForH(e)) {
          if (HKeyPressed) {
            return;
          }
          HKeyPressed = true;

          settings.board.heatmap.enable.toggle();
        }
      });

      $(window).keyup(function(e) {
        if (testForH(e)) {
          HKeyPressed = false;
        }
      });

      let XKeyPressed = false;
      // `e` is a key event.
      // True if x key is the focus of the event.
      const testForX = (e) => e.key === 'x' || e.key === 'X' || e.which === 88;

      $(window).keydown(function(e) {
        if (['INPUT', 'TEXTAREA'].includes(e.target.nodeName)) {
          // prevent inputs from triggering shortcuts
          return;
        }

        if (testForX(e)) {
          if (XKeyPressed) {
            return;
          }
          XKeyPressed = true;

          settings.board.virginmap.enable.toggle();
        }
      });

      $(window).keyup(function(e) {
        if (testForX(e)) {
          XKeyPressed = false;
        }
      });
    }
  };

  return {
    webinit: self.webinit,
    add: self.add,
    // NOTE ([  ]): If heatmap or virginmap are removed, they stick around in memory thanks to keybinds
    remove: self.remove,
    get heatmap() {
      return self.overlays.heatmap;
    },
    get heatbackground() {
      return self.overlays.heatbackground;
    },
    get virginmap() {
      return self.overlays.virginmap;
    },
    get virginbackground() {
      return self.overlays.virginbackground;
    }
  };
})();
