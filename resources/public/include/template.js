let board;
let query;
let uiHelper;

// here all the template stuff happens
module.exports.template = (function() {
  const self = {
    elements: {
      template: null,
      useCheckbox: $('#template-use'),
      titleInput: $('#template-title'),
      urlInput: $('#template-url'),
      imageErrorWarning: $('#template-image-error-warning'),
      coordsXInput: $('#template-coords-x'),
      coordsYInput: $('#template-coords-y'),
      opacityInput: $('#template-opacity'),
      opacityPercentage: $('#template-opacity-percentage'),
      widthInput: $('#template-width'),
      widthResetBtn: $('#template-width-reset')
    },
    queueTimer: 0,
    _queuedUpdates: {},
    _defaults: {
      url: '',
      x: 0,
      y: 0,
      width: -1,
      opacity: 0.5,
      title: ''
    },
    options: {},
    lazy_init: function() {
      if (self.elements.template != null) { // already inited
        return;
      }
      self.options.use = true;

      self.elements.imageErrorWarning.empty();
      self.elements.imageErrorWarning.hide();

      const drag = {
        x: 0,
        y: 0
      };
      self.elements.template = $('<img>').addClass('noselect').attr({
        id: 'board-template',
        src: self.options.url,
        alt: 'template'
      }).css({
        top: self.options.y,
        left: self.options.x,
        opacity: self.options.opacity,
        width: self.options.width === -1 ? 'auto' : self.options.width
      }).data('dragging', false).on('mousedown pointerdown', function(evt) {
        evt.preventDefault();
        $(this).data('dragging', true);
        drag.x = evt.clientX;
        drag.y = evt.clientY;
        evt.stopPropagation();
      }).on('mouseup pointerup', function(evt) {
        evt.preventDefault();
        $(this).data('dragging', false);
        evt.stopPropagation();
      }).on('mousemove pointermove', function(evt) {
        evt.preventDefault();
        if ($(this).data('dragging')) {
          if (!evt.ctrlKey && !evt.altKey) {
            self.stopDragging();
            return;
          }
          const pxOld = board.fromScreen(drag.x, drag.y);
          const pxNew = board.fromScreen(evt.clientX, evt.clientY);
          const dx = (pxNew.x) - (pxOld.x);
          const dy = (pxNew.y) - (pxOld.y);
          const newX = self.options.x + dx;
          const newY = self.options.y + dy;
          self._update({ x: newX, y: newY });
          query.set({ ox: newX, oy: newY }, true);
          if (dx !== 0) {
            drag.x = evt.clientX;
          }
          if (dy !== 0) {
            drag.y = evt.clientY;
          }
        }
      }).on('load', (e) => {
        if (self.options.width < 0) {
          self.elements.widthInput.val(self.elements.template.width());
        }
        self.elements.template.toggleClass('pixelate', query.get('scale') > self.getWidthRatio());
      }).on('error', () => {
        self.elements.imageErrorWarning.show();
        self.elements.imageErrorWarning.text(__('There was an error getting the image'));
        self.elements.template.remove();
      });
      if (board.update(true)) {
        return;
      }
      board.getRenderBoard().parent().prepend(self.elements.template);
    },
    updateSettings: function() {
      self.elements.useCheckbox.prop('checked', self.options.use);
      self.elements.urlInput.val(self.options.url ? self.options.url : '');

      self.elements.titleInput
        .prop('disabled', !self.options.use)
        .val(self.options.title ? self.options.title : '');

      self.elements.opacityInput
        .prop('disabled', !self.options.use)
        .val(self.options.opacity);
      self.elements.opacityPercentage.text(`${Math.floor(self.options.opacity * 100)}%`);

      self.elements.coordsXInput
        .prop('disabled', !self.options.use)
        .val(self.options.x);
      self.elements.coordsYInput
        .prop('disabled', !self.options.use)
        .val(self.options.y);

      self.elements.widthInput.prop('disabled', !self.options.use);
      if (self.options.width >= 0) {
        self.elements.widthInput.val(self.options.width);
      } else if (self.elements.template) {
        self.elements.widthInput.val(self.elements.template.width());
      } else {
        self.elements.widthInput.val(null);
      }
    },
    normalizeTemplateObj(objectToNormalize, direction) {
      // direction: true = url_to_template_obj, else = template_obj_to_url
      // normalize the given update object with settings that may be present from someone guessing options based on the URL

      const iterOver = [['tw', 'width'], ['ox', 'x'], ['oy', 'y'], ['oo', 'opacity'], ['template', 'url'], ['title', 'title']];
      if (direction !== true) {
        for (let i = 0; i < iterOver.length; i++) { iterOver[i].reverse(); }
      }

      for (let i = 0; i < iterOver.length; i++) {
        const x = iterOver[i];
        if ((x[0] in objectToNormalize) && objectToNormalize[x[1]] == null) { // if "tw" is set on `objectToNormalize` and `objectToNormalize.width` is not set
          objectToNormalize[x[1]] = objectToNormalize[x[0]]; // set `objectToNormalize["width"]` to `objectToNormalize["tw"]`
          delete objectToNormalize[x[0]]; // and delete `objectToNormalize["tw"]`
        }
      }

      return objectToNormalize;
    },
    queueUpdate: function(obj) {
      obj = self.normalizeTemplateObj(obj, true);
      self._queuedUpdates = Object.assign(self._queuedUpdates, obj);
      if (self.queueTimer) {
        clearTimeout(self.queueTimer);
      }
      self.queueTimer = setTimeout(function() {
        self._update(self._queuedUpdates);
        self._queuedUpdates = {};
        self.queueTimer = 0;
      }, 200);
    },
    _update: function(options, updateSettings = true) {
      if (!Object.keys(options).length) {
        return;
      }

      const urlUpdated = (options.url !== self.options.url && decodeURIComponent(options.url) !== self.options.url && options.url != null && self.options.url != null);
      if (options.url != null && options.url.length > 0) {
        options.url = decodeURIComponent(options.url);
      }
      if (options.title != null && options.title.length > 0) {
        options.title = decodeURIComponent(options.title);
      }

      // fix for `width` and other props being set after disabling template with the 'v' key then enabling a template without said prop set in the URL.
      if (urlUpdated && !self.options.use) {
        ['width', 'x', 'y', 'opacity'].forEach(x => {
          if (!Object.prototype.hasOwnProperty.call(options, x)) {
            options[x] = self._defaults[x];
          }
        });
      }

      options = Object.assign({}, self._defaults, self.options, self.normalizeTemplateObj(options, true)); // ensure every option needed to move forward is present
      Object.keys(self._defaults).forEach(x => { // and make sure they're all usable "out of the box"
        if (options[x] == null || (typeof options[x] === 'number' && isNaN(options[x]))) {
          options[x] = self._defaults[x];
        }
      });
      options.opacity = parseFloat(options.opacity.toFixed(2)); // cleans up opacity for the URL, e.g. 1.3877787807814457e-16 => 0
      self.options = options;

      if (options.url.length === 0 || options.use === false) {
        self.options.use = false;
        if (self.elements.template) {
          self.elements.template.remove();
          self.elements.template = null;
        }
        board.update(true);
        ['template', 'ox', 'oy', 'oo', 'tw', 'title'].forEach(x => query.remove(x, true));
      } else {
        self.options.use = true;
        if (urlUpdated === true && self.elements.template != null) {
          self.elements.template.remove(); // necessary so everything gets redrawn properly 'n whatnot. could probably just update the url directly...
          self.elements.template = null;
        }
        self.lazy_init();

        [['left', 'x'], ['top', 'y'], ['opacity', 'opacity']].forEach(x => {
          self.elements.template.css(x[0], options[x[1]]);
        });
        self.elements.template.css('width', options.width > 0 ? options.width : 'auto');

        [['url', 'template'], ['x', 'ox'], ['y', 'oy'], ['width', 'tw'], ['opacity', 'oo'], ['title', 'title']].forEach(x => {
          query.set(x[1], self.options[x[0]], true);
        });
      }
      if (updateSettings) {
        self.updateSettings();
      }
      document.title = uiHelper.getTitle();

      self.setPixelated(query.get('scale') >= self.getWidthRatio());
    },
    disableTemplate: function() {
      self._update({ url: null });
    },
    draw: function(ctx2, pxlX, pxlY) {
      if (!self.options.use) {
        return;
      }
      let width = self.elements.template[0].width;
      let height = self.elements.template[0].height;
      const scale = board.getScale();
      if (self.options.width !== -1) {
        height *= (self.options.width / width);
        width = self.options.width;
      }
      ctx2.globalAlpha = self.options.opacity;
      ctx2.drawImage(self.elements.template[0], (self.options.x - pxlX) * scale, (self.options.y - pxlY) * scale, width * scale, height * scale);
    },
    init: function() {
      board = require('./board').board;
      query = require('./query').query;
      uiHelper = require('./uiHelper').uiHelper;
      self.elements.imageErrorWarning.hide();

      self.elements.useCheckbox.change((e) => self._update({ use: e.target.checked }));
      self.elements.titleInput.change((e) => self._update({ title: e.target.value }, false));
      self.elements.urlInput.change((e) => self._update({ use: true, url: e.target.value }));

      self.elements.opacityInput.on('change input', (e) => {
        self.elements.opacityPercentage.text(`${Math.floor(e.target.value * 100)}%`);
        self._update({ opacity: parseFloat(e.target.value) }, false);
      });

      self.elements.coordsXInput.on('change input', (e) => self._update({ x: parseInt(e.target.value) }, false));
      self.elements.coordsYInput.on('change input', (e) => self._update({ y: parseInt(e.target.value) }, false));

      self.elements.widthInput.on('change input', (e) => self._update({ width: parseFloat(e.target.value) }, false));
      self.elements.widthResetBtn.on('click', (e) => self._update({ width: -1 }));

      self.updateSettings();

      $(window).keydown(function(evt) {
        if (['INPUT', 'TEXTAREA'].includes(evt.target.nodeName)) {
          // prevent inputs from triggering shortcuts
          return;
        }

        if (self.options.use) {
          switch (evt.originalEvent.code || evt.originalEvent.keyCode || evt.originalEvent.which || evt.originalEvent.key) {
            case 'ControlLeft':
            case 'ControlRight':
            case 'Control':
            case 17:
            case 'AltLeft':
            case 'AltRight':
            case 'Alt':
            case 18:
              evt.preventDefault();
              self.elements.template.css('pointer-events', 'initial');
              break;
          }
        }
        let newOpacity = 0;
        switch (evt.code || evt.keyCode || evt.which || evt.key) {
          case 'PageUp':
          case 33:
            newOpacity = Math.min(1, self.options.opacity + 0.1);
            self._update({ opacity: newOpacity });
            break;
          case 'PageDown':
          case 34:
            newOpacity = Math.max(0, self.options.opacity - 0.1);
            self._update({ opacity: newOpacity });
            break;
          case 'KeyV':
          case 86:
          case 'v':
          case 'V':
            self._update({
              use: !self.options.use
            });
            break;
        }
      }).on('keyup blur', self.stopDragging);
    },
    stopDragging: function() {
      if (self.options.use) {
        self.elements.template.css('pointer-events', 'none').data('dragging', false);
      }
    },
    setPixelated: function(pixelate = true) {
      if (self.elements.template !== null) {
        self.elements.template.toggleClass('pixelate', pixelate);
      }
    },
    getWidthRatio: function() {
      if (self.elements.template === null || self.options.width === -1) {
        return 1;
      }

      return self.elements.template[0].naturalWidth / self.options.width;
    }
  };
  return {
    normalizeTemplateObj: self.normalizeTemplateObj,
    update: self._update,
    draw: self.draw,
    init: self.init,
    queueUpdate: self.queueUpdate,
    getOptions: () => self.options,
    setPixelated: self.setPixelated,
    getWidthRatio: self.getWidthRatio
  };
})();
