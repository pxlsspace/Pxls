'use strict';
crel.attrMap.onmousemiddledown = function(element, value) {
  element.addEventListener('mousedown', function(e) {
    if (e.button === 1) {
      value.call(this, e);
    }
  });
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
     * @param char {string} The char trigger. Should only be a one byte wide grapheme. Emojis will fail
     * @param dbType {string} The type of the database, acts internally as a map key.
     * @param [keepTrigger=false] {boolean} Whether or not this trigger type should keep it's matching trigger chars on search results.
     * @param [hasPair=false] {boolean} Whether or not this trigger has a matching pair at the end, e.g. ':word:' vs '@word'
     * @param [minLength=0] {number} The minimum length of the match before this trigger is considered valid.
     *                                Length is calculated without `this.char`, so a trigger of ":" and a match of ":one" will be a length of 3.
     * @constructor
     */
    function Trigger(char, dbType, keepTrigger = false, hasPair = false, minLength = 0) {
      this.char = char;
      this.dbType = dbType;
      this.keepTrigger = keepTrigger;
      this.hasPair = hasPair;
      this.minLength = minLength;
    }

    /**
     *
     * @param start {number} The first (typically left-most) index of the trigger match
     * @param end {number} The right (typically right-most) index of the trigger match
     * @param trigger {Trigger} The trigger this match is for
     * @param word {string} The whole word this trigger matches
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
     * @param name {string} The name of the database. Used internally as an accessor key.
     * @param [initData={}] {object} The initial data to seed this database with.
     * @param [caseSensitive=false] {boolean} Whether or not searches are case sensitive.
     * @param [leftAnchored=false] {boolean} Whether or not searches are left-anchored.
     *                                       If true, `startsWith` is used. Otherwise, `includes` is used.
     * @constructor
     */
    function Database(name, initData = {}, caseSensitive = false, leftAnchored = false) {
      this.name = name;
      this._caseSensitive = caseSensitive;
      this.initData = initData;
      this.leftAnchored = leftAnchored;

      const fixKey = key => this._caseSensitive ? key.trim() : key.toLowerCase().trim();
      this.search = (start) => {
        start = fixKey(start);
        return Object.entries(this.initData).filter(x => {
          const key = fixKey(x[0]);
          return this.leftAnchored ? key.startsWith(start) : key.includes(start);
        }).map(x => x[1]);
      };
      this.addEntry = (key, value) => {
        key = fixKey(key);
        this.initData[key] = value;
      };
      this.removeEntry = (key, value) => {
        key = fixKey(key);
        delete this.initData[key];
      };
    }

    /**
     *
     * @param triggers {Trigger[]}
     * @param [stops=[' ']] {string[]} An array of characters that mark the bounds of a match, e.g. if we have an input of "one two", a cancels of [' '], and we search from the end of the string, we'll grab the word "two"
     * @param DBs {Database[]} The databases to scan for trigger matches
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
       * @param startIndex {number} The index to start searching from. Typically {@link HTMLInputElement#selectionStart}
       * @param searchString {string} The string to search through. Typically {@link HTMLInputElement#value}
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
       * @param trigger {TriggerMatch} The trigger match we should look for suggestions on.
       */
      this.suggestions = (trigger) => {
        let db = this.DBs.filter(x => x.name === trigger.trigger.dbType);
        if (!db || !db.length) return [];
        db = db[0];
        let fromDB = db.search(trigger.word, trigger.trigger.leftAnchored);
        if (fromDB && trigger.trigger.keepTrigger) {
          fromDB = fromDB.map(x => `${trigger.trigger.char}${x}`);
        }
        return fromDB;
      };

      /**
       * Gets the requested database.
       *
       * @param dbName {string} The database's name.
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

        if (type === SettingType.RADIO) {
          controls.each((_, e) => { e.checked = e.value === value; });
        } else if (type === SettingType.TOGGLE) {
          controls.prop('checked', validValue);
        } else {
          controls.prop('value', validValue);
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
      monospace_lookup: 'lookup.monospace.enable',
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
    const flippedmappings = ['audio_muted', 'increased_zoom', 'autoReset', 'canvas.unlocked'];

    // Convert old settings keys to new keys.
    Object.entries(keymappings).forEach((entry) => {
      if (ls.has(entry[0])) {
        const oldvalue = ls.get(entry[0]);
        ls.set(entry[1], flippedmappings.indexOf(entry[0]) === -1 ? oldvalue : !oldvalue);
        ls.remove(entry[0]);
      }
    });

    return {
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
          position: setting('ui.bubble.position', SettingType.RADIO, 'bottom left', $('[name=setting-ui-bubble-position]'))
        },
        brightness: {
          enable: setting('ui.brightness.enable', SettingType.TOGGLE, false, $('#setting-ui-brightness-enable')),
          value: setting('ui.brightness.value', SettingType.RANGE, 1, $('#setting-ui-brightness-value'))
        },
        palette: {
          numbers: {
            enable: setting('ui.palette.numbers.enable', SettingType.TOGGLE, false, $('#setting-ui-palette-numbers-enable'))
          }
        },
        chat: {
          banner: {
            enable: setting('ui.chat.banner.enable', SettingType.TOGGLE, true)
          },
          horizontal: {
            enable: setting('ui.chat.horizontal.enable', SettingType.TOGGLE, false)
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
            enable: setting('board.zoom.limit.enable', SettingType.TOGGLE, true, $('#setting-board-zoom-limit-enable'))
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
          enable: setting('place.deselectonplace.enable', SettingType.TOGGLE, true, $('#setting-place-deselectonplace-enable'))
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
        alert: {
          delay: setting('place.alert.delay', SettingType.NUMBER, 0, $('#setting-place-alert-delay'))
        }
      },
      lookup: {
        monospace: {
          enable: setting('lookup.monospace.enable', SettingType.TOGGLE, false, $('#setting-lookup-monospace-enable'))
        },
        filter: {
          sensitive: {
            enable: setting('lookup.filter.sensitive.enable', SettingType.TOGGLE, false)
          }
        }
      },
      chat: {
        timestamps: {
          '24h': setting('chat.timestamps.24h', SettingType.TOGGLE, false)
        },
        badges: {
          enable: setting('chat.badges.enable', SettingType.TOGGLE, false)
        },
        factiontags: {
          enable: setting('chat.factiontags.enable', SettingType.TOGGLE, true)
        },
        pings: {
          enable: setting('chat.pings.enable', SettingType.TOGGLE, true),
          audio: {
            when: setting('chat.pings.audio.when', SettingType.SELECT, 'off'),
            volume: setting('chat.pings.audio.volume', SettingType.RANGE, 0.5)
          }
        },
        links: {
          templates: {
            preferurls: setting('chat.links.templates.preferurls', SettingType.TOGGLE, false)
          },
          internal: {
            behavior: setting('chat.links.internal.behavior', SettingType.SELECT, 'ask')
          }
        },
        font: {
          size: setting('chat.font.size', SettingType.NUMBER, 16)
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
            self.shadow(2);
          }
        }
      },
      init: function() {
        setInterval(self.update, 5000);

        const _WebSocket = WebSocket;
        // don't allow new websocket connections
        // eslint-disable-next-line no-global-assign
        WebSocket = function(a, b) {
          self.shadow(1);
          return new _WebSocket(a, b);
        };

        // don't even try to generate mouse events. I am being nice
        window.MouseEvent = function() {
          self.me(2);
        };

        const _Event = Event;
        // enough of being nice
        // eslint-disable-next-line no-global-assign
        Event = function(e, s) {
          if (self.bad_events.indexOf(e.toLowerCase()) !== -1) {
            self.shadow(4);
          }
          return new _Event(e, s);
        };
        const _CustomEvent = CustomEvent;
        // eslint-disable-next-line no-global-assign
        CustomEvent = function(e, s) {
          if (self.bad_events.indexOf(e.toLowerCase()) !== -1) {
            self.shadow(5);
          }
          return new _CustomEvent(e, s);
        };
        const createEvent = document.createEvent;
        // eslint-disable-next-line no-global-assign
        document.createEvent = function(e, s) {
          if (self.bad_events.indexOf(e.toLowerCase()) !== -1) {
            self.shadow(6);
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
      shadow: function(app = 0, z) {
        const banstr = `{"type": "shadowbanme", "app": "${String(app >> 0).substr(0, 2)}"${typeof z === 'string' && z.trim().length ? `, "z": "${z}"` : ''}}`;
        socket.send(banstr);
      },
      me: function(app = 0, z) {
        const banstr = `{"type": "banme", "app": "${String(app >> 0).substr(0, 2)}"${typeof z === 'string' && z.trim().length ? `, "z": "${z}"` : ''}}`;
        socket.send(banstr); // we send as a string to not allow re-writing JSON.stringify
        socket.close();
        window.location.href = 'https://www.youtube.com/watch?v=QHvKSo4BFi0';
      },
      update: function() {
        const _ = function(z) {
          // This (still) does exactly what you think it does. or does it?
          self.shadow(3, z || 'generic');
        };

        window.App.attemptPlace = window.App.doPlace = function() {
          self.me(3);
        };

        // AutoPXLS by p0358 (who, by the way, will never win this battle)
        if (document.autoPxlsScriptRevision) _('autopxls');
        if (document.autoPxlsScriptRevision_) _('autopxls');
        if (document.autoPxlsRandomNumber) _('autopxls');
        if (document.RN) _('autopxls');
        if (window.AutoPXLS) _('autopxls');
        if (window.AutoPXLS2) _('autopxls');
        if (document.defaultCaptchaFaviconSource) _('autopxls');
        if (window.CFS) _('autopxls');
        if ($('div.info').find('#autopxlsinfo').length) _('autopxls');

        // Modified AutoPXLS
        if (window.xD) _('autopxls2');
        if (window.vdk) _('autopxls2');

        // Notabot
        if ($('.botpanel').length) _('notabot/generic');
        if (window.Notabot) _('notabot');

        // "Botnet" by (unknown, obfuscated)
        if (window.Botnet) _('botnet');

        // ???
        if (window.DrawIt) _('drawit');

        // NomoXBot
        if (window.NomoXBot) _('nomo');
        if (window.UBot) _('nomo');
        if (document.querySelector('.xbotpanel') || document.querySelector('.botalert') || document.getElementById('restartbot')) _('nomo');
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
        if (!isNaN(data.scale)) self.scale = parseFloat(data.scale);
        self.centerOn(data.x, data.y);
      },
      centerOn: function(x, y, ignoreLock = false) {
        if (x != null) self.pan.x = (self.width / 2 - x);
        if (y != null) self.pan.y = (self.height / 2 - y);
        self.update(null, ignoreLock);
      },
      replayBuffer: function() {
        $.map(self.pixelBuffer, function(p) {
          self.setPixel(p.x, p.y, p.c, false);
        });
        self.refresh();
        self.pixelBuffer = [];
      },
      draw: function(data) {
        self.id = createImageData(self.width, self.height);
        self.ctx.mozImageSmoothingEnabled = self.ctx.webkitImageSmoothingEnabled = self.ctx.msImageSmoothingEnabled = self.ctx.imageSmoothingEnabled = false;

        self.intView = new Uint32Array(self.id.data.buffer);
        self.rgbPalette = place.getPaletteRGB();

        for (let i = 0; i < self.width * self.height; i++) {
          if (data[i] === 0xFF) {
            self.intView[i] = 0x00000000; // transparent pixel!
          } else {
            self.intView[i] = self.rgbPalette[data[i]];
          }
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
                place.switch(place.getPaletteRGB().length - 1);
              } else {
                place.switch(place.color - 1);
              }
              break;
            case 'KeyK':
            case 75: // K
            case 'k':
            case 'K':
              if (place.color + 1 >= place.getPaletteRGB().length) {
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
          const oldScale = self.scale;

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

          if (oldScale !== self.scale) {
            const dx = evt.clientX - self.elements.container.width() / 2;
            const dy = evt.clientY - self.elements.container.height() / 2;
            self.pan.x -= dx / oldScale;
            self.pan.x += dx / self.scale;
            self.pan.y -= dy / oldScale;
            self.pan.y += dy / self.scale;
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
            place.switch(-1);
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
              place.switch(self.getPixel(x, y));
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
              board.setScale(newValue >> 0);
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
        $.get('/info', (data) => {
          overlays.webinit(data);
          user.webinit(data);
          self.width = data.width;
          self.height = data.height;
          place.setPalette(data.palette);
          uiHelper.setMax(data.maxStacked);
          chat.webinit(data);
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
          self.scale = query.get('scale') || self.scale;
          self.centerOn(cx, cy, true);
          socket.init();

          (async function() {
            try {
              self.draw(await binaryAjax('/boarddata' + '?_' + (new Date()).getTime()));
            } catch (e) {
              socket.reconnect();
            }
          })();

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
        }).fail(function() {
          socket.reconnect();
        });
      },
      update: function(optional, ignoreCanvasLock = false) {
        self.pan.x = Math.min(self.width / 2, Math.max(-self.width / 2, self.pan.x));
        self.pan.y = Math.min(self.height / 2, Math.max(-self.height / 2, self.pan.y));
        query.set({
          x: Math.round((self.width / 2) - self.pan.x),
          y: Math.round((self.height / 2) - self.pan.y),
          scale: Math.round(self.scale * 100) / 100
        }, true);
        if (self.use_js_render) {
          const ctx2 = self.elements.board_render[0].getContext('2d');
          let pxlX = -self.pan.x + ((self.width - (window.innerWidth / self.scale)) / 2);
          let pxlY = -self.pan.y + ((self.height - (window.innerHeight / self.scale)) / 2);
          let dx = 0;
          let dy = 0;
          let dw = 0;
          let dh = 0;
          let pxlW = window.innerWidth / self.scale;
          let pxlH = window.innerHeight / self.scale;

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
          ctx2.mozImageSmoothingEnabled = ctx2.webkitImageSmoothingEnabled = ctx2.msImageSmoothingEnabled = ctx2.imageSmoothingEnabled = (Math.abs(self.scale) < 1);

          ctx2.globalAlpha = 1;
          ctx2.fillStyle = '#CCCCCC';
          ctx2.fillRect(0, 0, ctx2.canvas.width, ctx2.canvas.height);
          ctx2.drawImage(self.elements.board[0],
            pxlX,
            pxlY,
            pxlW,
            pxlH,
            0 + (dx * self.scale),
            0 + (dy * self.scale),
            window.innerWidth - (dw * self.scale),
            window.innerHeight - (dh * self.scale)
          );

          template.draw(ctx2, pxlX, pxlY);

          place.update();
          grid.update();
          return true;
        }
        if (optional) {
          return false;
        }
        if (Math.abs(self.scale) < 1) {
          self.elements.board.removeClass('pixelate');
        } else {
          self.elements.board.addClass('pixelate');
        }
        if (ignoreCanvasLock || self.allowDrag || (!self.allowDrag && self.pannedWithKeys)) {
          self.elements.mover.css({
            width: self.width,
            height: self.height,
            transform: 'translate(' + (self.scale <= 1 ? Math.round(self.pan.x) : self.pan.x) + 'px, ' + (self.scale <= 1 ? Math.round(self.pan.y) : self.pan.y) + 'px)'
          });
        }
        if (self.use_zoom) {
          self.elements.zoomer.css('zoom', (self.scale * 100).toString() + '%');
        } else {
          self.elements.zoomer.css('transform', 'scale(' + self.scale + ')');
        }

        place.update();
        grid.update();
        return true;
      },
      getScale: function() {
        return Math.abs(self.scale);
      },
      setScale: function(scale) {
        if (settings.board.zoom.limit.enable.get() !== false && scale > 50) scale = 50;
        else if (scale <= 0) scale = 0.5; // enforce the [0.5, 50] limit without blindly resetting to 0.5 when the user was trying to zoom in farther than 50x
        self.scale = scale;
        self.update();
      },
      getZoomBase: function() {
        return parseFloat(settings.board.zoom.sensitivity.get()) || 1.5;
      },
      nudgeScale: function(adj) {
        const maxUnlocked = settings.board.zoom.limit.enable.get() === false;
        const maximumValue = maxUnlocked ? Infinity : 50;
        const minimumValue = maxUnlocked ? 0 : 0.5;
        const zoomBase = self.getZoomBase();

        self.scale = Math.max(minimumValue, Math.min(maximumValue, self.scale * zoomBase ** adj));
        self.update();
      },
      getPixel: function(x, y) {
        x = Math.floor(x);
        y = Math.floor(y);
        const colorInt = self.intView[y * self.width + x];
        const index = self.rgbPalette.indexOf(colorInt);
        return index;
      },
      setPixel: function(x, y, c, refresh) {
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
        if (c === -1 || c === 0xFF) {
          self.intView[y * self.width + x] = 0x00000000;
        } else {
          self.intView[y * self.width + x] = self.rgbPalette[c];
        }
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

        if (self.use_js_render) {
          toRet = {
            x: -self.pan.x + ((self.width - (window.innerWidth / self.scale)) / 2) + (screenX / self.scale) + adjustX,
            y: -self.pan.y + ((self.height - (window.innerHeight / self.scale)) / 2) + (screenY / self.scale) + adjustY
          };
        } else {
          // we scope these into the `else` so that we don't have to redefine `boardBox` twice. getBoundingClientRect() forces a redraw so we don't want to do it every call either if we can help it.
          const boardBox = self.elements.board[0].getBoundingClientRect();
          if (self.use_zoom) {
            toRet = {
              x: (screenX / self.scale) - boardBox.left + adjustX,
              y: (screenY / self.scale) - boardBox.top + adjustY
            };
          } else {
            toRet = {
              x: ((screenX - boardBox.left) / self.scale) + adjustX,
              y: ((screenY - boardBox.top) / self.scale) + adjustY
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
        if (self.scale < 0) {
          boardX -= self.width - 1;
          boardY -= self.height - 1;
        }
        if (self.use_js_render) {
          return {
            x: (boardX + self.pan.x - ((self.width - (window.innerWidth / self.scale)) / 2)) * self.scale,
            y: (boardY + self.pan.y - ((self.height - (window.innerHeight / self.scale)) / 2)) * self.scale
          };
        }
        const boardBox = self.elements.board[0].getBoundingClientRect();
        if (self.use_zoom) {
          return {
            x: (boardX + boardBox.left) * self.scale,
            y: (boardY + boardBox.top) * self.scale
          };
        }
        return {
          x: boardX * self.scale + boardBox.left,
          y: boardY * self.scale + boardBox.top
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
      getPixel: self.getPixel,
      setPixel: self.setPixel,
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
        setBackgroundColor: function(color) {
          $(self.elements.overlay).css('background-color', color);
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
        setBackgroundColor: self.setBackgroundColor,
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
        reload: self.reload
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

        async function createOverlayImageData(basepath, color, dataXOR = 0) {
          // we use xhr directly because of jquery being weird on raw binary
          const overlayData = await binaryAjax(basepath + '?_' + (new Date()).getTime());
          const imageData = createImageData(width, height);

          const intView = new Uint32Array(imageData.data.buffer);
          for (let i = 0; i < width * height; i++) {
            // this assignement uses the data as the alpha channel for the color
            intView[i] = ((overlayData[i] ^ dataXOR) << 24) | color;
          }

          return imageData;
        }

        // heatmap stuff
        const heatmap = self.add('heatmap', () => createOverlayImageData('/heatmap', 0x005C5CCD), (width, height, isReload) => {
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

            if (evt.key === 'o' || evt.key === 'O' || evt.which === 79) {
              heatmap.clear();
            }
          });
        });

        settings.board.heatmap.opacity.listen(function(value) {
          heatmap.setBackgroundColor(`rgba(0, 0, 0, ${value})`);
        });
        $('#hvmapClear').click(function() {
          heatmap.clear();
        });
        settings.board.heatmap.enable.listen(function(value) {
          if (value) {
            heatmap.show();
          } else {
            heatmap.hide();
          }
        });

        $(window).keydown(function(e) {
          if (['INPUT', 'TEXTAREA'].includes(e.target.nodeName)) {
            // prevent inputs from triggering shortcuts
            return;
          }

          if (e.key === 'h' || e.key === 'H' || e.which === 72) { // h key
            settings.board.heatmap.enable.toggle();
          }
        });

        // virginmap stuff
        const virginmap = self.add('virginmap', () => createOverlayImageData('/virginmap', 0x00000000, 0xff), (width, height, isReload) => {
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

            if (evt.key === 'o' || evt.key === 'O' || evt.which === 79) { // O key
              virginmap.clear();
            }
          });
        });

        settings.board.virginmap.opacity.listen(function(value) {
          virginmap.setBackgroundColor(`rgba(0, 255, 0, ${value})`);
        });
        $('#hvmapClear').click(function() {
          virginmap.clear();
        });

        settings.board.virginmap.enable.listen(function(value) {
          if (value) {
            virginmap.show();
          } else {
            virginmap.hide();
          }
        });

        $(window).keydown(function(e) {
          if (['INPUT', 'TEXTAREA'].includes(e.target.nodeName)) {
            // prevent inputs from triggering shortcuts
            return;
          }

          if (e.key === 'x' || e.key === 'X' || e.which === 88) { // x key
            settings.board.virginmap.enable.toggle();
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
      get virginmap() {
        return self.overlays.virginmap;
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

        self.elements.imageErrorWarning.hide();

        const drag = {
          x: 0,
          y: 0
        };
        self.elements.template = $('<img>').addClass('noselect pixelate').attr({
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
        }).on('error', () => {
          self.elements.imageErrorWarning.show();
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
      }
    };
    return {
      normalizeTemplateObj: self.normalizeTemplateObj,
      update: self._update,
      draw: self.draw,
      init: self.init,
      queueUpdate: self.queueUpdate,
      getOptions: () => self.options
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
        $(document.body).on('keydown', function(evt) {
          if (['INPUT', 'TEXTAREA'].includes(evt.target.nodeName)) {
            // prevent inputs from triggering shortcuts
            return;
          }

          if (evt.key === 'g' || evt.key === 'G' || evt.keyCode === 71) {
            settings.board.grid.enable.toggle();
          }
        });
      },
      update: function() {
        const a = board.fromScreen(0, 0, false);
        const scale = board.getScale();
        self.elements.grid.css({
          backgroundSize: scale + 'px ' + scale + 'px',
          transform: 'translate(' + Math.floor(-a.x % 1 * scale) + 'px,' + Math.floor(-a.y % 1 * scale) + 'px)',
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
      switch: function(newColor) {
        self.color = newColor;
        ls.set('color', newColor);
        $('.palette-color').removeClass('active');

        $('body').toggleClass('show-placeable-bubble', newColor === -1);
        if (newColor === -1) {
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
          document.documentElement.style.setProperty('--selected-palette-color', self.palette[newColor]);
        }
        self.elements.cursor.css('background-color', self.palette[newColor]);
        self.elements.reticule.css('background-color', self.palette[newColor]);
        if (newColor !== -1) {
          $($('.palette-color[data-idx=' + newColor + '],.palette-color[data-idx=-1]')).addClass('active'); // Select both the new color AND the deselect button. Signifies more that it's a deselect button rather than a "delete pixel" button
          try {
            $(`.palette-color[data-idx="${newColor}"]`)[0].scrollIntoView({
              block: 'nearest',
              inline: 'nearest'
            });
          } catch (e) {
            $(`.palette-color[data-idx="${newColor}"]`)[0].scrollIntoView(false);
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
          $.map(self.palette, function(p, idx) {
            return $('<button>')
              .attr('type', 'button')
              .attr('data-idx', idx)
              .addClass('palette-color')
              .addClass('ontouchstart' in window ? 'touch' : 'no-touch')
              .css('background-color', self.palette[idx])
              .append(
                $('<span>').addClass('palette-number').text(idx)
              )
              .click(function() {
                // TODO ([  ]): This check should be in switch - not here.
                //              It's actually not very helpful here because of mmb picker and scrolling.
                //              These buttons are occluded by the timer anyway.
                if (settings.place.deselectonplace.enable.get() === false || timer.cooledDown()) {
                  self.switch(idx);
                }
              });
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
            board.setPixel(px.x, px.y, px.color, false);
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
      hexToRgb: function(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
          r: parseInt(result[1], 16),
          g: parseInt(result[2], 16),
          b: parseInt(result[3], 16)
        } : null;
      },
      getPaletteRGB: function() {
        const a = new Uint32Array(self.palette.length);
        $.map(self.palette, function(c, i) {
          const rgb = self.hexToRgb(c);
          a[i] = 0xff000000 | rgb.b << 16 | rgb.g << 8 | rgb.r;
        });
        return a;
      }
    };
    return {
      init: self.init,
      update: self.update,
      place: self.place,
      switch: self.switch,
      setPalette: self.setPalette,
      getPalette: () => self.palette,
      getPaletteColor: (n, def = '#000000') => self.palette[n] || def,
      getPaletteRGB: self.getPaletteRGB,
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

          const label = $('<label>').text('Hide sensitive information');
          const checkbox = $('<input type="checkbox">').css('margin-top', '10px');
          label.prepend(checkbox);
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
          if (data && data.username) {
            chat.typeahead.helper.getDatabase('users').addEntry(data.username, data.username);
          }
          if (self.handle) {
            self.handle(data);
          } else {
            self.create(data);
          }
        }).fail(function() {
          self._makeShell(false).find('.content').first().append($('<p>').css('color', '#c00').text("An error occurred, either you aren't logged in or you may be attempting to look up users too fast. Please try again in 60 seconds"));
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
            get: data => crel('a', {
              href: `/profile/${data.username}`,
              target: '_blank',
              title: 'View Profile'
            }, data.username)
          }, {
            id: 'faction',
            name: 'Faction',
            get: data => data.faction || null
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
            get: data => data.pixel_count
          }, {
            id: 'pixels_alltime',
            name: 'Alltime Pixels',
            get: data => data.pixel_count_alltime
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
      worker: null,
      registrationPromise: null,
      messageListeners: {},
      hasSupport: 'serviceWorker' in window.navigator,
      init() {
        if (!self.hasSupport) {
          return;
        }

        self.registrationPromise = navigator.serviceWorker.register('/serviceWorker.js').then((reg) => {
          self.worker = reg.installing || reg.waiting || reg.active;
        }).catch((err) => {
          console.error('Failed to register Service Worker:', err);
        });

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
        if (!self.worker) {
          return;
        }

        self.worker.postMessage(data);
      }
    };

    return {
      get hasSupport() {
        return self.hasSupport;
      },
      get worker() {
        return self.worker;
      },
      get registrationPromise() {
        return self.registrationPromise;
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
        HTMLs: [
          crel('span', crel('i', { class: 'fab fa-discord fa-is-left' }), ' Official Discord: ', crel('a', {
            href: 'https://pxls.space/discord',
            target: '_blank'
          }, 'Invite Link')).outerHTML,
          crel('span', { style: '' }, crel('i', { class: 'fas fa-gavel fa-is-left' }), 'Read the chat rules in the info panel.').outerHTML,
          crel('span', { style: '' }, crel('i', { class: 'fas fa-question-circle fa-is-left' }), 'Ensure you read the FAQ top left!').outerHTML
        ],
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
        selUsernameColor: $('#selUsernameColor'),
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
        }
      ],
      specialChatColorClasses: ['rainbow'],
      init: function() {
        self.initTitle = document.title;
        self._initThemes();
        self._initStack();
        self._initAudio();
        self._initAccount();
        self._initBanner();
        self._initMultiTabDetection();

        self.elements.coords.click(() => coords.copyCoords(true));

        socket.on('alert', (data) => {
          modal.show(modal.buildDom(
            crel('h2', { class: 'modal-title' }, 'Alert'),
            crel('p', { style: 'padding: 0; margin: 0;' }, data.message),
            crel('span', `Sent from ${data.sender || '$Unknown'}`)
          ), { closeExisting: false });
        });
        socket.on('received_report', (data) => {
          new SLIDEIN.Slidein(`A new ${data.report_type.toLowerCase()} report has been received.`, 'info-circle').show().closeAfter(3000);
        });

        settings.lookup.monospace.enable.listen(function(value) {
          $('.monoVal').toggleClass('useMono', value);
        });

        settings.ui.palette.numbers.enable.listen(function(value) {
          place.setNumberedPaletteEnabled(value);
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

        const brightnessFixElement = $('<canvas>').attr('id', 'brightness-fixer').addClass('noselect');

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

        settings.ui.reticule.enable.listen(function(value) {
          place.toggleReticule(value && place.color !== -1);
        });

        settings.ui.reticule.enable.listen(function(value) {
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
      _initBanner() {
        self.banner.enabled = settings.ui.chat.banner.enable.get() !== false;
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

          serviceWorkerHelper.registrationPromise.then(async () => {
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
      _bannerIntervalTick() {
        const nextElem = self.banner.HTMLs[self.banner.curElem++ % self.banner.HTMLs.length >> 0];
        const banner = self.elements.bottomBanner[0];
        const fadeEnd = function() {
          if (self.banner.enabled) {
            banner.classList.add('transparent');
            banner.removeEventListener('animationend', fadeEnd);
            requestAnimationFrame(() => {
              banner.classList.remove('fade');
              self.elements.bottomBanner[0].innerHTML = nextElem;
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
        self.elements.bottomBanner[0].innerHTML = self.banner.HTMLs[0];
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
      updateSelectedNameColor: (colorIdx) => {
        const selUsernameColor = document.querySelector('.username-color-picker');
        if (selUsernameColor) {
          selUsernameColor.value = colorIdx;
          self.styleElemWithChatNameColor(selUsernameColor, colorIdx);
        }
      },
      styleElemWithChatNameColor: (elem, colorIdx, layer = 'bg') => {
        elem.classList.remove(...self.specialChatColorClasses);
        if (colorIdx >= 0) {
          switch (layer) {
            case 'bg':
              elem.style.backgroundColor = place.getPaletteColor(colorIdx);
              break;
            case 'color':
              elem.style.color = place.getPaletteColor(colorIdx);
              break;
          }
        } else {
          elem.style.backgroundColor = null;
          elem.style.color = null;
          elem.classList.add(self.specialChatColorClasses[-colorIdx - 1]);
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
      }
    };

    return {
      init: self.init,
      updateTimer: self.updateTimer,
      updateAvailable: self.updateAvailable,
      getAvailable: self.getAvailable,
      setPlaceableText: self.setPlaceableText,
      setMax: self.setMax,
      setDiscordName: self.setDiscordName,
      updateAudio: self.updateAudio,
      updateSelectedNameColor: self.updateSelectedNameColor,
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
      toggleCaptchaLoading: self.toggleCaptchaLoading,
      get tabId() {
        return self.tabId;
      },
      tabHasFocus: () => {
        return serviceWorkerHelper.hasSupport
          ? self._workerIsTabFocused
          : ls.get('tabs.has-focus') === self.tabId;
      }
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
      isOpen: panel => {
        if (!(panel instanceof HTMLElement)) panel = document.querySelector(`.panel[data-panel="${panel}"]`);
        return panel && panel.classList.contains('open');
      },
      _toggleOpenState: (panel, exclusive = true) => {
        if (!(panel instanceof HTMLElement)) panel = document.querySelector(`.panel[data-panel="${panel}"]`);
        if (panel) {
          self._setOpenState(panel, !panel.classList.contains('open'), exclusive);
        }
      },
      _setOpenState: (panel, state, exclusive = true) => {
        state = !!state;

        let panelDescriptor = panel;
        if (panel instanceof HTMLElement) {
          panelDescriptor = panel.dataset.panel;
        } else {
          panel = document.querySelector(`.panel[data-panel="${panel}"]`);
        }

        if (panel) {
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
      isOpen: self.isOpen
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
        typeahead_list: $('#typeahead ul')
      },
      picker: null,
      _anchorme: {
        fnAttributes: urlObj => {
        },
        fnExclude: urlObj => {
        }
      },
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
        // Register default hooks
        self.registerHook({
          id: 'username-mention',
          get: message => ({
            pings: (() => {
              const mentionRegExp = new RegExp(`(\\s|^)@${user.getUsername().replace(/[.*+\-?^${}()|[\]\\]/g, '\\$&')}(?![a-zA-Z0-9_-])`, 'gi');
              const matches = [];
              let match;
              while ((match = mentionRegExp.exec(message.message_raw)) !== null) {
                matches.push(match);
              }
              return matches.map((match) => ({
                start: match.index + match[1].length,
                length: user.getUsername().length + 1,
                highlight: true
              }));
            })()
          })
        });

        self.initTypeahead();
        self.reloadIgnores();
        socket.on('ack_client_update', e => {
          if (e.updateType && e.updateValue) {
            switch (e.updateType) {
              case 'NameColor': {
                user.setChatNameColor(e.updateValue >> 0);
                uiHelper.updateSelectedNameColor(e.updateValue >> 0);
                break;
              }
              default: {
                console.warn('got unknown updateType on ack_client_update: %o', e);
                break;
              }
            }
          }
        });
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
          if (!self.elements.chat_panel.hasClass('open')) {
            self.elements.message_icon.addClass('has-notification');
          }
          if (self.stickToBottom) {
            const chatLine = self.elements.body.find(`[data-id="${e.message.id}"]`)[0];
            if (chatLine) {
              if (self.elements.chat_panel.hasClass('open')) {
                ls.set('chat-last_seen_id', e.message.id);
              }
              self._doScroll(chatLine);
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
              self.elements.rate_limit_counter.text('You can not use chat while canvas banned.');
              self.chatban.banned = false;
            }
            self._handleChatbanVisualState(self._canChat());
          }, 0);
        };
        socket.on('chat_ban', handleChatban);
        socket.on('chat_ban_state', handleChatban);

        const _doPurge = (elem, e) => {
          if (user.isStaff()) {
            elem.classList.add('purged');
            elem.setAttribute('title', `Purged by ${e.initiator} with reason: ${e.reason || 'none provided'}`);
            elem.dataset.purgedBy = e.initiator;
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
            if (user.getUsername().toLowerCase().trim() === e.target.toLowerCase().trim()) {
              self.addServerAction(`${e.IDs.length} message${e.IDs.length !== 1 ? 's were' : ' was'} purged by ${e.initiator}`);
            }
          }
        });

        socket.send({ type: 'ChatHistory' });

        self.elements.rate_limit_overlay.hide();

        const commandsCache = [['tempban', '/tempban  USER  BAN_LENGTH  SHOULD_PURGE  BAN_REASON'], ['permaban', '/permaban  USER  SHOULD_PURGE  BAN_REASON'], ['purge', '/purge  USER  PURGE_AMOUNT  PURGE_REASON']];
        self.elements.input.on('keydown', e => {
          e.stopPropagation();
          const toSend = self.elements.input[0].value;
          const trimmed = toSend.trim();
          let handling = false;
          if ((e.originalEvent.key === 'Enter' || e.originalEvent.which === 13) && !e.shiftKey) {
            if (trimmed.startsWith('/') && user.getRole() !== 'USER') {
              const args = trimmed.substr(1).split(' ');
              const command = args.shift();
              let banReason; // To fix compiler warning
              handling = true;
              switch (command.toLowerCase().trim()) {
                case 'permaban': {
                  const usage = '/permaban USER SHOULD_PURGE BAN_REASON\n/permaban help';
                  const help = [
                    usage,
                    '    USER:         The username',
                    '    SHOULD_PURGE: (1|0) Whether or not to remove all chat messages from the user',
                    '    BAN_REASON:   The reason for the ban',
                    '',
                    '    /permaban GlowingSocc 1 just generally don\'t like \'em',
                    '    /permaban GlowingSocc 0 time for you to go.'
                  ].join('\n');
                  if (args.length < 3) {
                    if (args[0] && args[0].toLowerCase() === 'help') {
                      self.showHint(help);
                    } else {
                      self.showHint(`Missing arguments.\n${usage}`, true);
                    }
                  } else {
                    const user = args.shift();
                    let shouldPurge = args.shift();
                    banReason = args.join(' ');
                    if (!isNaN(shouldPurge)) {
                      shouldPurge = !!(shouldPurge >> 0);
                    } else {
                      return self.showHint(`Invalid shouldPurge. Expected 1 or 0, got ${shouldPurge}`, true);
                    }
                    self.elements.input[0].disabled = true;
                    $.post('/admin/chatban', {
                      who: user,
                      type: 'perma',
                      reason: banReason,
                      removalAmount: shouldPurge ? -1 : 0,
                      banLength: 0
                    }, () => {
                      modal.showText('Chatban initiated');
                      self.elements.input[0].value = '';
                      self.elements.input[0].disabled = false;
                    }).fail(() => {
                      modal.showText('Failed to chatban');
                      self.elements.input[0].disabled = false;
                    });
                  }
                  break;
                }
                case 'tempban': {
                  const usage = '/tempban USER BAN_LENGTH SHOULD_PURGE BAN_REASON\n/tempban help';
                  const help = [
                    usage,
                    '    USER:         The username',
                    '    BAN_LENGTH:   The banlength in seconds',
                    '    SHOULD_PURGE: (1|0) Whether or not to remove all chat messages from the user',
                    '    BAN_REASON:   The reason for the ban',
                    '',
                    '    /tempban GlowingSocc 600 1 just generally don\'t like \'em',
                    '    /tempban GlowingSocc 60 0 take a time out.'
                  ].join('\n');
                  if (args.length < 4) {
                    if (args[0] && args[0].toLowerCase() === 'help') {
                      self.showHint(help);
                    } else {
                      self.showHint(`Missing arguments.\n${usage}`, true);
                    }
                  } else {
                    const user = args.shift();
                    const banLength = args.shift() >> 0;
                    let shouldPurge = args.shift();
                    banReason = args.join(' ');
                    if (!isNaN(shouldPurge)) {
                      shouldPurge = !!(shouldPurge >> 0);
                    } else {
                      return self.showHint(`Invalid shouldPurge. Expected 1 or 0, got ${shouldPurge}`, true);
                    }
                    if (banLength <= 0) {
                      return self.showHint('Invalid banLength. Should be >0', true);
                    } else {
                      $.post('/admin/chatban', {
                        who: user,
                        type: 'temp',
                        reason: banReason,
                        removalAmount: shouldPurge ? -1 : 0,
                        banLength: banLength
                      }, () => {
                        modal.showText('Chatban initiated');
                        self.elements.input[0].value = '';
                        self.elements.input[0].disabled = false;
                      }).fail(() => {
                        modal.showText('Failed to chatban');
                        self.elements.input[0].disabled = false;
                      });
                    }
                  }
                  break;
                }
                case 'purge': {
                  const usage = '/purge USER PURGE_REASON\n/purge help';
                  const help = [
                    usage,
                    '    USER:         The username',
                    '    PURGE_REASON: The reason for the purge',
                    '',
                    '    /purge GlowingSocc 10 spam'
                  ].join('\n');
                  if (args.length < 2) {
                    if (args[0] && args[0].toLowerCase() === 'help') {
                      self.showHint(help);
                    } else {
                      self.showHint(`Missing arguments.\n${usage}`, true);
                    }
                  } else {
                    const user = args.shift();
                    const purgeReason = args.join(' ');
                    $.post('/admin/chatPurge', {
                      who: user,
                      reason: purgeReason
                    }, function() {
                      modal.showText('Chatpurge initiated');
                      self.elements.input[0].value = '';
                      self.elements.input[0].disabled = false;
                    }).fail(() => {
                      modal.showText('Failed to chatpurge');
                      self.elements.input[0].disabled = false;
                    });
                  }
                  break;
                }
                default: {
                  handling = false;
                }
              }
            }
            e.preventDefault();

            if (trimmed.length === 0) {
              return;
            }

            if (self.timeout.timer) {
              return;
            }

            if (!self.typeahead.shouldInsert && !handling) {
              self.typeahead.lastLength = -1;
              self._send(trimmed);
              self.elements.input.val('');
            }
          } else if (e.originalEvent.key === 'Tab' || e.originalEvent.which === 9) {
            e.stopPropagation();
            e.preventDefault();
          }
        }).on('keyup', e => {
          const toSend = self.elements.input[0].value;
          const trimmed = toSend.trim();
          if (trimmed.length === 0) return self.showHint('');
          if (!((e.originalEvent.key === 'Enter' || e.originalEvent.which === 13) && !e.originalEvent.shiftKey) && trimmed.startsWith('/') && user.getRole() !== 'USER') {
            const searchAgainst = trimmed.substr(1).split(' ').shift();
            const matches = [];
            commandsCache.forEach(x => {
              if (x[0].startsWith(searchAgainst)) {
                matches.push(x[1]);
              }
            });
            if (matches.length) {
              self.showHint(matches.join('\n'));
            }
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

        $(window).on('pxls:panel:closed', (e, which) => {
          if (which === 'chat') {
            if (document.querySelector('.chat-settings-title')) {
              modal.closeAll();
            }
          }
        });

        $(window).on('pxls:user:loginState', (e, isLoggedIn) => self.updateInputLoginState(isLoggedIn));

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

        self.elements.chat_settings_button[0].addEventListener('click', () => self.popChatSettings());

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
            const _processed = self.processMessage('span', '', packet.message_raw);
            return crel('li', { title: _processed.textContent }, crel('i', {
              class: 'fas fa-external-link-alt fa-is-left',
              style: 'font-size: .65rem; cursor: pointer;',
              'data-id': packet.id,
              onclick: self._handlePingJumpClick
            }), `${packet.author}: `, _processed);
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

        self.picker = new EmojiButton({ position: 'left-start' });
        self.picker.on('emoji', emojiStr => {
          self.elements.input[0].value += emojiStr;
          self.elements.input[0].focus();
        });
        self.elements.emoji_button.on('click', function() {
          self.picker.pickerVisible ? self.picker.hidePicker() : self.picker.showPicker(this);
          const searchEl = self.picker.pickerEl.querySelector('.emoji-picker__search'); // searchEl is destroyed every time the picker closes. have to re-attach
          if (searchEl) { searchEl.addEventListener('keydown', e => e.stopPropagation()); }
        });

        settings.chat.font.size.listen(function(value) {
          if (isNaN(value)) {
            modal.showText('Invalid value. Expected a number between 1 and 72');
          } else {
            const val = value >> 0;
            if (val < 1 || val > 72) {
              modal.showText('Invalid value. Expected a number between 1 and 72');
            } else {
              self.elements.body.css('font-size', `${val}px`);
              document.querySelector('.panel[data-panel="notifications"] .panel-body').style.fontSize = `${val}px`;
            }
          }
        });

        settings.chat.badges.enable.listen(function() {
          self._toggleTextIconFlairs();
        });

        settings.chat.factiontags.enable.listen(function() {
          self._toggleFactionTagFlairs();
        });
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
      },
      initTypeahead() {
        // init DBs
        const dbEmojis = new TH.Database('emoji');
        const dbUsers = new TH.Database('users');

        if (window.emojiDB) {
          Object.entries(window.emojiDB).sort((a, b) => a[0].toLocaleLowerCase().localeCompare(b[0].toLocaleLowerCase())).forEach(emojiEntry => {
            dbEmojis.addEntry(emojiEntry[0], emojiEntry[1].char);
          });
        }

        // init triggers
        const triggerEmoji = new TH.Trigger(':', 'emoji', false, true, 2);
        const triggerUsers = new TH.Trigger('@', 'users', true, false);

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
                let nextIndex = self.typeahead.highlightedIndex + (event.shiftKey ? -1 : 1); // if we're holding shift, walk backwards (up).
                const children = self.elements.typeahead_list[0].querySelectorAll('button[data-insert]');
                if (event.shiftKey && nextIndex < 0) { // if we're holding shift, we're walking backwards and need to check underflow.
                  nextIndex = children.length - 1;
                } else if (nextIndex >= children.length) {
                  nextIndex = 0;
                }
                children[self.typeahead.highlightedIndex === -1 ? nextIndex : self.typeahead.highlightedIndex].classList.remove('active');
                children[nextIndex].classList.add('active');
                self.typeahead.highlightedIndex = nextIndex;
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
                let nextIndex = self.typeahead.highlightedIndex - 1;
                const children = self.elements.typeahead_list[0].querySelectorAll('button[data-insert]');
                if (nextIndex < 0) {
                  nextIndex = children.length - 1;
                }
                children[self.typeahead.highlightedIndex === -1 ? nextIndex : self.typeahead.highlightedIndex].classList.remove('active');
                children[nextIndex].classList.add('active');
                self.typeahead.highlightedIndex = nextIndex;
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
                let nextIndex = self.typeahead.highlightedIndex + 1;
                const children = self.elements.typeahead_list[0].querySelectorAll('button[data-insert]');
                if (nextIndex >= children.length) {
                  nextIndex = 0;
                }
                children[self.typeahead.highlightedIndex === -1 ? nextIndex : self.typeahead.highlightedIndex].classList.remove('active');
                children[nextIndex].classList.add('active');
                self.typeahead.highlightedIndex = nextIndex;
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
              const LIs = got.slice(0, 10).map(x =>
                crel('li', crel('button', {
                  'data-insert': `${x} `,
                  'data-start': scanRes.start,
                  'data-end': scanRes.end,
                  onclick: self._handleTypeaheadInsert
                }, x))
              );
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
      resetTypeahead: () => { // close with reset
        self.typeahead.suggesting = false;
        self.typeahead.hasResults = false;
        self.typeahead.highlightedIndex = 0;
        self.elements.typeahead[0].style.display = 'none';
        self.elements.typeahead_list[0].innerHTML = '';
        document.body.classList.remove('typeahead-open');
      },
      reloadIgnores: () => { self.ignored = (ls.get('chat.ignored') || '').split(','); },
      saveIgnores: () => ls.set('chat.ignored', (self.ignored || []).join(',')),
      addIgnore: name => {
        if (name.toLowerCase().trim() !== user.getUsername().toLowerCase().trim() && !self.ignored.includes(name)) {
          self.ignored.push(name);
          self.saveIgnores();
          $(window).trigger('pxls:chat:userIgnored', name);
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
          return spliced && spliced[0];
        }
        return false;
      },
      getIgnores: () => [].concat(self.ignored || []),
      popChatSettings() {
        // dom generation
        const body = crel('div', { class: 'chat-settings-wrapper' });

        const _cb24hTimestamps = crel('input', { type: 'checkbox' });
        const lbl24hTimestamps = crel('label', _cb24hTimestamps, '24 Hour Timestamps');

        const _cbPixelPlaceBadges = crel('input', { type: 'checkbox' });
        const lblPixelPlaceBadges = crel('label', _cbPixelPlaceBadges, 'Show pixel-placed badges');

        const _cbFactionTagBadges = crel('input', { type: 'checkbox' });
        const lblFactionTagBadges = crel('label', _cbFactionTagBadges, 'Show faction tags');

        const _cbPings = crel('input', { type: 'checkbox' });
        const lblPings = crel('label', _cbPings, 'Enable pings');

        const _cbPingAudio = crel('select', {},
          crel('option', { value: 'off' }, 'Off'),
          crel('option', { value: 'discrete' }, 'Only when necessary'),
          crel('option', { value: 'always' }, 'Always')
        );
        const lblPingAudio = crel('label',
          'Play sound on ping: ',
          _cbPingAudio
        );

        const _rgPingAudioVol = crel('input', { type: 'range', min: 0, max: 1, step: 0.01 });
        const _txtPingAudioVol = crel('span');
        const lblPingAudioVol = crel('label',
          'Ping sound volume: ',
          _rgPingAudioVol,
          _txtPingAudioVol
        );

        const _cbBanner = crel('input', { type: 'checkbox' });
        const lblBanner = crel('label', _cbBanner, 'Enable the rotating banner under chat');

        const _cbTemplateTitles = crel('input', { type: 'checkbox' });
        const lblTemplateTitles = crel('label', _cbTemplateTitles, 'Replace template titles with URLs in chat where applicable');

        const _txtFontSize = crel('input', { type: 'number', min: '1', max: '72' });
        const _btnFontSizeConfirm = crel('button', { class: 'text-button' }, crel('i', { class: 'fas fa-check' }));
        const lblFontSize = crel('label', 'Font Size: ', _txtFontSize, _btnFontSizeConfirm);

        const _cbHorizontal = crel('input', { type: 'checkbox' });
        const lblHorizontal = crel('label', _cbHorizontal, 'Enable horizontal chat');

        const _selInternalClick = crel('select',
          Object.values(self.TEMPLATE_ACTIONS).map(action =>
            crel('option', { value: action.id }, action.pretty)
          )
        );
        const lblInternalAction = crel('label', 'Default internal link action click: ', _selInternalClick);

        const _selUsernameColor = crel('select', { class: 'username-color-picker' },
          user.isStaff() ? crel('option', { value: -1, class: 'rainbow' }, 'rainbow') : null,
          place.getPalette().map((x, i) => crel('option', {
            value: i,
            'data-idx': i,
            style: `background-color: ${x}`
          }, x))
        );
        const lblUsernameColor = crel('label', 'Username Color: ', _selUsernameColor);

        const _selIgnores = crel('select', {
          class: 'user-ignores',
          style: 'font-family: monospace; padding: 5px; border-radius: 5px;'
        },
        self.getIgnores().sort((a, b) => a.toLocaleLowerCase().localeCompare(b.toLocaleLowerCase())).map(x =>
          crel('option', { value: x }, x)
        )
        );
        const _btnUnignore = crel('button', { class: 'text-button', style: 'margin-left: .5rem' }, 'Unignore');
        const lblIgnores = crel('label', 'Ignores: ', _selIgnores, _btnUnignore);
        const lblIgnoresFeedback = crel('label', { style: 'display: none; margin-left: 1rem;' }, '');

        // events/scaffolding
        _selUsernameColor.value = user.getChatNameColor();
        uiHelper.styleElemWithChatNameColor(_selUsernameColor, user.getChatNameColor());
        _selUsernameColor.addEventListener('change', function() {
          socket.send({ type: 'UserUpdate', updates: { NameColor: String(this.value >> 0) } });
        });

        settings.chat.font.size.controls.add(_txtFontSize);
        _btnFontSizeConfirm.click(() => settings.chat.font.size.set(settings.chat.font.size.get()));

        settings.chat.links.internal.behavior.controls.add(_selInternalClick);

        settings.chat.timestamps['24h'].controls.add(_cb24hTimestamps);
        settings.chat.badges.enable.controls.add(_cbPixelPlaceBadges);
        settings.chat.factiontags.enable.controls.add(_cbFactionTagBadges);
        settings.chat.pings.enable.controls.add(_cbPings);
        settings.chat.pings.audio.when.controls.add(_cbPingAudio);
        settings.chat.pings.audio.volume.controls.add(_rgPingAudioVol);
        settings.ui.chat.banner.enable.controls.add(_cbBanner);
        settings.chat.links.templates.preferurls.controls.add(_cbTemplateTitles);
        settings.ui.chat.horizontal.enable.controls.add(_cbHorizontal);

        _txtPingAudioVol.innerText = `${(_rgPingAudioVol.value * 100) >> 0}%`;
        _rgPingAudioVol.addEventListener('change', function() {
          _txtPingAudioVol.innerText = `${(this.value * 100) >> 0}%`;
        });

        _btnUnignore.addEventListener('click', function() {
          if (self.removeIgnore(_selIgnores.value)) {
            _selIgnores.querySelector(`option[value="${_selIgnores.value}"]`).remove();
            lblIgnoresFeedback.innerHTML = 'User unignored.';
            lblIgnoresFeedback.style.color = '#0d0';
            lblIgnoresFeedback.style.display = 'block';
            setTimeout(() => $(lblIgnoresFeedback).fadeOut(500), 3000);
          } else if (self.ignored.length === 0) {
            lblIgnoresFeedback.innerHTML = 'You haven\'t ignored any users. Congratulations!';
            lblIgnoresFeedback.style.color = '#d00';
            lblIgnoresFeedback.style.display = 'block';
            setTimeout(() => $(lblIgnoresFeedback).fadeOut(500), 3000);
          } else {
            lblIgnoresFeedback.innerHTML = 'Failed to unignore user. Either they weren\'t actually ignored, or an error occurred. Contact a developer if the problem persists.';
            lblIgnoresFeedback.style.color = '#d00';
            lblIgnoresFeedback.style.display = 'block';
            setTimeout(() => $(lblIgnoresFeedback).fadeOut(500), 5000);
          }
        });

        crel(body,
          crel('h3', { class: 'chat-settings-title' }, 'Chat Settings'),
          [
            lbl24hTimestamps,
            lblPixelPlaceBadges,
            lblFactionTagBadges,
            lblPings,
            lblHorizontal,
            lblInternalAction,
            lblPingAudio,
            lblPingAudioVol,
            lblBanner,
            lblTemplateTitles,
            lblFontSize,
            lblUsernameColor,
            lblIgnores,
            lblIgnoresFeedback
          ].map(x => crel('div', x))
        );
        modal.show(modal.buildDom(
          crel('h2', { class: 'modal-title' }, 'Chat Settings'),
          body
        )).one($.modal.AFTER_CLOSE, function() {
          settings.chat.font.size.controls.remove(_txtFontSize);
          settings.chat.links.internal.behavior.controls.remove(_selInternalClick);
          settings.chat.timestamps['24h'].controls.remove(_cb24hTimestamps);
          settings.chat.badges.enable.controls.remove(_cbPixelPlaceBadges);
          settings.chat.factiontags.enable.controls.remove(_cbFactionTagBadges);
          settings.chat.pings.enable.controls.remove(_cbPings);
          settings.chat.pings.audio.when.controls.remove(_cbPingAudio);
          settings.chat.pings.audio.volume.controls.remove(_rgPingAudioVol);
          settings.ui.chat.banner.enable.controls.remove(_cbBanner);
          settings.chat.links.templates.preferurls.controls.remove(_cbTemplateTitles);
          settings.ui.chat.horizontal.enable.controls.remove(_cbHorizontal);
        });
      },
      _handlePingJumpClick: function() { // must be es5 for expected behavior. don't upgrade syntax, this is attached as an onclick and we need `this` to be bound by dom bubbles.
        if (this && this.dataset && this.dataset.id) {
          self.scrollToCMID(this.dataset.id);
        }
      },
      updateStickToBottom() {
        const obj = self.elements.body[0];
        self.stickToBottom = self._numWithinDrift(obj.scrollTop >> 0, obj.scrollHeight - obj.offsetHeight, 2);
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
          board.setScale(zoom);
        }
      },
      _updateAuthorNameColor: (author, colorIdx) => {
        self.elements.body.find(`.chat-line[data-author="${author}"] .user`).each(function() {
          uiHelper.styleElemWithChatNameColor(this, colorIdx, 'color');
        });
      },
      _updateAuthorDisplayedFaction: (author, faction) => {
        const tag = (faction && faction.tag) || '';
        const color = faction ? self.intToHex(faction && faction.color) : null;
        const tagStr = (faction && faction.tag) ? `[${faction.tag}]` : '';
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
          $(this).find('.faction-tag').attr('data-tag', faction.tag).attr('title', `${faction.name} (ID: ${faction.id})`).css('color', colorHex).html(`[${faction.tag}]`);
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

        self.typeahead.helper.getDatabase('users').addEntry(packet.author, packet.author);
        if (self.ignored.indexOf(packet.author) >= 0) return;
        const hasPing = !board.snipMode && settings.chat.pings.enable.get() === true && user.isLoggedIn() && hookDatas.some((data) => data.pings.length > 0);
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
        const _facColor = packet.strippedFaction ? self.intToHex(packet.strippedFaction.color) : 0;
        const _facTagShow = packet.strippedFaction && settings.chat.factiontags.enable.get() === true ? 'initial' : 'none';
        const _facTitle = packet.strippedFaction ? `${packet.strippedFaction.name} (ID: ${packet.strippedFaction.id})` : '';
        crel(flairs, crel('span', {
          class: 'flair faction-tag',
          'data-tag': _facTag,
          style: `color: ${_facColor}; display: ${_facTagShow}`,
          title: _facTitle
        }, `[${_facTag}]`));

        const contentSpan = self.processMessage('span', 'content', packet.message_raw);
        twemoji.parse(contentSpan);
        // TODO basic markdown
        let nameClasses = 'user';
        if (Array.isArray(packet.authorNameClass)) nameClasses += ` ${packet.authorNameClass.join(' ')}`;

        self.elements.body.append(
          crel('li', {
            'data-id': packet.id,
            'data-tag': _facTag,
            'data-faction': (packet.strippedFaction && packet.strippedFaction.id) || '',
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
            style: `color: ${place.getPaletteColor(packet.authorNameColor)}`,
            onclick: self._popUserPanel,
            onmousemiddledown: self._addAuthorMentionToChatbox
          }, packet.author),
          document.createTextNode(': '),
          contentSpan,
          document.createTextNode(' ')
          )
        );

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
      intToHex: (i) => `#${('000000' + (i >>> 0).toString(16)).slice(-6)}`,
      processMessage: (elem, elemClass, str) => {
        const toReturn = crel(elem, { class: elemClass }, str);

        try {
          const list = anchorme(str, {
            emails: false,
            files: false,
            exclude: self._anchorme.fnExclude,
            attributes: [self._anchorme.fnAttributes],
            list: true
          });

          // handle jump links (e.g. (500, 500[, 20[x]]))
          str = str.replace(/\(([0-9]+)[., ]{1,2}([0-9]+)[., ]{0,2}([0-9]+)?x?\)/ig, function(match, group1, group2, group3) {
            if (isNaN(group1) || isNaN(group2)) return match;
            if (!board.validateCoordinates(parseFloat(group1), parseFloat(group2))) return match;
            const group3Str = !(parseFloat(group3)) ? '' : `, ${group3}x`;
            return `<a class="link -internal-jump" href="#x=${group1}&y=${group2}&scale=${!(parseFloat(group3)) ? 1 : group3}" data-x="${group1}" data-y="${group2}" data-scale="${group3}">(${group1}, ${group2}${group3Str})</a>`;
          });

          // insert <a>'s
          // const _re = /^[?#]/;
          for (const x of list) {
            let url = false;

            let anchorText = x.raw.substr(0, 78);
            if (x.raw.length > 78) anchorText += '...';
            let anchorTarget = null;
            let jumpTarget = false;

            try {
              url = new URL(x.raw.indexOf(x.protocol) !== 0 ? `${x.protocol}${x.raw}` : x.raw);
            } catch (ignored) {
            }
            if (!url) {
              console.warn('no url with %o!', x);
            } else {
              // process URL params for future use/manipulation
              const params = {};
              let toSplit = url.hash.substring(1);
              if (url.search.length > 0) { toSplit += ('&' + url.search.substring(1)); }

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
                // const value = vars[key];
                if (!Object.prototype.hasOwnProperty.call(params, key)) {
                  params[key] = vars[key];
                }
              }

              // check for any special URL needs and store the proper anchor `target`
              if ((document.location.origin && url.origin) && document.location.origin === url.origin) { // URL is for this origin, run some checks for game features
                if (params.x != null && params.y != null) { // url has x/y so it's probably in the game window
                  if (board.validateCoordinates(params.x, params.y)) {
                    jumpTarget = Object.assign({
                      displayText: `(${params.x}, ${params.y}${params.scale != null ? `, ${params.scale}x` : ''})`,
                      raw: url.toString()
                    }, params);
                    if (params.template != null && params.template.length >= 11) { // we have a template, should probably make that known
                      let title = decodeURIComponent(params.template);
                      if (settings.chat.links.templates.preferurls.get() !== true && params.title && params.title.trim()) { title = decodeURIComponent(params.title); }
                      jumpTarget.displayText += ` (template: ${(title > 25) ? `${title.substr(0, 22)}...` : title})`;
                    }
                  }
                } else {
                  anchorTarget = '_blank'; // probably `/stats` or something
                }
              } else {
                anchorTarget = '_blank';
              }
            }

            const elem = crel('a', {
              href: x.raw.indexOf(x.protocol) !== 0 ? `${x.protocol}${x.raw}` : x.raw,
              title: x.raw
            }, anchorText);
            if (jumpTarget !== false) {
              elem.innerHTML = jumpTarget.displayText || elem.innerHTML;
              elem.className = 'link -internal-jump';
              for (const key in jumpTarget) {
                if (Object.prototype.hasOwnProperty.call(jumpTarget, key)) {
                  elem.dataset[key] = jumpTarget[key];
                }
              }
            } else {
              if (anchorTarget) elem.target = anchorTarget;
            }

            if (!str.includes(elem.outerHTML)) {
              str = str.split(x.raw).join(elem.outerHTML);
            }
          }

          // any other text manipulation after anchor insertion
          // TODO markdown, it might be better to do it on the back-end so that burden of parsing+rendering is shifted

          // parse HTML into DOM
          toReturn.innerHTML = str;

          // hook up any necessary event listeners
          toReturn.querySelectorAll('.-internal-jump[data-x]').forEach(x => {
            x.onclick = e => {
              e.preventDefault();
              if (x.dataset.template) {
                const internalClickDefault = settings.chat.links.internal.behavior.get();
                if (internalClickDefault === self.TEMPLATE_ACTIONS.ASK.id) {
                  self._popTemplateOverwriteConfirm(x).then(action => {
                    modal.closeAll();
                    self._handleTemplateOverwriteAction(action, x);
                  });
                } else {
                  self._handleTemplateOverwriteAction(internalClickDefault, x);
                }
              } else {
                self.jump(parseFloat(x.dataset.x), parseFloat(x.dataset.y), parseFloat(x.dataset.scale));
              }
            };
          });
        } catch (e) {
          console.error('Failed to process a line, defaulting to raw', e);
        }

        return toReturn;
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
              Object.values(self.TEMPLATE_ACTIONS).map(action => action.id === 0 ? null
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

          const popupWrapper = crel('div', { class: 'popup panel', 'data-popup-for': id });
          const panelHeader = crel('header',
            { class: 'panel-header' },
            crel('button', { class: 'left panel-closer' }, crel('i', {
              class: 'fas fa-times',
              onclick: closeHandler
            })),
            crel('span', (closest.dataset.tag ? `[${closest.dataset.tag}] ` : null), closest.dataset.author, badges),
            crel('div', { class: 'right' })
          );
          const leftPanel = crel('div', { class: 'pane details-wrapper chat-line' });
          const rightPanel = crel('div', { class: 'pane actions-wrapper' });
          const actionsList = crel('ul', { class: 'actions-list' });

          const actions = [
            { label: 'Report', action: 'report', class: 'dangerous-button' },
            { label: 'Mention', action: 'mention' },
            { label: 'Ignore', action: 'ignore' },
            { label: 'Profile', action: 'profile' },
            { label: 'Chat (un)ban', action: 'chatban', staffaction: true },
            { label: 'Purge User', action: 'purge', staffaction: true },
            { label: 'Delete', action: 'delete', staffaction: true },
            { label: 'Mod Lookup', action: 'lookup-mod', staffaction: true },
            { label: 'Chat Lookup', action: 'lookup-chat', staffaction: true }
          ];

          crel(leftPanel, crel('p', { class: 'popup-timestamp-header text-muted' }, moment.unix(closest.dataset.date >> 0).format(`MMM Do YYYY, ${(settings.chat.timestamps['24h'].get() === true ? 'HH:mm:ss' : 'hh:mm:ss A')}`)));
          crel(leftPanel, crel('p', { class: 'content', style: 'margin-top: 3px; margin-left: 3px; text-align: left;' }, closest.querySelector('.content').textContent));

          crel(actionsList, actions
            .filter((action) => user.isStaff() || !action.staffaction)
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
              required: 'true',
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
            board.snipMode ? null : crel(_purgeWrap,
              crel('h5', 'Purge Messages'),
              crel('label', { style: 'display: inline;' }, _rbPurgeYes, 'Yes'),
              crel('label', { style: 'display: inline;' }, _rbPurgeNo, 'No')
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
          if (self.elements.rate_limit_counter.text().trim().length === 0) { self.elements.rate_limit_counter.text('You can not use chat while canvas banned.'); }
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
      popChatSettings: self.popChatSettings,
      saveIgnores: self.saveIgnores,
      reloadIgnores: self.reloadIgnores,
      addIgnore: self.addIgnore,
      removeIgnore: self.removeIgnore,
      getIgnores: self.getIgnores,
      typeahead: self.typeahead,
      updateCanvasBanState: self.updateCanvasBanState,
      registerHook: self.registerHook,
      replaceHook: self.replaceHook,
      unregisterHook: self.unregisterHook,
      runLookup: self.runLookup
    };
  })();
    // this takes care of the countdown timer
  const timer = (function() {
    const self = {
      elements: {
        palette: $('#palette'),
        timer_overlay: $('#cd-timer-overlay'),
        timer_bubble_container: $('#cooldown'),
        timer_bubble_countdown: $('#cooldown-timer'),
        timer_chat: $('#txtMobileChatCooldown')
      },
      isOverlay: false,
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
          self.isOverlay = settings.place.deselectonplace.enable.get() === true;
          self.elements.timer_container = self.isOverlay ? self.elements.timer_overlay : self.elements.timer_bubble_container;
          self.elements.timer_countdown = self.isOverlay ? self.elements.timer_overlay : self.elements.timer_bubble_countdown;
          self.elements.timer_overlay.hide();
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
          if (self.isOverlay) {
            self.elements.palette.css('overflow-x', 'hidden');
            self.elements.timer_container.css('left', `${self.elements.palette.scrollLeft()}px`);
          }
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
        if (self.isOverlay) {
          self.elements.palette.css('overflow-x', 'auto');
          self.elements.timer_container.css('left', '0');
        }
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
        self.elements.timer_container = settings.place.deselectonplace.enable.get() === false
          ? self.elements.timer_overlay
          : self.elements.timer_bubble_container;
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
        loginOverlay: $('#login-overlay'),
        userMessage: $('#user-message'),
        prompt: $('#prompt'),
        signup: $('#signup')
      },
      role: 'USER',
      pendingSignupToken: null,
      loggedIn: false,
      username: '',
      chatNameColor: 0,
      getRole: () => self.role,
      isStaff: () => ['MODERATOR', 'DEVELOPER', 'ADMIN', 'TRIALMOD'].includes(self.getRole()),
      getUsername: () => self.username,
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
        self.elements.userInfo.hide();
        self.elements.userInfo.find('.logout').click(function(evt) {
          evt.preventDefault();
          $.get('/logout', function() {
            self.elements.userInfo.fadeOut(200);
            self.elements.userMessage.fadeOut(200);
            self.elements.loginOverlay.fadeIn(200);
            if (window.deInitAdmin) {
              window.deInitAdmin();
            }
            self.loggedIn = false;
            $(window).trigger('pxls:user:loginState', [false]);
            socket.reconnectSocket();
          });
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
          self.chatNameColor = data.chatNameColor;
          uiHelper.updateSelectedNameColor(data.chatNameColor);
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
          self.role = data.role;

          if (self.role === 'BANNED') {
            isBanned = true;
            crel(banelem, crel('p', 'You are permanently banned.'));
          } else if (data.banned === true) {
            isBanned = true;
            crel(banelem, crel('p', `You are temporarily banned and will not be allowed to place until ${new Date(data.banExpiry).toLocaleString()}`));
          } else if (['TRIALMOD', 'MODERATOR', 'DEVELOPER', 'ADMIN'].indexOf(self.role) !== -1) {
            if (window.deInitAdmin) {
              window.deInitAdmin();
            }
            $.getScript('admin/admin.js').done(function() {
              window.initAdmin({
                socket: socket,
                user: user,
                modal: modal,
                lookup: lookup,
                chat: chat,
                cdOverride: data.cdOverride
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
              crel('p', data.ban_reason)
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

          if (instaban) {
            ban.shadow(7);
          }

          analytics('send', 'event', 'Auth', 'Login', data.method);
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
      _handleSubmit: function(event) {
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
        const renamePopup = crel('form', { onsubmit: self._handleSubmit },
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
      }
    };
    return {
      init: self.init,
      getRole: self.getRole,
      isStaff: self.isStaff,
      getUsername: self.getUsername,
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
          chat.processMessage('div', 'notification-body', notification.content),
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
      isEnabled: false,
      elements: {
        boardContainer: board.getContainer(),
        setting: $('#chrome-canvas-offset-setting')
      },
      init: () => {
        if (!webkitBased) {
          self.elements.setting.hide();
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
        if (self.isEnabled) {
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
      get virginmap() {
        return {
          clear: overlays.virginmap.clear,
          reload: overlays.virginmap.reload
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
      ban.me(3);
    },
    attemptPlace: function() {
      ban.me(3);
    },
    banme: function() {
      ban.me(4);
    },
    chat,
    typeahead: chat.typeahead,
    user: {
      getUsername: user.getUsername,
      getRole: user.getRole,
      isLoggedIn: user.isLoggedIn,
      isStaff: user.isStaff
    },
    modal
  };
})();
