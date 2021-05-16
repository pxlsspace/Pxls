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
window.App = (function() {
  // first we define the global helperfunctions and figure out what kind of settings our browser needs to use
  const storageFactory = function(storageType, prefix, exdays) {
    const getCookie = function(cookieName) {
      let i; let x; let y; const ARRcookies = document.cookie.split(';');
      for (i = 0; i < ARRcookies.length; i++) {
        x = ARRcookies[i].substr(0, ARRcookies[i].indexOf('='));
        y = ARRcookies[i].substr(ARRcookies[i].indexOf('=') + 1);
        x = x.replace(/^\s+|\s+$/g, '');
        if (x === cookieName) {
          return unescape(y);
        }
      }
    };
    const setCookie = function(cookieName, value, exdays) {
      const exdate = new Date();
      let cookieValue = escape(value);
      exdate.setDate(exdate.getDate() + exdays);
      cookieValue += ((exdays == null) ? '' : '; expires=' + exdate.toUTCString());
      document.cookie = cookieName + '=' + cookieValue;
    };
    const _get = function(name, haveSupport) {
      let s;
      if (haveSupport) {
        s = storageType.getItem(name);
      } else {
        s = getCookie(prefix + name);
      }
      if (s === undefined) {
        s = null;
      }
      return s;
    };
    return {
      haveSupport: null,
      support: function() {
        if (this.haveSupport == null) {
          try {
            storageType.setItem('test', '1');
            this.haveSupport = storageType.getItem('test') === '1';
            storageType.removeItem('test');
          } catch (e) {
            this.haveSupport = false;
          }
        }
        return this.haveSupport;
      },
      get: function(name) {
        const s = _get(name, this.support());
        try {
          return JSON.parse(s);
        } catch (e) {
          return null;
        }
      },
      has: function(name) {
        return _get(name, this.support()) !== null;
      },
      set: function(name, value) {
        value = JSON.stringify(value);
        if (this.support()) {
          storageType.setItem(name, value);
        } else {
          setCookie(prefix + name, value, exdays);
        }
      },
      remove: function(name) {
        if (this.support()) {
          storageType.removeItem(name);
        } else {
          setCookie(prefix + name, '', -1);
        }
      }
    };
  };
  const binaryAjax = async function(url) {
    const response = await fetch(url);
    const data = new Uint8Array(await response.arrayBuffer());
    return data;
  };
  const createImageData = function(w, h) {
    try {
      return new ImageData(w, h);
    } catch (e) {
      const imgCanv = document.createElement('canvas');
      imgCanv.width = w;
      imgCanv.height = h;
      return imgCanv.getContext('2d').getImageData(0, 0, w, h);
    }
  };
  const intToHex = (i) => `#${('000000' + (i >>> 0).toString(16)).slice(-6)}`;
  const hexToRGB = function(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : null;
  };
  const analytics = function() {
    if (window.ga) {
      window.ga.apply(this, arguments);
    }
  };
  const nua = navigator.userAgent;
  let haveImageRendering = (function() {
    const checkImageRendering = function(prefix, crisp, pixelated, optimizeContrast) {
      const d = document.createElement('div');
      if (crisp) {
        d.style.imageRendering = prefix + 'crisp-edges';
        if (d.style.imageRendering === prefix + 'crisp-edges') {
          return true;
        }
      }
      if (pixelated) {
        d.style.imageRendering = prefix + 'pixelated';
        if (d.style.imageRendering === prefix + 'pixelated') {
          return true;
        }
      }
      if (optimizeContrast) {
        d.style.imageRendering = prefix + 'optimize-contrast';
        if (d.style.imageRendering === prefix + 'optimize-contrast') {
          return true;
        }
      }
      return false;
    };
    return checkImageRendering('', true, true, false) || checkImageRendering('-o-', true, false, false) || checkImageRendering('-moz-', true, false, false) || checkImageRendering('-webkit-', true, false, true);
  })();
  let haveZoomRendering = false;
  const webkitBased = nua.match(/AppleWebKit/i);
  const iOSSafari = (nua.match(/(iPod|iPhone|iPad)/i) && webkitBased);
  const desktopSafari = (nua.match(/safari/i) && !nua.match(/chrome/i));
  const msEdge = nua.indexOf('Edge') > -1;
  const possiblyMobile = window.innerWidth < 768 && nua.includes('Mobile');
  if (iOSSafari) {
    const iOS = parseFloat(
      ('' + (/CPU.*OS ([0-9_]{1,5})|(CPU like).*AppleWebKit.*Mobile/i.exec(navigator.userAgent) || [0, ''])[1])
        .replace('undefined', '3_2').replace('_', '.').replace('_', '')
    ) || false;
    haveImageRendering = false;
    if (iOS >= 11) {
      haveZoomRendering = true;
    }
  } else if (desktopSafari) {
    haveImageRendering = false;
    haveZoomRendering = true;
  }
  if (msEdge) {
    haveImageRendering = false;
  }
  const TH = (function() { // place typeahead in its own pseudo namespace
    /**
     *
     * @param {string} char The char trigger. Should only be a one byte wide grapheme. Emojis will fail
     * @param {string} dbType The type of the database, acts internally as a map key.
     * @param {boolean} [hasPair=false] Whether or not this trigger has a matching pair at the end, e.g. ':word:' vs '@word'
     * @param {number} [minLength=0] The minimum length of the match before this trigger is considered valid.
     *                                Length is calculated without `this.char`, so a trigger of ":" and a match of ":one" will be a length of 3.
     * @constructor
     */
    function Trigger(char, dbType, hasPair = false, minLength = 0) {
      this.char = char;
      this.dbType = dbType;
      this.hasPair = hasPair;
      this.minLength = minLength;
    }

    /**
     *
     * @param {number} start The first (typically left-most) index of the trigger match
     * @param {number} end The right (typically right-most) index of the trigger match
     * @param {Trigger} trigger The trigger this match is for
     * @param {string} word The whole word this trigger matches
     * @constructor
     */
    function TriggerMatch(start, end, trigger, word) {
      this.start = start;
      this.end = end;
      this.trigger = trigger;
      this.word = word;
    }

    /**
     *
     * @typedef TypeaheadEntry
     * @type {object}
     * @property {string} key The key of the entry, to be matched by the typeahead.
     * @property {string} value The value of the entry, what the typeahead should output when the option is selected.
     */

    /**
     *
     * @callback TypeaheadInserterCallback
     * @param {TypeaheadEntry} entry
     */
    /**
     *
     * @callback TypeaheadRendererCallback
     * @param {TypeaheadEntry} entry
     */

    const defaultCallback = (entry) => entry.value;

    /**
     *
     * @param {string} name The name of the database. Used internally as an accessor key.
     * @param {object} [initData={}] The initial data to seed this database with.
     * @param {boolean} [caseSensitive=false] Whether or not searches are case sensitive.
     * @param {boolean} [leftAnchored=false] Whether or not searches are left-anchored.
     *                                       If true, `startsWith` is used. Otherwise, `includes` is used.
     * @param {TypeaheadInserterCallback} [inserter] Function ran to insert an entry into the text field.
     * @param {TypeaheadRendererCallback} [renderer] Function ran to render an entry on the typeahead prompt.
     * @constructor
     */
    function Database(name, initData = {}, caseSensitive = false, leftAnchored = false, inserter = defaultCallback, renderer = defaultCallback) {
      this.name = name;
      this._caseSensitive = caseSensitive;
      this.initData = initData;
      this.leftAnchored = leftAnchored;
      this.inserter = inserter;
      this.renderer = renderer;

      const fixKey = key => this._caseSensitive ? key.trim() : key.toLowerCase().trim();
      this.search = (start) => {
        start = fixKey(start);
        return Object.entries(this.initData)
          .filter(x => {
            const key = fixKey(x[0]);
            return this.leftAnchored ? key.startsWith(start) : key.includes(start);
          })
          .map(x => ({
            key: x[0],
            value: x[1]
          }));
      };
      this.addEntry = (key, value) => {
        key = key.trim();
        this.initData[key] = value;
      };
      this.removeEntry = (key, value) => {
        key = key.trim();
        delete this.initData[key];
      };
    }

    /**
     *
     * @param {Trigger[]} triggers
     * @param {string[]} [stops=[' ']] An array of characters that mark the bounds of a match, e.g. if we have an input of "one two", a cancels of [' '], and we search from the end of the string, we'll grab the word "two"
     * @param {Database[]} [DBs=[]] The databases to scan for trigger matches
     * @constructor
     */
    function Typeahead(triggers, stops = [' '], DBs = []) {
      this.triggers = {};
      this.triggersCache = [];
      this.stops = stops;
      this.DBs = DBs;
      if (!Array.isArray(triggers) && triggers instanceof Trigger) {
        triggers = [triggers];
      }

      triggers.forEach(trigger => {
        this.triggers[trigger.char] = trigger;
        if (!this.triggersCache.includes(trigger.char)) this.triggersCache.push(trigger.char);
      });

      /**
       * Scans the given string from the specified start position for a trigger match.
       * Starts from the right and scans left for a trigger. If found, we then scan to the right of the start index for a word break.
       *
       * @param {number} startIndex The index to start searching from. Typically {@link HTMLInputElement#selectionStart}
       * @param {string} searchString The string to search through. Typically {@link HTMLInputElement#value}
       * @returns {TriggerMatch|boolean} `false` if failed, a `TriggerMatch` otherwise.
       */
      this.scan = (startIndex, searchString) => {
        const match = new TriggerMatch(0, searchString.length, null, '');
        let matched = false;
        let foundOnce = false;
        for (let i = startIndex - 1; i >= 0; i--) { // Search left from the starting index looking for a trigger match
          const char = searchString.charAt(i);
          if (this.triggersCache.includes(char)) {
            match.start = i;
            match.trigger = this.triggers[char];
            matched = true;
            if (foundOnce) break; else foundOnce = true; // We only break if we've foundOnce so that if we start at the end of something like ":word:" we don't short circuit at the first one we see.
            // We don't just go until we see a break character because ":d:word:" is not a valid trigger. Can expand trigger in the future to potentially catch this though if a usecase pops up.
          } else if (this.stops.includes(char)) {
            break;
          }
        }
        if (matched) {
          for (let i = startIndex; i < searchString.length; i++) {
            const char = searchString.charAt(i);
            if (this.stops.includes(char)) { // we found the end of our word
              match.end = i;
              break;
            }
          }

          // If we have a pair and it's present, we don't want to include it in our DB searches. We go to len-1 in order to grab the whole word only (it's the difference between "word:" and "word")
          const fixedEnd = (match.trigger.hasPair && searchString.charAt(match.end - 1) === match.trigger.char) ? match.end - 1 : match.end;
          match.word = searchString.substring(match.start + 1, fixedEnd);
        }

        return matched ? (match.word.length >= match.trigger.minLength ? match : false) : false;
      };

      /**
       * @param {TriggerMatch} trigger The trigger match we should look for suggestions on.
       */
      this.suggestions = (trigger) => {
        let db = this.DBs.filter(x => x.name === trigger.trigger.dbType);
        if (!db || !db.length) return [];
        db = db[0];
        return db.search(trigger.word, trigger.trigger.leftAnchored);
      };

      /**
       * Gets the requested database.
       *
       * @param {string} dbName The database's name.
       * @see {@link Database#name}
       * @returns {null|Database}
       */
      this.getDatabase = dbName => {
        for (const x of this.DBs) {
          // const key = x._caseSensitive ? dbName : dbName.toLowerCase();
          if (x.name === dbName.trim()) return x;
        }
        return null;
      };
    }

    return {
      Typeahead,
      TriggerMatch,
      Trigger,
      Database
    };
  })();
  const ls = storageFactory(localStorage, 'ls_', 99);
  const ss = storageFactory(sessionStorage, 'ss_', null);

  const settings = (function() {
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

    return {
      // utilities
      filter: {
        search: (query) => {
          searchInput.val(query);
          if (query) {
            filterSettings(query);
          }
        }
      },
      // setting objects
      ui: {
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
          beneathoverlays: setting('board.template.beneathoverlays', SettingType.TOGGLE, false, $('#setting-board-template-beneathoverlays'))
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
  })();
  // this object is used to access the query parameters (and in the future probably to set them), it is prefered to use # now instead of ? as JS can change them
  const query = (function() {
    const self = {
      params: {},
      initialized: false,
      _trigger: function(propName, oldValue, newValue) {
        $(window).trigger('pxls:queryUpdated', [propName, oldValue, newValue]); // window.on("queryUpdated", (event, propName, oldValue, newValue) => {...});
        // this will cause issues if you're not paying attention. always check for `newValue` to be null in the event of a deleted key.
      },
      _update: function(fromEvent) {
        let toSplit = window.location.hash.substring(1);
        if (window.location.search.length > 0) { toSplit += ('&' + window.location.search.substring(1)); }

        const _varsTemp = toSplit.split('&');
        const vars = {};
        _varsTemp.forEach(val => {
          const split = val.split('=');
          const key = split.shift().toLowerCase();
          if (!key.length) return;
          vars[key] = split.shift();
        });

        const varKeys = Object.keys(vars);
        for (let i = 0; i < varKeys.length; i++) {
          const key = varKeys[i];
          const value = vars[key];
          if (fromEvent === true) {
            if (!Object.prototype.hasOwnProperty.call(self.params, key) || self.params[key] !== vars[key]) {
              const oldValue = self.params[key];
              const newValue = vars[key] == null ? null : vars[key].toString();
              self.params[key] = newValue;
              self._trigger(key, oldValue, value); // if value == null || !value.length, shouldn't we be removing?
            } else {
            }
          } else if (!Object.prototype.hasOwnProperty.call(self.params, key)) {
            self.params[key] = vars[key];
          }
        }

        if (fromEvent === true) {
          // Filter out removed params (removed from URL, but still present in self.params)
          // Get self.params keys, filter out any that don't exist in varKeys, and for each remaining value, call `self.remove` on it.
          Object.keys(self.params).filter(x => !varKeys.includes(x)).forEach(value => self.remove(value));
        }

        if (window.location.search.substring(1)) {
          window.location = window.location.pathname + '#' + self.getStr();
        }
      },
      setIfDifferent: function() {
        // setIfDifferent({oo: 0.3, template: "https://i.trg0d.com/gpq0786uCk4"}, [silent=false]);
        // setIfDifferent("template", "https://i.trg0d.com/gpq0786uCk4", [silent=false]);

        let workWith = {};
        let silent = false;
        if ((typeof arguments[0]) === 'string') {
          const key = arguments[0];
          const value = arguments[1];
          silent = arguments[2];
          workWith[key] = value;
        } else if ((typeof arguments[0]) === 'object') {
          workWith = arguments[0];
          silent = arguments[1];
        }
        silent = silent == null ? false : silent === true; // set the default value if necessary or coerce to bool.
        const KVPs = Object.entries(workWith);
        for (let i = 0; i < KVPs.length; i++) {
          const k = KVPs[i][0];
          const v = KVPs[i][1].toString();
          if (self.get(k) === v) { continue; }
          self.set(k, v, silent);
        }
      },
      init: function() {
        if (ss.get('url_params')) {
          window.location.hash = ss.get('url_params');
          ss.remove('url_params');
        } else {
          self._update();

          if ('replaceState' in window.history) {
            // We disable this if `replaceState` is missing because this will call _update every time the `window.location.hash` is set programatically.
            // Simply scrolling around the map would constantly call `board.centerOn` because x/y would be modified.
            window.onhashchange = function() {
              self._update(true);
            };
          }
        }

        $(window).on('message', function(evt) {
          evt = evt.originalEvent;
          if (evt.data && evt.data.type && evt.data.data) {
            const data = evt.data;
            switch (data.type.toUpperCase().trim()) {
              case 'TEMPLATE_UPDATE':
                template.queueUpdate(data.data);
                break;
              case 'VIEWPORT_UPDATE':
                board.updateViewport(data.data);
                break;
              default:
                console.warn('Unknown data type: %o', data.type);
                break;
            }
          }
        });
      },
      has: function(key) {
        return self.get(key) != null;
      },
      getStr: function() {
        const params = [];
        for (const p in self.params) {
          if (Object.prototype.hasOwnProperty.call(self.params, p)) {
            let s = encodeURIComponent(p);
            if (self.params[p] !== null) {
              const decoded = decodeURIComponent(self.params[p]);
              let toSet = self.params[p];
              if (decoded === toSet) { toSet = encodeURIComponent(toSet); } // ensure already URL-encoded values don't get re-encoded. if decoded === toSet, then it's already in an un-encoded form, and we can encode "safely".
              s += '=' + toSet;
            }
            params.push(s);
          }
        }
        return params.join('&');
      },
      update: function() {
        const s = self.getStr();
        if (window.history.replaceState) {
          window.history.replaceState(null, null, '#' + s);
        } else {
          window.location.hash = s;
        }
      },
      set: function(n, v, silent) {
        const oldValue = self.params[n];
        self.params[n] = v.toString();
        if (silent !== true) self._trigger(n, oldValue, v.toString());
        self.lazy_update();
      },
      get: function(n) {
        return self.params[n];
      },
      remove: function(n, silent) {
        delete self.params[n];
        self.lazy_update();

        if (silent !== true) { self._trigger(n, self.params[n], null); }
      },
      timer: null,
      lazy_update: function() {
        if (self.timer !== null) {
          clearTimeout(self.timer);
        }
        self.timer = setTimeout(function() {
          self.timer = null;
          self.update();
        }, 200);
      }
    };
    return {
      init: self.init,
      get: self.get,
      set: self.setIfDifferent,
      has: self.has,
      update: self.update,
      remove: self.remove,
      lazy_update: self.lazy_update
    };
  })();
    // this object is responsible for detecting pxls placement and banning them
  const ban = (function() {
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
    // this object is takes care of the websocket connection
  const socket = (function() {
    const self = {
      ws: null,
      hooks: [],
      sendQueue: [],
      WSConstructor: WebSocket,
      wps: WebSocket.prototype.send, // make sure we have backups of those....
      wpc: WebSocket.prototype.close,
      ws_open_state: WebSocket.OPEN,
      reconnect: function() {
        $('#reconnecting').show();
        setTimeout(function() {
          $.get(window.location.pathname + '?_' + (new Date()).getTime(), function() {
            window.location.reload();
          }).fail(function() {
            console.info('Server still down...');
            self.reconnect();
          });
        }, 3000);
      },
      reconnectSocket: function() {
        self.ws.onclose = function() {
        };
        self.connectSocket();
      },
      connectSocket: function() {
        const l = window.location;
        const url = ((l.protocol === 'https:') ? 'wss://' : 'ws://') + l.host + l.pathname + 'ws';
        self.ws = new self.WSConstructor(url);
        self.ws.onopen = evt => {
          setTimeout(() => {
            while (self.sendQueue.length > 0) {
              const toSend = self.sendQueue.shift();
              self.send(toSend);
            }
          }, 0);
        };
        self.ws.onmessage = function(msg) {
          const data = JSON.parse(msg.data);
          $.map(self.hooks, function(h) {
            if (h.type === data.type) {
              h.fn(data);
            }
          });
        };
        self.ws.onclose = function() {
          self.reconnect();
        };
      },
      init: function() {
        if (self.ws !== null) {
          return; // already inited!
        }
        self.connectSocket();

        $(window).on('beforeunload', function() {
          self.ws.onclose = function() {
          };
          self.close();
        });

        $('#board-container').show();
        $('#ui').show();
        $('#loading').fadeOut(500);
        user.wsinit();
      },
      on: function(type, fn) {
        self.hooks.push({
          type: type,
          fn: fn
        });
      },
      close: function() {
        self.ws.close = self.wpc;
        self.ws.close();
      },
      send: function(s) {
        const toSend = typeof s === 'string' ? s : JSON.stringify(s);
        if (self.ws == null || self.ws.readyState !== self.ws_open_state) {
          self.sendQueue.push(toSend);
        } else {
          self.ws.send = self.wps;
          self.ws.send(toSend);
        }
      }
    };
    return {
      init: self.init,
      on: self.on,
      send: self.send,
      close: self.close,
      reconnect: self.reconnect,
      reconnectSocket: self.reconnectSocket
    };
  })();
    // this object holds all board information and is responsible of rendering the board
  const board = (function() {
    const self = {
      elements: {
        board: $('#board'),
        board_render: null, // populated on init based on rendering method
        mover: $('#board-mover'),
        zoomer: $('#board-zoomer'),
        container: $('#board-container')
      },
      ctx: null,
      use_js_render: !haveImageRendering && !haveZoomRendering,
      use_zoom: !haveImageRendering && haveZoomRendering,
      width: 0,
      height: 0,
      scale: 1,
      id: null,
      intView: null,
      pan: {
        x: 0,
        y: 0
      },
      allowDrag: true,
      pannedWithKeys: false,
      rgbPalette: [],
      loaded: false,
      pixelBuffer: [],
      holdTimer: {
        id: -1,
        holdTimeout: 500,
        handler: function(args) { // self.holdTimer.handler
          self.holdTimer.id = -1;
          lookup.runLookup(args.x, args.y);
        }
      },
      webInfo: false,
      updateViewport: function(data) {
        if (!isNaN(data.scale)) {
          self.setScale(parseFloat(data.scale), false);
        }
        self.centerOn(data.x, data.y);
      },
      centerOn: function(x, y, ignoreLock = false) {
        if (x != null) self.pan.x = (self.width / 2 - x);
        if (y != null) self.pan.y = (self.height / 2 - y);
        self.update(null, ignoreLock);
      },
      replayBuffer: function() {
        $.map(self.pixelBuffer, function(p) {
          self.setPixelIndex(p.x, p.y, p.c, false);
        });
        self.refresh();
        self.pixelBuffer = [];
      },
      draw: function(data) {
        self.id = createImageData(self.width, self.height);
        self.ctx.mozImageSmoothingEnabled = self.ctx.webkitImageSmoothingEnabled = self.ctx.msImageSmoothingEnabled = self.ctx.imageSmoothingEnabled = false;

        self.intView = new Uint32Array(self.id.data.buffer);
        self.rgbPalette = place.getPaletteABGR();

        for (let i = 0; i < self.width * self.height; i++) {
          self._setPixelIndex(i, data[i]);
        }

        self.ctx.putImageData(self.id, 0, 0);
        self.update();
        self.loaded = true;
        self.replayBuffer();
      },
      initInteraction: function() {
        // first zooming and stuff
        const handleMove = function(evt) {
          if (!self.allowDrag) return;
          self.pan.x += evt.dx / self.scale;
          self.pan.y += evt.dy / self.scale;

          self.update();
        };

        interact(self.elements.container[0]).draggable({
          inertia: true,
          onmove: handleMove
        }).gesturable({
          onmove: function(evt) {
            if (self.allowDrag) {
              self.scale *= (1 + evt.ds);
            }
            handleMove(evt);
          }
        });

        $(document.body).on('keydown', function(evt) {
          if (['INPUT', 'TEXTAREA'].includes(evt.target.nodeName)) {
            // prevent inputs from triggering shortcuts
            return;
          }

          switch (evt.originalEvent.code || evt.keyCode || evt.which || evt.key) {
            case 'KeyW': // W
            case 'ArrowUp':
            case 38: // Arrow Up
            case 87: // W
            case 'w':
            case 'W':
              self.pan.y += 100 / self.scale;
              break;
            case 'KeyD': // D
            case 'ArrowRight':
            case 39: // Arrow Right
            case 68: // D
            case 'd':
            case 'D':
              self.pan.x -= 100 / self.scale;
              break;
            case 'KeyS': // S
            case 'ArrowDown':
            case 40: // Arrow Down
            case 83: // S
            case 's':
            case 'S':
              self.pan.y -= 100 / self.scale;
              break;
            case 'KeyA': // A
            case 'ArrowLeft':
            case 37: // Arrow Left
            case 65: // A
            case 'a':
            case 'A':
              self.pan.x += 100 / self.scale;
              break;
            case 'KeyP':
            case 80: // P
            case 'p':
            case 'P':
              self.save();
              break;
            case 'KeyL':
            case 76: // L
            case 'l':
            case 'L':
              settings.board.lock.enable.toggle();
              break;
            case 'KeyR':
            case 82: // R
            case 'r':
            case 'R': {
              const tempOpts = template.getOptions();
              if (tempOpts.use) {
                const tempElem = $('#board-template');
                self.centerOn(tempOpts.x + (tempElem.width() / 2), tempOpts.y + (tempElem.height() / 2));
              } else if (place.lastPixel) {
                self.centerOn(place.lastPixel.x, place.lastPixel.y);
              }
              break;
            }
            case 'KeyJ':
            case 74: // J
            case 'j':
            case 'J':
              if (place.color < 1) {
                place.switch(place.palette.length - 1);
              } else {
                place.switch(place.color - 1);
              }
              break;
            case 'KeyK':
            case 75: // K
            case 'k':
            case 'K':
              if (place.color + 1 >= place.palette.length) {
                place.switch(0);
              } else {
                place.switch(place.color + 1);
              }
              break;
              // Following stuff could be broken af for many non-English layouts
            case 'KeyE': // E
            case 'Equal': // =
            case 'NumpadAdd': // numpad +
            case 69: // E
            case 107: // numpad +
            case 187: // =
            case 171: // +
            case '=':
            case 'e':
            case 'E':
              self.nudgeScale(1);
              break;
            case 'KeyQ': // Q
            case 'Minus': // -
            case 'NumpadSubtract': // numpad -
            case 81: // Q
            case 109: // numpad -
            case 173: // -
            case 189: // -
            case 'q':
            case 'Q':
            case '-':
              self.nudgeScale(-1);
              break;
            case 't':
            case 'T':
            case 'KeyT':
            case 84: // t
              panels.toggle('settings');
              break;
            case 'i':
            case 'I':
            case 'KeyI':
            case 73: // i
              panels.toggle('info');
              break;
            case 'b':
            case 'B':
            case 'KeyB':
            case 66: // b
              panels.toggle('chat');
              break;
          }
          self.pannedWithKeys = true;
          self.update();
        });

        self.elements.container[0].addEventListener('wheel', function(evt) {
          if (!self.allowDrag) return;
          const oldScale = self.getScale();

          let delta = -evt.deltaY;

          switch (evt.deltaMode) {
            case WheelEvent.DOM_DELTA_PIXEL:
              // 53 pixels is the default chrome gives for a wheel scroll.
              delta /= 53;
              break;
            case WheelEvent.DOM_DELTA_LINE:
              // default case on Firefox, three lines is default number.
              delta /= 3;
              break;
            case WheelEvent.DOM_DELTA_PAGE:
              delta = Math.sign(delta);
              break;
          }

          self.nudgeScale(delta);

          const scale = self.getScale();
          if (oldScale !== scale) {
            const dx = evt.clientX - self.elements.container.width() / 2;
            const dy = evt.clientY - self.elements.container.height() / 2;
            self.pan.x -= dx / oldScale;
            self.pan.x += dx / scale;
            self.pan.y -= dy / oldScale;
            self.pan.y += dy / scale;
            self.update();
            place.update();
          }
        }, { passive: true });

        // now init the movement
        let downX, downY, downStart;
        self.elements.board_render.on('pointerdown mousedown', handleInputDown)
          .on('pointermove mousemove', handleInputMove)
          .on('pointerup mouseup touchend', handleInputUp)
          .contextmenu(function(evt) {
            evt.preventDefault();
            switch (settings.place.rightclick.action.get()) {
              case 'clear':
                place.switch(-1);
                break;
              case 'copy': {
                const coordinates = board.fromScreen(evt.clientX, evt.clientY, true);
                const index = board.getPixelIndex(coordinates.x, coordinates.y);
                place.switch(index);
                break;
              }
              case 'lookup':
                lookup.runLookup(evt.clientX, evt.clientY);
                break;
              case 'clearlookup':
                place.switch(-1);
                lookup.runLookup(evt.clientX, evt.clientY);
                break;
            }
          });

        // Separated some of these events from jQuery to deal with chrome's complaints about passive event violations.
        self.elements.board_render[0].addEventListener('touchstart', handleInputDown, { passive: false });
        self.elements.board_render[0].addEventListener('touchmove', handleInputMove, { passive: false });

        function handleInputDown(event) {
          if (['INPUT', 'TEXTAREA'].includes(document.activeElement.nodeName)) {
            document.activeElement.blur();
          }

          let clientX = 0;
          let clientY = 0;
          let prereq = true;
          if (event.changedTouches && event.changedTouches[0]) {
            clientX = event.changedTouches[0].clientX;
            clientY = event.changedTouches[0].clientY;
          } else {
            clientX = event.clientX;
            clientY = event.clientY;
            if (event.button != null) prereq = event.button === 0; // if there are buttons, is the the left mouse button?
          }
          downX = clientX;
          downY = clientY;
          if (prereq && self.holdTimer.id === -1) {
            self.holdTimer.id = setTimeout(self.holdTimer.handler, self.holdTimer.holdTimeout, {
              x: clientX,
              y: clientY
            });
          }
          downStart = Date.now();
        }

        function handleInputMove(event) {
          if (self.holdTimer.id === -1) return;
          let clientX = -1;
          let clientY = -1;

          if (event.changedTouches && event.changedTouches[0]) {
            clientX = event.changedTouches[0].clientX;
            clientY = event.changedTouches[0].clientY;
          } else {
            clientX = event.clientX;
            clientY = event.clientY;
          }
          if (Math.abs(downX - clientX) > 5 || Math.abs(downY - clientY) > 5) {
            clearTimeout(self.holdTimer.id);
            self.holdTimer.id = -1;
          }
        }

        function handleInputUp(event) {
          if (self.holdTimer.id !== -1) {
            clearTimeout(self.holdTimer.id);
          }
          if (event.shiftKey === true) return;
          self.holdTimer.id = -1;
          let touch = false;
          let clientX = event.clientX;
          let clientY = event.clientY;
          let downDelta = Date.now() - downStart;
          if (event.type === 'touchend') {
            touch = true;
            clientX = event.changedTouches[0].clientX;
            clientY = event.changedTouches[0].clientY;
          }
          const dx = Math.abs(downX - clientX);
          const dy = Math.abs(downY - clientY);
          if ((event.button === 0 || touch) && downDelta < 500) {
            let pos;
            if (!self.allowDrag && dx < 25 && dy < 25) {
              pos = self.fromScreen(downX, downY);
              place.place(pos.x, pos.y);
            } else if (dx < 5 && dy < 5) {
              pos = self.fromScreen(clientX, clientY);
              place.place(pos.x, pos.y);
            }
          }
          downDelta = 0;
          if (event.button != null) {
            // Is the button pressed the middle mouse button?
            if (settings.place.picker.enable.get() === true && event.button === 1 && dx < 15 && dy < 15) {
              // If so, switch to the color at the location.
              const { x, y } = self.fromScreen(event.clientX, event.clientY);
              place.switch(self.getPixelIndex(x, y));
            }
          }
        }
      },
      init: function() {
        $(window).on('pxls:queryUpdated', (evt, propName, oldValue, newValue) => {
          switch (propName.toLowerCase()) {
            case 'x':
            case 'y':
              board.centerOn(query.get('x') >> 0, query.get('y') >> 0);
              break;
            case 'scale':
              board.setScale(newValue >> 0, true);
              break;
            case 'template':
              template.queueUpdate({ template: newValue, use: newValue !== null });
              break;
            case 'ox':
              template.queueUpdate({ ox: newValue == null ? null : newValue >> 0 });
              break;
            case 'oy':
              template.queueUpdate({ oy: newValue == null ? null : newValue >> 0 });
              break;
            case 'tw':
              template.queueUpdate({ tw: newValue == null ? null : newValue >> 0 });
              break;
            case 'title':
              template.queueUpdate({ title: newValue == null ? '' : newValue });
              break;
            case 'oo': {
              let parsed = parseFloat(newValue);
              if (!Number.isFinite(parsed)) parsed = null;
              template.queueUpdate({ oo: parsed == null ? null : parsed });
              break;
            }
          }
        });
        $('#ui').hide();
        self.elements.container.hide();

        if (self.use_js_render) {
          self.elements.board_render = $('<canvas>').css({
            width: '100vw',
            height: '100vh',
            margin: 0,
            marginTop: 3 // wtf? Noticed by experimenting
          });
          self.elements.board.parent().append(self.elements.board_render);
          self.elements.board.detach();
        } else {
          self.elements.board_render = self.elements.board;
        }
        self.ctx = self.elements.board[0].getContext('2d');
        self.initInteraction();

        settings.board.template.beneathoverlays.listen(function(value) {
          self.elements.container.toggleClass('lower-template', value);
        });
      },
      start: function() {
        $.get('/info', async (data) => {
          overlays.webinit(data);
          user.webinit(data);
          self.width = data.width;
          self.height = data.height;
          place.setPalette(data.palette);
          uiHelper.setMax(data.maxStacked);
          chat.webinit(data);
          uiHelper.initBanner(data.chatBannerText);
          chromeOffsetWorkaround.update();
          self.webInfo = data;
          if (data.captchaKey) {
            $('.g-recaptcha').attr('data-sitekey', data.captchaKey);

            $.getScript('https://www.google.com/recaptcha/api.js');
          }
          self.elements.board.attr({
            width: self.width,
            height: self.height
          });

          const cx = query.get('x') || self.width / 2;
          const cy = query.get('y') || self.height / 2;
          self.setScale(query.get('scale') || self.scale, false);
          self.centerOn(cx, cy, true);
          socket.init();

          if (self.use_js_render) {
            $(window).resize(function() {
              self.update();
            }).resize();
          } else {
            $(window).resize(function() {
              place.update();
              grid.update();
            });
          }
          const url = query.get('template');
          if (url) { // we have a template!
            template.queueUpdate({
              use: true,
              x: parseFloat(query.get('ox')),
              y: parseFloat(query.get('oy')),
              opacity: parseFloat(query.get('oo')),
              width: parseFloat(query.get('tw')),
              title: query.get('title'),
              url: url
            });
          }
          let spin = parseFloat(query.get('spin'));
          if (spin) { // SPIN SPIN SPIN!!!!
            spin = 360 / (spin * 1000);
            let degree = 0;
            let start = null;
            const spiiiiiin = function(timestamp) {
              if (!start) {
                start = timestamp;
              }
              const delta = (timestamp - start);
              degree += spin * delta;
              degree %= 360;
              start = timestamp;
              self.elements.container.css('transform', 'rotate(' + degree + 'deg)');
              window.requestAnimationFrame(spiiiiiin);
            };
            window.requestAnimationFrame(spiiiiiin);
          }
          const color = ls.get('color');
          if (color != null) {
            place.switch(parseInt(color));
          }

          settings.board.zoom.rounding.enable.listen(function(value) {
            // this rounds the current scale if it needs rounding
            self.setScale(self.getScale());
          });

          try {
            self.draw(await binaryAjax('/boarddata' + '?_' + (new Date()).getTime()));
          } catch (e) {
            console.error('Error drawing board:', e);
            socket.reconnect();
          }
        }).fail(function(e) {
          console.error('Error fetching /info:', e);
          socket.reconnect();
        });
      },
      update: function(optional, ignoreCanvasLock = false) {
        const scale = self.getScale();
        if (self.loaded) {
          self.pan.x = Math.min(self.width / 2, Math.max(-self.width / 2, self.pan.x));
          self.pan.y = Math.min(self.height / 2, Math.max(-self.height / 2, self.pan.y));
          query.set({
            x: Math.round((self.width / 2) - self.pan.x),
            y: Math.round((self.height / 2) - self.pan.y),
            scale: Math.round(scale * 100) / 100
          }, true);
        }
        if (self.use_js_render) {
          const ctx2 = self.elements.board_render[0].getContext('2d');
          let pxlX = -self.pan.x + ((self.width - (window.innerWidth / scale)) / 2);
          let pxlY = -self.pan.y + ((self.height - (window.innerHeight / scale)) / 2);
          let dx = 0;
          let dy = 0;
          let dw = 0;
          let dh = 0;
          let pxlW = window.innerWidth / scale;
          let pxlH = window.innerHeight / scale;

          if (pxlX < 0) {
            dx = -pxlX;
            pxlX = 0;
            pxlW -= dx;
            dw += dx;
          }

          if (pxlY < 0) {
            dy = -pxlY;
            pxlY = 0;
            pxlH -= dy;
            dh += dy;
          }

          if (pxlX + pxlW > self.width) {
            dw += pxlW + pxlX - self.width;
            pxlW = self.width - pxlX;
          }

          if (pxlY + pxlH > self.height) {
            dh += pxlH + pxlY - self.height;
            pxlH = self.height - pxlY;
          }

          ctx2.canvas.width = window.innerWidth;
          ctx2.canvas.height = window.innerHeight;
          ctx2.mozImageSmoothingEnabled = ctx2.webkitImageSmoothingEnabled = ctx2.msImageSmoothingEnabled = ctx2.imageSmoothingEnabled = (scale < 1);

          ctx2.globalAlpha = 1;
          ctx2.fillStyle = '#CCCCCC';
          ctx2.fillRect(0, 0, ctx2.canvas.width, ctx2.canvas.height);
          ctx2.drawImage(self.elements.board[0],
            pxlX,
            pxlY,
            pxlW,
            pxlH,
            0 + (dx * scale),
            0 + (dy * scale),
            window.innerWidth - (dw * scale),
            window.innerHeight - (dh * scale)
          );

          template.draw(ctx2, pxlX, pxlY);

          place.update();
          grid.update();
          return true;
        }
        if (optional) {
          return false;
        }

        self.elements.board.toggleClass('pixelate', scale > 1);
        overlays.heatmap.setPixelated(scale >= 1);
        overlays.heatbackground.setPixelated(scale >= 1);
        overlays.virginmap.setPixelated(scale >= 1);
        overlays.virginbackground.setPixelated(scale >= 1);
        template.setPixelated(scale >= template.getWidthRatio());

        if (ignoreCanvasLock || self.allowDrag || (!self.allowDrag && self.pannedWithKeys)) {
          self.elements.mover.css({
            width: self.width,
            height: self.height,
            transform: 'translate(' + (scale <= 1 ? Math.round(self.pan.x) : self.pan.x) + 'px, ' + (scale <= 1 ? Math.round(self.pan.y) : self.pan.y) + 'px)'
          });
        }
        if (self.use_zoom) {
          self.elements.zoomer.css('zoom', (scale * 100).toString() + '%');
        } else {
          self.elements.zoomer.css('transform', 'scale(' + scale + ')');
        }

        place.update();
        grid.update();
        return true;
      },
      getScale: function() {
        return Math.abs(self.scale);
      },
      setScale: function(scale, doUpdate = true) {
        // TODO: Determine why these values are being returned as strings rather than their appropriate type (float)
        const minimum = parseFloat(settings.board.zoom.limit.minimum.get());
        const maximum = parseFloat(settings.board.zoom.limit.maximum.get());
        // TODO: Determine why scale is a string
        scale = parseFloat(scale);
        if (scale > maximum) {
          scale = maximum;
        } else if (scale <= minimum) {
          // enforce the [x, y] limit without blindly resetting to x when the user was trying to zoom in farther than y
          scale = minimum;
        }

        if (settings.board.zoom.rounding.enable.get()) {
          // We round up if zooming in and round down if zooming out to ensure that the level does change
          // even if the scrolled amount wouldn't be closer to the next rounded value than the last one.
          let round;
          if (scale < self.scale) {
            round = Math.floor;
          } else {
            round = Math.ceil;
          }

          if (scale > 1) {
            if (self.scale < 1) {
              scale = 1;
            } else {
              scale = round(scale);
            }
          } else {
            if (self.scale > 1) {
              scale = 1;
            } else {
              scale = 2 ** round(Math.log(scale) / Math.log(2));
            }
          }
        }

        self.scale = scale;
        if (doUpdate) {
          self.update();
        }
      },
      getZoomBase: function() {
        return parseFloat(settings.board.zoom.sensitivity.get()) || 1.5;
      },
      nudgeScale: function(adj) {
        const zoomBase = self.getZoomBase();

        self.setScale(self.scale * zoomBase ** adj);
      },
      getPixelIndex: function(x, y) {
        x = Math.floor(x);
        y = Math.floor(y);
        if (!self.loaded) {
          return self.pixelBuffer.findIndex((pix) => pix.x === x && pix.y === y);
        }
        const colorValue = self.intView[y * self.width + x];
        const index = self.rgbPalette.indexOf(colorValue);
        return index !== -1 ? index : 0xFF;
      },
      _setPixelIndex: function(i, c) {
        if (c === -1 || c === 0xFF) {
          // transparent.
          self.intView[i] = 0x00000000;
        } else {
          self.intView[i] = self.rgbPalette[c];
        }
      },
      setPixelIndex: function(x, y, c, refresh) {
        if (!self.loaded) {
          self.pixelBuffer.push({
            x: x,
            y: y,
            c: c
          });
          return;
        }
        if (refresh === undefined) {
          refresh = true;
        }
        self._setPixelIndex(y * self.width + x, c);
        if (refresh) {
          self.ctx.putImageData(self.id, 0, 0);
        }
      },
      refresh: function() {
        if (self.loaded) {
          self.ctx.putImageData(self.id, 0, 0);
        }
      },
      fromScreen: function(screenX, screenY, floored = true) {
        let toRet = { x: 0, y: 0 };
        let adjustX = 0;
        let adjustY = 0;
        if (self.scale < 0) {
          adjustX = self.width;
          adjustY = self.height;
        }

        const scale = self.getScale();
        if (self.use_js_render) {
          toRet = {
            x: -self.pan.x + ((self.width - (window.innerWidth / scale)) / 2) + (screenX / scale) + adjustX,
            y: -self.pan.y + ((self.height - (window.innerHeight / scale)) / 2) + (screenY / scale) + adjustY
          };
        } else {
          // we scope these into the `else` so that we don't have to redefine `boardBox` twice. getBoundingClientRect() forces a redraw so we don't want to do it every call either if we can help it.
          const boardBox = self.elements.board[0].getBoundingClientRect();
          if (self.use_zoom) {
            toRet = {
              x: (screenX / scale) - boardBox.left + adjustX,
              y: (screenY / scale) - boardBox.top + adjustY
            };
          } else {
            toRet = {
              x: ((screenX - boardBox.left) / scale) + adjustX,
              y: ((screenY - boardBox.top) / scale) + adjustY
            };
          }
        }

        if (floored) {
          toRet.x >>= 0;
          toRet.y >>= 0;
        }

        return toRet;
      },
      toScreen: function(boardX, boardY) {
        const scale = self.getScale();
        if (scale < 0) {
          boardX -= self.width - 1;
          boardY -= self.height - 1;
        }
        if (self.use_js_render) {
          return {
            x: (boardX + self.pan.x - ((self.width - (window.innerWidth / scale)) / 2)) * scale,
            y: (boardY + self.pan.y - ((self.height - (window.innerHeight / scale)) / 2)) * scale
          };
        }
        const boardBox = self.elements.board[0].getBoundingClientRect();
        if (self.use_zoom) {
          return {
            x: (boardX + boardBox.left) * scale,
            y: (boardY + boardBox.top) * scale
          };
        }
        return {
          x: boardX * scale + boardBox.left,
          y: boardY * scale + boardBox.top
        };
      },
      save: function() {
        const a = document.createElement('a');
        const format = settings.board.snapshot.format.get();

        a.href = self.elements.board[0].toDataURL(format, 1);
        a.download = (new Date()).toISOString().replace(/^(\d+-\d+-\d+)T(\d+):(\d+):(\d).*$/, `pxls canvas $1 $2.$3.$4.${format.split('/')[1]}`);
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        if (typeof a.remove === 'function') {
          a.remove();
        }
      },
      getRenderBoard: function() {
        return self.elements.board_render;
      },
      validateCoordinates: (x, y) => {
        return (x >= 0 && x <= self.width) && (y >= 0 && y <= self.height);
      }
    };
    return {
      init: self.init,
      start: self.start,
      update: self.update,
      getScale: self.getScale,
      nudgeScale: self.nudgeScale,
      setScale: self.setScale,
      getPixelIndex: self.getPixelIndex,
      setPixelIndex: self.setPixelIndex,
      fromScreen: self.fromScreen,
      toScreen: self.toScreen,
      save: self.save,
      centerOn: self.centerOn,
      getRenderBoard: self.getRenderBoard,
      getContainer: () => self.elements.container,
      getWidth: () => self.width,
      getHeight: () => self.height,
      refresh: self.refresh,
      updateViewport: self.updateViewport,
      get allowDrag() {
        return self.allowDrag;
      },
      setAllowDrag: (allowDrag) => {
        self.allowDrag = allowDrag === true;
        if (self.allowDrag) { coords.lockIcon.fadeOut(200); } else { coords.lockIcon.fadeIn(200); }
      },
      validateCoordinates: self.validateCoordinates,
      get webInfo() {
        return self.webInfo;
      },
      get snipMode() {
        return self.webInfo && self.webInfo.snipMode === true;
      }
    };
  })();
  const overlays = (function() {
    const overlay = function(name, fetchData, onLazyInit = () => {}) {
      const self = {
        name: name,
        elements: {
          overlay: crel('canvas', { id: name, class: 'pixelate noselect' })
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
        setShown: function(value = self.isShown, fadeTime = 200) {
          self.isShown = value === true;

          if (!self.lazyInitStarted) {
            self.lazyInit();
          }

          if (!self.lazyInitDone) {
            uiHelper.setLoadingBubbleState(self.name, self.isShown);
            return;
          }

          if (self.isShown) {
            $(self.elements.overlay).fadeIn(fadeTime);
          } else {
            $(self.elements.overlay).fadeOut(fadeTime);
          }
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

      $(self.elements.overlay).hide();
      $('#board-mover').prepend(self.elements.overlay);

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

        // heatmap stuff
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

        const heatbackground = self.add('heatbackground', () => createOverlayImageData('/heatmap', '/placemap', 0xFF000000));

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

        // virginmap stuff
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

        const virginbackground = self.add('virginbackground', () => createOverlayImageData('/virginmap', '/placemap', 0x0000FF00, 0x00));

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
    // here all the template stuff happens
  const template = (function() {
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
          self.elements.imageErrorWarning.text('There was an error getting the image');
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
    // here all the grid stuff happens
  const grid = (function() {
    const self = {
      elements: {
        grid: $('#grid')
      },
      init: function() {
        self.elements.grid.hide();
        settings.board.grid.enable.listen(function(value) {
          if (value) {
            self.elements.grid.fadeIn({ duration: 100 });
          } else {
            self.elements.grid.fadeOut({ duration: 100 });
          }
        });
        let GKeyPressed = false;
        // `e` is a key event.
        // True if g key is the focus of the event.
        const testForG = (e) => e.key === 'g' || e.key === 'G' || e.which === 71;

        $(window).keydown(function(e) {
          if (['INPUT', 'TEXTAREA'].includes(e.target.nodeName)) {
            // prevent inputs from triggering shortcuts
            return;
          }

          if (testForG(e)) {
            if (GKeyPressed) {
              return;
            }
            GKeyPressed = true;

            settings.board.grid.enable.toggle();
          }
        });

        $(window).keyup(function(e) {
          if (testForG(e)) {
            GKeyPressed = false;
          }
        });
      },
      update: function() {
        const a = board.fromScreen(0, 0, false);
        const scale = board.getScale();
        const roundedScale = Math.max(1, Math.floor(scale));
        const scaleRoundingErrorMultiplier = scale / roundedScale;
        self.elements.grid.css({
          backgroundSize: roundedScale + 'px ' + roundedScale + 'px',
          transform: 'translate(' + Math.floor(-a.x % 1 * roundedScale) + 'px,' + Math.floor(-a.y % 1 * roundedScale) + 'px) scale(' + scaleRoundingErrorMultiplier + ')',
          opacity: (scale - 2) / 6
        });
      }
    };
    return {
      init: self.init,
      update: self.update
    };
  })();
    // this takes care of placing pixels, the palette, the reticule and stuff associated with that
  const place = (function() {
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
    // this is the user lookup helper
  const lookup = (function() {
    const self = {
      elements: {
        lookup: $('#lookup'),
        prompt: $('#prompt')
      },
      handle: null,
      report: function(id, x, y) {
        const reportButton = crel('button', { class: 'text-button dangerous-button' }, 'Report');
        reportButton.addEventListener('click', function() {
          this.disabled = true;
          this.textContent = 'Sending...';

          const selectedRule = this.closest('.modal').querySelector('select').value;
          const textarea = this.closest('.modal').querySelector('textarea').value.trim();
          let msg = selectedRule;
          if (selectedRule === 'other') {
            if (textarea === '') {
              modal.showText('You must specify the details.');
              return;
            }
            msg = textarea;
          } else if (textarea !== '') {
            msg += '; additional information: ' + textarea;
          }
          $.post('/report', {
            id: id,
            x: x,
            y: y,
            message: msg
          }, function() {
            modal.showText('Sent report!');
            self.elements.prompt.hide();
            self.elements.lookup.hide();
          }).fail(function() {
            modal.showText('Error sending report.');
          });
        });
        modal.show(modal.buildDom(
          crel('h2', { class: 'modal-title' }, 'Report Pixel'),
          crel('div',
            crel('select', { style: 'width: 100%; margin-bottom: 1em;' },
              crel('option', 'Rule #1: Hateful/derogatory speech or symbols'),
              crel('option', 'Rule #2: Nudity, genitalia, or non-PG-13 content'),
              crel('option', 'Rule #3: Multi-account'),
              crel('option', 'Rule #4: Botting'),
              crel('option', { value: 'other' }, 'Other (specify below)')
            ),
            crel('textarea', {
              placeholder: 'Additional information (if applicable)',
              style: 'width: 100%; height: 5em',
              onkeydown: e => e.stopPropagation()
            }),
            crel('div', { class: 'buttons' },
              crel('button', { class: 'text-button', onclick: () => modal.closeAll() }, 'Cancel'),
              reportButton
            )
          )
        ));
      },
      /**
         * All lookup hooks.
         */
      hooks: [],
      /**
         * Registers hooks.
         * @param {...Object} hooks Information about the hook.
         * @param {String} hooks.id An ID for the hook.
         * @param {String} hooks.name A user-facing name for the hook.
         * @param {Boolean} hooks.sensitive Whenever the hook contains sensitive information.
         * @param {Boolean} hooks.backgroundCompatible Whenever the hook should appear even if the pixel is background.
         * @param {Function} hooks.get A function that returns the text information shown in the lookup.
         * @param {Object} hooks.css An object mapping CSS rules to values for the hook value.
         */
      registerHook: function(...hooks) {
        return self.hooks.push(...$.map(hooks, function(hook) {
          return {
            id: hook.id || 'hook',
            name: hook.name || 'Hook',
            sensitive: hook.sensitive || false,
            backgroundCompatible: hook.backgroundCompatible || false,
            get: hook.get || function() {
            },
            css: hook.css || {}
          };
        }));
      },
      /**
         * Replace a hook by its ID.
         * @param {String} hookId The ID of the hook to replace.
         * @param {Object} newHook Information about the hook.
         * @param {String} newHook.name New user-facing name for the hook.
         * @param {Boolean} newHook.sensitive Whenever the new hook contains sensitive information.
         * @param {Boolean} newHook.backgroundCompatible Whenever the new hook should appear even if the pixel is background.
         * @param {Function} newHook.get A function that returns the text information shown in the lookup.
         * @param {Object} newHook.css An object mapping CSS rules to values for the new hook value.
         */
      replaceHook: function(hookId, newHook) {
        delete newHook.id;
        for (const idx in self.hooks) {
          const hook = self.hooks[idx];
          if (hook.id === hookId) {
            self.hooks[idx] = Object.assign(hook, newHook);
            return;
          }
        }
      },
      /**
         * Unregisters a hook by its ID.
         * @param {string} hookId The ID of the hook to unregister.
         */
      unregisterHook: function(hookId) {
        self.hooks = $.grep(self.hooks, function(hook) {
          return hook.id !== hookId;
        });
      },
      create: function(data) {
        const sensitiveElems = [];
        self._makeShell(data).find('.content').first().append(() => {
          if (!data.bg) {
            return '';
          }

          return $('<p>').text('This pixel is background (was not placed by a user).');
        }).append(() => {
          const hooks = data.bg
            ? self.hooks.filter((hook) => hook.backgroundCompatible)
            : self.hooks;

          return $.map(hooks, (hook) => {
            const get = hook.get(data);
            if (get == null) {
              return null;
            }

            const value = typeof get === 'object'
              ? (get instanceof Node ? $(get) : get)
              : $('<span>').text(get);

            const _retVal = $('<div data-sensitive="' + hook.sensitive + '">').append(
              $('<b>').text(hook.name + ': '),
              value.css(hook.css)
            ).attr('id', 'lookuphook_' + hook.id);
            if (hook.sensitive) {
              sensitiveElems.push(_retVal);
              if (settings.lookup.filter.sensitive.enable.get()) {
                _retVal.css('display', 'none');
              }
            }
            return _retVal;
          });
        }).append(() => {
          if (data.bg || sensitiveElems.length < 1) {
            return '';
          }

          const label = $('<label>');
          const checkbox = $('<input type="checkbox">').css('margin-top', '10px');
          const span = $('<span class="label-text">').text('Hide sensitive information');
          label.prepend(checkbox, span);
          settings.lookup.filter.sensitive.enable.controls.add(checkbox);
          return label;
        });
        self.elements.lookup.fadeIn(200);
      },
      _makeShell: function(data) {
        return self.elements.lookup.empty().append(
          $('<div>').addClass('content'),
          (!data.bg && user.isLoggedIn()
            ? $('<button>').css('float', 'left').addClass('dangerous-button text-button').text('Report').click(function() {
              self.report(data.id, data.x, data.y);
            })
            : ''),
          $('<button>').css('float', 'right').addClass('text-button').text('Close').click(function() {
            self.elements.lookup.fadeOut(200);
          }),
          (template.getOptions().use ? $('<button>').css('float', 'right').addClass('text-button').text('Move Template Here').click(function() {
            template.queueUpdate({
              ox: data.x,
              oy: data.y
            });
          }) : '')
        );
      },
      runLookup(clientX, clientY) {
        const pos = board.fromScreen(clientX, clientY);
        $.get('/lookup', pos, function(data) {
          data = data || { x: pos.x, y: pos.y, bg: true };
          if (data && data.username && chat.typeahead.helper) {
            chat.typeahead.helper.getDatabase('users').addEntry(data.username, data.username);
          }
          if (self.handle) {
            self.handle(data);
          } else {
            self.create(data);
          }
        }).fail(function() {
          self._makeShell({ x: pos.x, y: pos.y }).find('.content').first().append($('<p>').css('color', '#c00').text("An error occurred, either you aren't logged in or you may be attempting to look up users too fast. Please try again in 60 seconds"));
          self.elements.lookup.fadeIn(200);
        });
      },
      init: function() {
        // Register default hooks
        self.registerHook(
          {
            id: 'coords',
            name: 'Coords',
            get: data => $('<a>').text('(' + data.x + ', ' + data.y + ')').attr('href', coords.getLinkToCoords(data.x, data.y)),
            backgroundCompatible: true
          }, {
            id: 'username',
            name: 'Username',
            get: data => data.username
              ? !board.snipMode
                ? crel('a', {
                  href: `/profile/${data.username}`,
                  target: '_blank',
                  title: 'View Profile'
                }, data.username)
                : data.username
              : null
          }, {
            id: 'faction',
            name: 'Faction',
            get: data => data.faction || null
          }, {
            id: 'origin',
            name: 'Origin',
            get: data => {
              switch (data.origin) {
                case 'nuke':
                  return 'Part of a nuke';
                case 'mod':
                  return 'Placed by a staff member using placement overrides';
                default:
                  return null;
              }
            }
          }, {
            id: 'time',
            name: 'Time',
            get: data => {
              const delta = ((new Date()).getTime() - data.time) / 1000;
              const stamp = (new Date(data.time)).toLocaleString();

              const span = $('<span>');
              span.attr('title', stamp);

              if (delta > 24 * 3600) {
                return span.text(stamp);
              } else if (delta < 5) {
                return span.text('just now');
              } else {
                const secs = Math.floor(delta % 60);
                const secsStr = secs < 10 ? '0' + secs : secs;
                const minutes = Math.floor((delta / 60)) % 60;
                const minuteStr = minutes < 10 ? '0' + minutes : minutes;
                const hours = Math.floor(delta / 3600);
                const hoursStr = hours < 10 ? '0' + hours : hours;
                return span.text(hoursStr + ':' + minuteStr + ':' + secsStr + ' ago');
              }
            }
          }, {
            id: 'pixels',
            name: 'Pixels',
            get: data => data.pixelCount
          }, {
            id: 'pixels_alltime',
            name: 'Alltime Pixels',
            get: data => data.pixelCountAlltime
          }, {
            id: 'discord_name',
            name: 'Discord',
            get: data => data.discordName
          }
        );

        settings.lookup.filter.sensitive.enable.listen(function(value) {
          $('[data-sensitive=true]').css('display', value ? 'none' : '');
        });

        self.elements.lookup.hide();
        self.elements.prompt.hide();
        board.getRenderBoard().on('click', function(evt) {
          if (evt.shiftKey) {
            evt.preventDefault();
            self.runLookup(evt.clientX, evt.clientY);
          }
        });
      },
      registerHandle: function(fn) {
        self.handle = fn;
      },
      clearHandle: function() {
        self.handle = null;
      }
    };
    return {
      init: self.init,
      registerHandle: self.registerHandle,
      registerHook: self.registerHook,
      replaceHook: self.replaceHook,
      unregisterHook: self.unregisterHook,
      runLookup: self.runLookup,
      clearHandle: self.clearHandle
    };
  })();
  const serviceWorkerHelper = (() => {
    const self = {
      isInit: false,
      messageListeners: {},
      hasSupport: 'serviceWorker' in window.navigator,
      init() {
        if (!self.hasSupport) {
          return;
        }

        if (navigator.serviceWorker.controller == null) {
          navigator.serviceWorker.register('/serviceWorker.js')
            .then(() => {
              self.isInit = true;
            })
            .catch((err) => {
              console.error('Failed to register Service Worker:', err);
            });
        } else {
          self.isInit = true;
        }

        navigator.serviceWorker.addEventListener('message', (ev) => {
          if (typeof ev.data !== 'object' || !('type' in ev.data)) {
            console.warn(`${self.tabId}: Received non-data message from ${ev.source.id} (${ev.source.type})`, ev.data);
            return;
          }

          if (ev.data.type in self.messageListeners) {
            for (const cb of self.messageListeners[ev.data.type]) {
              cb(ev);
            }
          }
          if ('*' in self.messageListeners) {
            for (const cb of self.messageListeners['*']) {
              cb(ev);
            }
          }
        });
      },
      addMessageListener(type, callback) {
        const callbacks = self.messageListeners[type] || [];
        if (callbacks.includes(callback)) {
          return;
        }
        callbacks.push(callback);
        self.messageListeners[type] = callbacks;
      },
      removeMessageListener(type, callback) {
        if (!(type in self.messageListeners)) {
          return;
        }

        const callbacks = self.messageListeners[type];
        const idx = callbacks.indexOf(callback);
        if (idx === -1) {
          return;
        }

        callbacks.splice(idx, 1);
      },
      postMessage(data) {
        if (!self.isInit) {
          return;
        }

        navigator.serviceWorker.ready.then(({ installing, waiting, active }) => {
          const worker = navigator.serviceWorker.controller || installing || waiting || active;
          worker.postMessage(data);
        });
      }
    };

    return {
      get hasSupport() {
        return self.hasSupport;
      },
      get readyPromise() {
        return navigator.serviceWorker.ready.then((v) => {
          // fail safe
          self.isInit = true;
          return v;
        });
      },
      init: self.init,
      addMessageListener: self.addMessageListener,
      removeMessageListener: self.removeMessageListener,
      postMessage: self.postMessage
    };
  })();
  const uiHelper = (function() {
    const self = {
      tabId: null,
      _workerIsTabFocused: false,
      _available: -1,
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
        bottomBanner: $('#bottom-banner')
      },
      themes: [
        {
          name: 'Dark',
          location: '/themes/dark.css',
          color: '#1A1A1A'
        },
        {
          name: 'Darker',
          location: '/themes/darker.css',
          color: '#000'
        },
        {
          name: 'Blue',
          location: '/themes/blue.css',
          color: '#0000FF'
        },
        {
          name: 'Purple',
          location: '/themes/purple.css',
          color: '#5a2f71'
        },
        {
          name: 'Green',
          location: '/themes/green.css',
          color: '#005f00'
        },
        {
          name: 'Matte',
          location: '/themes/matte.css',
          color: '#468079'
        },
        {
          name: 'Terminal',
          location: '/themes/terminal.css',
          color: '#94e044'
        },
        {
          name: 'Red',
          location: '/themes/red.css',
          color: '#cf0000'
        }
      ],
      specialChatColorClasses: ['rainbow', ['donator', 'donator--green'], ['donator', 'donator--gray']],
      init: function() {
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
          new SLIDEIN.Slidein(`A new ${data.report_type.toLowerCase()} report has been received.`, 'info-circle').show().closeAfter(3000);
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
            modal.showText('Discord name updated successfully');
          },
          error: function(data) {
            const err = data.responseJSON && data.responseJSON.details ? data.responseJSON.details : data.responseText;
            if (data.status === 200) { // seems to be caused when response body isn't json? just show whatever we can and trust server sent good enough details.
              modal.showText(err);
            } else {
              modal.showText('Couldn\'t change discord name: ' + err);
            }
          }
        });
      },
      updateAudio: function(url) {
        try {
          if (!url) url = 'notify.wav';
          timer.audioElem.src = url;
        } catch (e) {
          modal.showText('Failed to update audio src, using default sound.');
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
        if (typeof prepend !== 'string') prepend = '';
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
      prettifyRange: self.prettifyRange
    };
  })();
  const panels = (function() {
    const self = {
      init: () => {
        Array.from(document.querySelectorAll('.panel-trigger')).forEach(panelTrigger => {
          panelTrigger.addEventListener('click', e => {
            if (!e.target) {
              return console.debug('[PANELS:TRIGGER] No target?');
            }

            const closestTrigger = e.target.closest('.panel-trigger');
            if (closestTrigger) {
              const _panelDescriptor = closestTrigger.dataset.panel;
              if (_panelDescriptor && _panelDescriptor.trim()) {
                const targetPanel = document.querySelector(`.panel[data-panel="${_panelDescriptor.trim()}"]`);
                if (targetPanel) {
                  self._setOpenState(targetPanel, true, true);
                } else {
                  console.debug('[PANELS:TRIGGER] Bad descriptor? Got: %o', _panelDescriptor);
                }
              } else {
                console.debug('[PANELS:TRIGGER] No descriptor? Elem: %o', closestTrigger);
              }
            } else {
              console.debug('[PANELS:TRIGGER] No trigger?');
            }
          });
        });
        Array.from(document.querySelectorAll('.panel-closer')).forEach(panelClose => {
          panelClose.addEventListener('click', e => {
            if (!e.target) {
              return console.debug('[PANELS:CLOSER] No target?');
            }
            const closestPanel = e.target.closest('.panel');
            if (closestPanel) {
              self._setOpenState(closestPanel, false, false);
            } else {
              console.debug('[PANELS:CLOSER] No panel?');
            }
          });
        });
        if (ls.get('seen_initial_info') !== true) {
          ls.set('seen_initial_info', true);
          self._setOpenState('info', true);
        }
      },
      _getPanelElement: (panel) => panel instanceof HTMLElement ? panel : document.querySelector(`.panel[data-panel="${panel}"]`),
      _getPanelTriggerElement: (panel) => {
        panel = self._getPanelElement(panel);
        if (!panel) {
          return null;
        }
        return document.querySelector(`.panel-trigger[data-panel="${panel.dataset.panel}"]`);
      },
      setEnabled: (panel, enabled) => {
        panel = self._getPanelElement(panel);
        if (enabled) {
          delete panel.dataset.disabled;
        } else {
          panel.dataset.disabled = '';
        }

        const panelTrigger = self._getPanelTriggerElement(panel);
        if (panelTrigger) {
          panelTrigger.style.display = enabled ? '' : 'none';
        }
      },
      isEnabled: (panel) => {
        panel = self._getPanelElement(panel);
        return panel && panel.dataset.disabled == null;
      },
      isOpen: panel => {
        panel = self._getPanelElement(panel);
        return panel && self.isEnabled(panel) && panel.classList.contains('open');
      },
      _toggleOpenState: (panel, exclusive = true) => {
        panel = self._getPanelElement(panel);
        if (panel && self.isEnabled(panel)) {
          self._setOpenState(panel, !panel.classList.contains('open'), exclusive);
        }
      },
      _setOpenState: (panel, state, exclusive = true) => {
        state = !!state;

        panel = self._getPanelElement(panel);
        if (panel) {
          const panelDescriptor = panel.dataset.panel;
          const panelPosition = panel.classList.contains('right') ? 'right' : 'left';

          if (state) {
            if (exclusive) {
              document.querySelectorAll(`.panel[data-panel].${panelPosition}.open`).forEach(x => {
                x.classList.remove('open');
                $(window).trigger('pxls:panel:closed', x.dataset.panel);
              });
            }
            $(window).trigger('pxls:panel:opened', panelDescriptor);
            document.body.classList.toggle('panel-open', true);
            document.body.classList.toggle(`panel-${panelPosition}`, true);
          } else {
            $(window).trigger('pxls:panel:closed', panelDescriptor);
            document.body.classList.toggle('panel-open', document.querySelectorAll('.panel.open').length - 1 > 0);
            document.body.classList.toggle(`panel-${panelPosition}`, false);
          }
          panel.classList.toggle('open', state);

          document.body.classList.toggle(`panel-${panelPosition}-halfwidth`, $(`.panel[data-panel].${panelPosition}.open.half-width`).length > 0);
          document.body.classList.toggle(`panel-${panelPosition}-horizontal`, $(`.panel[data-panel].${panelPosition}.open.horizontal`).length > 0);
        }
      }
    };
    return {
      init: self.init,
      open: panel => self._setOpenState(panel, true),
      close: panel => self._setOpenState(panel, false),
      toggle: (panel, exclusive = true) => self._toggleOpenState(panel, exclusive),
      isOpen: self.isOpen,
      setEnabled: self.setEnabled,
      isEnabled: self.isEnabled
    };
  })();
  const chat = (function() {
    const self = {
      seenHistory: false,
      stickToBottom: true,
      repositionTimer: false,
      pings: 0,
      pingsList: [],
      pingAudio: new Audio('chatnotify.wav'),
      lastPingAudioTimestamp: 0,
      last_opened_panel: ls.get('chat.last_opened_panel') >> 0,
      idLog: [],
      typeahead: {
        helper: null,
        suggesting: false,
        hasResults: false,
        highlightedIndex: 0,
        lastLength: false,
        get shouldInsert() {
          return self.typeahead.suggesting && self.typeahead.hasResults && self.typeahead.highlightedIndex !== -1;
        }
      },
      ignored: [],
      chatban: {
        banned: false,
        banStart: 0,
        banEnd: 0,
        permanent: false,
        banEndFormatted: '',
        timeLeft: 0,
        timer: 0
      },
      timeout: {
        ends: 0,
        timer: 0
      },
      elements: {
        message_icon: $('#message-icon'),
        panel_trigger: $('.panel-trigger[data-panel=chat]'),
        ping_counter: $('#ping-counter'),
        input: $('#txtChatContent'),
        body: $('#chat-body'),
        rate_limit_overlay: $('.chat-ratelimit-overlay'),
        rate_limit_counter: $('#chat-ratelimit'),
        chat_panel: $('.panel[data-panel=chat]'),
        chat_hint: $('#chat-hint'),
        chat_settings_button: $('#btnChatSettings'),
        pings_button: $('#btnPings'),
        jump_button: $('#jump-to-bottom'),
        emoji_button: $('#emojiPanelTrigger'),
        typeahead: $('#typeahead'),
        typeahead_list: $('#typeahead ul'),
        ping_audio_volume_value: $('#chat-pings-audio-volume-value'),
        username_color_select: $('#selChatUsernameColor'),
        username_color_feedback_label: $('#lblChatUsernameColorFeedback'),
        user_ignore_select: $('#selChatUserIgnore'),
        user_unignore_button: $('#btnChatUserUnignore'),
        user_ignore_feedback_label: $('#lblChatUserIgnoreFeedback')
      },
      picker: null,
      markdownProcessor: null,
      TEMPLATE_ACTIONS: {
        ASK: {
          id: 'ask',
          pretty: 'Ask'
        },
        NEW_TAB: {
          id: 'new tab',
          pretty: 'Open in a new tab'
        },
        CURRENT_TAB: {
          id: 'current tab',
          pretty: 'Open in current tab (replacing template)'
        },
        JUMP_ONLY: {
          id: 'jump only',
          pretty: 'Jump to coordinates without replacing template'
        }
      },
      init: () => {
        // NOTE(netux): The processor is deriverately left unfrozen to allow for extending
        // it through third party extensions.
        self.markdownProcessor = uiHelper.makeMarkdownProcessor()
          .use(function() {
            this.Compiler.prototype.visitors.link = (node, next) => {
              const url = new URL(node.url, location.href);

              const hashParams = new URLSearchParams(url.hash.substr(1));
              const getParam = (name) => hashParams.has(name) ? hashParams.get(name) : url.searchParams.get(name);

              const coordsX = parseFloat(getParam('x'));
              const coordsY = parseFloat(getParam('y'));

              const isSameOrigin = location.origin && url.origin && location.origin === url.origin;
              if (isSameOrigin && !isNaN(coordsX) && !isNaN(coordsY) && board.validateCoordinates(coordsX, coordsY)) {
                const scale = parseFloat(getParam('scale'));
                return self._makeCoordinatesElement(url.toString(), coordsX, coordsY, isNaN(scale) ? 20 : scale, getParam('template'), getParam('title'));
              } else {
                return crel('a', { href: node.url, target: '_blank' }, next());
              }
            };

            this.Compiler.prototype.visitors.coordinate =
              (node, next) => self._makeCoordinatesElement(node.url, node.x, node.y, node.scale);
          });

        self.reloadIgnores();
        socket.on('chat_user_update', e => {
          if (e.who && e.updates && typeof (e.updates) === 'object') {
            for (const update of Object.entries(e.updates)) {
              switch (update[0]) {
                case 'NameColor': {
                  self._updateAuthorNameColor(e.who, Math.floor(update[1]));
                  break;
                }
                case 'DisplayedFaction': {
                  self._updateAuthorDisplayedFaction(e.who, update[1]);
                  break;
                }
                default: {
                  console.warn('Got an unknown chat_user_update from %o: %o (%o)', e.who, update, e);
                  break;
                }
              }
            }
          } else console.warn('Malformed chat_user_update: %o', e);
        });
        socket.on('faction_update', e => self._updateFaction(e.faction));
        socket.on('faction_clear', e => self._clearFaction(e.fid));
        socket.on('chat_history', e => {
          if (self.seenHistory) return;
          for (const packet of e.messages.reverse()) {
            self._process(packet, true);
          }
          const last = self.elements.body.find('li[data-id]').last()[0];
          if (last) {
            self._doScroll(last);
            if (last.dataset.id && last.dataset.id > ls.get('chat-last_seen_id')) {
              self.elements.message_icon.addClass('has-notification');
            }
          }
          self.seenHistory = true;
          self.addServerAction('History loaded at ' + moment().format('MMM Do YYYY, hh:mm:ss A'));
          setTimeout(() => socket.send({ type: 'ChatbanState' }), 0);
        });
        socket.on('chat_message', e => {
          self._process(e.message);
          const isChatOpen = panels.isOpen('chat');
          if (!isChatOpen) {
            self.elements.message_icon.addClass('has-notification');
          }
          if (self.stickToBottom) {
            const chatLine = self.elements.body.find(`[data-id="${e.message.id}"]`)[0];
            if (chatLine) {
              if (isChatOpen && uiHelper.tabHasFocus()) {
                ls.set('chat-last_seen_id', e.message.id);
              }
              self._doScroll(chatLine);
            }
          }
        });
        serviceWorkerHelper.addMessageListener('focus', ({ data }) => {
          if (uiHelper.tabId === data.id && panels.isOpen('chat')) {
            const chatLine = self.elements.body.find('.chat-line[data-id]').last()[0];
            if (chatLine) {
              ls.set('chat-last_seen_id', chatLine.dataset.id);
            }
          }
        });
        socket.on('message_cooldown', e => {
          self.timeout.ends = (new Date() >> 0) + ((e.diff >> 0) * 1e3) + 1e3; // add 1 second so that we're 1-based instead of 0-based
          if (uiHelper.tabHasFocus()) {
            self.elements.input.val(e.message);
          }
          if ((new Date() >> 0) > self.timeout.ends) {
            self.elements.rate_limit_overlay.fadeOut();
          } else {
            self.elements.rate_limit_overlay.fadeIn();
          }
          if (self.timeout.timer > 0) clearInterval(self.timeout.timer);
          self.timeout.timer = setInterval(() => {
            const delta = (self.timeout.ends - (new Date() >> 0)) / 1e3 >> 0;
            self.elements.rate_limit_counter.text(`${delta}s`);
            if (delta <= 0) {
              self.elements.rate_limit_overlay.fadeOut();
              self.elements.rate_limit_counter.text('');
              clearInterval(self.timeout.timer);
              self.timeout.timer = 0;
            }
          }, 100);
        });
        socket.on('chat_lookup', e => {
          if (e.target && Array.isArray(e.history) && Array.isArray(e.chatbans)) {
            // const now = moment();
            const is24h = settings.chat.timestamps['24h'].get() === true;
            const shortFormat = `MMM Do YYYY, ${is24h ? 'HH:mm' : 'hh:mm A'}`;
            const longFormat = `dddd, MMMM Do YYYY, ${is24h ? 'HH:mm:ss' : 'h:mm:ss a'}`;
            const dom = crel('div', { class: 'halves' },
              crel('div', { class: 'side chat-lookup-side' },
                e.history.length > 0 ? ([ // array children are injected as fragments
                  crel('h3', { style: 'text-align: center' }, `Last ${e.history.length} messages`),
                  crel('hr'),
                  crel('ul', { class: 'chat-history chat-body' },
                    e.history.map(message => crel('li', { class: `chat-line ${message.purged ? 'purged' : ''}`.trimRight() },
                      crel('span', { title: moment(message.sent * 1e3).format(longFormat) }, moment(message.sent * 1e3).format(shortFormat)),
                      ' ',
                      (() => {
                        const toRet = crel('span', { class: 'user' }, e.target.username);
                        uiHelper.styleElemWithChatNameColor(toRet, e.target.chatNameColor, 'color');
                        return toRet;
                      })(),
                      ': ',
                      crel('span', { class: 'content' }, message.content)
                    ))
                  )
                ]) : ([
                  crel('h3', { style: 'text-align: center' }, 'Last Messages'),
                  crel('hr'),
                  crel('p', 'No message history')
                ])
              ),
              crel('div', { class: 'side chat-lookup-side' },
                crel('h3', { style: 'text-align: center' }, 'Chat Bans'),
                crel('hr'),
                crel('ul', { class: 'chatban-history' },
                  e.chatbans.map(chatban => {
                    return crel('li',
                      crel('article', { class: 'chatban' },
                        crel('header',
                          crel('h4', `${chatban.initiator_name} ${chatban.type === 'UNBAN' ? 'un' : ''}banned ${e.target.username}${chatban.type !== 'PERMA' ? '' : ''}`)
                        ),
                        crel('div',
                          crel('table',
                            crel('tbody',
                              crel('tr',
                                crel('th', 'Reason:'),
                                crel('td', chatban.reason || '$No reason provided$')
                              ),
                              crel('tr',
                                crel('th', 'When:'),
                                crel('td', moment(chatban.when * 1e3).format(longFormat))
                              ),
                              chatban.type !== 'UNBAN' ? ([
                                crel('tr',
                                  crel('th', 'Length:'),
                                  crel('td', (chatban.type.toUpperCase().trim() === 'PERMA') ? 'Permanent' : `${chatban.expiry - chatban.when}s${(chatban.expiry - chatban.when) >= 60 ? ` (${moment.duration(chatban.expiry - chatban.when, 'seconds').humanize()})` : ''}`)
                                ),
                                (chatban.type.toUpperCase().trim() === 'PERMA') ? null : crel('tr',
                                  crel('th', 'Expiry:'),
                                  crel('td', moment(chatban.expiry * 1e3).format(longFormat))
                                ),
                                crel('tr',
                                  crel('th', 'Purged:'),
                                  crel('td', String(chatban.purged))
                                )
                              ]) : null
                            )
                          )
                        )
                      )
                    );
                  })
                )
              )
            );
            modal.show(modal.buildDom(
              crel('h2', { class: 'modal-title' }, 'Chat Lookup'),
              dom
            ));
          }
        });
        const handleChatban = e => {
          clearInterval(self.timeout.timer);
          self.chatban.banStart = moment.now();
          self.chatban.banEnd = moment(e.expiry);
          self.chatban.permanent = e.permanent;
          self.chatban.banEndFormatted = self.chatban.banEnd.format('MMM Do YYYY, hh:mm:ss A');
          setTimeout(() => {
            clearInterval(self.chatban.timer);
            self.elements.input.prop('disabled', true);
            self.elements.emoji_button.hide();
            if (e.expiry - self.chatban.banStart > 0 && !e.permanent) {
              self.chatban.banned = true;
              self.elements.rate_limit_counter.text('You have been banned from chat.');
              self.addServerAction(`You are banned ${e.permanent ? 'permanently from chat.' : 'until ' + self.chatban.banEndFormatted}`);
              if (e.reason) {
                self.addServerAction(`Ban reason: ${e.reason}`);
              }
              self.chatban.timer = setInterval(() => {
                const timeLeft = self.chatban.banEnd - moment();
                if (timeLeft > 0) {
                  self.elements.rate_limit_overlay.show();
                  self.elements.rate_limit_counter.text(`Chatban expires in ${Math.ceil(timeLeft / 1e3)}s, at ${self.chatban.banEndFormatted}`);
                } else {
                  self.elements.rate_limit_overlay.hide();
                  self.elements.rate_limit_counter.text('');
                  self.elements.emoji_button.show();
                  self._handleChatbanVisualState(true);
                }
              }, 150);
            } else if (e.permanent) {
              self.chatban.banned = true;
              self.elements.rate_limit_counter.text('You have been banned from chat.');
              self.addServerAction(`You are banned from chat${e.permanent ? ' permanently.' : 'until ' + self.chatban.banEndFormatted}`);
              if (e.reason) {
                self.addServerAction(`Ban reason: ${e.reason}`);
              }
            } else if (e.type !== 'chat_ban_state') { // chat_ban_state is a query result, not an action notice.
              self.addServerAction('You have been unbanned from chat.');
              self.elements.rate_limit_counter.text('You cannot use chat while canvas banned.');
              self.chatban.banned = false;
            }
            self._handleChatbanVisualState(self._canChat());
          }, 0);
        };
        socket.on('chat_ban', handleChatban);
        socket.on('chat_ban_state', handleChatban);

        const _doPurge = (elem, e) => {
          if (user.hasPermission('chat.history.purged')) {
            self._markMessagePurged(elem, e);
          } else {
            elem.remove();
          }
        };
        socket.on('chat_purge', e => {
          const lines = Array.from(self.elements.body[0].querySelectorAll(`.chat-line[data-author="${e.target}"]`));
          if (Array.isArray(lines) && lines.length) {
            lines.sort((a, b) => (a.dataset.date >> 0) - (b.dataset.date >> 0));
            for (let i = 0; i < e.amount; i++) {
              const line = lines.pop();
              if (line) {
                _doPurge(line, e);
              } else {
                break;
              }
            }
          } else console.warn(lines, 'was not an array-like, or was empty.');
          if (e.amount >= 2147483647) {
            self.addServerAction(`${e.initiator} purged all messages from ${e.target}.`);
          } else {
            self.addServerAction(`${e.amount} message${e.amount !== 1 ? 's' : ''} from ${e.target} ${e.amount !== 1 ? 'were' : 'was'} purged by ${e.initiator}.`);
          }
        });
        socket.on('chat_purge_specific', e => {
          const lines = [];
          if (e.IDs && e.IDs.length) {
            e.IDs.forEach(x => {
              const line = self.elements.body.find(`.chat-line[data-id="${x}"]`)[0];
              if (line) lines.push(line);
            });
          }
          if (lines.length) {
            lines.forEach(x => _doPurge(x, e));
            self.addServerAction(`${e.IDs.length} message${e.IDs.length !== 1 ? 's' : ''} from ${e.target} ${e.IDs.length !== 1 ? 'were' : 'was'} purged by ${e.initiator}`);
          }
        });

        socket.send({ type: 'ChatHistory' });

        self.elements.rate_limit_overlay.hide();

        self.elements.input.on('keydown', e => {
          e.stopPropagation();
          const toSend = self.elements.input[0].value;
          const trimmed = toSend.trim();
          if ((e.originalEvent.key === 'Enter' || e.originalEvent.which === 13) && !e.shiftKey) {
            e.preventDefault();

            if (trimmed.length === 0) {
              return;
            }

            if (self.timeout.timer) {
              return;
            }

            if (!self.typeahead.shouldInsert) {
              self.typeahead.lastLength = -1;
              self._send(trimmed);
              self.elements.input.val('');
            }
          } else if (e.originalEvent.key === 'Tab' || e.originalEvent.which === 9) {
            e.stopPropagation();
            e.preventDefault();
          }
        }).on('focus', e => {
          if (self.stickToBottom) {
            setTimeout(self.scrollToBottom, 300);
          }
        });

        $(window).on('pxls:chat:userIgnored', (e, who) => {
          Array.from(document.querySelectorAll(`.chat-line[data-author="${who}"]`)).forEach(x => x.remove());
        });

        $(window).on('pxls:panel:opened', (e, which) => {
          if (which === 'chat') {
            ls.set('chat.last_opened_panel', new Date() / 1e3 >> 0);
            self.clearPings();
            const lastN = self.elements.body.find('[data-id]').last()[0];
            if (lastN) {
              ls.set('chat-last_seen_id', lastN.dataset.id);
            }

            if (user.isLoggedIn()) {
              self._handleChatbanVisualState(self._canChat());
            } else {
              self._handleChatbanVisualState(false);
              self.elements.rate_limit_counter.text('You must be logged in to chat');
            }
          }
        });

        window.addEventListener('storage', (ev) => {
          // value updated on another tab
          if (ev.storageArea === window.localStorage && ev.key === 'chat-last_seen_id') {
            const isLastChild = self.elements.body.find(`[data-id="${JSON.parse(ev.newValue)}"]`).is(':last-child');
            if (isLastChild) {
              self.clearPings();
            }
          }
        });

        $(window).on('pxls:user:loginState', (e, isLoggedIn) => {
          self.updateInputLoginState(isLoggedIn);

          self.elements.username_color_select.disabled = isLoggedIn;
          if (isLoggedIn) {
            // add role-gated colors
            self._populateUsernameColor();
            uiHelper.styleElemWithChatNameColor(self.elements.username_color_select[0], user.getChatNameColor());
          }
        });

        $(window).on('mouseup', e => {
          let target = e.target;
          const popup = document.querySelector('.popup');
          if (!popup) return;
          if (e.originalEvent && e.originalEvent.target) { target = e.originalEvent.target; }

          if (target) {
            const closestPopup = target.closest('.popup');
            closestPopup || popup.remove();
          }
        });

        $(window).on('resize', e => {
          const popup = document.querySelector('.popup[data-popup-for]');
          if (!popup) return;
          const cog = document.querySelector(`.chat-line[data-id="${popup.dataset.popupFor}"] [data-action="actions-panel"]`);
          if (!cog) return console.warn('no cog');

          if (self.repositionTimer) clearTimeout(self.repositionTimer);
          self.repositionTimer = setTimeout(() => {
            self._positionPopupRelativeToX(popup, cog);
            self.repositionTimer = false;
          }, 25);
        });

        self.elements.body[0].addEventListener('wheel', e => {
          const popup = document.querySelector('.popup');
          if (popup) popup.remove();
        });

        self.elements.chat_settings_button[0].addEventListener('click', () => {
          settings.filter.search('Chat');
          panels.toggle('settings');
        });

        self.elements.pings_button[0].addEventListener('click', function() {
          const closeHandler = function() {
            if (this && this.closest) {
              const toClose = this.closest('.popup');
              if (toClose) toClose.remove();
            }
          };

          const popupWrapper = crel('div', { class: 'popup panel' });
          const panelHeader = crel('header', { class: 'panel-header' },
            crel('button', { class: 'left panel-closer' }, crel('i', {
              class: 'fas fa-times',
              onclick: closeHandler
            })),
            crel('h2', 'Pings'),
            crel('div', { class: 'right' })
          );
          // const mainPanel = crel('div', { class: 'pane' });

          const pingsList = crel('ul', { class: 'pings-list' }, self.pingsList.map(packet => {
            const _processed = crel('span', self.processMessage(packet.message_raw));
            return crel('li', { title: _processed.textContent }, crel('i', {
              class: 'fas fa-external-link-alt fa-is-left',
              style: 'font-size: .65rem; cursor: pointer;',
              'data-id': packet.id,
              onclick: self._handlePingJumpClick
            }), `${board.snipMode ? '-snip-' : packet.author}: `, _processed);
          }));
          const popup = crel(popupWrapper, panelHeader, crel('div', { class: 'pane pane-full' }, pingsList));
          document.body.appendChild(popup);
          self._positionPopupRelativeToX(popup, this);
          pingsList.scrollTop = pingsList.scrollHeight;
        });

        self.elements.jump_button[0].addEventListener('click', self.scrollToBottom);

        const notifBody = document.querySelector('.panel[data-panel="notifications"] .panel-body');

        self.elements.body.css('font-size', `${settings.chat.font.size.get() >> 0 || 16}px`);
        notifBody.style.fontSize = `${settings.chat.font.size.get() >> 0 || 16}px`;

        self.elements.body.on('scroll', e => {
          self.updateStickToBottom();
          if (self.stickToBottom && self.elements.chat_panel[0].classList.contains('open')) {
            self.clearPings();
          }
          self.elements.jump_button[0].style.display = self.stickToBottom ? 'none' : 'block';
        });

        // settings
        settings.chat.font.size.listen(function(value) {
          if (isNaN(value)) {
            modal.showText('Invalid chat font size. Expected a number between 1 and 72.');
            settings.chat.font.size.set(16);
          } else {
            const val = value >> 0;
            if (val < 1 || val > 72) {
              modal.showText('Invalid chat font size. Expected a number between 1 and 72.');
              settings.chat.font.size.set(16);
            } else {
              self.elements.body.css('font-size', `${val}px`);
              document.querySelector('.panel[data-panel="notifications"] .panel-body').style.fontSize = `${val}px`;
            }
          }
        });

        settings.chat.truncate.max.listen(function(value) {
          if (isNaN(value)) {
            modal.showText('Invalid maximum chat messages. Expected a number greater than 50.');
            settings.chat.truncate.max.set(50);
          } else {
            const val = value >> 0;
            if (val < 50) {
              modal.showText('Invalid maximum chat messages. Expected a number greater than 50.');
              settings.chat.truncate.max.set(50);
            }
          }
        });

        settings.chat.pings.audio.volume.listen(function(value) {
          const parsed = parseFloat(value);
          const volume = isNaN(parsed) ? 1 : parsed;
          self.elements.ping_audio_volume_value.text(`${volume * 100 >> 0}%`);
        });

        settings.chat.badges.enable.listen(function() {
          self._toggleTextIconFlairs();
        });

        settings.chat.factiontags.enable.listen(function() {
          self._toggleFactionTagFlairs();
        });

        const selSettingChatLinksInternalBehavior = $('#setting-chat-links-internal-behavior');
        selSettingChatLinksInternalBehavior.append(
          Object.values(self.TEMPLATE_ACTIONS).map(action =>
            crel('option', { value: action.id }, action.pretty)
          )
        );
        settings.chat.links.internal.behavior.controls.add(selSettingChatLinksInternalBehavior);

        self.elements.username_color_select.disabled = true;

        self.elements.user_ignore_select.append(
          self.getIgnores().sort((a, b) => a.toLocaleLowerCase().localeCompare(b.toLocaleLowerCase())).map(x =>
            crel('option', { value: x }, x)
          )
        );

        self.elements.user_unignore_button.on('click', function() {
          if (self.removeIgnore(self.elements.user_ignore_select.val())) {
            self.elements.user_ignore_select.find(`option[value="${self.elements.user_ignore_select.val()}"]`).remove();
            self.elements.user_ignore_feedback_label.text('User unignored.');
            self.elements.user_ignore_feedback_label.css('color', 'var(--text-red-color)');
            self.elements.user_ignore_feedback_label.css('display', 'block');
            setTimeout(() => self.elements.user_ignore_feedback_label.fadeOut(500), 3000);
          } else if (self.ignored.length === 0) {
            self.elements.user_ignore_feedback_label.text('You haven\'t ignored any users. Congratulations!');
            self.elements.user_ignore_feedback_label.css('color', 'var(--text-red-color)');
            self.elements.user_ignore_feedback_label.css('display', 'block');
            setTimeout(() => self.elements.user_ignore_feedback_label.fadeOut(500), 3000);
          } else {
            self.elements.user_ignore_feedback_label.text('Failed to unignore user. Either they weren\'t actually ignored, or an error occurred. Contact a developer if the problem persists.');
            self.elements.user_ignore_feedback_label.css('color', 'var(--text-red-color)');
            self.elements.user_ignore_feedback_label.css('display', 'block');
            setTimeout(() => self.elements.user_ignore_feedback_label.fadeOut(500), 5000);
          }
        });
      },
      disable: () => {
        panels.setEnabled('chat', false);
        self.elements.username_color_select.attr('disabled', '');
      },
      _handleChatbanVisualState(canChat) {
        if (canChat) {
          self.elements.input.prop('disabled', false);
          self.elements.rate_limit_overlay.hide();
          self.elements.rate_limit_counter.text('');
          self.elements.emoji_button.show();
        } else {
          self.elements.input.prop('disabled', true);
          self.elements.rate_limit_overlay.show();
          self.elements.emoji_button.hide();
        }
      },
      webinit(data) {
        self.setCharLimit(data.chatCharacterLimit);
        self.canvasBanRespected = data.chatRespectsCanvasBan;
        self._populateUsernameColor();
        self.elements.username_color_select.value = user.getChatNameColor();
        self.elements.username_color_select.on('change', function() {
          self.elements.username_color_select.disabled = true;

          const color = this.value >> 0;
          $.post({
            type: 'POST',
            url: '/chat/setColor',
            data: {
              color
            },
            success: () => {
              user.setChatNameColor(color);
              self.updateSelectedNameColor(color);
              self.elements.username_color_feedback_label.innerText = 'Color updated';
            },
            error: (data) => {
              const err = data.responseJSON && data.responseJSON.details ? data.responseJSON.details : data.responseText;
              if (data.status === 200) {
                self.elements.username_color_feedback_label.innerText = err;
              } else {
                self.elements.username_color_feedback_label.innerText = 'Couldn\'t change chat color: ' + err;
              }
            },
            complete: () => {
              self.elements.username_color_select.value = user.getChatNameColor();
              self.elements.username_color_select.disabled = false;
            }
          });
        });

        if (data.chatEnabled) {
          self.customEmoji = data.customEmoji.map(({ name, emoji }) => ({ name, emoji: `./emoji/${emoji}` }));
          self.initEmojiPicker();
          self.initTypeahead();
        } else {
          self.disable();
        }
      },
      initTypeahead() {
        // init DBs
        const dbEmojis = new TH.Database('emoji', {}, false, false, (x) => (twemoji.test(x.value)) ? x.value : ':' + x.key + ':', (x) => (twemoji.test(x.value)) ? `${twemoji.parse(x.value)} :${x.key}:` : `${'<img class="emoji emoji--custom" draggable="false" alt="' + x.key + '" src="' + x.value + '"/>'} :${x.key}:`);
        const dbUsers = new TH.Database('users', {}, false, false, (x) => `@${x.value} `, (x) => `@${x.value}`);

        // add emoji to emoji DB
        if (window.emojiDB) {
          Object.keys(window.emojiDB)
            .sort((a, b) => a.toLocaleLowerCase().localeCompare(b.toLocaleLowerCase()))
            .forEach(name => {
              dbEmojis.addEntry(name, window.emojiDB[name]);
            });
        }
        if (self.customEmoji.length > 0) {
          self.customEmoji.forEach(function (emoji) {
            window.emojiDB[emoji.name.toLowerCase()] = emoji.emoji;
            dbEmojis.addEntry(emoji.name, emoji.emoji);
          });
        }

        // init triggers
        const triggerEmoji = new TH.Trigger(':', 'emoji', true, 2);
        const triggerUsers = new TH.Trigger('@', 'users', false);

        // init typeahead
        self.typeahead.helper = new TH.Typeahead([triggerEmoji, triggerUsers], [' '], [dbEmojis, dbUsers]);
        window.th = self.typeahead.helper;

        // attach events
        self.elements.typeahead[0].querySelectorAll('[data-dismiss="typeahead"]').forEach(x => x.addEventListener('click', () => {
          self.resetTypeahead();
          self.elements.input[0].focus();
        }));
        self.elements.input[0].addEventListener('click', () => scan());
        self.elements.input[0].addEventListener('keyup', function(event) {
          switch (event.key || event.code || event.which || event.charCode) {
            case 'Escape':
            case 27: {
              if (self.typeahead.suggesting) {
                event.preventDefault();
                event.stopPropagation();
                event.stopImmediatePropagation();

                self.resetTypeahead();
              }
              break;
            }
            case 'Tab':
            case 9: {
              if (self.typeahead.suggesting) {
                event.preventDefault();
                event.stopPropagation();
                event.stopImmediatePropagation();

                self.selectNextTypeaheadEntry(event.shiftKey ? -1 : 1); // if we're holding shift, walk backwards (up).
                return;
              } else {
                scan();
              }
              break;
            }
            case 'ArrowUp':
            case 38: {
              if (self.typeahead.suggesting) {
                event.preventDefault();
                event.stopPropagation();
                event.stopImmediatePropagation();
                self.selectNextTypeaheadEntry(-1);
                return;
              }
              break;
            }
            case 'ArrowDown':
            case 40: {
              if (self.typeahead.suggesting) {
                event.preventDefault();
                event.stopPropagation();
                event.stopImmediatePropagation();
                self.selectNextTypeaheadEntry(1);
                return;
              }
              break;
            }
            case 'Enter':
            case 13: {
              if (self.typeahead.shouldInsert) {
                event.preventDefault();
                event.stopPropagation();
                event.stopImmediatePropagation();
                const selected = self.elements.typeahead_list[0].querySelector('button[data-insert].active');
                if (selected) {
                  self._handleTypeaheadInsert(selected);
                } else {
                  const topResult = self.elements.typeahead_list[0].querySelector('li:first-child > button[data-insert]');
                  if (topResult) {
                    self._handleTypeaheadInsert(topResult);
                  }
                }
                return;
              }
              break;
            }
          }
          // stops it from scanning when we keyup with shift or some other control character.
          if (self.elements.input[0].value.length !== self.typeahead.lastLength) { scan(); }
        });

        function scan() {
          const scanRes = self.typeahead.helper.scan(self.elements.input[0].selectionStart, self.elements.input[0].value);
          let got = false;
          self.typeahead.lastLength = self.elements.input[0].value.length;
          self.typeahead.suggesting = scanRes !== false;
          if (scanRes) {
            got = self.typeahead.helper.suggestions(scanRes);
            self.typeahead.hasResults = got.length > 0;
            if (!got.length) {
              self.elements.typeahead_list[0].innerHTML = '<li class="no-results">No Results</li>'; // no reason to crel this if we're just gonna innerHTML anyway.
            } else {
              self.elements.typeahead_list[0].innerHTML = '';
              const db = self.typeahead.helper.getDatabase(scanRes.trigger.dbType);

              const LIs = got.slice(0, 50).map(x => {
                const el = crel('button', {
                  'data-insert': db.inserter(x),
                  'data-start': scanRes.start,
                  'data-end': scanRes.end,
                  onclick: self._handleTypeaheadInsert
                });
                el.innerHTML = db.renderer(x);
                return crel('li', el);
              });
              LIs[0].classList.add('active');
              crel(self.elements.typeahead_list[0], LIs);
            }
          }
          self.elements.typeahead[0].style.display = self.typeahead.suggesting && self.typeahead.hasResults ? 'block' : 'none';
          document.body.classList.toggle('typeahead-open', self.typeahead.suggesting);
        }
      },
      _handleTypeaheadInsert: function(elem) {
        if (this instanceof HTMLElement) elem = this;
        else if (!(elem instanceof HTMLElement)) return console.warn('Got non-elem on handleTypeaheadInsert: %o', elem);
        const start = parseInt(elem.dataset.start);
        const end = parseInt(elem.dataset.end);
        const toInsert = elem.dataset.insert || '';
        if (!toInsert || start >= end) {
          return console.warn('Got invalid data on elem %o.');
        }
        self.elements.input[0].value = self.elements.input[0].value.substring(0, start) + toInsert + self.elements.input[0].value.substring(end);
        self.elements.input[0].focus();
        self.resetTypeahead();
      },
      selectNextTypeaheadEntry(direction) {
        let nextIndex = self.typeahead.highlightedIndex + direction;
        const children = self.elements.typeahead_list[0].querySelectorAll('button[data-insert]');
        if (direction < 0 && nextIndex < 0) { // if we're walking backwards, we need to check for underflow.
          nextIndex = children.length - 1;
        } else if (direction > 0 && nextIndex >= children.length) { // if we're walking forwards, we need to check for overflow.
          nextIndex = 0;
        }
        const lastSelected = children[self.typeahead.highlightedIndex === -1 ? nextIndex : self.typeahead.highlightedIndex];
        if (lastSelected) {
          lastSelected.classList.remove('active');
        }
        children[nextIndex].classList.add('active');
        children[nextIndex].scrollIntoView();
        self.typeahead.highlightedIndex = nextIndex;
      },
      resetTypeahead: () => { // close with reset
        self.typeahead.suggesting = false;
        self.typeahead.hasResults = false;
        self.typeahead.highlightedIndex = 0;
        self.elements.typeahead[0].style.display = 'none';
        self.elements.typeahead_list[0].innerHTML = '';
        document.body.classList.remove('typeahead-open');
      },
      initEmojiPicker() {
        const pickerOptions = {
          position: 'left-start',
          style: 'twemoji',
          zIndex: 30,
          emojiVersion: '13.0'
        };
        if (self.customEmoji.length > 0) pickerOptions.custom = self.customEmoji;
        self.picker = new EmojiButton.EmojiButton(pickerOptions);
        self.picker.on('emoji', emojiObj => {
          if (emojiObj.custom) {
            self.elements.input[0].value += ':' + emojiObj.name + ':';
            self.elements.input[0].focus();
          } else {
            self.elements.input[0].value += emojiObj.emoji;
            self.elements.input[0].focus();
          }
        });
        self.elements.emoji_button.on('click', function() {
          self.picker.pickerVisible ? self.picker.hidePicker() : self.picker.showPicker(this);
          const searchEl = self.picker.pickerEl.querySelector('.emoji-picker__search'); // searchEl is destroyed every time the picker closes. have to re-attach
          if (searchEl) {
            searchEl.addEventListener('keydown', e => e.stopPropagation());
          }
        });
      },
      reloadIgnores: () => { self.ignored = (ls.get('chat.ignored') || '').split(','); },
      saveIgnores: () => ls.set('chat.ignored', (self.ignored || []).join(',')),
      addIgnore: name => {
        if (name.toLowerCase().trim() !== user.getUsername().toLowerCase().trim() && !self.ignored.includes(name)) {
          self.ignored.push(name);
          self.saveIgnores();
          $(window).trigger('pxls:chat:userIgnored', name);
          self.elements.user_ignore_select.append(crel('option', { value: name }, name));
          return true;
        }
        return false;
      },
      removeIgnore: name => {
        const index = self.ignored.indexOf(name);
        if (index >= 0) {
          const spliced = self.ignored.splice(index, 1);
          self.saveIgnores();
          $(window).trigger('pxls:chat:userUnignored', spliced && spliced[0] ? spliced[0] : false);
          self.elements.user_ignore_select.find(`option[value="${name}"]`).remove();
          return spliced && spliced[0];
        }
        return false;
      },
      getIgnores: () => [].concat(self.ignored || []),
      updateStickToBottom() {
        const obj = self.elements.body[0];
        self.stickToBottom = self._numWithinDrift(obj.scrollTop >> 0, obj.scrollHeight - obj.offsetHeight, 2);
      },
      _handlePingJumpClick: function() { // must be es5 for expected behavior. don't upgrade syntax, this is attached as an onclick and we need `this` to be bound by dom bubbles.
        if (this && this.dataset && this.dataset.id) {
          self.scrollToCMID(this.dataset.id);
        }
      },
      scrollToCMID(cmid) {
        const elem = self.elements.body[0].querySelector(`.chat-line[data-id="${cmid}"]`);
        if (elem) {
          self._doScroll(elem);
          const ripAnim = function() {
            elem.removeEventListener('animationend', ripAnim);
            elem.classList.remove('-scrolled-to');
          };
          elem.addEventListener('animationend', ripAnim);
          elem.classList.add('-scrolled-to');
        }
      },
      scrollToBottom() {
        self.elements.body[0].scrollTop = self.elements.body[0].scrollHeight;
        self.stickToBottom = true;
      },
      setCharLimit(num) {
        self.elements.input.prop('maxlength', num);
      },
      isChatBanned: () => {
        return self.chatban.permanent || (self.chatban.banEnd - moment.now() > 0);
      },
      updateInputLoginState: (isLoggedIn) => {
        const isChatBanned = self.isChatBanned();

        if (isLoggedIn && !isChatBanned) {
          self.elements.input.prop('disabled', false);
          self.elements.rate_limit_overlay.hide();
          self.elements.rate_limit_counter.text('');
          self.elements.emoji_button.show();
        } else {
          self.elements.input.prop('disabled', true);
          self.elements.rate_limit_overlay.show();
          if (!isChatBanned) {
            self.elements.rate_limit_counter.text('You must be logged in to chat.');
          }
          self.elements.emoji_button.hide();
        }
      },
      clearPings: () => {
        self.elements.message_icon.removeClass('has-notification');
        self.elements.panel_trigger.removeClass('has-ping');
        self.elements.pings_button.removeClass('has-notification');
        self.pings = 0;
      },
      _numWithinDrift(needle, haystack, drift) {
        return needle >= (haystack - drift) && needle <= (haystack + drift);
      },
      showHint: (msg, isError = false) => {
        self.elements.chat_hint.toggleClass('text-red', isError === true).text(msg);
      },
      addServerAction: msg => {
        const when = moment();
        const toAppend =
            crel('li', { class: 'chat-line server-action' },
              crel('span', { title: when.format('MMM Do YYYY, hh:mm:ss A') }, when.format(settings.chat.timestamps['24h'].get() === true ? 'HH:mm' : 'hh:mm A')),
              document.createTextNode(' - '),
              crel('span', { class: 'content' }, msg)
            );

        self.elements.body.append(toAppend);
        if (self.stickToBottom) {
          self._doScroll(toAppend);
        }
      },
      _send: msg => {
        socket.send({ type: 'ChatMessage', message: msg });
      },
      jump: (x, y, zoom) => {
        if (typeof x !== 'number') { x = parseFloat(x); }
        if (typeof y !== 'number') { y = parseFloat(y); }
        if (zoom == null) { zoom = false; } else if (typeof zoom !== 'number') { zoom = parseFloat(zoom); }

        board.centerOn(x, y);

        if (zoom) {
          board.setScale(zoom, true);
        }
      },
      updateSelectedNameColor: (colorIdx) => {
        self.elements.username_color_select[0].value = colorIdx;
        uiHelper.styleElemWithChatNameColor(self.elements.username_color_select[0], colorIdx);
      },
      _populateUsernameColor: () => {
        const hasPermForColor = (name) => user.hasPermission(`chat.usercolor.${name}`);
        const hasAllDonatorColors = hasPermForColor('donator') || hasPermForColor('donator.*');
        self.elements.username_color_select.empty().append(
          hasPermForColor('rainbow') ? crel('option', { value: -1, class: 'rainbow' }, '*. Rainbow') : null,
          hasAllDonatorColors || hasPermForColor('donator.green') ? crel('option', { value: -2, class: 'donator donator--green' }, '*. Donator Green') : null,
          hasAllDonatorColors || hasPermForColor('donator.gray') ? crel('option', { value: -3, class: 'donator donator--gray' }, '*. Donator Gray') : null,
          place.palette.map(({ name, value: hex }, i) => crel('option', {
            value: i,
            'data-idx': i,
            style: `background-color: #${hex}`
          }, `${i}. ${name}`))
        );
        self.elements.username_color_select[0].value = user.getChatNameColor();
      },
      _updateAuthorNameColor: (author, colorIdx) => {
        self.elements.body.find(`.chat-line[data-author="${author}"] .user`).each(function() {
          uiHelper.styleElemWithChatNameColor(this, colorIdx, 'color');
        });
      },
      _updateAuthorDisplayedFaction: (author, faction) => {
        const tag = (faction && faction.tag) || '';
        const color = faction ? intToHex(faction && faction.color) : null;
        const tagStr = (faction && faction.tag) ? `[${twemoji.parse(faction.tag)}]` : '';
        let ttStr = '';
        if (faction && faction.name != null && faction.id != null) {
          ttStr = `${faction.name} (ID: ${faction.id})`;
        }

        self.elements.body.find(`.chat-line[data-author="${author}"]`).each(function() {
          this.dataset.faction = (faction && faction.id) || '';
          this.dataset.tag = tag;
          $(this).find('.faction-tag').each(function() {
            this.dataset.tag = tag;
            this.style.color = color;
            this.style.display = settings.chat.factiontags.enable.get() === true ? 'initial' : 'none';
            this.innerHTML = tagStr;
            this.setAttribute('title', ttStr);
          });
        });
      },
      _updateFaction: (faction) => {
        if (faction == null || faction.id == null) return;
        const colorHex = `#${('000000' + (faction.color >>> 0).toString(16)).slice(-6)}`;
        self.elements.body.find(`.chat-line[data-faction="${faction.id}"]`).each(function() {
          this.dataset.tag = faction.tag;
          $(this).find('.faction-tag').attr('data-tag', faction.tag).attr('title', `${faction.name} (ID: ${faction.id})`).css('color', colorHex).html(`[${twemoji.parse(faction.tag)}]`);
        });
      },
      _clearFaction: (fid) => {
        if (fid == null) return;
        self.elements.body.find(`.chat-line[data-faction="${fid}"]`).each(function() {
          const _ft = $(this).find('.faction-tag')[0];
          ['tag', 'faction', 'title'].forEach(x => {
            this.dataset[x] = '';
            _ft.dataset[x] = '';
          });
          _ft.innerHTML = '';
        });
      },
      _toggleTextIconFlairs: (enabled = settings.chat.badges.enable.get() === true) => {
        self.elements.body.find('.chat-line .flairs .text-badge').each(function() {
          this.style.display = enabled ? 'initial' : 'none';
        });
      },
      _toggleFactionTagFlairs: (enabled = settings.chat.factiontags.enable.get() === true) => {
        self.elements.body.find('.chat-line:not([data-faction=""]) .flairs .faction-tag').each(function() {
          this.style.display = enabled ? 'initial' : 'none';
        });
      },
      /**
         * All lookup hooks.
         */
      hooks: [],
      /**
         * Registers hooks.
         * @param {...Object} hooks Information about the hook.
         * @param {String} hooks.id An ID for the hook.
         * @param {Function} hooks.get A function that returns an object representing message metadata.
         */
      registerHook: function(...hooks) {
        return self.hooks.push(...$.map(hooks, function(hook) {
          return {
            id: hook.id || 'hook',
            get: hook.get || function() {
            }
          };
        }));
      },
      /**
         * Replace a hook by its ID.
         * @param {String} hookId The ID of the hook to replace.
         * @param {Object} newHook Information about the hook.
         * @param {Function} newHook.get A function that returns an object representing message metadata.
         */
      replaceHook: function(hookId, newHook) {
        delete newHook.id;
        for (const idx in self.hooks) {
          const hook = self.hooks[idx];
          if (hook.id === hookId) {
            self.hooks[idx] = Object.assign(hook, newHook);
            return;
          }
        }
      },
      /**
         * Unregisters a hook by its ID.
         * @param {string} hookId The ID of the hook to unregister.
         */
      unregisterHook: function(hookId) {
        self.hooks = $.grep(self.hooks, function(hook) {
          return hook.id !== hookId;
        });
      },
      _process: (packet, isHistory = false) => {
        if (packet.id) {
          if (self.idLog.includes(packet.id)) {
            return;
          } else {
            self.idLog.unshift(packet.id); // sit this id in front so we short circuit sooner
            if (self.idLog.length > 50) {
              self.idLog.pop(); // ensure we pop off back instead of shift off front
            }
          }
        }

        const hookDatas = self.hooks.map((hook) => Object.assign({}, { pings: [] }, hook.get(packet)));

        if (!board.snipMode) {
          self.typeahead.helper.getDatabase('users').addEntry(packet.author, packet.author);

          if (self.ignored.indexOf(packet.author) >= 0) return;
        }
        let hasPing = !board.snipMode && settings.chat.pings.enable.get() === true && user.isLoggedIn() && hookDatas.some((data) => data.pings.length > 0);
        const when = moment.unix(packet.date);
        const flairs = crel('span', { class: 'flairs' });
        if (Array.isArray(packet.badges)) {
          packet.badges.forEach(badge => {
            switch (badge.type) {
              case 'text': {
                const _countBadgeShow = settings.chat.badges.enable.get() ? 'initial' : 'none';
                crel(flairs, crel('span', {
                  class: 'flair text-badge',
                  style: `display: ${_countBadgeShow}`,
                  title: badge.tooltip || ''
                }, badge.displayName || ''));
                break;
              }
              case 'icon':
                crel(flairs, crel('span', { class: 'flair icon-badge' }, crel('i', {
                  class: badge.cssIcon || '',
                  title: badge.tooltip || ''
                }, document.createTextNode(' '))));
                break;
            }
          });
        }

        const _facTag = packet.strippedFaction ? packet.strippedFaction.tag : '';
        if (!board.snipMode) {
          const _facColor = packet.strippedFaction ? intToHex(packet.strippedFaction.color) : 0;
          const _facTagShow = packet.strippedFaction && settings.chat.factiontags.enable.get() === true ? 'initial' : 'none';
          const _facTitle = packet.strippedFaction ? `${packet.strippedFaction.name} (ID: ${packet.strippedFaction.id})` : '';

          const _facFlair = crel('span', {
            class: 'flair faction-tag',
            'data-tag': _facTag,
            style: `color: ${_facColor}; display: ${_facTagShow}`,
            title: _facTitle
          });
          _facFlair.innerHTML = `[${twemoji.parse(_facTag)}]`;
          crel(flairs, _facFlair);
        }

        const contentSpan = crel('span', { class: 'content' },
          self.processMessage(packet.message_raw, (username) => {
            if (username === user.getUsername() && !hasPing) {
              hasPing = true;
            }
          })
        );
        let nameClasses = 'user';
        if (Array.isArray(packet.authorNameClass)) nameClasses += ` ${packet.authorNameClass.join(' ')}`;

        // Truncate older chat messages by removing the diff of the current message count and the maximum count.
        const diff = self.elements.body.children().length - settings.chat.truncate.max.get();
        if (diff > 0) {
          self.elements.body.children().slice(0, diff).remove();
        }

        const chatLine = crel('li', {
          'data-id': packet.id,
          'data-tag': !board.snipMode ? _facTag : '',
          'data-faction': !board.snipMode ? (packet.strippedFaction && packet.strippedFaction.id) || '' : '',
          'data-author': packet.author,
          'data-date': packet.date,
          'data-badges': JSON.stringify(packet.badges || []),
          class: `chat-line${hasPing ? ' has-ping' : ''} ${packet.author.toLowerCase().trim() === user.getUsername().toLowerCase().trim() ? 'is-from-us' : ''}`
        },
        crel('span', { title: when.format('MMM Do YYYY, hh:mm:ss A') }, when.format(settings.chat.timestamps['24h'].get() === true ? 'HH:mm' : 'hh:mm A')),
        document.createTextNode(' '),
        flairs,
        crel('span', {
          class: nameClasses,
          style: `color: #${place.getPaletteColorValue(packet.authorNameColor)}`,
          onclick: self._popUserPanel,
          onmousemiddledown: self._addAuthorMentionToChatbox
        }, board.snipMode ? '-snip-' : packet.author),
        document.createTextNode(': '),
        contentSpan,
        document.createTextNode(' '));
        self.elements.body.append(chatLine);

        if (packet.purge) {
          self._markMessagePurged(chatLine, packet.purge);
        }
        if (packet.authorWasShadowBanned) {
          self._markMessageShadowBanned(chatLine);
        }

        if (hasPing) {
          self.pingsList.push(packet);
          if (!((panels.isOpen('chat') && self.stickToBottom) || (packet.date < self.last_opened_panel))) {
            ++self.pings;
            self.elements.panel_trigger.addClass('has-ping');
            self.elements.pings_button.addClass('has-notification');
          }

          const pingAudioState = settings.chat.pings.audio.when.get();
          const canPlayPingAudio = !isHistory && settings.audio.enable.get() &&
              pingAudioState !== 'off' && Date.now() - self.lastPingAudioTimestamp > 5000;
          if ((!panels.isOpen('chat') || !document.hasFocus() || pingAudioState === 'always') &&
              uiHelper.tabHasFocus() && canPlayPingAudio) {
            self.pingAudio.volume = parseFloat(settings.chat.pings.audio.volume.get());
            self.pingAudio.play();
            self.lastPingAudioTimestamp = Date.now();
          }
        }
      },
      processMessage: (str, mentionCallback) => {
        let content = str;
        try {
          const processor = self.markdownProcessor()
            .use(pxlsMarkdown.plugins.mention, { mentionCallback });
          const file = processor.processSync(str);
          content = file.result;
        } catch (err) {
          console.error(`could not process chat message "${str}"`, err, '\nDefaulting to raw content.');
        }

        return content;
      },
      _markMessagePurged: (elem, purge) => {
        elem.classList.add('purged');
        elem.setAttribute('title', `Purged by ${purge.initiator} with reason: ${purge.reason || 'none provided'}`);
        elem.dataset.purgedBy = purge.initiator;
      },
      _markMessageShadowBanned: (elem) => {
        elem.classList.add('shadow-banned');
        elem.dataset.shadowBanned = 'true';
      },
      _makeCoordinatesElement: (raw, x, y, scale, template, title) => {
        let text = `(${x}, ${y}${scale != null ? `, ${scale}x` : ''})`;
        if (template != null && template.length >= 11) { // we have a template, should probably make that known
          const tmplName = decodeURIComponent(
            settings.chat.links.templates.preferurls.get() !== true && title && title.trim()
              ? title
              : template
          );
          text += ` (template: ${(tmplName > 25) ? `${tmplName.substr(0, 22)}...` : tmplName})`;
        }

        function handleClick(e) {
          e.preventDefault();

          if (template) {
            const internalClickDefault = settings.chat.links.internal.behavior.get();
            if (internalClickDefault === self.TEMPLATE_ACTIONS.ASK.id) {
              self._popTemplateOverwriteConfirm(e.target).then(action => {
                modal.closeAll();
                self._handleTemplateOverwriteAction(action, e.target);
              });
            } else {
              self._handleTemplateOverwriteAction(internalClickDefault, e.target);
            }
          } else {
            self.jump(parseFloat(x), parseFloat(y), parseFloat(scale));
          }
        }

        return crel('a', {
          class: 'link coordinates',
          dataset: {
            raw,
            x,
            y,
            scale,
            template,
            title
          },
          href: raw,
          onclick: handleClick
        }, text);
      },
      _handleTemplateOverwriteAction: (action, linkElem) => {
        switch (action) {
          case false:
            break;
          case self.TEMPLATE_ACTIONS.CURRENT_TAB.id: {
            self._pushStateMaybe(); // ensure people can back button if available
            document.location.href = linkElem.dataset.raw; // overwrite href since that will trigger hash-based update of template. no need to re-write that logic
            break;
          }
          case self.TEMPLATE_ACTIONS.JUMP_ONLY.id: {
            self._pushStateMaybe(); // ensure people can back button if available
            self.jump(parseFloat(linkElem.dataset.x), parseFloat(linkElem.dataset.y), parseFloat(linkElem.dataset.scale));
            break;
          }
          case self.TEMPLATE_ACTIONS.NEW_TAB.id: {
            if (!window.open(linkElem.dataset.raw, '_blank')) { // what popup blocker still blocks _blank redirects? idk but i'm sure they exist.
              modal.show(modal.buildDom(
                crel('h2', { class: 'modal-title' }, 'Open Failed'),
                crel('div',
                  crel('h3', 'Failed to automatically open in a new tab'),
                  crel('a', {
                    href: linkElem.dataset.raw,
                    target: '_blank'
                  }, 'Click here to open in a new tab instead')
                )
              ));
            }
            break;
          }
        }
      },
      _popTemplateOverwriteConfirm: (internalJumpElem) => {
        return new Promise((resolve, reject) => {
          const bodyWrapper = crel('div');
          // const buttons = crel('div', { style: 'text-align: right; display: block; width: 100%;' });

          modal.show(modal.buildDom(
            crel('h2', { class: 'modal-title' }, 'Open Template'),
            crel(bodyWrapper,
              crel('h3', { class: 'text-orange' }, 'This link will overwrite your current template. What would you like to do?'),
              Object.values(self.TEMPLATE_ACTIONS).map(action => action.id === self.TEMPLATE_ACTIONS.ASK.id ? null
                : crel('label', { style: 'display: block; margin: 3px 3px 3px 1rem; margin-left: 1rem;' },
                  crel('input', {
                    type: 'radio',
                    name: 'link-action-rb',
                    'data-action-id': action.id
                  }),
                  action.pretty
                )
              ),
              crel('span', { class: 'text-muted' }, 'Note: You can set a default action in the settings menu which bypasses this popup completely.')
            ),
            [
              ['Cancel', () => resolve(false)],
              ['OK', () => resolve(bodyWrapper.querySelector('input[type=radio]:checked').dataset.actionId)]
            ].map(x =>
              crel('button', {
                class: 'text-button',
                style: 'margin-left: 3px; position: initial !important; bottom: initial !important; right: initial !important;',
                onclick: x[1]
              }, x[0])
            )
          ));
          bodyWrapper.querySelector(`input[type="radio"][data-action-id="${self.TEMPLATE_ACTIONS.NEW_TAB.id}"]`).checked = true;
        });
      },
      _pushStateMaybe(url) {
        if ((typeof history.pushState) === 'function') {
          history.pushState(null, document.title, url == null ? document.location.href : url); // ensure people can back button if available
        }
      },
      // The following functions must use es5 syntax for expected behavior.
      // Don't upgrade syntax, `this` is attached to a DOM Event and we need `this` to be bound by DOM Bubbles.
      _addAuthorMentionToChatbox: function(e) {
        e.preventDefault();
        if (this && this.closest) {
          const chatLineEl = this.closest('.chat-line[data-id]');
          if (!chatLineEl) return console.warn('no closets chat-line on self: %o', this);

          self.elements.input.val(self.elements.input.val() + '@' + chatLineEl.dataset.author + ' ');
          self.elements.input.focus();
        }
      },
      _popUserPanel: function(e) {
        if (this && this.closest) {
          const closest = this.closest('.chat-line[data-id]');
          if (!closest) return console.warn('no closets chat-line on self: %o', this);

          const id = closest.dataset.id;

          let badgesArray = [];
          try {
            badgesArray = JSON.parse(closest.dataset.badges);
          } catch (ignored) {
          }
          const badges = crel('span', { class: 'badges' });
          badgesArray.forEach(badge => {
            switch (badge.type) {
              case 'text':
                crel(badges, crel('span', {
                  class: 'text-badge',
                  title: badge.tooltip || ''
                }, badge.displayName || ''), document.createTextNode(' '));
                break;
              case 'icon':
                crel(badges, crel('i', {
                  class: (badge.cssIcon || '') + ' icon-badge',
                  title: badge.tooltip || ''
                }, document.createTextNode(' ')), document.createTextNode(' '));
                break;
            }
          });

          const closeHandler = function() {
            if (this && this.closest) {
              const toClose = this.closest('.popup');
              if (toClose) toClose.remove();
            }
          };

          let _factionTag = null;
          if (closest.dataset.tag) {
            _factionTag = document.createElement('span', { class: 'flair faction-tag' });
            _factionTag.innerHTML = `[${twemoji.parse(closest.dataset.tag)}] `;
          }

          const popupWrapper = crel('div', { class: 'popup panel', 'data-popup-for': id });
          const panelHeader = crel('header',
            { class: 'panel-header' },
            crel('button', { class: 'left panel-closer' }, crel('i', {
              class: 'fas fa-times',
              onclick: closeHandler
            })),
            crel('span', _factionTag, closest.dataset.author, badges),
            crel('div', { class: 'right' })
          );
          const leftPanel = crel('div', { class: 'pane details-wrapper chat-line' });
          const rightPanel = crel('div', { class: 'pane actions-wrapper' });
          const actionsList = crel('ul', { class: 'actions-list' });

          const actions = [
            { label: 'Report', action: 'report', class: 'dangerous-button' },
            { label: 'Mention', action: 'mention' },
            { label: 'Ignore', action: 'ignore' },
            (!board.snipMode || App.user.hasPermission('user.receivestaffbroadcasts')) && { label: 'Profile', action: 'profile' },
            { label: 'Chat (un)ban', action: 'chatban', staffaction: true },
            // TODO(netux): Fix infraestructure and allow to purge during snip mode
            !board.snipMode && { label: 'Purge User', action: 'purge', staffaction: true },
            { label: 'Delete', action: 'delete', staffaction: true },
            { label: 'Mod Lookup', action: 'lookup-mod', staffaction: true },
            { label: 'Chat Lookup', action: 'lookup-chat', staffaction: true }
          ];

          crel(leftPanel, crel('p', { class: 'popup-timestamp-header text-muted' }, moment.unix(closest.dataset.date >> 0).format(`MMM Do YYYY, ${(settings.chat.timestamps['24h'].get() === true ? 'HH:mm:ss' : 'hh:mm:ss A')}`)));
          crel(leftPanel, crel('p', { class: 'content', style: 'margin-top: 3px; margin-left: 3px; text-align: left;' }, closest.querySelector('.content').textContent));

          crel(actionsList, actions
            .filter((action) => action && (user.isStaff() || !action.staffaction))
            .map((action) => crel('li', crel('button', {
              type: 'button',
              class: 'text-button fullwidth ' + (action.class || ''),
              'data-action': action.action,
              'data-id': id,
              onclick: self._handleActionClick
            }, action.label))));
          crel(rightPanel, actionsList);

          const popup = crel(popupWrapper, panelHeader, leftPanel, rightPanel);
          document.body.appendChild(popup);
          self._positionPopupRelativeToX(popup, this);
        }
      },
      _positionPopupRelativeToX(popup, x) {
        const bodyRect = document.body.getBoundingClientRect();
        const thisRect = x.getBoundingClientRect(); // this: span.user or i.fas.fa-cog
        let popupRect = popup.getBoundingClientRect();

        if (thisRect.left < (popupRect.width / 2)) {
          popup.style.left = `${thisRect.left >> 0}px`;
        } else {
          popup.style.left = `${((thisRect.left + (thisRect.width / 2 >> 0)) - (popupRect.width / 2 >> 0)) >> 0}px`;
        }

        popup.style.top = `${thisRect.top + thisRect.height + 2}px`;

        popupRect = popup.getBoundingClientRect(); // have to re-calculate after moving before fixing positioning. forces relayout though

        if (popupRect.bottom > bodyRect.bottom) {
          popup.style.bottom = '2px';
          popup.style.top = null;
        }
        if (popupRect.top < bodyRect.top) {
          popup.style.top = '2px';
          popup.style.bottom = null;
        }
        if (popupRect.right > bodyRect.right) {
          popup.style.right = '2px';
          popup.style.left = null;
        }
        if (popupRect.left < bodyRect.left) {
          popup.style.left = '2px';
          popup.style.right = null;
        }
      },
      _handleActionClick: function(e) { // must be es5 for expected behavior. don't upgrade syntax, this is attached as an onclick and we need `this` to be bound by dom bubbles.
        if (!this.dataset) return console.trace('onClick attached to invalid object');

        const chatLine = self.elements.body.find(`.chat-line[data-id="${this.dataset.id}"]`)[0];
        if (!chatLine && !this.dataset.target) return console.warn('no chatLine/target? searched for id %o', this.dataset.id);
        const mode = !!chatLine;

        const reportingMessage = mode ? chatLine.querySelector('.content').textContent : '';
        const reportingTarget = mode ? chatLine.dataset.author : this.dataset.target;

        $('.popup').remove();
        switch (this.dataset.action.toLowerCase().trim()) {
          case 'report': {
            const reportButton = crel('button', {
              class: 'text-button dangerous-button',
              type: 'submit'
            }, 'Report');
            const textArea = crel('textarea', {
              placeholder: 'Enter a reason for your report',
              style: 'width: 100%; border: 1px solid #999;',
              onkeydown: e => e.stopPropagation()
            });

            const chatReport =
                crel('form', { class: 'report chat-report', 'data-chat-id': this.dataset.id },
                  crel('p', { style: 'font-size: 1rem !important;' },
                    'You are reporting a chat message from ',
                    crel('span', { style: 'font-weight: bold' }, reportingTarget),
                    crel('span', { title: reportingMessage }, ` with the content "${reportingMessage.substr(0, 60)}${reportingMessage.length > 60 ? '...' : ''}"`)
                  ),
                  textArea,
                  crel('div', { style: 'text-align: right' },
                    crel('button', {
                      class: 'text-button',
                      style: 'position: initial; margin-right: .25rem',
                      type: 'button',
                      onclick: () => {
                        modal.closeAll();
                        chatReport.remove();
                      }
                    }, 'Cancel'),
                    reportButton
                  )
                );
            chatReport.onsubmit = e => {
              e.preventDefault();
              reportButton.disabled = true;
              if (!this.dataset.id) return console.error('!! No id to report? !!', this);
              $.post('/reportChat', {
                cmid: this.dataset.id,
                report_message: textArea.value
              }, function() {
                chatReport.remove();
                modal.showText('Sent report!');
              }).fail(function() {
                modal.showText('Error sending report.');
                reportButton.disabled = false;
              });
            };
            modal.show(modal.buildDom(
              crel('h2', { class: 'modal-title' }, 'Report User'),
              chatReport
            ));
            break;
          }
          case 'mention': {
            if (reportingTarget) {
              self.elements.input.val(self.elements.input.val() + `@${reportingTarget} `);
            } else console.warn('no reportingTarget');
            break;
          }
          case 'ignore': {
            if (reportingTarget) {
              if (chat.addIgnore(reportingTarget)) {
                modal.showText('User ignored. You can unignore from chat settings.');
              } else {
                modal.showText('Failed to ignore user. Either they\'re already ignored, or an error occurred. If the problem persists, contact a developer.');
              }
            } else console.warn('no reportingTarget');
            break;
          }
          case 'chatban': {
            const messageTable = mode
              ? crel('table', { class: 'chatmod-table' },
                crel('tr',
                  crel('th', 'ID: '),
                  crel('td', this.dataset.id)
                ),
                crel('tr',
                  crel('th', 'Message: '),
                  crel('td', { title: reportingMessage }, `${reportingMessage.substr(0, 120)}${reportingMessage.length > 120 ? '...' : ''}`)
                ),
                crel('tr',
                  crel('th', 'User: '),
                  crel('td', reportingTarget)
                )
              )
              : crel('table', { class: 'chatmod-table' },
                crel('tr',
                  crel('th', 'User: '),
                  crel('td', reportingTarget)
                )
              );

            const banLengths = [['Unban', -3], ['Permanent', -1], ['Temporary', -2]];
            const _selBanLength = crel('select', { name: 'selBanLength' },
              banLengths.map(lenPart =>
                crel('option', { value: lenPart[1] }, lenPart[0])
              )
            );

            const _customLenWrap = crel('div', { style: 'display: block; margin-top: .5rem' });
            const _selCustomLength = crel('select', {
              name: 'selCustomLength',
              style: 'display: inline-block; width: auto;'
            },
            crel('option', { value: '1' }, 'Seconds'),
            crel('option', { value: '60' }, 'Minutes'),
            crel('option', { value: '3600' }, 'Hours'),
            crel('option', { value: '86400' }, 'Days')
            );
            const _txtCustomLength = crel('input', {
              type: 'number',
              name: 'txtCustomLength',
              style: 'display: inline-block; width: auto;',
              min: '1',
              step: '1',
              value: '10'
            });

            const _selBanReason = crel('select',
              crel('option', 'Rule 3: Spam'),
              crel('option', 'Rule 1: Chat civility'),
              crel('option', 'Rule 2: Hate Speech'),
              crel('option', 'Rule 5/6: NSFW'),
              crel('option', 'Rule 4: Copy/pastas'),
              crel('option', 'Custom')
            );

            const _additionalReasonInfoWrap = crel('div', { style: 'margin-top: .5rem;' });
            const _txtAdditionalReason = crel('textarea', {
              type: 'text',
              name: 'txtAdditionalReasonInfo'
            });

            const _purgeWrap = crel('div', { style: 'display: block;' });
            const _rbPurgeYes = crel('input', {
              type: 'radio',
              name: 'rbPurge',
              checked: String(!board.snipMode)
            });
            const _rbPurgeNo = crel('input', { type: 'radio', name: 'rbPurge' });

            const _reasonWrap = crel('div', { style: 'display: block;' });

            const _btnCancel = crel('button', {
              class: 'text-button',
              type: 'button',
              onclick: () => {
                chatbanContainer.remove();
                modal.closeAll();
              }
            }, 'Cancel');
            const _btnOK = crel('button', { class: 'text-button dangerous-button', type: 'submit' }, 'Ban');

            const chatbanContainer = crel('form', {
              class: 'chatmod-container',
              'data-chat-id': this.dataset.id
            },
            crel('h5', mode ? 'Banning:' : 'Message:'),
            messageTable,
            crel('h5', 'Ban Length'),
            _selBanLength,
            crel(_customLenWrap,
              _txtCustomLength,
              _selCustomLength
            ),
            crel(_reasonWrap,
              crel('h5', 'Reason'),
              _selBanReason,
              crel(_additionalReasonInfoWrap, _txtAdditionalReason)
            ),
            crel(_purgeWrap,
              crel('h5', 'Purge Messages'),
              board.snipMode
                ? crel('span', { class: 'text-orange extra-warning' },
                  crel('i', { class: 'fas fa-exclamation-triangle' }),
                  ' Purging all messages is disabled during snip mode'
                )
                : [
                  crel('label', { style: 'display: inline;' }, _rbPurgeYes, 'Yes'),
                  crel('label', { style: 'display: inline;' }, _rbPurgeNo, 'No')
                ]
            ),
            crel('div', { class: 'buttons' },
              _btnCancel,
              _btnOK
            )
            );

            _selBanLength.value = banLengths[2][1]; // 10 minutes
            _selBanLength.addEventListener('change', function() {
              const isCustom = this.value === '-2';
              _customLenWrap.style.display = isCustom ? 'block' : 'none';
              _txtCustomLength.required = isCustom;

              const isUnban = _selBanLength.value === '-3';
              _reasonWrap.style.display = isUnban ? 'none' : 'block';
              _purgeWrap.style.display = isUnban ? 'none' : 'block';
              _btnOK.innerHTML = isUnban ? 'Unban' : 'Ban';
            });
            _selCustomLength.selectedIndex = 1; // minutes

            const updateAdditionalTextarea = () => {
              const isCustom = _selBanReason.value === 'Custom';
              _txtAdditionalReason.placeholder = isCustom ? 'Custom reason' : 'Additional information (if applicable)';
              _txtAdditionalReason.required = isCustom;
            };

            updateAdditionalTextarea();
            _selBanReason.addEventListener('change', updateAdditionalTextarea);

            _txtAdditionalReason.onkeydown = e => e.stopPropagation();
            _txtCustomLength.onkeydown = e => e.stopPropagation();

            chatbanContainer.onsubmit = e => {
              e.preventDefault();
              const postData = {
                type: 'temp',
                reason: 'none provided',
                // TODO(netux): Fix infraestructure and allow to purge during snip mode
                removalAmount: !board.snipMode ? (_rbPurgeYes.checked ? -1 : 0) : 0, // message purges are based on username, so if we purge when everyone in chat is -snip-, we aren't gonna have a good time
                banLength: 0
              };

              if (_selBanReason.value === 'Custom') {
                postData.reason = _txtAdditionalReason.value;
              } else {
                postData.reason = _selBanReason.value;
                if (_txtAdditionalReason.value) {
                  postData.reason += `. Additional information: ${_txtAdditionalReason.value}`;
                }
              }

              if (_selBanLength.value === '-3') { // unban
                postData.type = 'unban';
                postData.reason = '(web shell unban)';
                postData.banLength = -1;
              } else if (_selBanLength.value === '-2') { // custom
                postData.banLength = (_txtCustomLength.value >> 0) * (_selCustomLength.value >> 0);
              } else if (_selBanLength.value === '-1') { // perma
                postData.type = 'perma';
                postData.banLength = 0;
              } else {
                postData.banLength = _selBanLength.value >> 0;
              }

              if (mode) { postData.cmid = this.dataset.id; } else { postData.who = reportingTarget; }

              $.post('/admin/chatban', postData, () => {
                modal.showText('Chatban initiated');
              }).fail(() => {
                modal.showText('Error occurred while chatbanning');
              });
            };
            modal.show(modal.buildDom(
              crel('h2', { class: 'modal-title' }, 'Chatban'),
              crel('div', { style: 'padding-left: 1em' },
                chatbanContainer
              )
            ));
            break;
          }
          case 'delete': {
            const _txtReason = crel('input', {
              type: 'text',
              name: 'txtReason',
              style: 'display: inline-block; width: 100%; font-family: sans-serif; font-size: 1rem;'
            });

            const dodelete = () => $.post('/admin/delete', {
              cmid: this.dataset.id,
              reason: _txtReason.value
            }, () => {
              modal.closeAll();
            }).fail(() => {
              modal.showText('Failed to delete');
            });

            if (e.shiftKey === true) {
              return dodelete();
            }
            const btndelete = crel('button', { class: 'text-button dangerous-button' }, 'Delete');
            btndelete.onclick = () => dodelete();
            const deleteWrapper = crel('div', { class: 'chatmod-container' },
              crel('table',
                crel('tr',
                  crel('th', 'ID: '),
                  crel('td', this.dataset.id)
                ),
                crel('tr',
                  crel('th', 'User: '),
                  crel('td', reportingTarget)
                ),
                crel('tr',
                  crel('th', 'Message: '),
                  crel('td', { title: reportingMessage }, `${reportingMessage.substr(0, 120)}${reportingMessage.length > 120 ? '...' : ''}`)
                ),
                crel('tr',
                  crel('th', 'Reason: '),
                  crel('td', _txtReason)
                )
              ),
              crel('div', { class: 'buttons' },
                crel('button', {
                  class: 'text-button',
                  type: 'button',
                  onclick: () => {
                    deleteWrapper.remove();
                    modal.closeAll();
                  }
                }, 'Cancel'),
                btndelete
              )
            );
            modal.show(modal.buildDom(
              crel('h2', { class: 'modal-title' }, 'Delete Message'),
              deleteWrapper
            ));
            break;
          }
          case 'purge': {
            const txtPurgeReason = crel('input', { type: 'text', onkeydown: e => e.stopPropagation() });

            const btnPurge = crel('button', { class: 'text-button dangerous-button', type: 'submit' }, 'Purge');

            const messageTable = mode
              ? crel('table',
                crel('tr',
                  crel('th', 'ID: '),
                  crel('td', this.dataset.id)
                ),
                crel('tr',
                  crel('th', 'Message: '),
                  crel('td', { title: reportingMessage }, `${reportingMessage.substr(0, 120)}${reportingMessage.length > 120 ? '...' : ''}`)
                )
              )
              : crel('table', { class: 'chatmod-table' },
                crel('tr',
                  crel('th', 'User: '),
                  crel('td', reportingTarget)
                )
              );

            const purgeWrapper = crel('form', { class: 'chatmod-container' },
              crel('h5', 'Selected Message'),
              messageTable,
              crel('div',
                crel('h5', 'Purge Reason'),
                txtPurgeReason
              ),
              crel('div', { class: 'buttons' },
                crel('button', {
                  class: 'text-button',
                  type: 'button',
                  onclick: () => {
                    purgeWrapper.remove();
                    modal.closeAll();
                  }
                }, 'Cancel'),
                btnPurge
              )
            );
            purgeWrapper.onsubmit = e => {
              e.preventDefault();

              $.post('/admin/chatPurge', {
                who: reportingTarget,
                reason: txtPurgeReason.value
              }, function() {
                purgeWrapper.remove();
                modal.showText('User purged');
              }).fail(function() {
                modal.showText('Error sending purge.');
              });
            };
            modal.show(modal.buildDom(
              crel('h2', { class: 'modal-title' }, 'Purge User'),
              crel('div', { style: 'padding-left: 1em' }, purgeWrapper)
            ));
            break;
          }
          case 'lookup-mod': {
            if (user.admin && user.admin.checkUser && user.admin.checkUser.check) {
              const type = board.snipMode ? 'cmid' : 'username';
              const arg = board.snipMode ? this.dataset.id : reportingTarget;
              user.admin.checkUser.check(arg, type);
            }
            break;
          }
          case 'lookup-chat': {
            socket.send({
              type: 'ChatLookup',
              arg: board.snipMode ? this.dataset.id : reportingTarget,
              mode: board.snipMode ? 'cmid' : 'username'
            });
            break;
          }
          case 'request-rename': {
            const rbStateOn = crel('input', { type: 'radio', name: 'rbState' });
            const rbStateOff = crel('input', { type: 'radio', name: 'rbState' });

            const stateOn = crel('label', { style: 'display: inline-block' }, rbStateOn, ' On');
            const stateOff = crel('label', { style: 'display: inline-block' }, rbStateOff, ' Off');

            const btnSetState = crel('button', { class: 'text-button', type: 'submit' }, 'Set');

            const renameError = crel('p', {
              style: 'display: none; color: #f00; font-weight: bold; font-size: .9rem',
              class: 'rename-error'
            }, '');

            rbStateOff.checked = true;

            const renameWrapper = crel('form', { class: 'chatmod-container' },
              crel('h3', 'Toggle Rename Request'),
              crel('p', 'Select one of the options below to set the current rename request state.'),
              crel('div', stateOn, stateOff),
              renameError,
              crel('div', { class: 'buttons' },
                crel('button', {
                  class: 'text-button',
                  type: 'button',
                  onclick: () => {
                    renameWrapper.remove();
                    modal.closeAll();
                  }
                }, 'Cancel'),
                btnSetState
              )
            );

            renameWrapper.onsubmit = e => {
              e.preventDefault();
              $.post('/admin/flagNameChange', {
                user: reportingTarget,
                flagState: rbStateOn.checked === true
              }, function() {
                renameWrapper.remove();
                modal.showText('Rename request updated');
              }).fail(function(xhrObj) {
                let resp = 'An unknown error occurred. Please contact a developer';
                if (xhrObj.responseJSON) {
                  resp = xhrObj.responseJSON.details || resp;
                } else if (xhrObj.responseText) {
                  try {
                    resp = JSON.parse(xhrObj.responseText).details;
                  } catch (ignored) {
                  }
                }

                renameError.style.display = null;
                renameError.innerHTML = resp;
              });
            };
            modal.show(modal.buildDom(
              crel('h2', { class: 'modal-title' }, 'Request Rename'),
              renameWrapper
            ));
            break;
          }
          case 'force-rename': {
            const newNameInput = crel('input', {
              type: 'text',
              required: 'true',
              onkeydown: e => e.stopPropagation()
            });
            const newNameWrapper = crel('label', 'New Name: ', newNameInput);

            const btnSetState = crel('button', { class: 'text-button', type: 'submit' }, 'Set');

            const renameError = crel('p', {
              style: 'display: none; color: #f00; font-weight: bold; font-size: .9rem',
              class: 'rename-error'
            }, '');

            const renameWrapper = crel('form', { class: 'chatmod-container' },
              crel('p', 'Enter the new name for the user below. Please note that if you\'re trying to change the caps, you\'ll have to rename to something else first.'),
              newNameWrapper,
              renameError,
              crel('div', { class: 'buttons' },
                crel('button', {
                  class: 'text-button',
                  type: 'button',
                  onclick: () => {
                    modal.closeAll();
                  }
                }, 'Cancel'),
                btnSetState
              )
            );

            renameWrapper.onsubmit = e => {
              e.preventDefault();
              $.post('/admin/forceNameChange', {
                user: reportingTarget,
                newName: newNameInput.value.trim()
              }, function() {
                modal.showText('User renamed');
              }).fail(function(xhrObj) {
                let resp = 'An unknown error occurred. Please contact a developer';
                if (xhrObj.responseJSON) {
                  resp = xhrObj.responseJSON.details || resp;
                } else if (xhrObj.responseText) {
                  try {
                    resp = JSON.parse(xhrObj.responseText).details;
                  } catch (ignored) {
                  }
                }

                renameError.style.display = null;
                renameError.innerHTML = resp;
              });
            };
            modal.show(modal.buildDom(
              crel('h2', { class: 'modal-title' }, 'Force Rename'),
              renameWrapper
            ));
            break;
          }
          case 'profile': {
            if (!window.open(`/profile/${reportingTarget}`, '_blank')) {
              modal.show(modal.buildDom(
                crel('h2', { class: 'modal-title' }, 'Open Failed'),
                crel('div',
                  crel('h3', 'Failed to automatically open in a new tab'),
                  crel('a', {
                    href: `/profile/${reportingTarget}`,
                    target: '_blank'
                  }, 'Click here to open in a new tab instead')
                )
              ));
            }
            break;
          }
        }
      },
      _doScroll: elem => {
        try { // Fixes iframes scrolling their parent. For context see https://github.com/pxlsspace/Pxls/pull/192's commit messages.
          elem.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        } catch (ignored) {
          elem.scrollIntoView(false);
        }
      },
      _canChat() {
        if (!user.isLoggedIn()) return false;
        if (!self.canvasBanRespected) return !self.chatban.banned;
        return !self.chatban.banned && !self.canvasBanned;
      },
      updateCanvasBanState(state) {
        self.canvasBanned = state;
        const canChat = self._canChat();
        self._handleChatbanVisualState(canChat);
        if (!canChat) {
          if (self.elements.rate_limit_counter.text().trim().length === 0) { self.elements.rate_limit_counter.text('You cannot use chat while canvas banned.'); }
        }
      }
    };
    return {
      init: self.init,
      webinit: self.webinit,
      _handleActionClick: self._handleActionClick,
      clearPings: self.clearPings,
      setCharLimit: self.setCharLimit,
      processMessage: self.processMessage,
      saveIgnores: self.saveIgnores,
      reloadIgnores: self.reloadIgnores,
      addIgnore: self.addIgnore,
      removeIgnore: self.removeIgnore,
      getIgnores: self.getIgnores,
      typeahead: self.typeahead,
      updateSelectedNameColor: self.updateSelectedNameColor,
      updateCanvasBanState: self.updateCanvasBanState,
      registerHook: self.registerHook,
      replaceHook: self.replaceHook,
      unregisterHook: self.unregisterHook,
      runLookup: self.runLookup,
      get markdownProcessor() {
        return self.markdownProcessor;
      },
      get canvasBanRespected() {
        return self.canvasBanRespected;
      }
    };
  })();
    // this takes care of the countdown timer
  const timer = (function() {
    const self = {
      elements: {
        palette: $('#palette'),
        timer_container: $('#cooldown'),
        timer_countdown: $('#cooldown-timer'),
        timer_chat: $('#txtMobileChatCooldown')
      },
      hasFiredNotification: true,
      cooldown: 0,
      runningTimer: false,
      audio: new Audio('notify.wav'),
      title: '',
      cooledDown: function() {
        return self.cooldown < (new Date()).getTime();
      },
      update: function(die) {
        // subtract one extra millisecond to prevent the first displaying to be derped
        let delta = (self.cooldown - (new Date()).getTime() - 1) / 1000;

        if (self.runningTimer === false) {
          self.elements.timer_container.hide();
        }

        if (self.status) {
          self.elements.timer_countdown.text(self.status);
        }

        const alertDelay = settings.place.alert.delay.get();
        if (alertDelay < 0 && delta < Math.abs(alertDelay) && !self.hasFiredNotification) {
          self.playAudio();
          let notif;
          if (!document.hasFocus()) {
            notif = nativeNotifications.maybeShow(`Your next pixel will be available in ${Math.abs(alertDelay)} seconds!`);
          }
          setTimeout(() => {
            uiHelper.setPlaceableText(1);
            if (notif) {
              $(window).one('pxls:ack:place', () => notif.close());
            }
          }, delta * 1000);
          self.hasFiredNotification = true;
        }

        if (delta > 0) {
          self.elements.timer_container.show();
          delta++; // real people don't count seconds zero-based (programming is more awesome)
          const secs = Math.floor(delta % 60);
          const secsStr = secs < 10 ? '0' + secs : secs;
          const minutes = Math.floor(delta / 60);
          const minuteStr = minutes < 10 ? '0' + minutes : minutes;
          self.elements.timer_countdown.text(`${minuteStr}:${secsStr}`);
          self.elements.timer_chat.text(`(${minuteStr}:${secsStr})`);

          document.title = uiHelper.getTitle(`[${minuteStr}:${secsStr}]`);

          if (self.runningTimer && !die) {
            return;
          }
          self.runningTimer = true;
          setTimeout(function() {
            self.update(true);
          }, 1000);
          return;
        }

        self.runningTimer = false;

        document.title = uiHelper.getTitle();
        self.elements.timer_container.hide();
        self.elements.timer_chat.text('');

        if (alertDelay > 0) {
          setTimeout(() => {
            self.playAudio();
            if (!document.hasFocus()) {
              const notif = nativeNotifications.maybeShow(`Your next pixel has been available for ${alertDelay} seconds!`);
              if (notif) {
                $(window).one('pxls:ack:place', () => notif.close());
              }
            }
            uiHelper.setPlaceableText(1);
            self.hasFiredNotification = true;
          }, alertDelay * 1000);
          return;
        }

        if (!self.hasFiredNotification) {
          self.playAudio();
          if (!document.hasFocus()) {
            const notif = nativeNotifications.maybeShow('Your next pixel is available!');
            if (notif) {
              $(window).one('pxls:ack:place', () => notif.close());
            }
          }
          uiHelper.setPlaceableText(1);
          self.hasFiredNotification = true;
        }
      },
      init: function() {
        self.title = document.title;
        self.elements.timer_container.hide();
        self.elements.timer_chat.text('');

        setTimeout(function() {
          if (self.cooledDown() && uiHelper.getAvailable() === 0) {
            uiHelper.setPlaceableText(1);
          }
        }, 250);
        socket.on('cooldown', function(data) {
          self.cooldown = (new Date()).getTime() + (data.wait * 1000);
          self.hasFiredNotification = data.wait === 0;
          self.update();
        });
      },
      playAudio: function() {
        if (uiHelper.tabHasFocus() && settings.audio.enable.get()) {
          self.audio.play();
        }
      }
    };
    return {
      init: self.init,
      cooledDown: self.cooledDown,
      playAudio: self.playAudio,
      audioElem: self.audio
    };
  })();
    // this takes care of displaying the coordinates the mouse is over
  const coords = (function() {
    const self = {
      elements: {
        coordsWrapper: $('#coords-info'),
        coords: $('#coords-info .coords'),
        lockIcon: $('#canvas-lock-icon')
      },
      mouseCoords: null,
      init: function() {
        self.elements.coordsWrapper.hide();
        const _board = board.getRenderBoard()[0];
        _board.addEventListener('pointermove', pointerHandler, { passive: false });
        _board.addEventListener('mousemove', pointerHandler, { passive: false });
        _board.addEventListener('touchstart', touchHandler, { passive: false });
        _board.addEventListener('touchmove', touchHandler, { passive: false });
        // board.getRenderBoard().on("pointermove mousemove", function(evt) {
        // }).on("touchstart touchmove", function(evt) {
        // });

        function pointerHandler(evt) {
          const boardPos = board.fromScreen(evt.clientX, evt.clientY);

          self.mouseCoords = boardPos;
          self.elements.coords.text('(' + (boardPos.x) + ', ' + (boardPos.y) + ')');
          if (!self.elements.coordsWrapper.is(':visible')) self.elements.coordsWrapper.fadeIn(200);
        }

        function touchHandler(evt) {
          const boardPos = board.fromScreen(evt.changedTouches[0].clientX, evt.changedTouches[0].clientY);

          self.mouseCoords = boardPos;
          self.elements.coords.text('(' + (boardPos.x) + ', ' + (boardPos.y) + ')');
          if (!self.elements.coordsWrapper.is(':visible')) self.elements.coordsWrapper.fadeIn(200);
        }

        $(window).keydown((event) => {
          if (['INPUT', 'TEXTAREA'].includes(event.target.nodeName)) {
            // prevent inputs from triggering shortcuts
            return;
          }

          if (!event.ctrlKey && (event.key === 'c' || event.key === 'C' || event.keyCode === 67)) {
            self.copyCoords();
          }
        });
      },
      copyCoords: function(useHash = false) {
        if (!navigator.clipboard || !self.mouseCoords) {
          return;
        }
        const x = useHash ? query.get('x') : self.mouseCoords.x;
        const y = useHash ? query.get('y') : self.mouseCoords.y;
        const scale = useHash ? query.get('scale') : 20;
        navigator.clipboard.writeText(self.getLinkToCoords(x, y, scale));
        self.elements.coordsWrapper.addClass('copyPulse');
        setTimeout(() => {
          self.elements.coordsWrapper.removeClass('copyPulse');
        }, 200);
      },
      /**
       * Returns a link to the website at a specific position.
       * @param {number} x The X coordinate for the link to have.
       * @param {number} y The Y coordinate for the link to have.
       * @param {number} scale The board scale.
       */
      getLinkToCoords: (x = 0, y = 0, scale = 20) => {
        const templateConfig = ['template', 'tw', 'oo', 'ox', 'oy', 'title']
          .filter(query.has)
          .map((conf) => `${conf}=${encodeURIComponent(query.get(conf))}`)
          .join('&');
        return `${location.origin}/#x=${Math.floor(x)}&y=${Math.floor(y)}&scale=${scale}&${templateConfig}`;
      }
    };
    return {
      init: self.init,
      copyCoords: self.copyCoords,
      getLinkToCoords: self.getLinkToCoords,
      lockIcon: self.elements.lockIcon
    };
  })();
    // this holds user stuff / info
  const user = (function() {
    const self = {
      elements: {
        users: $('#online-count'),
        userInfo: $('#user-info'),
        pixelCounts: $('#pixel-counts'),
        loginOverlay: $('#login-overlay'),
        userMessage: $('#user-message'),
        prompt: $('#prompt'),
        signup: $('#signup')
      },
      roles: [],
      pendingSignupToken: null,
      loggedIn: false,
      username: '',
      placementOverrides: null,
      chatNameColor: 0,
      getRoles: () => self.roles,
      isStaff: () => self.hasPermission('user.admin'),
      isDonator: () => self.hasPermission('user.donator'),
      getPermissions: () => {
        let perms = [];
        self.roles.flatMap(function loop(node) {
          if (node.inherits.length > 0) {
            perms.push(...node.permissions);
            return node.inherits.flatMap(loop);
          } else {
            perms.push(node.permissions);
          }
        });
        // NOTE: Slightly hacky fix for arrays showing up in permissions
        perms = perms.flatMap(permissions => permissions);
        return [...new Set(perms)];
      },
      hasPermission: node => self.getPermissions().includes(node),
      getUsername: () => self.username,
      getPixelCount: () => self.pixelCount,
      getPixelCountAllTime: () => self.pixelCountAllTime,
      signin: function() {
        const data = ls.get('auth_respond');
        if (!data) {
          return;
        }
        ls.remove('auth_respond');
        if (data.signup) {
          self.pendingSignupToken = data.token;
          self.elements.signup.fadeIn(200);
        } else {
          socket.reconnectSocket();
        }
        self.elements.prompt.fadeOut(200);
      },
      isLoggedIn: function() {
        return self.loggedIn;
      },
      webinit: function(data) {
        self.elements.loginOverlay.find('a').click(function(evt) {
          evt.preventDefault();

          const cancelButton = crel('button', { class: 'float-right text-button' }, 'Cancel');
          cancelButton.addEventListener('click', function() {
            self.elements.prompt.fadeOut(200);
          });

          self.elements.prompt[0].innerHTML = '';
          crel(self.elements.prompt[0],
            crel('div', { class: 'content' },
              crel('h1', 'Sign in with...'),
              crel('ul',
                Object.values(data.authServices).map(service => {
                  const anchor = crel('a', { href: `/signin/${service.id}?redirect=1` }, service.name);
                  anchor.addEventListener('click', function(e) {
                    if (window.open(this.href, '_blank')) {
                      e.preventDefault();
                      return;
                    }
                    ls.set('auth_same_window', true);
                  });
                  const toRet = crel('li', anchor);
                  if (!service.registrationEnabled) {
                    crel(toRet, crel('span', { style: 'font-style: italic; font-size: .75em; font-weight: bold; color: red; margin-left: .5em' }, 'New Accounts Disabled'));
                  }
                  return toRet;
                })
              )
            ),
            cancelButton
          );
          self.elements.prompt.fadeIn(200);
        });
      },
      wsinit: function() {
        if (ls.get('auth_proceed')) {
          // we need to authenticate...
          ls.remove('auth_proceed');
          self.signin();
        }
      },
      doSignup: function() {
        if (!self.pendingSignupToken) return;

        $.post({
          type: 'POST',
          url: '/signup',
          data: {
            token: self.pendingSignupToken,
            username: self.elements.signup.find('input').val()
          },
          success: function() {
            self.elements.signup.find('#error').text('');
            self.elements.signup.find('input').val('');
            self.elements.signup.fadeOut(200);
            socket.reconnectSocket();
            self.pendingSignupToken = null;
          },
          error: function(data) {
            self.elements.signup.find('#error').text(data.responseJSON.message);
          }
        });
        // self.pendingSignupToken = null;
      },
      doSignOut: function() {
        return fetch('/logout').then(() => {
          self.elements.userInfo.fadeOut(200);
          self.elements.pixelCounts.fadeOut(200);
          self.elements.userMessage.fadeOut(200);
          self.elements.loginOverlay.fadeIn(200);
          if (window.deInitAdmin) {
            window.deInitAdmin();
          }
          self.loggedIn = false;
          $(window).trigger('pxls:user:loginState', [false]);
          socket.reconnectSocket();
        });
      },
      init: function() {
        self.elements.userMessage.hide();
        self.elements.signup.hide();
        self.elements.signup.find('input').keydown(function(evt) {
          evt.stopPropagation();
          if (evt.key === 'Enter' || evt.which === 13) {
            self.doSignup();
          }
        });
        self.elements.signup.find('#signup-button').click(self.doSignup);
        self.elements.users.hide();
        self.elements.pixelCounts.hide();
        self.elements.userInfo.hide();
        self.elements.userInfo.find('.logout').click(function(evt) {
          evt.preventDefault();

          modal.show(modal.buildDom(
            crel('h2', { class: 'modal-title' }, 'Sign Out'),
            crel('div',
              crel('p', 'Are you sure you want to sign out?'),
              crel('div', { class: 'buttons' },
                crel('button', {
                  class: 'dangerous-button text-button',
                  onclick: () => self.doSignOut().then(() => modal.closeAll())
                }, 'Yes'),
                crel('button', {
                  class: 'text-button',
                  onclick: () => modal.closeAll()
                }, 'No')
              )
            )
          ));
        });
        $(window).bind('storage', function(evt) {
          if (evt.originalEvent.key === 'auth') {
            ls.remove('auth');
            self.signin();
          }
        });
        socket.on('users', function(data) {
          self.elements.users.text(data.count + ' online').fadeIn(200);
        });
        socket.on('session_limit', function(data) {
          socket.close();
          modal.showText('Too many sessions open, try closing some tabs.');
        });
        socket.on('userinfo', function(data) {
          let isBanned = false;
          const banelem = crel('div', { class: 'ban-alert-content' });
          self.username = data.username;
          self.loggedIn = true;
          self.pixelCount = data.pixelCount;
          self.pixelCountAllTime = data.pixelCountAllTime;
          self.updatePixelCountElements();
          self.elements.pixelCounts.fadeIn(200);
          self.placementOverrides = data.placementOverrides;
          place.togglePaletteSpecialColors(data.placementOverrides.canPlaceAnyColor);
          self.chatNameColor = data.chatNameColor;
          chat.updateSelectedNameColor(data.chatNameColor);
          self.roles = data.roles;
          $(window).trigger('pxls:user:loginState', [true]);
          self.renameRequested = data.renameRequested;
          uiHelper.setDiscordName(data.discordName || null);
          self.elements.loginOverlay.fadeOut(200);
          self.elements.userInfo.find('span#username').html(crel('a', {
            href: `/profile/${data.username}`,
            target: '_blank',
            title: 'My Profile'
          }, data.username).outerHTML);
          if (data.method === 'ip') {
            self.elements.userInfo.hide();
          } else {
            self.elements.userInfo.fadeIn(200);
          }

          if (data.banExpiry === 0) {
            isBanned = true;
            crel(banelem, crel('p', 'You are permanently banned.'));
          } else if (data.banned === true) {
            isBanned = true;
            crel(banelem, crel('p', `You are temporarily banned and will not be allowed to place until ${new Date(data.banExpiry).toLocaleString()}`));
          } else if (self.isStaff()) {
            if (window.deInitAdmin) {
              window.deInitAdmin();
            }
            $.getScript('admin/admin.js').done(function() {
              window.initAdmin({
                socket: socket,
                user: user,
                modal: modal,
                lookup: lookup,
                chat: chat
              }, admin => { self.admin = admin; });
            });
          } else if (window.deInitAdmin) {
            window.deInitAdmin();
          }
          if (isBanned) {
            self.elements.userMessage.empty().show().text('You can contact us using one of the links in the info menu.').fadeIn(200);
            crel(banelem,
              crel('p', 'If you think this was an error, please contact us using one of the links in the info tab.'),
              crel('p', 'Ban reason:'),
              crel('p', data.banReason)
            );
            modal.show(modal.buildDom(
              crel('h2', 'Banned'),
              banelem
            ), { escapeClose: false, clickClose: false });
            if (window.deInitAdmin) {
              window.deInitAdmin();
            }
          } else if (data.renameRequested) {
            self.showRenameRequest();
          } else {
            self.elements.userMessage.hide();
          }
          chat.updateCanvasBanState(isBanned);

          if (instaban) ban.shadow('App existed beforehand');

          analytics('send', 'event', 'Auth', 'Login', data.method);
        });
        socket.on('pixelCounts', function(data) {
          self.pixelCount = data.pixelCount;
          self.pixelCountAllTime = data.pixelCountAllTime;

          self.updatePixelCountElements();

          // For userscripts.
          $(window).trigger('pxls:pixelCounts:update', Object.assign({}, data));
        });
        socket.on('admin_placement_overrides', function(data) {
          self.placementOverrides = data.placementOverrides;
        });
        socket.on('rename', function(e) {
          if (e.requested === true) {
            self.showRenameRequest();
          } else {
            self.hideRenameRequest();
          }
        });
        socket.on('rename_success', e => {
          self.username = e.newName;
          self.elements.userInfo.find('span.name').text(e.newName);
        });
      },
      _handleRenameSubmit: function(event) {
        event.preventDefault();
        const input = this.querySelector('.rename-input');
        const btn = this.querySelector('.rename-submit');
        const err = this.querySelector('.rename-error');
        if (!input || !input.value || !btn || !err) return console.error('Missing one or more variables from querySelector. input: %o, btn: %o, err: %o', input, btn, err);
        input.disabled = btn.disabled = true;
        $.post('/execNameChange', { newName: input.value.trim() }, function() {
          self.renameRequested = false;
          self.hideRenameRequest();
          modal.closeAll();
        }).fail(function(xhrObj) {
          let resp = 'An unknown error occurred. Please contact staff on discord';
          if (xhrObj.responseJSON) {
            resp = xhrObj.responseJSON.details || resp;
          } else if (xhrObj.responseText) {
            try {
              resp = JSON.parse(xhrObj.responseText).details;
            } catch (ignored) {
            }
          }
          err.style.display = null;
          err.innerHTML = resp;
        }).always(function() {
          input.disabled = btn.disabled = false;
        });
      },
      _handleRenameClick: function(event) {
        const renamePopup = crel('form', { onsubmit: self._handleRenameSubmit },
          crel('p', 'Staff have required you to change your username, this usually means your name breaks one of our rules.'),
          crel('p', 'If you disagree, please contact us on Discord (link in the info panel).'),
          crel('label', 'New Username: ',
            crel('input', {
              type: 'text',
              class: 'rename-input',
              required: 'true',
              onkeydown: e => e.stopPropagation()
            })
          ),
          crel('p', {
            style: 'display: none; font-weight: bold; color: #f00; font-size: .9rem;',
            class: 'rename-error'
          }, ''),
          crel('div', { style: 'text-align: right' },
            crel('button', { class: 'text-button', onclick: () => modal.closeAll() }, 'Not now'),
            crel('button', { class: 'rename-submit text-button', type: 'submit' }, 'Change')
          )
        );
        modal.show(modal.buildDom(
          crel('h2', { class: 'modal-title' }, 'Rename Requested'),
          renamePopup
        ));
      },
      showRenameRequest: () => {
        self.elements.userMessage.empty().show().append(
          crel('span', 'You must change your username. Click ',
            crel('span', {
              style: 'cursor: pointer; text-decoration: underline;',
              onclick: self._handleRenameClick
            }, 'here'),
            document.createTextNode(' to continue.')
          )
        ).fadeIn(200);
      },
      hideRenameRequest: () => {
        self.elements.userMessage.fadeOut(200);
      },
      updatePixelCountElements: () => {
        self.elements.pixelCounts.find('#current-pixel-count').text(self.pixelCount.toLocaleString());
        self.elements.pixelCounts.find('#alltime-pixel-count').text(self.pixelCountAllTime.toLocaleString());
      }
    };
    return {
      init: self.init,
      getRoles: self.getRoles,
      isStaff: self.isStaff,
      isDonator: self.isDonator,
      getPermissions: self.getPermissions,
      hasPermission: self.hasPermission,
      getUsername: self.getUsername,
      getPixelCount: self.getPixelCount,
      getPixelCountAllTime: self.getPixelCountAllTime,
      webinit: self.webinit,
      wsinit: self.wsinit,
      isLoggedIn: self.isLoggedIn,
      renameRequested: self.renameRequested,
      showRenameRequest: self.showRenameRequest,
      hideRenameRequest: self.hideRenameRequest,
      getChatNameColor: () => self.chatNameColor,
      setChatNameColor: c => { self.chatNameColor = c; },
      get admin() {
        return self.admin || false;
      },
      get placementOverrides() {
        return self.placementOverrides;
      }
    };
  })();
    // this takes care of browser notifications
  const nativeNotifications = (function() {
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
  const notifications = (function() {
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
        return crel('article', { class: 'notification', 'data-notification-id': notification.id },
          crel('header', { class: 'notification-title' }, crel('h2', notification.title)),
          crel('div', { class: 'notification-body' }, chat.processMessage(notification.content)),
          crel('footer', { class: 'notification-footer' },
            notification.who ? document.createTextNode(`Posted by ${notification.who}`) : null,
            notification.expiry !== 0 ? crel('span', { class: 'notification-expiry float-left' },
              crel('i', { class: 'far fa-clock fa-is-left' }),
              crel('span', { title: moment.unix(notification.expiry).format('MMMM DD, YYYY, hh:mm:ss A') }, `Expires ${moment.unix(notification.expiry).format('MMM DD YYYY')}`)
            ) : null
          )
        );
      }
    };
    return {
      init: self.init
    };
  })();
    // this attempts to fix a problem with chromium based browsers offsetting the canvas
    // by a pixel when the window size is odd.
  const chromeOffsetWorkaround = (function() {
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
  const modal = (function() {
    return {
      showText: function(text, opts) {
        opts = Object.assign({}, { title: 'Pxls', footerButtons: [], modalOpts: {} }, opts);
        if (opts.footerButtons != null && !Array.isArray(opts.footerButtons)) {
          if (!(opts.footerButtons instanceof HTMLElement)) throw new Error('Invalid footerButtons provided. Expected HTMLElement[]');
          opts.footerButtons = [opts.footerButtons];
        }
        /* let footer;
        if (Array.isArray(opts.footerButtons)) {
          const validButtons = opts.footerButtons.filter(x => x instanceof HTMLElement);
          if (validButtons.length > 0) {
            footer = crel('div', { class: 'modal-footer' }, validButtons);
          }
        } */
        return modal.show(modal.buildDom(
          crel('h2', { class: 'modal-title' }, opts.title || 'Pxls'),
          crel('p', { style: 'margin: 0;' }, text)
        ), opts.modalOpts);
      },
      show: function(modal, opts) {
        if (!(modal instanceof HTMLElement)) throw new Error('Invalid modal object supplied. Expected an HTMLElement');
        opts = Object.assign({}, $.modal.defaults || {}, {
          closeExisting: true,
          escapeClose: true,
          clickClose: true,
          showClose: false,
          closeText: '<i class="fas fa-times"></i>'
        }, { removeOnClose: true }, opts);
        if (!document.body.contains(modal)) {
          document.body.appendChild(modal);
        }
        const modalObj = $(modal).modal(opts);
        if (opts.removeOnClose === true) {
          modalObj.on($.modal.AFTER_CLOSE, function() {
            $(this).remove();
          });
        }
        return modalObj;
      },
      buildCloser: function() {
        const button = crel('button', { class: 'panel-closer' }, crel('i', { class: 'fas fa-times' }));
        button.addEventListener('click', () => modal.closeTop());
        return button;
      },
      buildDom: function(headerContent, bodyContent, footerContent) {
        return crel('div', { class: 'modal panel', tabindex: '-1', role: 'dialog' },
          crel('div', { class: 'modal-wrapper', role: 'document' },
            headerContent == null ? null : crel('header', { class: 'modal-header panel-header' },
              crel('div', { class: 'left' }),
              crel('div', { class: 'mid' }, headerContent),
              crel('div', { class: 'right' }, this.buildCloser())),
            bodyContent == null ? null : crel('div', { class: 'modal-body panel-body' }, bodyContent),
            footerContent == null ? null : crel('footer', { class: 'modal-footer panel-footer' }, footerContent)
          )
        );
      },
      closeAll: function(clearDom = true) {
        while ($.modal.isActive()) { $.modal.close(); }
        if (clearDom) { Array.from(document.querySelectorAll('.modal')).forEach(el => el.remove()); }
      },
      closeTop: function(clearDom = true) {
        const elem = $.modal.close();
        if (clearDom && elem && elem[0]) { elem[0].remove(); }
      }
    };
  })();
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
  user.init();
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
      updateAudio: uiHelper.updateAudio
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
      modal.showText(s, { title: 'Alert', modalOpts: { closeExisting: false } });
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
