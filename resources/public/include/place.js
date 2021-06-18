const { ls } = require('./storage');
const { timer } = require('./timer');
const { socket } = require('./socket');
const { settings } = require('./settings');
const { uiHelper } = require('./uiHelper');
const { modal } = require('./modal');
let board;
let user;

const {
  analytics,
  hexToRGB
} = require('./helpers');

// this takes care of placing pixels, the palette, the reticule and stuff associated with that
module.exports.place = (function() {
  const self = {
    elements: {
      palette: $('#palette'),
      cursor: $('#cursor'),
      reticule: $('#reticule'),
      undo: $('#undo')
    },
    undoTimeout: false,
    palette: [],
    reticule: {
      x: 0,
      y: 0
    },
    audio: new Audio('place.wav'),
    color: -1,
    isDoingCaptcha: false,
    lastPixel: null,
    autoreset: true,
    setAutoReset: function(v) {
      self.autoreset = !!v;
    },
    switch: function(newColorIdx) {
      const isOnPalette = newColorIdx >= 0 && newColorIdx < self.palette.length;
      const isTransparent = newColorIdx === 0xFF && user.placementOverrides && user.placementOverrides.canPlaceAnyColor;

      if (!isOnPalette && !isTransparent) {
        newColorIdx = -1;
      }

      self.color = newColorIdx;
      ls.set('color', newColorIdx);
      $('.palette-color').removeClass('active');

      $('body').toggleClass('show-placeable-bubble', newColorIdx === -1);
      if (newColorIdx === -1) {
        self.toggleCursor(false);
        self.toggleReticule(false);
        if ('removeProperty' in document.documentElement.style) {
          document.documentElement.style.removeProperty('--selected-palette-color');
        }
        return;
      }
      if (self.scale <= 15) {
        self.toggleCursor(true);
      }
      if ('setProperty' in document.documentElement.style) {
        document.documentElement.style.setProperty('--selected-palette-color', isTransparent ? 'transparent' : `#${self.palette[newColorIdx].value}`);
      }
      [self.elements.cursor, self.elements.reticule].forEach((el) => el
        .css('background-color', isOnPalette ? `#${self.palette[newColorIdx].value}` : (isTransparent ? 'var(--general-background)' : null))
      );
      if (newColorIdx !== -1) {
        $($('.palette-color[data-idx=' + newColorIdx + '],.palette-color[data-idx=-1]')).addClass('active'); // Select both the new color AND the deselect button. Signifies more that it's a deselect button rather than a "delete pixel" button
        try {
          $(`.palette-color[data-idx="${newColorIdx}"]`)[0].scrollIntoView({
            block: 'nearest',
            inline: 'nearest'
          });
        } catch (e) {
          $(`.palette-color[data-idx="${newColorIdx}"]`)[0].scrollIntoView(false);
        }
      }
    },
    place: function(x, y, color = null) {
      if (!timer.cooledDown() || self.color === -1) { // nope can't place yet
        return;
      }
      self._place(x, y, color);
    },
    _place: function(x, y, color = null) {
      if (color == null) {
        color = self.color;
      }

      self.lastPixel = { x, y, color };
      socket.send({
        type: 'pixel',
        x,
        y,
        color
      });

      analytics('send', 'event', 'Pixels', 'Place');
      if (self.autoreset) {
        self.switch(-1);
      }
    },
    update: function(clientX, clientY) {
      if (clientX !== undefined) {
        const boardPos = board.fromScreen(clientX, clientY);
        self.reticule = {
          x: boardPos.x,
          y: boardPos.y
        };
      }
      if (self.color === -1) {
        self.toggleReticule(false);
        self.toggleCursor(false);
        return;
      }
      if (settings.ui.reticule.enable.get()) {
        const screenPos = board.toScreen(self.reticule.x, self.reticule.y);
        const scale = board.getScale();
        self.elements.reticule.css({
          left: screenPos.x - 1,
          top: screenPos.y - 1,
          width: scale - 1,
          height: scale - 1
        });
        self.toggleReticule(true);
      }
      if (settings.ui.cursor.enable.get()) {
        self.toggleCursor(true);
      }
    },
    setNumberedPaletteEnabled: function(shouldBeNumbered) {
      self.elements.palette[0].classList.toggle('no-pills', !shouldBeNumbered);
    },
    toggleReticule: (show) => {
      if (show && settings.ui.reticule.enable.get()) {
        self.elements.reticule.show();
      } else if (!show) {
        self.elements.reticule.hide();
      }
    },
    toggleCursor: (show) => {
      if (show && settings.ui.cursor.enable.get()) {
        self.elements.cursor.show();
      } else if (!show) {
        self.elements.cursor.hide();
      }
    },
    setPalette: function(palette) {
      self.palette = palette;
      self.elements.palette.find('.palette-color').remove().end().append(
        $.map(self.palette, function(color, idx) {
          return $('<button>')
            .attr('title', color.name)
            .attr('type', 'button')
            .attr('data-idx', idx)
            .addClass('palette-color')
            .addClass('ontouchstart' in window ? 'touch' : 'no-touch')
            .css('background-color', `#${color.value}`)
            .append(
              $('<span>').addClass('palette-number').text(idx)
            )
            .click(function() {
              self.switch(idx);
            });
        })
      );
      self.elements.palette.prepend(
        $('<button>')
          .attr('type', 'button')
          .attr('data-idx', 0xFF)
          .addClass('palette-color palette-color-special checkerboard-background pixelate')
          .addClass('ontouchstart' in window ? 'touch' : 'no-touch')
          .hide()
          .click(function() {
            self.switch(0xFF);
          })
      );
      self.elements.palette.prepend(
        $('<button>')
          .attr('type', 'button')
          .attr('data-idx', -1)
          .addClass('palette-color no-border deselect-button')
          .addClass('ontouchstart' in window ? 'touch' : 'no-touch').css('background-color', 'transparent')
          .append(
            crel('i', { class: 'fas fa-times' })
          )
          .click(function() {
            self.switch(-1);
          })
      );
    },
    togglePaletteSpecialColors: (show) => {
      self.elements.palette.find('.palette-color.palette-color-special').toggle(show);
    },
    can_undo: false,
    undo: function(evt) {
      evt.stopPropagation();
      socket.send({ type: 'undo' });
      self.can_undo = false;
      document.body.classList.remove('undo-visible');
      self.elements.undo.removeClass('open');
    },
    init: function() {
      board = require('./board').board;
      user = require('./user').user;
      self.toggleReticule(false);
      self.toggleCursor(false);
      document.body.classList.remove('undo-visible');
      self.elements.undo.removeClass('open');
      board.getRenderBoard().on('pointermove mousemove', function(evt) {
        self.update(evt.clientX, evt.clientY);
      });
      $(window).on('pointermove mousemove touchstart touchmove', function(evt) {
        let x = 0;
        let y = 0;
        if (evt.changedTouches && evt.changedTouches[0]) {
          x = evt.changedTouches[0].clientX;
          y = evt.changedTouches[0].clientY;
        } else {
          x = evt.clientX;
          y = evt.clientY;
        }

        if (settings.ui.cursor.enable.get() !== false) {
          self.elements.cursor.css('transform', 'translate(' + x + 'px, ' + y + 'px)');
        }
        if (self.can_undo) {

        }
      }).keydown(function(evt) {
        if (['INPUT', 'TEXTAREA'].includes(evt.target.nodeName)) {
          // prevent inputs from triggering shortcuts
          return;
        }

        if (self.can_undo && (evt.key === 'z' || evt.key === 'Z' || evt.keyCode === 90) && evt.ctrlKey) {
          self.undo(evt);
        }
      }).on('touchstart', function(evt) {
        if (self.color === -1 || self.can_undo) {

        }
      });
      socket.on('pixel', function(data) {
        $.map(data.pixels, function(px) {
          board.setPixelIndex(px.x, px.y, px.color, false);
        });
        board.refresh();
        board.update(true);
      });
      socket.on('ACK', function(data) {
        switch (data.ackFor) {
          case 'PLACE':
            $(window).trigger('pxls:ack:place', [data.x, data.y]);
            if (uiHelper.tabHasFocus() && settings.audio.enable.get()) {
              const clone = self.audio.cloneNode(false);
              clone.volume = parseFloat(settings.audio.alert.volume.get());
              clone.play();
            }
            break;
          case 'UNDO':
            $(window).trigger('pxls:ack:undo', [data.x, data.y]);
            break;
        }

        if (uiHelper.getAvailable() === 0) { uiHelper.setPlaceableText(data.ackFor === 'PLACE' ? 0 : 1); }
      });
      socket.on('admin_placement_overrides', function(data) {
        self.togglePaletteSpecialColors(data.placementOverrides.canPlaceAnyColor);
        if (!data.placementOverrides.canPlaceAnyColor && self.color === 0xFF) {
          self.switch(-1);
        }
      });
      socket.on('captcha_required', function(data) {
        if (!self.isDoingCaptcha) {
          uiHelper.toggleCaptchaLoading(true);
          grecaptcha.reset();
        }
        // always execute captcha in case the user closed a captcha popup
        // and couldn't bring it back up.
        grecaptcha.execute();
        self.isDoingCaptcha = true;

        analytics('send', 'event', 'Captcha', 'Execute');
      });
      socket.on('captcha_status', function(data) {
        if (data.success) {
          self._place(self.lastPixel.x, self.lastPixel.y, self.lastPixel.color);

          analytics('send', 'event', 'Captcha', 'Accepted');
        } else {
          modal.showText('Failed captcha verification');
          analytics('send', 'event', 'Captcha', 'Failed');
        }
        uiHelper.toggleCaptchaLoading(false);
      });
      socket.on('can_undo', function(data) {
        document.body.classList.add('undo-visible');
        self.elements.undo.addClass('open');
        self.can_undo = true;
        if (self.undoTimeout !== false) clearTimeout(self.undoTimeout);
        self.undoTimeout = setTimeout(function() {
          document.body.classList.remove('undo-visible');
          self.elements.undo.removeClass('open');
          self.can_undo = false;
          self.undoTimeout = false;
        }, data.time * 1000);
      });
      self.elements.undo.click(self.undo);
      window.recaptchaCallback = function(token) {
        self.isDoingCaptcha = false;
        socket.send({
          type: 'captcha',
          token: token
        });
        analytics('send', 'event', 'Captcha', 'Sent');
      };
      self.elements.palette.on('wheel', e => {
        if (settings.place.palette.scrolling.enable.get() !== true) return;
        const delta = e.originalEvent.deltaY * -40;
        const newVal = (self.color + ((delta > 0 ? 1 : -1) * (settings.place.palette.scrolling.invert.get() === true ? -1 : 1))) % self.palette.length;
        self.switch(newVal <= -1 ? self.palette.length - 1 : newVal);
      });

      settings.place.deselectonplace.enable.listen(function(value) {
        self.setAutoReset(value);
      });
    },
    getPaletteABGR: function() {
      const result = new Uint32Array(self.palette.length);
      for (const i in self.palette) {
        const { r, g, b } = hexToRGB(self.palette[i].value);
        result[i] = 0xFF000000 | b << 16 | g << 8 | r;
      }
      return result;
    }
  };
  return {
    init: self.init,
    update: self.update,
    place: self.place,
    switch: self.switch,
    setPalette: self.setPalette,
    get palette() {
      return self.palette;
    },
    getPaletteColorValue: (idx, def = '000000') => self.palette[idx] ? self.palette[idx].value : def,
    getPaletteABGR: self.getPaletteABGR,
    togglePaletteSpecialColors: self.togglePaletteSpecialColors,
    setAutoReset: self.setAutoReset,
    setNumberedPaletteEnabled: self.setNumberedPaletteEnabled,
    get color() {
      return self.color;
    },
    get lastPixel() {
      return self.lastPixel;
    },
    toggleReticule: self.toggleReticule,
    toggleCursor: self.toggleCursor
  };
})();
