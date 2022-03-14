const {
  webkitBased,
  possiblyMobile
} = require('./helpers').flags;

const { ls } = require('./storage');

module.exports.settings = (function() {
  const SettingType = {
    TOGGLE: 0,
    RANGE: 1,
    TEXT: 2,
    NUMBER: 3,
    SELECT: 4,
    RADIO: 5
  };

  const validate = function(value, fallback, type) {
    switch (type) {
      case SettingType.TOGGLE:
        // valid if value is a boolean (either true or false)
        if (value === true || value === false) {
          return value;
        }
        break;
      case SettingType.TEXT:
        if (typeof value === 'string') {
          return value;
        }
        break;
      case SettingType.NUMBER:
        /* falls through */
      case SettingType.RANGE:
        // valid if value is a number
        if (!isNaN(parseFloat(value))) {
          return value;
        }
        break;
      case SettingType.SELECT:
        /* falls through */
      case SettingType.RADIO:
        // select and radios can use practically any values: allow if not void
        if (value != null) {
          return value;
        }
    }
    return fallback;
  };

  const filterInput = function(controls, type) {
    switch (type) {
      case SettingType.TOGGLE:
        return controls.filter('input[type=checkbox]');
      case SettingType.RANGE:
        return controls.filter('input[type=range]');
      case SettingType.TEXT:
        return controls.filter('input[type=text]');
      case SettingType.NUMBER:
        return controls.filter('input[type=number]');
      case SettingType.SELECT:
        return controls.filter('select');
      case SettingType.RADIO:
        return controls.filter('input[type=radio]');
    }
  };

  /**
   * Creates a new setting
   * @param {String} name the key to use in localstorage for the setting .
   * @param {SettingType} type the type of setting.
   * @param defaultValue the default value of the setting.
   * @param {JQuery|Element|selector} initialControls the inputs to bind as the controls of this setting.
   * @returns {Object} the setting object with public access to certain functions.
   */
  const setting = function(name, type, defaultValue, initialControls = $()) {
    const listeners = [];
    let controls = $();

    const get = function() {
      const value = ls.get(name);
      return validate(value, defaultValue, type);
    };
    const set = function(value) {
      const validValue = validate(value, defaultValue, type);
      ls.set(name, validValue);

      if (controls.length > 0) {
        if (type === SettingType.RADIO) {
          controls.each((_, e) => { e.checked = e.value === value; });
        } else if (type === SettingType.TOGGLE) {
          controls.prop('checked', validValue);
        } else {
          controls.prop('value', validValue);
        }
      }

      listeners.forEach((f) => f(validValue));
    };

    // this is defined here and not higher up so that we have a specific instance to unbind events from
    const keydownFunction = (evt) => {
      if (evt.key === 'Enter' || evt.which === 13) {
        $(this).blur();
      }
      // this prevents things like hotkey listeners picking up the events
      evt.stopPropagation();
    };
    let changeFunction = (evt) => set(evt.target.value);
    let changeEvents = 'change';

    switch (type) {
      case SettingType.RADIO:
        changeEvents = 'click';
        break;
      case SettingType.RANGE:
        changeEvents = 'input change';
        break;
      case SettingType.TOGGLE:
        changeFunction = (evt) => self.set(evt.target.checked);
        break;
    }

    const self = {
      get: get,
      set: set,
      reset: function() {
        self.set(defaultValue);
      },
      listen: function(f) {
        listeners.push(f);
        // this makes the listener aware of the initial state since it may not be initialised to the correct value
        f(self.get());
      },
      unlisten: function(f) {
        const index = listeners.indexOf(f);
        if (index !== -1) {
          listeners.splice(index, 1);
        }
      },
      controls: {
        add: function(control) {
          const toAdd = filterInput($(control), type);
          controls = controls.add(toAdd);

          if (type === SettingType.TEXT || type === SettingType.NUMBER) {
            toAdd.on('keydown', keydownFunction);
          }

          toAdd.on(changeEvents, changeFunction);

          // update the new controls to have the correct value
          self.set(self.get());
        },
        remove: function(control) {
          const toRemove = controls.filter($(control));
          controls = controls.not(toRemove);

          if (type === SettingType.TEXT || type === SettingType.NUMBER) {
            toRemove.off('keydown', keydownFunction);
          }

          toRemove.off(changeEvents, changeFunction);
        },
        disable: function() {
          controls.prop('disabled', true);
        },
        enable: function() {
          controls.prop('disabled', false);
        }
      }
    };

    if (type === SettingType.TOGGLE) {
      self.toggle = function() { self.set(!self.get()); };
    }

    self.controls.add(initialControls);

    return self;
  };

  const keymappings = {
    currentTheme: 'ui.theme.index',
    audio_muted: 'audio.enable',
    heatmap: 'board.heatmap.enable',
    virgimap: 'board.virginmap.enable',
    view_grid: 'board.grid.enable',
    'canvas.unlocked': 'board.lock.enable',
    'nativenotifications.pixel-avail': 'place.notification.enable',
    autoReset: 'place.deselectonplace.enable',
    zoomBaseValue: 'board.zoom.sensitivity',
    increased_zoom: 'board.zoom.limit.enable',
    scrollSwitchEnabled: 'place.palette.scrolling.enable',
    scrollSwitchDirectionInverted: 'place.palette.scrolling.invert',
    'ui.show-reticule': 'ui.reticule.enable',
    'ui.show-cursor': 'ui.cursor.enable',
    templateBeneathHeatmap: 'board.template.beneathoverlays',
    enableMiddleMouseSelect: 'place.picker.enable',
    enableNumberedPalette: 'ui.palette.numbers.enable',
    heatmap_background_opacity: 'board.heatmap.opacity',
    virginmap_background_opacity: 'board.virginmap.opacity',
    snapshotImageFormat: 'board.snapshot.format',
    'bubble-position': 'ui.bubble.position',
    'brightness.enabled': 'ui.brightness.enable',
    colorBrightness: 'ui.brightness.value',
    'alert.src': 'audio.alert.src',
    'alert.volume': 'audio.alert.volume',
    alert_delay: 'place.alert.delay',
    'chrome-canvas-offset-workaround': 'fix.chrome.offset.enable',
    hide_sensitive: 'lookup.filter.sensitive.enable',
    'chat.font-size': 'chat.font.size',
    'chat.internalClickDefault': 'chat.links.internal.behavior',
    'chat.24h': 'chat.timestamps.24h',
    'chat.text-icons-enabled': 'chat.badges.enable',
    'chat.faction-tags-enabled': 'chat.factiontags.enable',
    'chat.pings-enabled': 'chat.pings.enable',
    'chat.ping-audio-state': 'chat.pings.audio.when',
    'chat.ping-audio-volume': 'chat.pings.audio.volume',
    'chat.banner-enabled': 'ui.chat.banner.enable',
    'chat.use-template-urls': 'chat.links.templates.preferurls',
    'chat.horizontal': 'ui.chat.horizontal.enable'
  };

  // these are the settings which have gone from being toggle-off to toggle-on
  const flippedmappings = ['audio_muted', 'increased_zoom', 'canvas.unlocked'];

  // Convert old settings keys to new keys.
  Object.entries(keymappings).forEach((entry) => {
    if (ls.has(entry[0])) {
      const oldvalue = ls.get(entry[0]);
      ls.set(entry[1], flippedmappings.indexOf(entry[0]) === -1 ? oldvalue : !oldvalue);
      ls.remove(entry[0]);
    }
  });

  const searchInput = $('#settings-search-input').val(null);
  const searchNoResults = $('<p>').text('No Results').addClass('hidden text-muted').css({ 'text-align': 'center', 'margin-top': '5em', 'font-style': 'italic' });
  $('#settings > .panel-body').append(searchNoResults);

  const searchFunction = function(regex, object, allowTextSearch = false) {
    const data = object.data('keywords');
    if (!data) {
      return allowTextSearch && regex.test(object.text());
    }
    return data.split(';').some((k) => regex.test(k)) || (allowTextSearch && regex.test(object.text()));
  };

  function filterSettings(searchString) {
    const search = searchFunction.bind(null, new RegExp(searchString.replace(/[.*+\-?^${}()|[\]\\]/g, '\\$&'), 'i'));

    const sections = $('#settings > .panel-body > article');
    const displayedSections = sections.filter((_, _section) => {
      const section = $(_section);
      const sectionItems = section.children('header + *').children(':not(section)');
      const subsections = section.children('header + *').children('section');

      if (search(section)) {
        section.toggleClass('hidden', false);
        sectionItems.toggleClass('hidden', false);
        subsections.toggleClass('hidden', false);
        subsections.children(':not(h4)').toggleClass('hidden', false);
        return true;
      } else {
        const displayedItems = sectionItems.filter((_, _item) => {
          const item = $(_item);
          const itemVisible = search(item, true);
          item.toggleClass('hidden', !itemVisible);
          return itemVisible;
        });

        const displayedSubsections = subsections.filter((_, _subsection) => {
          const subsection = $(_subsection);
          const subsectionItems = subsection.children(':not(h4)');

          if (search(subsection)) {
            subsection.toggleClass('hidden', false);
            subsectionItems.toggleClass('hidden', false);
            return true;
          } else {
            const displayedSubsectionItems = subsectionItems.filter((_, _item) => {
              const item = $(_item);
              const itemVisible = search(item, true);
              item.toggleClass('hidden', !itemVisible);
              return itemVisible;
            });

            const subsectionHidden = displayedSubsectionItems.length === 0;
            subsection.toggleClass('hidden', subsectionHidden);
            return !subsectionHidden;
          }
        });

        const sectionHidden = displayedSubsections.length + displayedItems.length === 0;
        section.toggleClass('hidden', sectionHidden);
        return !sectionHidden;
      }
    });

    searchNoResults.toggleClass('hidden', displayedSections.length > 0);
  }

  searchInput.on('keyup', function(evt) {
    if (evt.key === 'Enter' || evt.which === 13) {
      $(this).blur();
    }

    filterSettings(searchInput.val());

    evt.stopPropagation();
  });

  searchInput.on('change', function() {
    filterSettings(searchInput.val());
  });

  const self = {
    // utilities
    filter: {
      search: (query) => {
        searchInput.val(query);
        if (typeof query === 'string') {
          filterSettings(query);
        }
      }
    },
    // setting objects
    ui: {
      language: {
        override: setting('ui.language.override', SettingType.SELECT, '', $('#setting-ui-language-override'))
      },
      theme: {
        index: setting('ui.theme.index', SettingType.SELECT, '-1', $('#setting-ui-theme-index'))
      },
      reticule: {
        enable: setting('ui.reticule.enable', SettingType.TOGGLE, !possiblyMobile, $('#setting-ui-reticule-enable'))
      },
      cursor: {
        enable: setting('ui.cursor.enable', SettingType.TOGGLE, !possiblyMobile, $('#setting-ui-cursor-enable'))
      },
      bubble: {
        position: setting('ui.bubble.position', SettingType.SELECT, 'bottom left', $('#setting-ui-bubble-position')),
        compact: setting('ui.bubble.compact', SettingType.TOGGLE, false)
      },
      brightness: {
        enable: setting('ui.brightness.enable', SettingType.TOGGLE, false, $('#setting-ui-brightness-enable')),
        value: setting('ui.brightness.value', SettingType.RANGE, 1, $('#setting-ui-brightness-value'))
      },
      palette: {
        numbers: {
          enable: setting('ui.palette.numbers.enable', SettingType.TOGGLE, false, $('#setting-ui-palette-numbers-enable'))
        },
        scrollbar: {
          thin: {
            enable: setting('ui.palette.scrollbar.thin.enable', SettingType.TOGGLE, true, $('#setting-ui-palette-scrollbar-thin-enable'))
          }
        },
        stacking: {
          enable: setting('ui.palette.stacking.enable', SettingType.TOGGLE, false, $('#setting-ui-palette-stacking-enable'))
        }
      },
      chat: {
        banner: {
          enable: setting('ui.chat.banner.enable', SettingType.TOGGLE, true, $('#setting-ui-chat-banner-enable'))
        },
        horizontal: {
          enable: setting('ui.chat.horizontal.enable', SettingType.TOGGLE, false, $('#setting-ui-chat-horizontal-enable'))
        },
        icon: {
          badge: setting('ui.chat.icon.badge', SettingType.SELECT, 'ping', $('#setting-ui-chat-icon-badge')),
          color: setting('ui.chat.icon.color', SettingType.SELECT, 'message', $('#setting-ui-chat-icon-color'))
        }
      }
    },
    audio: {
      enable: setting('audio.enable', SettingType.TOGGLE, true, $('#setting-audio-enable')),
      alert: {
        src: setting('audio.alert.src', SettingType.TEXT, '', $('#setting-audio-alert-src')),
        volume: setting('audio.alert.volume', SettingType.RANGE, 1, $('#setting-audio-alert-volume'))
      }
    },
    board: {
      heatmap: {
        enable: setting('board.heatmap.enable', SettingType.TOGGLE, false, $('#setting-board-heatmap-enable')),
        opacity: setting('board.heatmap.opacity', SettingType.RANGE, 0.5, $('#setting-board-heatmap-opacity'))
      },
      virginmap: {
        enable: setting('board.virginmap.enable', SettingType.TOGGLE, false, $('#setting-board-virginmap-enable')),
        opacity: setting('board.virginmap.opacity', SettingType.RANGE, 0.5, $('#setting-board-virginmap-opacity'))
      },
      grid: {
        enable: setting('board.grid.enable', SettingType.TOGGLE, false, $('#setting-board-grid-enable'))
      },
      lock: {
        enable: setting('board.lock.enable', SettingType.TOGGLE, false, $('#setting-board-lock-enable'))
      },
      zoom: {
        sensitivity: setting('board.zoom.sensitivity', SettingType.RANGE, 1.5, $('#setting-board-zoom-sensitivity')),
        limit: {
          minimum: setting('board.zoom.limit.minimum', SettingType.NUMBER, 0.5, $('#setting-board-zoom-limit-minimum')),
          maximum: setting('board.zoom.limit.maximum', SettingType.NUMBER, 50, $('#setting-board-zoom-limit-maximum'))
        },
        rounding: {
          enable: setting('board.zoom.rounding.enable', SettingType.TOGGLE, false, $('#setting-board-zoom-rounding-enable'))
        }
      },
      template: {
        beneathoverlays: setting('board.template.beneathoverlays', SettingType.TOGGLE, false, $('#setting-board-template-beneathoverlays')),
        opacity: setting('board.template.opacity', SettingType.RANGE, 1.0, $('#template-opacity')),
        style: {
          // NOTE ([  ]): This is a bit ugly, since both of these are essentially
          // the URL of the style. The issue is that I can't think of a good way
          // to have defaults and also allow custom input without this duplication.
          // `source` is the canonical source of the template value in theory,
          // so a simplified system can just drop the other setting rather than
          // converting it.
          source: setting('board.template.style.source', SettingType.SELECT, null, $('#template-style-mode')),
          customsource: setting('board.template.style.customsource', SettingType.TEXT, '', $('#template-custom-style-url'))
        }
      },
      snapshot: {
        format: setting('board.snapshot.format', SettingType.SELECT, 'image/png', $('#setting-board-snapshot-format'))
      }
    },
    place: {
      notification: {
        enable: setting('place.notification.enable', SettingType.TOGGLE, true, $('#setting-place-notification-enable'))
      },
      deselectonplace: {
        enable: setting('place.deselectonplace.enable', SettingType.TOGGLE, false, $('#setting-place-deselectonplace-enable'))
      },
      palette: {
        scrolling: {
          enable: setting('place.palette.scrolling.enable', SettingType.TOGGLE, false, $('#setting-place-palette-scrolling-enable')),
          invert: setting('place.palette.scrolling.invert', SettingType.TOGGLE, false, $('#setting-place-palette-scrolling-invert'))
        }
      },
      picker: {
        enable: setting('place.picker.enable', SettingType.TOGGLE, true, $('#setting-place-picker-enable'))
      },
      rightclick: {
        action: setting('ui.rightclick.action', SettingType.SELECT, 'nothing', $('#setting-ui-right-click-action'))
      },
      alert: {
        delay: setting('place.alert.delay', SettingType.NUMBER, 0, $('#setting-place-alert-delay'))
      }
    },
    lookup: {
      filter: {
        sensitive: {
          enable: setting('lookup.filter.sensitive.enable', SettingType.TOGGLE, false)
        }
      }
    },
    chat: {
      timestamps: {
        '24h': setting('chat.timestamps.24h', SettingType.TOGGLE, false, $('#setting-chat-timestamps-24h'))
      },
      badges: {
        enable: setting('chat.badges.enable', SettingType.TOGGLE, false, $('#setting-chat-badges-enable'))
      },
      factiontags: {
        enable: setting('chat.factiontags.enable', SettingType.TOGGLE, true, $('#setting-chat-factiontags-enable'))
      },
      pings: {
        enable: setting('chat.pings.enable', SettingType.TOGGLE, true, $('#setting-chat-pings-enable')),
        audio: {
          when: setting('chat.pings.audio.when', SettingType.SELECT, 'off', $('#setting-chat-pings-audio-when')),
          volume: setting('chat.pings.audio.volume', SettingType.RANGE, 0.5, $('#setting-chat-pings-audio-volume'))
        }
      },
      links: {
        templates: {
          preferurls: setting('chat.links.templates.preferurls', SettingType.TOGGLE, false, $('#setting-chat-links-templates-preferurls'))
        },
        internal: {
          behavior: setting('chat.links.internal.behavior', SettingType.SELECT, 'ask')
        }
      },
      font: {
        size: setting('chat.font.size', SettingType.NUMBER, 16, $('#setting-chat-font-size'))
      },
      truncate: {
        max: setting('chat.truncate.max', SettingType.NUMBER, 250, $('#setting-chat-truncate-max'))
      }
    },
    fix: {
      chrome: {
        offset: {
          enable: setting('fix.chrome.offset.enable', SettingType.TOGGLE, webkitBased, $('#setting-fix-chrome-offset-enable'))
        }
      }
    }
  };
  $(window).on('pxls:panel:closed', (event, panel) => {
    if (panel === 'settings') {
      self.filter.search('');
    }
  });
  return self;
})();
