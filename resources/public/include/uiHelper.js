const { modal } = require('./modal');
const { settings } = require('./settings');
const { panels } = require('./panels');
const { coords } = require('./coords');
const { socket } = require('./socket');
const { chat } = require('./chat');
const { serviceWorkerHelper } = require('./serviceworkers');
const { template } = require('./template');
const { ls, setCookie } = require('./storage');
let timer;
let place;
let board;

const uiHelper = (function() {
  const self = {
    tabId: null,
    _workerIsTabFocused: false,
    _available: -1,
    pixelsAvailable: -1,
    maxStacked: -1,
    _alertUpdateTimer: false,
    initTitle: '',
    isLoadingBubbleShown: false,
    loadingStates: {},
    banner: {
      elements: [],
      curElem: 0,
      intervalID: 0,
      timeout: 10000,
      enabled: true
    },
    elements: {
      mainBubble: $('#main-bubble'),
      loadingBubble: $('#loading-bubble'),
      stackCount: $('#placeable-count, #placeableCount-cursor'),
      captchaLoadingIcon: $('.captcha-loading-icon'),
      coords: $('#coords-info .coords'),
      lblAlertVolume: $('#lblAlertVolume'),
      btnForceAudioUpdate: $('#btnForceAudioUpdate'),
      themeSelect: $('#setting-ui-theme-index'),
      themeColorMeta: $('meta[name="theme-color"]'),
      txtDiscordName: $('#txtDiscordName'),
      bottomBanner: $('#bottom-banner'),
      dragDropTarget: $('#drag-drop-target'),
      dragDrop: $('#drag-drop')
    },
    themes: [
      {
        // translator: theme name
        name: __('Dark'),
        location: '/themes/dark.css',
        color: '#1A1A1A'
      },
      {
        // translator: theme name
        name: __('Darker'),
        location: '/themes/darker.css',
        color: '#000'
      },
      {
        // translator: theme name
        name: __('Blue'),
        location: '/themes/blue.css',
        color: '#0000FF'
      },
      {
        // translator: theme name
        name: __('Purple'),
        location: '/themes/purple.css',
        color: '#5a2f71'
      },
      {
        // translator: theme name
        name: __('Green'),
        location: '/themes/green.css',
        color: '#005f00'
      },
      {
        // translator: theme name
        name: __('Matte'),
        location: '/themes/matte.css',
        color: '#468079'
      },
      {
        // translator: theme name
        name: __('Terminal'),
        location: '/themes/terminal.css',
        color: '#94e044'
      },
      {
        // translator: theme name
        name: __('Red'),
        location: '/themes/red.css',
        color: '#cf0000'
      },
      {
        name: 'Synthwave',
        location: '/themes/synthwave.css',
        color: '#1d192c'
      }
    ],
    specialChatColorClasses: ['rainbow', ['donator', 'donator--green'], ['donator', 'donator--gray'], ['donator', 'donator--synthwave'], ['donator', 'donator--ace'], ['donator', 'donator--trans'], ['donator', 'donator--bi'], ['donator', 'donator--pan'], ['donator', 'donator--nonbinary'], ['donator', 'donator--mines'], ['donator', 'donator--eggplant'], ['donator', 'donator--banana'], ['donator', 'donator--teal']],
    init: function() {
      timer = require('./timer').timer;
      place = require('./place').place;
      board = require('./board').board;
      self.initTitle = document.title;
      self._initThemes();
      self._initStack();
      self._initAudio();
      self._initAccount();
      self._initMultiTabDetection();
      self.prettifyRange('input[type=range]');

      self.elements.coords.click(() => coords.copyCoords(true));

      socket.on('alert', (data) => {
        modal.show(modal.buildDom(
          crel('h2', { class: 'modal-title' }, 'Alert'),
          crel('p', { style: 'padding: 0; margin: 0;' }, chat.processMessage(data.message)),
          crel('span', `Sent from ${data.sender || '$Unknown'}`)
        ), { closeExisting: false });
      });
      socket.on('received_report', (data) => {
        const type = data.report_type.toLowerCase();
        new SLIDEIN.Slidein(__(`A new ${type} report has been received.`), 'info-circle').show().closeAfter(3000);
      });

      $('article > header').on('click', event => {
        const body = $(event.currentTarget).next();
        body.toggleClass('hidden');
      });

      settings.ui.palette.numbers.enable.listen(function(value) {
        place.setNumberedPaletteEnabled(value);
      });

      settings.ui.palette.scrollbar.thin.enable.listen(function(value) {
        document.querySelector('#palette').classList.toggle('thin-scrollbar', value);
      });

      settings.ui.palette.stacking.enable.listen(function(value) {
        document.querySelector('#palette').classList.toggle('palette-stacking', value);
      });

      settings.board.lock.enable.listen((value) => board.setAllowDrag(!value));

      settings.ui.chat.banner.enable.listen(function(value) {
        self.setBannerEnabled(value);
      });

      settings.ui.chat.horizontal.enable.listen(function(value) {
        const _chatPanel = document.querySelector('aside.panel[data-panel="chat"]');
        if (_chatPanel) {
          _chatPanel.classList.toggle('horizontal', value === true);
          if (_chatPanel.classList.contains('open')) {
            document.body.classList.toggle(`panel-${_chatPanel.classList.contains('right') ? 'right' : 'left'}-horizontal`, value === true);
          }
        }
      });

      const numOrDefault = (n, def) => isNaN(n) ? def : n;

      const brightnessFixElement = $('<div>').attr('id', 'brightness-fixer').addClass('noselect');

      settings.ui.brightness.enable.listen(function(enabled) {
        if (enabled) {
          settings.ui.brightness.value.controls.enable();
          $('#board-mover').prepend(brightnessFixElement);
        } else {
          settings.ui.brightness.value.controls.disable();
          brightnessFixElement.remove();
        }
        self.adjustColorBrightness(enabled ? numOrDefault(parseFloat(settings.ui.brightness.value.get()), 1) : null);
      });

      settings.ui.brightness.value.listen(function(value) {
        if (settings.ui.brightness.enable.get() === true) {
          const level = numOrDefault(parseFloat(value), 1);
          self.adjustColorBrightness(level);
        }
      });

      settings.ui.bubble.position.listen(function(value) {
        self.elements.mainBubble.attr('position', value);
      });

      $('#setting-ui-bubble-compact').on('click', settings.ui.bubble.compact.toggle);
      settings.ui.bubble.compact.listen(function(value) {
        self.elements.mainBubble.toggleClass('compact', value);
      });

      settings.ui.reticule.enable.listen(function(value) {
        place.toggleReticule(value && place.color !== -1);
      });

      settings.ui.cursor.enable.listen(function(value) {
        place.toggleCursor(value && place.color !== -1);
      });

      let overrideLang = null;
      settings.ui.language.override.listen(function(value) {
        if (overrideLang !== null && overrideLang !== value) {
          if (value) {
            setCookie('pxls-accept-language-override', value);
          } else {
            setCookie('pxls-accept-language-override', null, -1);
          }
          // we need to fetch the page in the new locale, so reload
          window.location.reload();
        } else {
          overrideLang = value;
        }
      });

      $(window).keydown((evt) => {
        if (['INPUT', 'TEXTAREA'].includes(evt.target.nodeName)) {
          // prevent inputs from triggering shortcuts
          return;
        }

        switch (evt.key || evt.which) {
          case 'Escape':
          case 27: {
            const selector = $('#lookup, #prompt, #alert, .popup');
            const openPanels = $('.panel.open');
            if (selector.is(':visible')) {
              selector.fadeOut(200);
            } else if (openPanels.length) {
              openPanels.each((i, elem) => panels.close(elem));
            } else {
              place.switch(-1);
            }
            break;
          }
        }
      });

      const _info = document.querySelector('.panel[data-panel="info"]');
      if (_info.classList.contains('open')) {
        _info.querySelectorAll('iframe[data-lazysrc]').forEach(elem => {
          elem.src = elem.dataset.lazysrc;
          delete elem.dataset.lazysrc;
        });
      } else {
        const toAttach = (e, which) => {
          if (which === 'info') {
            const elems = document.querySelectorAll('iframe[data-lazysrc]');
            if (elems && elems.length) {
              elems.forEach(elem => {
                elem.src = elem.dataset.lazysrc;
                delete elem.dataset.lazysrc;
              });
            }
            $(window).off('pxls:panel:opened', toAttach);
          }
        };
        $(window).on('pxls:panel:opened', toAttach);
      }

      self.elements.dragDropTarget.hide();
      self.elements.dragDrop.hide();

      // NOTE (Flying): Needed for dragenter and drop to fire.
      document.addEventListener('dragover', event => event.preventDefault(), false);

      document.addEventListener('dragenter', event => {
        event.preventDefault();
        if (!self.elements.dragDropTarget.is(':visible')) {
          self.elements.dragDropTarget.show();
          self.elements.dragDrop.fadeIn(200);
        }
      }, false);

      document.addEventListener('dragleave', event => {
        event.preventDefault();
        if (self.elements.dragDropTarget.is(event.target)) {
          self.elements.dragDropTarget.hide();
          self.elements.dragDrop.fadeOut(200);
        }
      }, false);

      /**
       * NOTE (Flying): There are different behaviors when different things are
       * dropped onto the window. Here's a list of what I've found so far:
       *
       * For files dragged from a file manager onto the browser, the name is
       * the file name, the type is the mime type (like image/png), and the
       * contents is the file data.
       *
       * For URLs and embedded images (like in Discord), the name is the
       * sanitized URL (i.e. :/ replaced with -) ending in '.url', the type is
       * an empty string, and the contents is a base64 string like so:
       *
       *   data:application/octet-stream;base64,W0ludGVybmV0U2hvcnRjdXRdDQp ...
       *
       * Decoding the base64 string will give you something like this:
       *
       *   [InternetShortcut]
       *   URL=https://example.org/mycooltemplateimage.png
       */
      document.addEventListener('drop', async event => {
        event.preventDefault();
        self.elements.dragDropTarget.hide();
        self.elements.dragDrop.fadeOut(200);
        const data = event.dataTransfer;
        let url;
        if (data.types.includes('Files')) {
          const file = data.files[0];
          url = await new Promise(resolve => {
            const reader = new FileReader();
            reader.onload = () => {
              if (reader.result.startsWith('data:application/octet-stream')) {
                // Windows only
                const linkFile = Buffer.from(reader.result.split(',')[1], 'base64');
                const linkFileStr = String.fromCharCode.apply(null, linkFile);
                resolve(linkFileStr.split('URL=')[1].trim());
              }
              resolve(reader.result);
            };
            reader.readAsDataURL(file);
          });
        } else if (data.types.length === 0) {
          // Triggered by dragging random text
          return;
        } else {
          url = data.getData('text/plain');
        }

        if (url.startsWith('file:')) {
          modal.showText(__('Cannot fetch local files. Use the file selector in template settings.'));
          return;
        }

        if (url.startsWith(window.location.origin)) {
          modal.show(modal.buildDom(
            crel('h2', { class: 'modal-title' }, __('Redirect Warning')),
            crel('div',
              crel('p', __('Are you sure you want to redirect to the following URL?')),
              crel('p', {
                style: 'font-family: monospace; max-width: 50vw;'
              }, url),
              crel('div', { class: 'buttons' },
                crel('button', {
                  class: 'dangerous-button text-button',
                  onclick: () => {
                    window.location.href = url;
                    modal.closeAll();
                  }
                }, __('Yes')),
                crel('button', {
                  class: 'text-button',
                  onclick: () => modal.closeAll()
                }, __('No'))
              )
            )
          ));
          return;
        }

        if (url.startsWith('data:')) {
          // data:image/png;base64, ...
          const mimeType = url.substring(5, url.indexOf(';'));
          if (!['image/png', 'image/jpeg', 'image/webp'].includes(mimeType)) {
            modal.showText(__('Drag and dropped file must be a valid image.'));
            return;
          }
        }

        self.handleFileUrl(url);
      }, false);
    },
    prettifyRange: function (ranges) {
      ranges = $(ranges);
      function updateBar(e) {
        var min = e.min;
        var max = e.max;
        var val = e.value;
        $(e).css({
          backgroundSize: (val - min) * 100 / (max - min) + '% 100%'
        });
      }
      ranges.on('input', (e) => updateBar(e.target));
      ranges.each((idx, element) => updateBar(element));
    },
    _initThemes: function() {
      for (let i = 0; i < self.themes.length; i++) {
        self.themes[i].element = $('<link data-theme="' + i + '" rel="stylesheet" href="' + self.themes[i].location + '">');
        self.themes[i].loaded = false;
        self.elements.themeSelect.append($('<option>', {
          value: i,
          text: self.themes[i].name
        }));
      }

      // since we just changed the options available, this will coerce the settings into making the control reflect the actual theme.
      settings.ui.theme.index.set(settings.ui.theme.index.get());
      settings.ui.theme.index.listen(async function(value) {
        await self.loadTheme(parseInt(value));
      });
    },
    _initStack: function() {
      socket.on('pixels', function(data) {
        self.updateAvailable(data.count, data.cause);
      });
    },
    _initAudio: function() {
      timer.audioElem.addEventListener('error', err => {
        if (console.warn) console.warn('An error occurred on the audioElem node: %o', err);
      });

      settings.audio.alert.src.listen(function(url) { // change should only fire on blur so we normally won't be calling updateAudio for each keystroke. just in case though, we'll lazy update.
        if (self._alertUpdateTimer !== false) clearTimeout(self._alertUpdateTimer);
        self._alertUpdateTimer = setTimeout(function(url) {
          self.updateAudio(url);
          self._alertUpdateTimer = false;
        }, 250, url);
      });
      self.elements.btnForceAudioUpdate.click(() => settings.audio.alert.src.set(settings.audio.alert.src.get()));

      settings.audio.alert.volume.listen(function(value) {
        const parsed = parseFloat(value);
        const volume = isNaN(parsed) ? 1 : parsed;
        self.elements.lblAlertVolume.text(`${volume * 100 >> 0}%`);
        timer.audioElem.volume = volume;
      });

      $('#btnAlertAudioTest').click(() => timer.audioElem.play());

      $('#btnAlertReset').click(() => {
        // TODO confirm with user
        self.updateAudio('notify.wav');
        settings.audio.alert.src.reset();
      });
    },
    _initAccount: function() {
      self.elements.txtDiscordName.keydown(function(evt) {
        if (evt.key === 'Enter' || evt.which === 13) {
          self.handleDiscordNameSet();
        }
        evt.stopPropagation();
      });
      $('#btnDiscordNameSet').click(() => {
        self.handleDiscordNameSet();
      });
      $('#btnDiscordNameRemove').click(() => {
        self.setDiscordName('');
        self.handleDiscordNameSet();
      });
    },
    initBanner(textList) {
      self.banner.enabled = settings.ui.chat.banner.enable.get() !== false;

      const processor = uiHelper.makeMarkdownProcessor({
        inline: ['coordinate', 'emoji_raw', 'emoji_name', 'mention', 'escape', 'autoLink', 'link', 'url', 'underline', 'strong', 'emphasis', 'deletion', 'code', 'fontAwesomeIcon']
      });

      self.banner.elements = [];
      for (const i in textList) {
        try {
          const file = processor.processSync(textList[i]);
          self.banner.elements.push(file.result);
        } catch (ex) {
          console.error(`Failed to parse chat banner text at index ${i}:`, ex);
        }
      }

      self._bannerIntervalTick();
    },
    _initMultiTabDetection() {
      let handleUnload;

      if (serviceWorkerHelper.hasSupport) {
        serviceWorkerHelper.addMessageListener('request-id', ({ source, data }) => {
          self.tabId = data.id;
          if (document.hasFocus()) {
            source.postMessage({ type: 'focus' });
          }
        });
        serviceWorkerHelper.addMessageListener('focus', ({ data }) => {
          self._workerIsTabFocused = self.tabId === data.id;
        });

        serviceWorkerHelper.readyPromise.then(async () => {
          serviceWorkerHelper.postMessage({ type: 'request-id' });
        }).catch(() => {
          self.tabHasFocus = true;
        });

        window.addEventListener('focus', () => {
          serviceWorkerHelper.postMessage({ type: 'focus' });
        });

        handleUnload = () => serviceWorkerHelper.postMessage({ type: 'leave' });
      } else {
        const openTabIds = ls.get('tabs.open') || [];
        while (self.tabId == null || openTabIds.includes(self.tabId)) {
          self.tabId = Math.floor(Math.random() * Number.MAX_SAFE_INTEGER);
        }
        openTabIds.push(self.tabId);
        ls.set('tabs.open', openTabIds);

        const markSelfAsFocused = () => ls.set('tabs.has-focus', self.tabId);
        if (document.hasFocus()) {
          markSelfAsFocused();
        }
        window.addEventListener('focus', markSelfAsFocused);

        handleUnload = () => {
          const openTabIds = ls.get('tabs.open') || [];
          openTabIds.splice(openTabIds.indexOf(self.tabId), 1);
          ls.set('tabs.open', openTabIds);
        };
      }

      if (handleUnload) {
        let unloadHandled = false;
        const secureHandleUnload = () => {
          if (unloadHandled) {
            return;
          }
          unloadHandled = true;
          handleUnload();
        };
        window.addEventListener('beforeunload', secureHandleUnload, false);
        window.addEventListener('unload', secureHandleUnload, false);
      }
    },
    _setBannerElems(elems) {
      const banner = self.elements.bottomBanner[0];
      while (banner.lastChild) {
        banner.removeChild(banner.lastChild);
      }
      banner.append(...elems);
    },
    _bannerIntervalTick() {
      const nextElems = self.banner.elements[self.banner.curElem++ % self.banner.elements.length >> 0];
      if (!nextElems) {
        return;
      }

      const banner = self.elements.bottomBanner[0];
      const fadeEnd = function() {
        if (self.banner.enabled) {
          banner.classList.add('transparent');
          banner.removeEventListener('animationend', fadeEnd);
          requestAnimationFrame(() => {
            banner.classList.remove('fade');
            self._setBannerElems(nextElems);
            requestAnimationFrame(() => {
              banner.classList.add('fade-rev');
              banner.addEventListener('animationend', fadeRevEnd);
            });
          });
        } else {
          self.resetBanner();
        }
      };
      const fadeRevEnd = function() {
        if (self.banner.enabled) {
          banner.removeEventListener('animationend', fadeRevEnd);
          banner.classList.remove('transparent', 'fade-rev');
          setTimeout(() => self._bannerIntervalTick(), self.banner.timeout);
        } else {
          self.resetBanner();
        }
      };
      if (self.banner.enabled) {
        requestAnimationFrame(() => {
          banner.addEventListener('animationend', fadeEnd);
          banner.classList.add('fade');
        });
      } else {
        self.resetBanner();
      }
    },
    resetBanner: () => {
      self.banner.curElem = 1; // set to 1 so that when we re-enable, we don't show [0] again immediately.
      self._setBannerElems(self.banner.elements[0] || []);
      self.elements.bottomBanner[0].classList.remove('transparent', 'fade', 'fade-rev');
    },
    setBannerEnabled: enabled => {
      self.banner.enabled = enabled === true;
      if (!enabled) {
        self.resetBanner();
      } else {
        self._bannerIntervalTick();
      }
    },
    handleDiscordNameSet() {
      const name = self.elements.txtDiscordName.val();

      // TODO confirm with user
      $.post({
        type: 'POST',
        url: '/setDiscordName',
        data: {
          discordName: name
        },
        success: function() {
          modal.showText(__('Discord name updated successfully'));
        },
        error: function(data) {
          const err = data.responseJSON && data.responseJSON.details ? data.responseJSON.details : data.responseText;
          if (data.status === 200) { // seems to be caused when response body isn't json? just show whatever we can and trust server sent good enough details.
            modal.showText(err);
          } else {
            modal.showText(__('Couldn\'t change discord name: ') + err);
          }
        }
      });
    },
    updateAudio: function(url) {
      try {
        if (!url) url = 'notify.wav';
        timer.audioElem.src = url;
      } catch (e) {
        modal.showText(__('Failed to update audio src, using default sound.'));
        timer.audioElem.src = 'notify.wav';
      }
    },
    updateAvailable: function(count, cause) {
      if (count > 0 && cause === 'stackGain') timer.playAudio();
      self.setPlaceableText(count);
    },
    setMax(maxStacked) {
      self.maxStacked = maxStacked + 1;
    },
    setPlaceableText(placeable) {
      self.elements.stackCount.text(`${placeable}/${self.maxStacked}`);
      self.pixelsAvailable = placeable;
      document.title = uiHelper.getTitle();
    },
    setDiscordName(name) {
      self.elements.txtDiscordName.val(name);
    },
    adjustColorBrightness(level) {
      $([
        '#board-container',
        '#cursor',
        '#reticule',
        '#palette .palette-color'
      ].join(', ')).css('filter', level != null ? `brightness(${level})` : '');
    },
    getAvailable() {
      return self._available;
    },
    styleElemWithChatNameColor: (elem, colorIdx, layer = 'bg') => {
      elem.classList.remove(...self.specialChatColorClasses.reduce((acc, val) => {
        acc.push(...(Array.isArray(val) ? val : [val]));
        return acc;
      }, []));
      if (colorIdx >= 0) {
        switch (layer) {
          case 'bg':
            elem.style.backgroundColor = `#${place.getPaletteColorValue(colorIdx)}`;
            break;
          case 'color':
            elem.style.color = `#${place.getPaletteColorValue(colorIdx)}`;
            break;
        }
      } else {
        elem.style.backgroundColor = null;
        elem.style.color = null;
        const classes = self.specialChatColorClasses[-colorIdx - 1];
        elem.classList.add(...(Array.isArray(classes) ? classes : [classes]));
      }
    },
    setLoadingBubbleState: (process, state) => {
      self.loadingStates[process] = state;
      const processItem = self.elements.loadingBubble.children(`.loading-bubble-item[data-process="${process}"]`);

      const hasVisibleItems = Object.values(self.loadingStates).some((v) => v);
      if (hasVisibleItems && !self.isLoadingBubbleShown) {
        processItem.show();
        self.elements.loadingBubble.fadeIn(300);
        self.isLoadingBubbleShown = true;
      } else if (!hasVisibleItems && self.isLoadingBubbleShown) {
        self.elements.loadingBubble.fadeOut(300, () => processItem.hide());
        self.isLoadingBubbleShown = false;
      } else {
        processItem.toggle(state);
      }
    },
    toggleCaptchaLoading: (display) => {
      self.elements.captchaLoadingIcon.css('display', display ? 'inline-block' : 'none');
    },
    loadTheme: async (index) => {
      // Default theme (-1) doesn't need to load anything special.
      if (index === -1) {
        self.enableTheme(-1);
        return;
      }
      if (!(index in self.themes)) {
        return console.warn(`Tried to load invalid theme "${index}"`);
      }
      const theme = self.themes[index];
      if (theme.loaded) {
        self.enableTheme(index);
      } else {
        await new Promise((resolve, reject) => {
          theme.element.one('load', () => {
            if (!theme.loaded) {
              theme.loaded = true;
              self.enableTheme(index);
            }
            resolve();
          });
          theme.element.appendTo(document.head);
        });
      }
    },
    enableTheme: (index) => {
      // If theme is -1, the user selected the default theme.
      if (index === -1) {
        self.elements.themeColorMeta.attr('content', null);
      } else {
        if (!(index in self.themes)) {
          return console.warn(`Tried to enable invalid theme "${index}"`);
        }
        const theme = self.themes[index];
        theme.element.prop('disabled', false);
        self.elements.themeColorMeta.attr('content', theme.color);
      }
      $(`*[data-theme]:not([data-theme=${index}])`).prop('disabled', true);
    },
    makeMarkdownProcessor(whitelist = {}) {
      whitelist = {
        block: (whitelist && whitelist.block) || ['blankLine'],
        inline: (whitelist && whitelist.inline) || ['coordinate', 'emoji_raw', 'emoji_name', 'mention', 'escape', 'autoLink', 'url', 'underline', 'strong', 'emphasis', 'deletion', 'code']
      };

      return pxlsMarkdown.processor()
        .use(pxlsMarkdown.plugins.emoji, {
          emojiDB: window.emojiDB,
          // from Twemoji 13.0.0
          emojiRegex: /(?:\ud83d\udc68\ud83c\udffb\u200d\ud83e\udd1d\u200d\ud83d\udc68\ud83c[\udffc-\udfff]|\ud83d\udc68\ud83c\udffc\u200d\ud83e\udd1d\u200d\ud83d\udc68\ud83c[\udffb\udffd-\udfff]|\ud83d\udc68\ud83c\udffd\u200d\ud83e\udd1d\u200d\ud83d\udc68\ud83c[\udffb\udffc\udffe\udfff]|\ud83d\udc68\ud83c\udffe\u200d\ud83e\udd1d\u200d\ud83d\udc68\ud83c[\udffb-\udffd\udfff]|\ud83d\udc68\ud83c\udfff\u200d\ud83e\udd1d\u200d\ud83d\udc68\ud83c[\udffb-\udffe]|\ud83d\udc69\ud83c\udffb\u200d\ud83e\udd1d\u200d\ud83d\udc68\ud83c[\udffc-\udfff]|\ud83d\udc69\ud83c\udffb\u200d\ud83e\udd1d\u200d\ud83d\udc69\ud83c[\udffc-\udfff]|\ud83d\udc69\ud83c\udffc\u200d\ud83e\udd1d\u200d\ud83d\udc68\ud83c[\udffb\udffd-\udfff]|\ud83d\udc69\ud83c\udffc\u200d\ud83e\udd1d\u200d\ud83d\udc69\ud83c[\udffb\udffd-\udfff]|\ud83d\udc69\ud83c\udffd\u200d\ud83e\udd1d\u200d\ud83d\udc68\ud83c[\udffb\udffc\udffe\udfff]|\ud83d\udc69\ud83c\udffd\u200d\ud83e\udd1d\u200d\ud83d\udc69\ud83c[\udffb\udffc\udffe\udfff]|\ud83d\udc69\ud83c\udffe\u200d\ud83e\udd1d\u200d\ud83d\udc68\ud83c[\udffb-\udffd\udfff]|\ud83d\udc69\ud83c\udffe\u200d\ud83e\udd1d\u200d\ud83d\udc69\ud83c[\udffb-\udffd\udfff]|\ud83d\udc69\ud83c\udfff\u200d\ud83e\udd1d\u200d\ud83d\udc68\ud83c[\udffb-\udffe]|\ud83d\udc69\ud83c\udfff\u200d\ud83e\udd1d\u200d\ud83d\udc69\ud83c[\udffb-\udffe]|\ud83e\uddd1\ud83c\udffb\u200d\ud83e\udd1d\u200d\ud83e\uddd1\ud83c[\udffb-\udfff]|\ud83e\uddd1\ud83c\udffc\u200d\ud83e\udd1d\u200d\ud83e\uddd1\ud83c[\udffb-\udfff]|\ud83e\uddd1\ud83c\udffd\u200d\ud83e\udd1d\u200d\ud83e\uddd1\ud83c[\udffb-\udfff]|\ud83e\uddd1\ud83c\udffe\u200d\ud83e\udd1d\u200d\ud83e\uddd1\ud83c[\udffb-\udfff]|\ud83e\uddd1\ud83c\udfff\u200d\ud83e\udd1d\u200d\ud83e\uddd1\ud83c[\udffb-\udfff]|\ud83e\uddd1\u200d\ud83e\udd1d\u200d\ud83e\uddd1|\ud83d\udc6b\ud83c[\udffb-\udfff]|\ud83d\udc6c\ud83c[\udffb-\udfff]|\ud83d\udc6d\ud83c[\udffb-\udfff]|\ud83d[\udc6b-\udc6d])|(?:\ud83d[\udc68\udc69]|\ud83e\uddd1)(?:\ud83c[\udffb-\udfff])?\u200d(?:\u2695\ufe0f|\u2696\ufe0f|\u2708\ufe0f|\ud83c[\udf3e\udf73\udf7c\udf84\udf93\udfa4\udfa8\udfeb\udfed]|\ud83d[\udcbb\udcbc\udd27\udd2c\ude80\ude92]|\ud83e[\uddaf-\uddb3\uddbc\uddbd])|(?:\ud83c[\udfcb\udfcc]|\ud83d[\udd74\udd75]|\u26f9)((?:\ud83c[\udffb-\udfff]|\ufe0f)\u200d[\u2640\u2642]\ufe0f)|(?:\ud83c[\udfc3\udfc4\udfca]|\ud83d[\udc6e\udc70\udc71\udc73\udc77\udc81\udc82\udc86\udc87\ude45-\ude47\ude4b\ude4d\ude4e\udea3\udeb4-\udeb6]|\ud83e[\udd26\udd35\udd37-\udd39\udd3d\udd3e\uddb8\uddb9\uddcd-\uddcf\uddd6-\udddd])(?:\ud83c[\udffb-\udfff])?\u200d[\u2640\u2642]\ufe0f|(?:\ud83d\udc68\u200d\u2764\ufe0f\u200d\ud83d\udc8b\u200d\ud83d\udc68|\ud83d\udc68\u200d\ud83d\udc68\u200d\ud83d\udc66\u200d\ud83d\udc66|\ud83d\udc68\u200d\ud83d\udc68\u200d\ud83d\udc67\u200d\ud83d[\udc66\udc67]|\ud83d\udc68\u200d\ud83d\udc69\u200d\ud83d\udc66\u200d\ud83d\udc66|\ud83d\udc68\u200d\ud83d\udc69\u200d\ud83d\udc67\u200d\ud83d[\udc66\udc67]|\ud83d\udc69\u200d\u2764\ufe0f\u200d\ud83d\udc8b\u200d\ud83d[\udc68\udc69]|\ud83d\udc69\u200d\ud83d\udc69\u200d\ud83d\udc66\u200d\ud83d\udc66|\ud83d\udc69\u200d\ud83d\udc69\u200d\ud83d\udc67\u200d\ud83d[\udc66\udc67]|\ud83d\udc68\u200d\u2764\ufe0f\u200d\ud83d\udc68|\ud83d\udc68\u200d\ud83d\udc66\u200d\ud83d\udc66|\ud83d\udc68\u200d\ud83d\udc67\u200d\ud83d[\udc66\udc67]|\ud83d\udc68\u200d\ud83d\udc68\u200d\ud83d[\udc66\udc67]|\ud83d\udc68\u200d\ud83d\udc69\u200d\ud83d[\udc66\udc67]|\ud83d\udc69\u200d\u2764\ufe0f\u200d\ud83d[\udc68\udc69]|\ud83d\udc69\u200d\ud83d\udc66\u200d\ud83d\udc66|\ud83d\udc69\u200d\ud83d\udc67\u200d\ud83d[\udc66\udc67]|\ud83d\udc69\u200d\ud83d\udc69\u200d\ud83d[\udc66\udc67]|\ud83c\udff3\ufe0f\u200d\u26a7\ufe0f|\ud83c\udff3\ufe0f\u200d\ud83c\udf08|\ud83c\udff4\u200d\u2620\ufe0f|\ud83d\udc15\u200d\ud83e\uddba|\ud83d\udc3b\u200d\u2744\ufe0f|\ud83d\udc41\u200d\ud83d\udde8|\ud83d\udc68\u200d\ud83d[\udc66\udc67]|\ud83d\udc69\u200d\ud83d[\udc66\udc67]|\ud83d\udc6f\u200d\u2640\ufe0f|\ud83d\udc6f\u200d\u2642\ufe0f|\ud83e\udd3c\u200d\u2640\ufe0f|\ud83e\udd3c\u200d\u2642\ufe0f|\ud83e\uddde\u200d\u2640\ufe0f|\ud83e\uddde\u200d\u2642\ufe0f|\ud83e\udddf\u200d\u2640\ufe0f|\ud83e\udddf\u200d\u2642\ufe0f|\ud83d\udc08\u200d\u2b1b)|[#*0-9]\ufe0f?\u20e3|(?:[©®\u2122\u265f]\ufe0f)|(?:\ud83c[\udc04\udd70\udd71\udd7e\udd7f\ude02\ude1a\ude2f\ude37\udf21\udf24-\udf2c\udf36\udf7d\udf96\udf97\udf99-\udf9b\udf9e\udf9f\udfcd\udfce\udfd4-\udfdf\udff3\udff5\udff7]|\ud83d[\udc3f\udc41\udcfd\udd49\udd4a\udd6f\udd70\udd73\udd76-\udd79\udd87\udd8a-\udd8d\udda5\udda8\uddb1\uddb2\uddbc\uddc2-\uddc4\uddd1-\uddd3\udddc-\uddde\udde1\udde3\udde8\uddef\uddf3\uddfa\udecb\udecd-\udecf\udee0-\udee5\udee9\udef0\udef3]|[\u203c\u2049\u2139\u2194-\u2199\u21a9\u21aa\u231a\u231b\u2328\u23cf\u23ed-\u23ef\u23f1\u23f2\u23f8-\u23fa\u24c2\u25aa\u25ab\u25b6\u25c0\u25fb-\u25fe\u2600-\u2604\u260e\u2611\u2614\u2615\u2618\u2620\u2622\u2623\u2626\u262a\u262e\u262f\u2638-\u263a\u2640\u2642\u2648-\u2653\u2660\u2663\u2665\u2666\u2668\u267b\u267f\u2692-\u2697\u2699\u269b\u269c\u26a0\u26a1\u26a7\u26aa\u26ab\u26b0\u26b1\u26bd\u26be\u26c4\u26c5\u26c8\u26cf\u26d1\u26d3\u26d4\u26e9\u26ea\u26f0-\u26f5\u26f8\u26fa\u26fd\u2702\u2708\u2709\u270f\u2712\u2714\u2716\u271d\u2721\u2733\u2734\u2744\u2747\u2757\u2763\u2764\u27a1\u2934\u2935\u2b05-\u2b07\u2b1b\u2b1c\u2b50\u2b55\u3030\u303d\u3297\u3299])(?:\ufe0f|(?!\ufe0e))|(?:(?:\ud83c[\udfcb\udfcc]|\ud83d[\udd74\udd75\udd90]|[\u261d\u26f7\u26f9\u270c\u270d])(?:\ufe0f|(?!\ufe0e))|(?:\ud83c[\udf85\udfc2-\udfc4\udfc7\udfca]|\ud83d[\udc42\udc43\udc46-\udc50\udc66-\udc69\udc6e\udc70-\udc78\udc7c\udc81-\udc83\udc85-\udc87\udcaa\udd7a\udd95\udd96\ude45-\ude47\ude4b-\ude4f\udea3\udeb4-\udeb6\udec0\udecc]|\ud83e[\udd0c\udd0f\udd18-\udd1c\udd1e\udd1f\udd26\udd30-\udd39\udd3d\udd3e\udd77\uddb5\uddb6\uddb8\uddb9\uddbb\uddcd-\uddcf\uddd1-\udddd]|[\u270a\u270b]))(?:\ud83c[\udffb-\udfff])?|(?:\ud83c\udff4\udb40\udc67\udb40\udc62\udb40\udc65\udb40\udc6e\udb40\udc67\udb40\udc7f|\ud83c\udff4\udb40\udc67\udb40\udc62\udb40\udc73\udb40\udc63\udb40\udc74\udb40\udc7f|\ud83c\udff4\udb40\udc67\udb40\udc62\udb40\udc77\udb40\udc6c\udb40\udc73\udb40\udc7f|\ud83c\udde6\ud83c[\udde8-\uddec\uddee\uddf1\uddf2\uddf4\uddf6-\uddfa\uddfc\uddfd\uddff]|\ud83c\udde7\ud83c[\udde6\udde7\udde9-\uddef\uddf1-\uddf4\uddf6-\uddf9\uddfb\uddfc\uddfe\uddff]|\ud83c\udde8\ud83c[\udde6\udde8\udde9\uddeb-\uddee\uddf0-\uddf5\uddf7\uddfa-\uddff]|\ud83c\udde9\ud83c[\uddea\uddec\uddef\uddf0\uddf2\uddf4\uddff]|\ud83c\uddea\ud83c[\udde6\udde8\uddea\uddec\udded\uddf7-\uddfa]|\ud83c\uddeb\ud83c[\uddee-\uddf0\uddf2\uddf4\uddf7]|\ud83c\uddec\ud83c[\udde6\udde7\udde9-\uddee\uddf1-\uddf3\uddf5-\uddfa\uddfc\uddfe]|\ud83c\udded\ud83c[\uddf0\uddf2\uddf3\uddf7\uddf9\uddfa]|\ud83c\uddee\ud83c[\udde8-\uddea\uddf1-\uddf4\uddf6-\uddf9]|\ud83c\uddef\ud83c[\uddea\uddf2\uddf4\uddf5]|\ud83c\uddf0\ud83c[\uddea\uddec-\uddee\uddf2\uddf3\uddf5\uddf7\uddfc\uddfe\uddff]|\ud83c\uddf1\ud83c[\udde6-\udde8\uddee\uddf0\uddf7-\uddfb\uddfe]|\ud83c\uddf2\ud83c[\udde6\udde8-\udded\uddf0-\uddff]|\ud83c\uddf3\ud83c[\udde6\udde8\uddea-\uddec\uddee\uddf1\uddf4\uddf5\uddf7\uddfa\uddff]|\ud83c\uddf4\ud83c\uddf2|\ud83c\uddf5\ud83c[\udde6\uddea-\udded\uddf0-\uddf3\uddf7-\uddf9\uddfc\uddfe]|\ud83c\uddf6\ud83c\udde6|\ud83c\uddf7\ud83c[\uddea\uddf4\uddf8\uddfa\uddfc]|\ud83c\uddf8\ud83c[\udde6-\uddea\uddec-\uddf4\uddf7-\uddf9\uddfb\uddfd-\uddff]|\ud83c\uddf9\ud83c[\udde6\udde8\udde9\uddeb-\udded\uddef-\uddf4\uddf7\uddf9\uddfb\uddfc\uddff]|\ud83c\uddfa\ud83c[\udde6\uddec\uddf2\uddf3\uddf8\uddfe\uddff]|\ud83c\uddfb\ud83c[\udde6\udde8\uddea\uddec\uddee\uddf3\uddfa]|\ud83c\uddfc\ud83c[\uddeb\uddf8]|\ud83c\uddfd\ud83c\uddf0|\ud83c\uddfe\ud83c[\uddea\uddf9]|\ud83c\uddff\ud83c[\udde6\uddf2\uddfc]|\ud83c[\udccf\udd8e\udd91-\udd9a\udde6-\uddff\ude01\ude32-\ude36\ude38-\ude3a\ude50\ude51\udf00-\udf20\udf2d-\udf35\udf37-\udf7c\udf7e-\udf84\udf86-\udf93\udfa0-\udfc1\udfc5\udfc6\udfc8\udfc9\udfcf-\udfd3\udfe0-\udff0\udff4\udff8-\udfff]|\ud83d[\udc00-\udc3e\udc40\udc44\udc45\udc51-\udc65\udc6a\udc6f\udc79-\udc7b\udc7d-\udc80\udc84\udc88-\udca9\udcab-\udcfc\udcff-\udd3d\udd4b-\udd4e\udd50-\udd67\udda4\uddfb-\ude44\ude48-\ude4a\ude80-\udea2\udea4-\udeb3\udeb7-\udebf\udec1-\udec5\uded0-\uded2\uded5-\uded7\udeeb\udeec\udef4-\udefc\udfe0-\udfeb]|\ud83e[\udd0d\udd0e\udd10-\udd17\udd1d\udd20-\udd25\udd27-\udd2f\udd3a\udd3c\udd3f-\udd45\udd47-\udd76\udd78\udd7a-\uddb4\uddb7\uddba\uddbc-\uddcb\uddd0\uddde-\uddff\ude70-\ude74\ude78-\ude7a\ude80-\ude86\ude90-\udea8\udeb0-\udeb6\udec0-\udec2\uded0-\uded6]|[\u23e9-\u23ec\u23f0\u23f3\u267e\u26ce\u2705\u2728\u274c\u274e\u2753-\u2755\u2795-\u2797\u27b0\u27bf\ue50a])|\ufe0f/
        })
        .use(pxlsMarkdown.plugins.methodWhitelist, whitelist)
        .use(function() {
          this.Compiler.prototype.visitors.emoji = (node, next) => {
            if (twemoji.test(node.value)) {
              const el = twemoji.parse(crel('span', node.value)).children[0];
              el.title = `:${node.emojiName}:`;
              return el;
            } else {
              return crel('img', {
                draggable: false,
                class: 'emoji emoji--custom',
                alt: `:${node.emojiName}:`,
                src: node.value,
                title: `:${node.emojiName}:`
              });
            }
          };
        });
    },
    /**
     * Handles a file upload through the file browser.
     * @param {DataTransfer} dataTransfer The data transfer.
     */
    handleFile(dataTransfer) {
      const reader = new FileReader();
      reader.onload = () => self.handleFileUrl(reader.result);
      reader.readAsDataURL(dataTransfer.files[0]);
    },
    /**
     * Handles a file URL either through drag-and-drop or the file browser.
     * @param {string} url The file URL.
     */
    handleFileUrl(url) {
      template.update({ use: true, url, convertMode: 'nearestCustom' });
    }
  };

  return {
    init: self.init,
    initBanner: self.initBanner,
    updateTimer: self.updateTimer,
    updateAvailable: self.updateAvailable,
    getAvailable: self.getAvailable,
    setPlaceableText: self.setPlaceableText,
    setMax: self.setMax,
    setDiscordName: self.setDiscordName,
    updateAudio: self.updateAudio,
    styleElemWithChatNameColor: self.styleElemWithChatNameColor,
    setBannerEnabled: self.setBannerEnabled,
    get initTitle() {
      return self.initTitle;
    },
    getTitle: (prepend) => {
      if (typeof prepend !== 'string') {
        if (self.pixelsAvailable > 0) {
          prepend = `[${self.pixelsAvailable}/${self.maxStacked}]`;
        } else if (self.pixelsAvailable === 0) {
          prepend = `[${timer.getCurrentTimer()}]`;
        } else {
          prepend = '';
        }
      }
      const tplOpts = template.getOptions();
      let append = self.initTitle;

      if (tplOpts.use && tplOpts.title) { append = tplOpts.title; }

      return `${prepend ? prepend + ' ' : ''}${decodeURIComponent(append)}`;
    },
    setLoadingBubbleState: self.setLoadingBubbleState,
    makeMarkdownProcessor: self.makeMarkdownProcessor,
    toggleCaptchaLoading: self.toggleCaptchaLoading,
    get tabId() {
      return self.tabId;
    },
    tabHasFocus: () => {
      return serviceWorkerHelper.hasSupport
        ? self._workerIsTabFocused
        : ls.get('tabs.has-focus') === self.tabId;
    },
    prettifyRange: self.prettifyRange,
    handleFile: self.handleFile
  };
})();

module.exports.uiHelper = uiHelper;
