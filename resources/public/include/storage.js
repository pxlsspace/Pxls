const getCookie = module.exports.getCookie = function(cookieName) {
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

const setCookie = module.exports.setCookie = function(cookieName, value, exdays) {
  const exdate = new Date();
  let cookieValue = escape(value);
  exdate.setDate(exdate.getDate() + exdays);
  cookieValue += ((exdays == null) ? '' : '; expires=' + exdate.toUTCString());
  document.cookie = cookieName + '=' + cookieValue;
};

const storageFactory = function(storageType, prefix, exdays) {
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

module.exports.ls = storageFactory(localStorage, 'ls_', 99);
module.exports.ss = storageFactory(sessionStorage, 'ss_', null);
