const { ss } = require('./storage');
const { board } = require('./board');
const { template } = require('./template');

// this object is used to access the query parameters (and in the future probably to set them), it is prefered to use # now instead of ? as JS can change them
module.exports.query = (function() {
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
