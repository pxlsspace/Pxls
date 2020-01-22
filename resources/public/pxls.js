"use strict";
crel.attrMap['onmousemiddledown'] = function(element, value) {
    element.addEventListener('mousedown', function (e) {
        if (e.button == 1) {
            value.call(this, e);
        }
    });
};

var instaban = false;
if (window.App !== undefined) {
    instaban = true;
}
window.App = (function () {
    // first we define the global helperfunctions and figure out what kind of settings our browser needs to use
    var storageFactory = function (storageType, prefix, exdays) {
        var getCookie = function (c_name) {
            var i, x, y, ARRcookies = document.cookie.split(";");
            for (i = 0; i < ARRcookies.length; i++) {
                x = ARRcookies[i].substr(0, ARRcookies[i].indexOf("="));
                y = ARRcookies[i].substr(ARRcookies[i].indexOf("=") + 1);
                x = x.replace(/^\s+|\s+$/g, "");
                if (x == c_name) {
                    return unescape(y);
                }
            }
        },
            setCookie = function (c_name, value, exdays) {
                var exdate = new Date(),
                    c_value = escape(value);
                exdate.setDate(exdate.getDate() + exdays);
                c_value += ((exdays === null) ? '' : '; expires=' + exdate.toUTCString());
                document.cookie = c_name + '=' + c_value;
            };
        return {
            haveSupport: null,
            support: function () {
                if (this.haveSupport === null) {
                    try {
                        storageType.setItem('test', 1);
                        this.haveSupport = (storageType.getItem('test') == 1);
                        storageType.removeItem('test');
                    } catch (e) {
                        this.haveSupport = false;
                    }
                }
                return this.haveSupport;
            },
            get: function (name) {
                var s;
                if (this.support()) {
                    s = storageType.getItem(name)
                } else {
                    s = getCookie(prefix + name);
                }
                if (s === undefined) {
                    s = null;
                }
                try {
                    return JSON.parse(s);
                } catch (e) {
                    return null;
                }
            },
            set: function (name, value) {
                value = JSON.stringify(value);
                if (this.support()) {
                    storageType.setItem(name, value);
                } else {
                    setCookie(prefix + name, value, exdays)
                }
            },
            remove: function (name) {
                if (this.support()) {
                    storageType.removeItem(name);
                } else {
                    setCookie(prefix + name, '', -1);
                }
            }
        };
    },
        binary_ajax = function (url, fn, failfn) {
            // TODO(netux): convert to use async/await (https://caniuse.com/#feat=async-functions)
            // and possibly fetch (https://caniuse.com/#feat=fetch)
            var xhr = new XMLHttpRequest();
            xhr.open("GET", url, true);
            xhr.responseType = "arraybuffer";
            xhr.onload = function (event) {
                if (xhr.readyState == 4) {
                    if (xhr.status == 200) {
                        if (xhr.response) {
                            var data = new Uint8Array(xhr.response);
                            fn(data);
                        }
                    } else if (failfn) {
                        failfn();
                    }
                }
            };
            xhr.send(null);

            return xhr;
        },
        createImageData = function (w, h) {
            try {
                return new ImageData(w, h);
            } catch (e) {
                var imgCanv = document.createElement('canvas');
                imgCanv.width = w;
                imgCanv.height = h;
                return imgCanv.getContext('2d').getImageData(0, 0, w, h);
            }
        },
        analytics = function () {
            if (window.ga) {
                window.ga.apply(this, arguments);
            }
        },
        nua = navigator.userAgent,
        have_image_rendering = (function () {
            var checkImageRendering = function (prefix, crisp, pixelated, optimize_contrast) {
                var d = document.createElement('div');
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
                if (optimize_contrast) {
                    d.style.imageRendering = prefix + 'optimize-contrast';
                    if (d.style.imageRendering === prefix + 'optimize-contrast') {
                        return true;
                    }
                }
                return false;
            };
            return checkImageRendering('', true, true, false) || checkImageRendering('-o-', true, false, false) || checkImageRendering('-moz-', true, false, false) || checkImageRendering('-webkit-', true, false, true);
        })(),
        have_zoom_rendering = false,
        ios_safari = (nua.match(/(iPod|iPhone|iPad)/i) && nua.match(/AppleWebKit/i)),
        desktop_safari = (nua.match(/safari/i) && !nua.match(/chrome/i)),
        ms_edge = nua.indexOf('Edge') > -1;
    if (ios_safari) {
        var iOS = parseFloat(
            ('' + (/CPU.*OS ([0-9_]{1,5})|(CPU like).*AppleWebKit.*Mobile/i.exec(navigator.userAgent) || [0, ''])[1])
                .replace('undefined', '3_2').replace('_', '.').replace('_', '')
        ) || false;
        have_image_rendering = false;
        if (iOS >= 11) {
            have_zoom_rendering = true;
        }
    } else if (desktop_safari) {
        have_image_rendering = false;
        have_zoom_rendering = true;
    }
    if (ms_edge) {
        have_image_rendering = false;
    }
    const TH = (function() { //place typeahead in its own pseudo namespace
        /**
         *
         * @param char {string} The char trigger. Should only be a one byte wide grapheme. Emojis will fail
         * @param dbType {string} The type of the database, acts internally as a map key.
         * @param [keepTrigger=false] {boolean} Whether or not this trigger type should keep it's matching trigger chars on search results.
         * @param [hasPair=false] {boolean} Whether or not this trigger has a matching pair at the end, e.g. ':word:' vs '@word'
         * @constructor
         */
        function Trigger(char, dbType, keepTrigger = false, hasPair = false) {
            this.char = char;
            this.dbType = dbType;
            this.keepTrigger = keepTrigger;
            this.hasPair = hasPair;
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
         * @constructor
         */
        function Database(name, initData = {}, caseSensitive = false) {
            this.name = name;
            this._caseSensitive = caseSensitive;
            this.initData = initData;

            const fixKey = key => this._caseSensitive ? key.trim() : key.toLowerCase().trim();
            this.search = start => {
                start = fixKey(start);
                return Object.entries(this.initData).filter(x => fixKey(x[0]).startsWith(start)).map(x => x[1]);
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
                let match = new TriggerMatch(0, searchString.length, null, ''),
                    matched = false,
                    foundOnce = false;
                for (let i = startIndex-1; i >= 0; i--) { //Search left from the starting index looking for a trigger match
                    let char = searchString.charAt(i);
                    if (this.triggersCache.includes(char)) {
                        match.start = i;
                        match.trigger = this.triggers[char];
                        matched = true;
                        if (foundOnce) break; else foundOnce = true; //We only break if we've foundOnce so that if we start at the end of something like ":word:" we don't short circuit at the first one we see.
                        //We don't just go until we see a break character because ":d:word:" is not a valid trigger. Can expand trigger in the future to potentially catch this though if a usecase pops up.
                    } else if (this.stops.includes(char)) {
                        break;
                    }
                }
                if (matched) {
                    for (let i = startIndex; i < searchString.length; i++) {
                        let char = searchString.charAt(i);
                        if (this.stops.includes(char)) { //we found the end of our word
                            match.end = i;
                            break;
                        }
                    }

                    // If we have a pair and it's present, we don't want to include it in our DB searches. We go to len-1 in order to grab the whole word only (it's the difference between "word:" and "word")
                    let fixedEnd = (match.trigger.hasPair && searchString.charAt(match.end - 1) === match.trigger.char) ? match.end - 1 : match.end;
                    match.word = searchString.substring(match.start+1, fixedEnd);
                }

                return matched ? match : false;
            };

            /**
             * @param trigger {TriggerMatch} The trigger match we should look for suggestions on.
             */
            this.suggestions = (trigger) => {
                let db = this.DBs.filter(x => x.name === trigger.trigger.dbType);
                if (!db || !db.length) return [];
                db = db[0];
                let fromDB = db.search(trigger.word);
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
                for (let x of this.DBs) {
                    let key = x._caseSensitive ? dbName : dbName.toLowerCase();
                    if (x.name === dbName.trim()) return x;
                }
                return null;
            }
        }

        return {
            Typeahead,
            TriggerMatch,
            Trigger,
            Database
        };
    })();
    var ls = storageFactory(localStorage, 'ls_', 99),
        ss = storageFactory(sessionStorage, 'ss_', null),
        // this object is used to access the query parameters (and in the future probably to set them), it is prefered to use # now instead of ? as JS can change them
        query = (function () {
            var self = {
                params: {},
                initialized: false,
                _trigger: function (propName, oldValue, newValue) {
                    $(window).trigger("pxls:queryUpdated", [propName, oldValue, newValue]); //window.on("queryUpdated", (event, propName, oldValue, newValue) => {...});
                    //this will cause issues if you're not paying attention. always check for `newValue` to be null in the event of a deleted key.
                },
                _update: function (fromEvent) {
                    let toSplit = window.location.hash.substring(1);
                    if (window.location.search.length > 0)
                        toSplit += ("&" + window.location.search.substring(1));

                    var _varsTemp = toSplit.split("&"),
                        vars = {};
                    _varsTemp.forEach(val => {
                        let split = val.split("="),
                            key = split.shift().toLowerCase();
                        if (!key.length) return;
                        vars[key] = split.shift();
                    });

                    let varKeys = Object.keys(vars);
                    for (let i = 0; i < varKeys.length; i++) {
                        let key = varKeys[i],
                            value = vars[key];
                        if (fromEvent === true) {
                            if (!self.params.hasOwnProperty(key) || self.params[key] !== vars[key]) {
                                let oldValue = self.params[key],
                                    newValue = vars[key] == null ? null : vars[key].toString();
                                self.params[key] = newValue;
                                self._trigger(key, oldValue, value); //if value == null || !value.length, shouldn't we be removing?
                            } else {
                            }
                        } else if (!self.params.hasOwnProperty(key)) {
                            self.params[key] = vars[key];
                        }
                    }

                    if (fromEvent === true) {
                        //Filter out removed params (removed from URL, but still present in self.params)
                        //Get self.params keys, filter out any that don't exist in varKeys, and for each remaining value, call `self.remove` on it.
                        Object.keys(self.params).filter(x => !varKeys.includes(x)).forEach(value => self.remove(value));
                    }

                    if (window.location.search.substring(1)) {
                        window.location = window.location.pathname + "#" + self.getStr();
                    }
                },
                setIfDifferent: function () {
                    //setIfDifferent({oo: 0.3, template: "https://i.trg0d.com/gpq0786uCk4"}, [silent=false]);
                    //setIfDifferent("template", "https://i.trg0d.com/gpq0786uCk4", [silent=false]);

                    let workWith = {},
                        silent = false;
                    if ((typeof arguments[0]) === "string") {
                        let key = arguments[0],
                            value = arguments[1],
                            silent = arguments[2];
                        workWith[key] = value;
                    } else if ((typeof arguments[0]) === "object") {
                        workWith = arguments[0];
                        silent = arguments[1];
                    }
                    silent = silent == null ? false : silent === true; //set the default value if necessary or coerce to bool.
                    let KVPs = Object.entries(workWith);
                    for (let i = 0; i < KVPs.length; i++) {
                        let k = KVPs[i][0],
                            v = KVPs[i][1].toString();
                        if (self.get(k) === v)
                            continue;
                        self.set(k, v, silent);
                    }
                },
                init: function () {
                    if (ss.get("url_params")) {
                        window.location.hash = ss.get("url_params");
                        ss.remove("url_params");
                    } else {
                        self._update();

                        if ("replaceState" in window.history) {
                            // We disable this if `replaceState` is missing because this will call _update every time the `window.location.hash` is set programatically.
                            // Simply scrolling around the map would constantly call `board.centerOn` because x/y would be modified.
                            window.onhashchange = function () {
                                self._update(true);
                            };
                        }
                    }

                    $(window).on("message", function (evt) {
                        evt = evt.originalEvent;
                        if (evt.data && evt.data.type && evt.data.data) {
                            let data = evt.data;
                            switch (data.type.toUpperCase().trim()) {
                                case "TEMPLATE_UPDATE":
                                    template.queueUpdate(data.data);
                                    break;
                                case "VIEWPORT_UPDATE":
                                    board.updateViewport(data.data);
                                    break;
                                default:
                                    console.warn("Unknown data type: %o", data.type);
                                    break;
                            }
                        }
                    });
                },
                has: function (key) {
                    return self.get(key) != null;
                },
                getStr: function () {
                    var params = [];
                    for (var p in self.params) {
                        if (self.params.hasOwnProperty(p)) {
                            var s = encodeURIComponent(p);
                            if (self.params[p] !== null) {
                                let decoded = decodeURIComponent(self.params[p]),
                                    toSet = self.params[p];
                                if (decoded === toSet)
                                    toSet = encodeURIComponent(toSet); //ensure already URL-encoded values don't get re-encoded. if decoded === toSet, then it's already in an un-encoded form, and we can encode "safely".
                                s += "=" + toSet;
                            }
                            params.push(s);
                        }
                    }
                    return params.join("&");
                },
                update: function () {
                    var s = self.getStr();
                    if (window.history.replaceState) {
                        window.history.replaceState(null, null, '#' + s);
                    } else {
                        window.location.hash = s;
                    }
                },
                set: function (n, v, silent) {
                    let oldValue = self.params[n];
                    self.params[n] = v.toString();
                    if (silent !== true) self._trigger(n, oldValue, v.toString());
                    self.lazy_update();
                },
                get: function (n) {
                    return self.params[n];
                },
                remove: function (n, silent) {
                    delete self.params[n];
                    self.lazy_update();

                    if (silent !== true)
                        self._trigger(n, self.params[n], null);
                },
                timer: null,
                lazy_update: function () {
                    if (self.timer !== null) {
                        clearTimeout(self.timer);
                    }
                    self.timer = setTimeout(function () {
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
        })(),
        // this object is responsible for detecting pxls placement and banning them
        ban = (function () {
            var self = {
                bad_src: [/^https?:\/\/[^\/]*raw[^\/]*git[^\/]*\/(metonator|Deklost|NomoX|RogerioBlanco)/gi,
                    /.*pxlsbot(\.min)?\.js/gi,
                    /^chrome\-extension:\/\/lmleofkkoohkbgjikogbpmnjmpdedfil/gi,
                    /^https?:\/\/.*mlpixel\.org/gi],
                bad_events: ["mousedown", "mouseup", "click"],
                checkSrc: function (src) {
                    // as naive as possible to make injection next to impossible
                    for (var i = 0; i < self.bad_src.length; i++) {
                        if (src.match(self.bad_src[i])) {
                            self.shadow(2);
                        }
                    }
                },
                init: function () {
                    setInterval(self.update, 5000);

                    // don't allow new websocket connections
                    var ws = window.WebSocket;
                    window.WebSocket = function (a, b) {
                        self.shadow(1);
                        return new ws(a, b);
                    };

                    // don't even try to generate mouse events. I am being nice
                    window.MouseEvent = function () {
                        self.me(2);
                    };

                    // enough of being nice
                    var evt = window.Event;
                    window.Event = function (e, s) {
                        if (self.bad_events.indexOf(e.toLowerCase()) !== -1) {
                            self.shadow(4);
                        }
                        return new evt(e, s);
                    };
                    var custom_evt = window.CustomEvent;
                    window.CustomEvent = function (e, s) {
                        if (self.bad_events.indexOf(e.toLowerCase()) !== -1) {
                            self.shadow(5);
                        }
                        return new custom_evt(e, s);
                    };
                    var evt_old = window.document.createEvent;
                    document.createEvent = function (e, s) {
                        if (self.bad_events.indexOf(e.toLowerCase()) !== -1) {
                            self.shadow(6);
                        }
                        return evt_old(e, s);
                    };

                    // listen to script insertions
                    $(window).on("DOMNodeInserted", function (evt) {
                        if (evt.target.nodeName != "SCRIPT") {
                            return;
                        }
                        self.checkSrc(evt.target.src);
                    });
                    $("script").map(function () {
                        self.checkSrc(this.src);
                    });
                },
                shadow: function (app = 0, z) {
                    let banstr = `{"type": "shadowbanme", "app": "${String(app >> 0).substr(0, 2)}"${typeof z === 'string' && z.trim().length ? `, "z": "${z}"` : ''}}`;
                    socket.send(banstr);
                },
                me: function (app = 0, z) {
                    let banstr = `{"type": "banme", "app": "${String(app >> 0).substr(0, 2)}"${typeof z === 'string' && z.trim().length ? `, "z": "${z}"` : ''}}`;
                    socket.send(banstr); // we send as a string to not allow re-writing JSON.stringify
                    socket.close();
                    window.location.href = "https://www.youtube.com/watch?v=QHvKSo4BFi0";
                },
                update: function () {
                    var _ = function (z) {
                        // This (still) does exactly what you think it does. or does it?
                        self.shadow(3, z || 'generic');
                    };

                    window.App.attemptPlace = window.App.doPlace = function () {
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
                    if ($("div.info").find("#autopxlsinfo").length) _('autopxls');

                    // Modified AutoPXLS
                    if (window.xD) _('autopxls2');
                    if (window.vdk) _('autopxls2');

                    // Notabot
                    if ($(".botpanel").length) _('notabot/generic');
                    if (window.Notabot) _('notabot');

                    // "Botnet" by (unknown, obfuscated)
                    if (window.Botnet) _('botnet');

                    // ???
                    if (window.DrawIt) _('drawit');

                    //NomoXBot
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
        })(),
        // this object is takes care of the websocket connection
        socket = (function () {
            var self = {
                ws: null,
                ws_constructor: WebSocket,
                hooks: [],
                sendQueue: [],
                wps: WebSocket.prototype.send, // make sure we have backups of those....
                wpc: WebSocket.prototype.close,
                ws_open_state: WebSocket.OPEN,
                reconnect: function () {
                    $("#reconnecting").show();
                    setTimeout(function () {
                        $.get(window.location.pathname + "?_" + (new Date()).getTime(), function () {
                            window.location.reload();
                        }).fail(function () {
                            console.info("Server still down...");
                            self.reconnect();
                        });
                    }, 3000);
                },
                reconnectSocket: function () {
                    self.ws.onclose = function () { };
                    self.connectSocket();
                },
                connectSocket: function () {
                    var l = window.location,
                        url = ((l.protocol === "https:") ? "wss://" : "ws://") + l.host + l.pathname + "ws";
                    self.ws = new self.ws_constructor(url);
                    self.ws.onopen = evt => {
                        setTimeout(() => {
                            while (self.sendQueue.length > 0) {
                                let toSend = self.sendQueue.shift();
                                self.send(toSend);
                            }
                        }, 0);
                    };
                    self.ws.onmessage = function (msg) {
                        var data = JSON.parse(msg.data);
                        $.map(self.hooks, function (h) {
                            if (h.type === data.type) {
                                h.fn(data);
                            }
                        });
                    };
                    self.ws.onclose = function () {
                        self.reconnect();
                    };
                },
                init: function () {
                    if (self.ws !== null) {
                        return; // already inited!
                    }
                    self.connectSocket();

                    $(window).on("beforeunload", function () {
                        self.ws.onclose = function () { };
                        self.close();
                    });

                    $("#board-container").show();
                    $("#ui").show();
                    $("#loading").fadeOut(500);
                    user.wsinit();
                },
                on: function (type, fn) {
                    self.hooks.push({
                        type: type,
                        fn: fn
                    });
                },
                close: function () {
                    self.ws.close = self.wpc;
                    self.ws.close();
                },
                send: function (s) {
                    let toSend = typeof s === "string" ? s : JSON.stringify(s);
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
        })(),
        // this object holds all board information and is responsible of rendering the board
        board = (function () {
            var self = {
                elements: {
                    board: $("#board"),
                    board_render: null, // populated on init based on rendering method
                    mover: $("#board-mover"),
                    zoomer: $("#board-zoomer"),
                    container: $("#board-container")
                },
                ctx: null,
                use_js_render: !have_image_rendering && !have_zoom_rendering,
                use_zoom: !have_image_rendering && have_zoom_rendering,
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
                    handler: function (args) { //self.holdTimer.handler
                        self.holdTimer.id = -1;
                        lookup.runLookup(args.x, args.y);
                    }
                },
                updateViewport: function (data) {
                    if (!isNaN(data.scale)) self.scale = parseFloat(data.scale);
                    self.centerOn(data.x, data.y);
                },
                centerOn: function (x, y) {
                    if (x != null) self.pan.x = (self.width / 2 - x);
                    if (y != null) self.pan.y = (self.height / 2 - y);
                    self.update();
                },
                replayBuffer: function () {
                    $.map(self.pixelBuffer, function (p) {
                        self.setPixel(p.x, p.y, p.c, false);
                    });
                    self.refresh();
                    self.pixelBuffer = [];
                },
                draw: function (data) {
                    self.id = createImageData(self.width, self.height);
                    self.ctx.mozImageSmoothingEnabled = self.ctx.webkitImageSmoothingEnabled = self.ctx.msImageSmoothingEnabled = self.ctx.imageSmoothingEnabled = false;

                    self.intView = new Uint32Array(self.id.data.buffer);
                    self.rgbPalette = place.getPaletteRGB();

                    for (var i = 0; i < self.width * self.height; i++) {
                        if (data[i] == 0xFF) {
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
                initInteraction: function () {
                    // first zooming and stuff
                    var handleMove = function (evt) {
                        if (!self.allowDrag) return;
                        self.pan.x += evt.dx / self.scale;
                        self.pan.y += evt.dy / self.scale;

                        self.update();
                    };

                    interact(self.elements.container[0]).draggable({
                        inertia: true,
                        onmove: handleMove
                    }).gesturable({
                        onmove: function (evt) {
                            self.scale *= (1 + evt.ds);
                            handleMove(evt);
                        }
                    });

                    $(document.body).on("keydown", function (evt) {
                        if (["INPUT", "TEXTAREA"].includes(evt.target.nodeName)) {
                            // prevent inputs from triggering shortcuts
                            return;
                        }

                        switch (evt.originalEvent.code || evt.keyCode || evt.which || evt.key) {
                            case "KeyW":        // W
                            case "ArrowUp":
                            case 38:            // Arrow Up
                            case 87:            // W
                            case "w":
                            case "W":
                                self.pan.y += 100 / self.scale;
                                break;
                            case "KeyD":        // D
                            case "ArrowRight":
                            case 39:            // Arrow Right
                            case 68:            // D
                            case "d":
                            case "D":
                                self.pan.x -= 100 / self.scale;
                                break;
                            case "KeyS":        // S
                            case "ArrowDown":
                            case 40:            // Arrow Down
                            case 83:            // S
                            case "s":
                            case "S":
                                self.pan.y -= 100 / self.scale;
                                break;
                            case "KeyA":        // A
                            case "ArrowLeft":
                            case 37:            // Arrow Left
                            case 65:            // A
                            case "a":
                            case "A":
                                self.pan.x += 100 / self.scale;
                                break;
                            case "KeyP":
                            case 80:            // P
                            case "p":
                            case "P":
                                self.save();
                                break;
                            case "KeyL":
                            case 76:            // L
                            case "l":
                            case "L":
                                self.allowDrag = !self.allowDrag;
                                if (self.allowDrag) coords.lockIcon.fadeOut(200);
                                else coords.lockIcon.fadeIn(200);
                                break;
                            case "KeyR":
                            case 82:            // R
                            case "r":
                            case "R":
                                var tempOpts = template.getOptions();
                                var tempElem = $("#board-template");
                                if (tempOpts.use) {
                                  board.centerOn(tempOpts.x + (tempElem.width() / 2), tempOpts.y + (tempElem.height() / 2));
                                }
                                break;
                            case "KeyJ":
                            case 74:            // J
                            case "j":
                            case "J":
                                if (place.color < 1) {
                                    place.switch(place.getPaletteRGB().length - 1);
                                } else {
                                    place.switch(place.color - 1);
                                }
                                break;
                            case "KeyK":
                            case 75:            // K
                            case "k":
                            case "K":
                                if (place.color + 1 >= place.getPaletteRGB().length) {
                                    place.switch(0);
                                } else {
                                    place.switch(place.color + 1);
                                }
                                break;
                            // Following stuff could be broken af for many non-English layouts
                            case "KeyE":        // E
                            case "Equal":       // =
                            case "NumpadAdd":   // numpad +
                            case 69:            // E
                            case 107:           // numpad +
                            case 187:           // =
                            case 171:           // +
                            case "=":
                            case "e":
                            case "E":
                                self.nudgeScale(1);
                                break;
                            case "KeyQ":             // Q
                            case "Minus":            // -
                            case "NumpadSubtract":   // numpad -
                            case 81:                 // Q
                            case 109:                // numpad -
                            case 173:                // -
                            case 189:                // -
                            case "q":
                            case "Q":
                            case "-":
                                self.nudgeScale(-1);
                                break;
                            case "t":
                            case "T":
                            case "KeyT":
                            case 84: //t
                                panels.toggle("settings");
                                break;
                            case "i":
                            case "I":
                            case "KeyI":
                            case 73: //i
                                panels.toggle("info");
                                break;
                            case "b":
                            case "B":
                            case "KeyB":
                            case 66: //b
                                panels.toggle("chat");
                                break;
                        }
                        self.pannedWithKeys = true;
                        self.update();
                    });

                    self.elements.container[0].addEventListener("wheel", function (evt) {
                        if (!self.allowDrag) return;
                        var oldScale = self.scale;
                        if (evt.deltaY > 0) {
                            self.nudgeScale(-1);
                        } else {
                            self.nudgeScale(1);
                        }

                        if (oldScale !== self.scale) {
                            var dx = evt.clientX - self.elements.container.width() / 2;
                            var dy = evt.clientY - self.elements.container.height() / 2;
                            self.pan.x -= dx / oldScale;
                            self.pan.x += dx / self.scale;
                            self.pan.y -= dy / oldScale;
                            self.pan.y += dy / self.scale;
                            self.update();
                            place.update();
                        }
                    }, { passive: true });

                    // now init the movement
                    var downX, downY, downStart;
                    self.elements.board_render.on("pointerdown mousedown", handleInputDown)
                        .on("pointermove mousemove", handleInputMove)
                        .on("pointerup mouseup touchend", handleInputUp)
                        .contextmenu(function (evt) {
                            evt.preventDefault();
                            place.switch(-1);
                        });

                    //Separated some of these events from jQuery to deal with chrome's complaints about passive event violations.
                    self.elements.board_render[0].addEventListener("touchstart", handleInputDown, { passive: false });
                    self.elements.board_render[0].addEventListener("touchmove", handleInputMove, { passive: false });

                    function handleInputDown(event) {
                        if (["INPUT", "TEXTAREA"].includes(document.activeElement.nodeName)) {
                            document.activeElement.blur();
                        }

                        let clientX = 0,
                            clientY = 0,
                            prereq = true;
                        if (event.changedTouches && event.changedTouches[0]) {
                            clientX = event.changedTouches[0].clientX;
                            clientY = event.changedTouches[0].clientY;
                        } else {
                            clientX = event.clientX;
                            clientY = event.clientY;
                            if (event.button != null) prereq = event.button === 0; //if there are buttons, is the the left mouse button?
                        }
                        downX = clientX, downY = clientY;
                        if (prereq && self.holdTimer.id === -1) {
                            self.holdTimer.id = setTimeout(self.holdTimer.handler, self.holdTimer.holdTimeout, { x: clientX, y: clientY });
                        }
                        downStart = Date.now();
                    }
                    function handleInputMove(event) {
                        if (self.holdTimer.id === -1) return;
                        let clientX = -1, clientY = -1;

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
                        var touch = false,
                            clientX = event.clientX,
                            clientY = event.clientY,
                            downDelta = Date.now() - downStart;
                        if (event.type === 'touchend') {
                            touch = true;
                            clientX = event.changedTouches[0].clientX;
                            clientY = event.changedTouches[0].clientY;
                        }
                        var dx = Math.abs(downX - clientX),
                            dy = Math.abs(downY - clientY);
                        if ((event.button === 0 || touch) && downDelta < 500) {
                            if (!self.allowDrag && dx < 25 && dy < 25) {
                                var pos = self.fromScreen(downX, downY);
                                place.place(pos.x, pos.y);
                            } else if (dx < 5 && dy < 5) {
                                var pos = self.fromScreen(clientX, clientY);
                                place.place(pos.x, pos.y);
                            }
                        }
                        downDelta = 0;
                        if (event.button != null) {
                            // Is the button pressed the middle mouse button?
                            if (ls.get("enableMiddleMouseSelect") === true && event.button === 1 && dx < 15 && dy < 15) {
                                // If so, switch to the color at the location.
                                var { x, y } = self.fromScreen(event.clientX, event.clientY);
                                place.switch(self.getPixel(x, y));
                                return;
                            }
                        }
                    }
                },
                init: function () {
                    $(window).on("pxls:queryUpdated", (evt, propName, oldValue, newValue) => {
                        switch (propName.toLowerCase()) {
                            case "x":
                            case "y":
                                board.centerOn(query.get("x") >> 0, query.get("y") >> 0);
                                break;
                            case "scale":
                                board.setScale(newValue >> 0);
                                break;

                            case "template":
                                template.queueUpdate({ template: newValue, use: newValue !== null });
                                break;
                            case "ox":
                                template.queueUpdate({ ox: newValue === null ? null : newValue >> 0 });
                                break;
                            case "oy":
                                template.queueUpdate({ oy: newValue === null ? null : newValue >> 0 });
                                break;
                            case "tw":
                                template.queueUpdate({ tw: newValue === null ? null : newValue >> 0 });
                                break;
                            case "title":
                                template.queueUpdate({ title: newValue === null ? '' : newValue });
                                break;
                            case "oo":
                                let parsed = parseFloat(newValue);
                                if (!Number.isFinite(parsed)) parsed = null;
                                template.queueUpdate({ oo: parsed === null ? null : parsed });
                                break;
                        }
                    });
                    $("#ui").hide();
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
                    self.ctx = self.elements.board[0].getContext("2d");
                    self.initInteraction();

                    $("#snapshotImageFormat").val(ls.get("snapshotImageFormat") || 'image/png');
                    $("#snapshotImageFormat").on("change input", event => {
                        ls.set("snapshotImageFormat", event.target.value);
                    });
                },
                start: function () {
                    $.get("/info", (data) => {
                        heatmap.webinit(data);
                        virginmap.webinit(data);
                        user.webinit(data);
                        self.width = data.width;
                        self.height = data.height;
                        place.setPalette(data.palette);
                        uiHelper.setMax(data.maxStacked);
                        chat.setCharLimit(data.chatCharacterLimit);
                        chromeOffsetWorkaround.update();
                        if (data.captchaKey) {
                            $(".g-recaptcha").attr("data-sitekey", data.captchaKey);

                            $.getScript('https://www.google.com/recaptcha/api.js');
                        }
                        self.elements.board.attr({
                            width: self.width,
                            height: self.height
                        });

                        var cx = query.get("x") || self.width / 2,
                            cy = query.get("y") || self.height / 2;
                        self.scale = query.get("scale") || self.scale;
                        self.centerOn(cx, cy);
                        socket.init();
                        binary_ajax("/boarddata" + "?_" + (new Date()).getTime(), self.draw, socket.reconnect);

                        if (self.use_js_render) {
                            $(window).resize(function () {
                                self.update();
                            }).resize();
                        } else {
                            $(window).resize(function () {
                                place.update();
                                grid.update();
                            });
                        }
                        var url = query.get("template");
                        if (url) { // we have a template!
                            template.queueUpdate({
                                use: true,
                                x: parseFloat(query.get("ox")),
                                y: parseFloat(query.get("oy")),
                                opacity: parseFloat(query.get("oo")),
                                width: parseFloat(query.get("tw")),
                                title: query.get('title'),
                                url: url
                            });
                        }
                        var spin = parseFloat(query.get("spin"));
                        if (spin) { // SPIN SPIN SPIN!!!!
                            spin = 360 / (spin * 1000);
                            var degree = 0,
                                start = null,
                                spiiiiiin = function (timestamp) {
                                    if (!start) {
                                        start = timestamp;
                                    }
                                    var delta = (timestamp - start);
                                    degree += spin * delta;
                                    degree %= 360;
                                    start = timestamp;
                                    self.elements.container.css("transform", "rotate(" + degree + "deg)");
                                    window.requestAnimationFrame(spiiiiiin);
                                };
                            window.requestAnimationFrame(spiiiiiin);
                        }
                        let color = ls.get("color");
                        if (color != null) {
                            place.switch(parseInt(color));
                        }
                    }).fail(function () {
                        socket.reconnect();
                    });
                },
                update: function (optional) {
                    self.pan.x = Math.min(self.width / 2, Math.max(-self.width / 2, self.pan.x));
                    self.pan.y = Math.min(self.height / 2, Math.max(-self.height / 2, self.pan.y));
                    query.set({
                        x: Math.round((self.width / 2) - self.pan.x),
                        y: Math.round((self.height / 2) - self.pan.y),
                        scale: Math.round(self.scale * 100) / 100
                    }, true);
                    if (self.use_js_render) {
                        var ctx2 = self.elements.board_render[0].getContext("2d"),
                            pxl_x = -self.pan.x + ((self.width - (window.innerWidth / self.scale)) / 2),
                            pxl_y = -self.pan.y + ((self.height - (window.innerHeight / self.scale)) / 2),
                            dx = 0,
                            dy = 0,
                            dw = 0,
                            dh = 0,
                            pxl_w = window.innerWidth / self.scale,
                            pxl_h = window.innerHeight / self.scale;

                        if (pxl_x < 0) {
                            dx = -pxl_x;
                            pxl_x = 0;
                            pxl_w -= dx;
                            dw += dx;
                        }

                        if (pxl_y < 0) {
                            dy = -pxl_y;
                            pxl_y = 0;
                            pxl_h -= dy;
                            dh += dy;
                        }

                        if (pxl_x + pxl_w > self.width) {
                            dw += pxl_w + pxl_x - self.width;
                            pxl_w = self.width - pxl_x;
                        }

                        if (pxl_y + pxl_h > self.height) {
                            dh += pxl_h + pxl_y - self.height;
                            pxl_h = self.height - pxl_y;
                        }

                        ctx2.canvas.width = window.innerWidth;
                        ctx2.canvas.height = window.innerHeight;
                        ctx2.mozImageSmoothingEnabled = ctx2.webkitImageSmoothingEnabled = ctx2.msImageSmoothingEnabled = ctx2.imageSmoothingEnabled = (Math.abs(self.scale) < 1);

                        ctx2.globalAlpha = 1;
                        ctx2.fillStyle = '#CCCCCC';
                        ctx2.fillRect(0, 0, ctx2.canvas.width, ctx2.canvas.height);
                        ctx2.drawImage(self.elements.board[0],
                            pxl_x,
                            pxl_y,
                            pxl_w,
                            pxl_h,
                            0 + (dx * self.scale),
                            0 + (dy * self.scale),
                            window.innerWidth - (dw * self.scale),
                            window.innerHeight - (dh * self.scale)
                        );

                        template.draw(ctx2, pxl_x, pxl_y);

                        place.update();
                        grid.update();
                        return true;
                    }
                    if (optional) {
                        return false;
                    }
                    if (Math.abs(self.scale) < 1) {
                        self.elements.board.removeClass("pixelate");
                    } else {
                        self.elements.board.addClass("pixelate");
                    }
                    if (self.allowDrag || (!self.allowDrag && self.pannedWithKeys)) {
                        self.elements.mover.css({
                            width: self.width,
                            height: self.height,
                            transform: "translate(" + (self.scale <= 1 ? Math.round(self.pan.x) : self.pan.x) + "px, " + (self.scale <= 1 ? Math.round(self.pan.y) : self.pan.y) + "px)"
                        });
                    }
                    if (self.use_zoom) {
                        self.elements.zoomer.css("zoom", (self.scale * 100).toString() + "%");
                    } else {
                        self.elements.zoomer.css("transform", "scale(" + self.scale + ")");
                    }

                    place.update();
                    grid.update();
                    return true;
                },
                getScale: function () {
                    return Math.abs(self.scale);
                },
                setScale: function (scale) {
                    if (ls.get("increased_zoom") !== true && scale > 50) scale = 50;
                    else if (scale <= 0) scale = 0.5; //enforce the [0.5, 50] limit without blindly resetting to 0.5 when the user was trying to zoom in farther than 50x
                    self.scale = scale;
                    self.update();
                },
                nudgeScale: function (adj) {
                    var oldScale = Math.abs(self.scale),
                        sign = Math.sign(self.scale),
                        maxUnlocked = ls.get("increased_zoom") === true;
                    if (adj === -1) {
                        if (oldScale <= 1) {
                            self.scale = 0.5;
                        } else if (oldScale <= 2) {
                            self.scale = 1;
                        } else {
                            self.scale = Math.round(Math.max(2, oldScale / 1.25));
                        }
                    } else {
                        if (oldScale === 0.5) {
                            self.scale = 1;
                        } else if (oldScale === 1) {
                            self.scale = 2;
                        } else {
                            let modifiedScale = oldScale * 1.25;
                            if (maxUnlocked && oldScale >= 50) {
                                modifiedScale = oldScale * 1.15;
                            }
                            modifiedScale = Math.ceil(modifiedScale);
                            self.scale = maxUnlocked ? modifiedScale : Math.round(Math.min(50, modifiedScale));
                        }
                    }
                    self.scale *= sign;
                    self.update();
                },
                getPixel: function (x, y) {
                    x = Math.floor(x);
                    y = Math.floor(y);
                    var colorInt = self.intView[y * self.width + x];
                    var index = self.rgbPalette.indexOf(colorInt);
                    return index;
                },
                setPixel: function (x, y, c, refresh) {
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
                    if (c == -1 || c == 0xFF) {
                        self.intView[y * self.width + x] = 0x00000000;
                    } else {
                        self.intView[y * self.width + x] = self.rgbPalette[c];
                    }
                    if (refresh) {
                        self.ctx.putImageData(self.id, 0, 0);
                    }
                },
                refresh: function () {
                    if (self.loaded) {
                        self.ctx.putImageData(self.id, 0, 0);
                    }
                },
                fromScreen: function (screenX, screenY, floored = true) {
                    let toRet = {x: 0, y: 0};
                    let adjust_x = 0,
                        adjust_y = 0;
                    if (self.scale < 0) {
                        adjust_x = self.width;
                        adjust_y = self.height;
                    }

                    if (self.use_js_render) {
                        toRet = {
                            x: -self.pan.x + ((self.width - (window.innerWidth / self.scale)) / 2) + (screenX / self.scale) + adjust_x,
                            y: -self.pan.y + ((self.height - (window.innerHeight / self.scale)) / 2) + (screenY / self.scale) + adjust_y
                        };
                    } else {
                        //we scope these into the `else` so that we don't have to redefine `boardBox` twice. getBoundingClientRect() forces a redraw so we don't want to do it every call either if we can help it.
                        let boardBox = self.elements.board[0].getBoundingClientRect();
                        if (self.use_zoom) {
                            toRet =  {
                                x: (screenX / self.scale) - boardBox.left + adjust_x,
                                y: (screenY / self.scale) - boardBox.top + adjust_y
                            };
                        } else {
                            toRet = {
                                x: ((screenX - boardBox.left) / self.scale) + adjust_x,
                                y: ((screenY - boardBox.top) / self.scale) + adjust_y
                            };
                        }
                    }

                    if (floored) {
                        toRet.x >>= 0;
                        toRet.y >>= 0;
                    }

                    return toRet;
                },
                toScreen: function (boardX, boardY) {
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
                    var boardBox = self.elements.board[0].getBoundingClientRect();
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
                save: function () {
                    var a = document.createElement("a");
                    const format = $("#snapshotImageFormat").val();

                    a.href = self.elements.board[0].toDataURL(format, 1);
                    a.download = (new Date()).toISOString().replace(/^(\d+-\d+-\d+)T(\d+):(\d+):(\d).*$/, `pxls canvas $1 $2.$3.$4.${format.split("/")[1]}`);
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    if (typeof a.remove === "function") {
                        a.remove();
                    }
                },
                getRenderBoard: function () {
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
                allowDrag: self.allowDrag,
                validateCoordinates: self.validateCoordinates
            };
        })(),
        // heatmap init stuff
        heatmap = (function () {
            var self = {
                elements: {
                    heatmap: $("#heatmap")
                },
                ctx: null,
                id: null,
                intView: null,
                width: 0,
                height: 0,
                lazy_inited: false,
                fetchRequest: null,
                is_shown: false,
                color: 0x005C5CCD,
                loop: function () {
                    for (var i = 0; i < self.width * self.height; i++) {
                        var opacity = self.intView[i] >> 24;
                        if (opacity) {
                            opacity--;
                            self.intView[i] = (opacity << 24) | self.color;
                        }
                    }
                    self.ctx.putImageData(self.id, 0, 0);
                    setTimeout(self.loop, self.seconds * 1000 / 256);
                },
                lazy_init: () => {
                    if (self.lazy_inited) {
                        uiHelper.setLoadingState("heatmap", false);
                        return;
                    }
                    uiHelper.setLoadingState("heatmap", true);
                    self.lazy_inited = true;
                    // we use xhr directly because of jquery being weird on raw binary
                    self.fetchRequest = binary_ajax("/heatmap" + "?_" + (new Date()).getTime(), function (data) {
                        self.fetchRequest = null;
                        self.ctx = self.elements.heatmap[0].getContext("2d");
                        self.ctx.mozImageSmoothingEnabled = self.ctx.webkitImageSmoothingEnabled = self.ctx.msImageSmoothingEnabled = self.ctx.imageSmoothingEnabled = false;
                        self.id = createImageData(self.width, self.height);

                        self.intView = new Uint32Array(self.id.data.buffer);
                        for (var i = 0; i < self.width * self.height; i++) {
                            self.intView[i] = (data[i] << 24) | self.color;
                        }
                        self.ctx.putImageData(self.id, 0, 0);
                        self.elements.heatmap.fadeIn(200);
                        uiHelper.setLoadingState("heatmap", false);
                        setTimeout(self.loop, self.seconds * 1000 / 256);
                        socket.on("pixel", function (data) {
                            self.ctx.fillStyle = "#CD5C5C";
                            $.map(data.pixels, function (px) {
                                self.ctx.fillRect(px.x, px.y, 1, 1);
                                self.intView[px.y * self.width + px.x] = 0xFF000000 | self.color;
                            });
                        });
                    });
                },
                clear: function () {
                    self._clear();
                },
                _clear: function () {
                    // If the user hasn't opened the heatmap yet, we can't clear it!
                    if (self.intView == null) {
                        return;
                    }
                    for (var i = 0; i < self.width * self.height; i++) {
                        self.intView[i] = 0;
                    }
                    self.ctx.putImageData(self.id, 0, 0);
                },
                setBackgroundOpacity: function (opacity) {
                    if (typeof (opacity) === "string") {
                        opacity = parseFloat(opacity);
                        if (isNaN(opacity)) opacity = 0.5;
                    }
                    if (opacity === null || opacity === undefined) opacity = 0.5;
                    if (opacity < 0 || opacity > 1) opacity = 0.5;

                    ls.set("heatmap_background_opacity", opacity);
                    self.elements.heatmap.css("background-color", "rgba(0, 0, 0, " + opacity + ")");
                },
                init: function () {
                    self.elements.heatmap.hide();
                    self.setBackgroundOpacity(ls.get("heatmap_background_opacity"));
                    $("#heatmap-opacity").val(ls.get("heatmap_background_opacity")); //heatmap_background_opacity should always be valid after a call to self.setBackgroundOpacity.
                    $("#heatmap-opacity").on("change input", function () {
                        self.setBackgroundOpacity(parseFloat(this.value));
                    });
                    $("#hvmapClear").click(function () {
                        self.clear();
                    });
                    $(window).keydown((evt) => {
                        if (["INPUT", "TEXTAREA"].includes(evt.target.nodeName)) {
                            // prevent inputs from triggering shortcuts
                            return;
                        }

                        if (evt.key == "o" || evt.key == "O" || evt.which == 79) {
                            self.clear();
                        }
                    });
                },
                show: function () {
                    self.is_shown = false;
                    self.toggle();
                },
                hide: function () {
                    self.is_shown = true;
                    self.toggle();
                },
                toggle: function () {
                    self.is_shown = !self.is_shown;
                    ls.set("heatmap", self.is_shown);
                    $("#heatmaptoggle")[0].checked = self.is_shown;
                    if (self.fetchRequest) {
                       self.fetchRequest.abort();
                       uiHelper.setLoadingState("heatmap", false);
                       self.lazy_inited = false;
                       self.fetchRequest = null;
                       return;
                    }

                    if (self.lazy_inited) {
                        if (self.is_shown) {
                            this.elements.heatmap.fadeIn(200);
                        } else {
                            this.elements.heatmap.fadeOut(200);
                        }
                        return;
                    }
                    if (self.is_shown) {
                        self.lazy_init();
                    }
                },
                webinit: function (data) {
                    self.width = data.width;
                    self.height = data.height;
                    self.seconds = data.heatmapCooldown;
                    self.elements.heatmap.attr({
                        width: self.width,
                        height: self.height
                    });
                    if (ls.get("heatmap")) {
                        self.show();
                    }
                    $("#heatmaptoggle")[0].checked = ls.get("heatmap");
                    $("#heatmaptoggle").change(function () {
                        if (this.checked) {
                            self.show();
                        } else {
                            self.hide();
                        }
                    });

                    $(window).keydown(function (e) {
                        if (["INPUT", "TEXTAREA"].includes(e.target.nodeName)) {
                            // prevent inputs from triggering shortcuts
                            return;
                        }

                        if (e.key == "h" || e.key == "H" || e.which == 72) { // h key
                            self.toggle();
                            $("#heatmaptoggle")[0].checked = ls.get("heatmap");
                        }
                    });
                }
            };
            return {
                init: self.init,
                webinit: self.webinit,
                toggle: self.toggle,
                setBackgroundOpacity: self.setBackgroundOpacity,
                clear: self.clear
            };
        })(),
        // Virginmaps are like heatmaps
        virginmap = (function () {
            var self = {
                elements: {
                    virginmap: $("#virginmap")
                },
                ctx: null,
                id: null,
                width: 0,
                height: 0,
                lazy_inited: false,
                fetchRequest: null,
                is_shown: false,
                lazy_init: function () {
                    if (self.lazy_inited) {
                        uiHelper.setLoadingState("virginmap", false);
                        return;
                    }
                    uiHelper.setLoadingState("virginmap", true);
                    self.lazy_inited = true;
                    // we use xhr directly because of jquery being weird on raw binary
                    self.fetchRequest = binary_ajax("/virginmap" + "?_" + (new Date()).getTime(), (data) => {
                        self.fetchRequest = null;
                        self.ctx = self.elements.virginmap[0].getContext("2d");
                        self.ctx.mozImageSmoothingEnabled = self.ctx.webkitImageSmoothingEnabled = self.ctx.msImageSmoothingEnabled = self.ctx.imageSmoothingEnabled = false;
                        self.id = createImageData(self.width, self.height);

                        self.ctx.putImageData(self.id, 0, 0);
                        self.ctx.fillStyle = "#000000";

                        self.intView = new Uint32Array(self.id.data.buffer);
                        for (var i = 0; i < self.width * self.height; i++) {
                            var x = i % self.width;
                            var y = Math.floor(i / self.width);
                            if (data[i] === 0) {
                                self.ctx.fillRect(x, y, 1, 1);
                            }
                        }
                        self.elements.virginmap.fadeIn(200);
                        uiHelper.setLoadingState("virginmap", false);
                        socket.on("pixel", function (data) {
                            $.map(data.pixels, function (px) {
                                self.ctx.fillStyle = "#000000";
                                self.ctx.fillRect(px.x, px.y, 1, 1);
                            });
                        });
                    });
                },
                clear: function () {
                    self._clear();
                },
                _clear: function () {
                    self.ctx.putImageData(self.id, 0, 0);
                    self.ctx.fillStyle = "#00FF00";
                    self.ctx.fillRect(0, 0, self.width, self.height);
                },
                setBackgroundOpacity: function (opacity) {
                    if (typeof (opacity) === "string") {
                        opacity = parseFloat(opacity);
                        if (isNaN(opacity)) opacity = 0.5;
                    }
                    if (opacity === null || opacity === undefined) opacity = 0.5;
                    if (opacity < 0 || opacity > 1) opacity = 0.5;

                    ls.set("virginmap_background_opacity", opacity);
                    self.elements.virginmap.css("background-color", "rgba(0, 255, 0, " + opacity + ")");
                },
                init: function () {
                    self.elements.virginmap.hide();
                    self.setBackgroundOpacity(ls.get("virginmap_background_opacity"));
                    $("#virginmap-opacity").val(ls.get("virginmap_background_opacity")); //virginmap_background_opacity should always be valid after a call to self.setBackgroundOpacity.
                    $("#virginmap-opacity").on("change input", function () {
                        self.setBackgroundOpacity(parseFloat(this.value));
                    });
                    $("#hvmapClear").click(function () {
                        self.clear();
                    });
                    $(window).keydown(function (evt) {
                        if (["INPUT", "TEXTAREA"].includes(evt.target.nodeName)) {
                            // prevent inputs from triggering shortcuts
                            return;
                        }

                        if (evt.key == "o" || evt.key == "O" || evt.which == 79) { //O key
                            self.clear();
                        }
                    });
                },
                show: function () {
                    self.is_shown = false;
                    self.toggle();
                },
                hide: function () {
                    self.is_shown = true;
                    self.toggle();
                },
                toggle: function () {
                    self.is_shown = !self.is_shown;
                    ls.set("virginmap", self.is_shown);
                    $("#virginmaptoggle")[0].checked = self.is_shown;
                    if (self.fetchRequest) {
                       self.fetchRequest.abort();
                       uiHelper.setLoadingState("virginmap", false);
                       self.lazy_inited = false;
                       self.fetchRequest = null;
                       return;
                    }

                    if (self.lazy_inited) {
                        if (self.is_shown) {
                            this.elements.virginmap.fadeIn(200);
                        } else {
                            this.elements.virginmap.fadeOut(200);
                        }
                        return;
                    }
                    if (self.is_shown) {
                        self.lazy_init();
                    }
                },
                webinit: function (data) {
                    self.width = data.width;
                    self.height = data.height;
                    self.seconds = data.virginmapCooldown;
                    self.elements.virginmap.attr({
                        width: self.width,
                        height: self.height
                    });
                    if (ls.get("virginmap")) {
                        self.show();
                    }
                    $("#virginmaptoggle")[0].checked = ls.get("virginmap");
                    $("#virginmaptoggle").change(function () {
                        if (this.checked) {
                            self.show();
                        } else {
                            self.hide();
                        }
                    });

                    $(window).keydown(function (e) {
                        if (["INPUT", "TEXTAREA"].includes(e.target.nodeName)) {
                            // prevent inputs from triggering shortcuts
                            return;
                        }

                        if (e.key == "x" || e.key == "X" || e.which == 88) { // x key
                            self.toggle();
                            $("#virginmaptoggle")[0].checked = ls.get("virginmap");
                        }
                    });
                }
            };
            return {
                init: self.init,
                webinit: self.webinit,
                toggle: self.toggle,
                setBackgroundOpacity: self.setBackgroundOpacity,
                clear: self.clear
            };
        })(),
        // here all the template stuff happens
        template = (function () {
            var self = {
                elements: {
                    template: null,
                    useCheckbox: $("#template-use"),
                    titleInput: $("#template-title"),
                    urlInput: $("#template-url"),
                    imageErrorWarning: $("#template-image-error-warning"),
                    coordsXInput: $("#template-coords-x"),
                    coordsYInput: $("#template-coords-y"),
                    opacityInput: $("#template-opacity"),
                    opacityPercentage: $("#template-opacity-percentage"),
                    widthInput: $("#template-width"),
                    widthResetBtn: $("#template-width-reset")
                },
                queueTimer: 0,
                _queuedUpdates: {},
                _defaults: {
                    url: "",
                    x: 0,
                    y: 0,
                    width: -1,
                    opacity: 0.5,
                    title: ''
                },
                options: {},
                lazy_init: function () {
                    if (self.elements.template != null) { // already inited
                        return;
                    }
                    self.options.use = true;

                    self.elements.imageErrorWarning.hide();

                    var drag = {
                        x: 0,
                        y: 0
                    };
                    self.elements.template = $("<img>").addClass("noselect pixelate").attr({
                        id: "board-template",
                        src: self.options.url,
                        alt: "template"
                    }).css({
                        top: self.options.y,
                        left: self.options.x,
                        opacity: self.options.opacity,
                        width: self.options.width === -1 ? 'auto' : self.options.width
                    }).data("dragging", false).on("mousedown pointerdown", function (evt) {
                        evt.preventDefault();
                        $(this).data("dragging", true);
                        drag.x = evt.clientX;
                        drag.y = evt.clientY;
                        evt.stopPropagation();
                    }).on("mouseup pointerup", function (evt) {
                        evt.preventDefault();
                        $(this).data("dragging", false);
                        evt.stopPropagation();
                    }).on("mousemove pointermove", function (evt) {
                        evt.preventDefault();
                        if ($(this).data("dragging")) {
                            if (!evt.ctrlKey && !evt.altKey) {
                                self.stopDragging();
                                return;
                            }
                            var px_old = board.fromScreen(drag.x, drag.y),
                                px_new = board.fromScreen(evt.clientX, evt.clientY),
                                dx = (px_new.x) - (px_old.x),
                                dy = (px_new.y) - (px_old.y),
                                newX = self.options.x + dx,
                                newY = self.options.y + dy;
                            self._update({ x: newX, y: newY });
                            query.set({ ox: newX, oy: newY }, true);
                            if (dx != 0) {
                                drag.x = evt.clientX;
                            }
                            if (dy != 0) {
                                drag.y = evt.clientY;
                            }
                        }
                    }).on("load", (e) => {
                        if (self.options.width < 0) {
                            self.elements.widthInput.val(self.elements.template.width());
                        }
                    }).on("error", () => {
                        self.elements.imageErrorWarning.show();
                        self.elements.template.remove();
                    });
                    if (board.update(true)) {
                        return;
                    }
                    board.getRenderBoard().parent().prepend(self.elements.template);
                },
                updateDrawer: function () {
                    self.elements.useCheckbox.prop("checked", self.options.use);
                    self.elements.urlInput.val(self.options.url ? self.options.url : "");

                    self.elements.titleInput
                        .prop("disabled", !self.options.use)
                        .val(self.options.title ? self.options.title : "");

                    self.elements.opacityInput
                        .prop("disabled", !self.options.use)
                        .val(self.options.opacity);
                    self.elements.opacityPercentage.text(`${Math.floor(self.options.opacity * 100)}%`);

                    self.elements.coordsXInput
                        .prop("disabled", !self.options.use)
                        .val(self.options.x);
                    self.elements.coordsYInput
                        .prop("disabled", !self.options.use)
                        .val(self.options.y);

                    self.elements.widthInput.prop("disabled", !self.options.use);
                    if (self.options.width >= 0) {
                        self.elements.widthInput.val(self.options.width);
                    } else if (self.elements.template) {
                        self.elements.widthInput.val(self.elements.template.width());
                    } else {
                        self.elements.widthInput.val(null);
                    }
                },
                normalizeTemplateObj(objectToNormalize, direction) {
                    //direction: true = url_to_template_obj, else = template_obj_to_url
                    //normalize the given update object with settings that may be present from someone guessing options based on the URL

                    let iterOver = [["tw", "width"], ["ox", "x"], ["oy", "y"], ["oo", "opacity"], ["template", "url"], ["title", "title"]];
                    if (direction !== true)
                        for (let i = 0; i < iterOver.length; i++)
                            iterOver[i].reverse();

                    for (let i = 0; i < iterOver.length; i++) {
                        let x = iterOver[i];
                        if ((x[0] in objectToNormalize) && objectToNormalize[x[1]] == null) { //if "tw" is set on `objectToNormalize` and `objectToNormalize.width` is not set
                            objectToNormalize[x[1]] = objectToNormalize[x[0]]; //set `objectToNormalize["width"]` to `objectToNormalize["tw"]`
                            delete objectToNormalize[x[0]]; //and delete `objectToNormalize["tw"]`
                        }
                    }

                    return objectToNormalize;
                },
                queueUpdate: function (obj) {
                    obj = self.normalizeTemplateObj(obj, true);
                    self._queuedUpdates = Object.assign(self._queuedUpdates, obj);
                    if (self.queueTimer) {
                        clearTimeout(self.queueTimer);
                    }
                    self.queueTimer = setTimeout(function () {
                        self._update(self._queuedUpdates);
                        self._queuedUpdates = {};
                        self.queueTimer = 0;
                    }, 200);
                },
                _update: function (options, updateDrawer = true) {
                    if (!Object.keys(options).length) {
                        return;
                    }

                    let urlUpdated = (options.url !== self.options.url && decodeURIComponent(options.url) !== self.options.url && options.url != null && self.options.url != null);
                    if (options.url != null && options.url.length > 0) {
                        options.url = decodeURIComponent(options.url);
                    }
                    if (options.title != null && options.title.length > 0) {
                        options.title = decodeURIComponent(options.title);
                    }

                    //fix for `width` and other props being set after disabling template with the 'v' key then enabling a template without said prop set in the URL.
                    if (urlUpdated && !self.options.use) {
                        ["width", "x", "y", "opacity"].forEach(x => {
                            if (!options.hasOwnProperty(x)) {
                                options[x] = self._defaults[x];
                            }
                        });
                    }

                    options = Object.assign({}, self._defaults, self.options, self.normalizeTemplateObj(options, true)); //ensure every option needed to move forward is present
                    Object.keys(self._defaults).forEach(x => { //and make sure they're all usable "out of the box"
                        if (options[x] == null || (typeof options[x] === "number" && isNaN(options[x]))) {
                            options[x] = self._defaults[x];
                        }
                    });
                    options.opacity = parseFloat(options.opacity.toFixed(2)); //cleans up opacity for the URL, e.g. 1.3877787807814457e-16 => 0
                    self.options = options;

                    if (options.url.length === 0 || options.use === false) {
                        self.options.use = false;
                        if (self.elements.template) {
                            self.elements.template.remove();
                            self.elements.template = null;
                        }
                        board.update(true);
                        ["template", "ox", "oy", "oo", "tw", "title"].forEach(x => query.remove(x, true));
                    } else {
                        self.options.use = true;
                        if (urlUpdated === true && self.elements.template != null) {
                            self.elements.template.remove(); //necessary so everything gets redrawn properly 'n whatnot. could probably just update the url directly...
                            self.elements.template = null;
                        }
                        self.lazy_init();

                        [["left", "x"], ["top", "y"], ["opacity", "opacity"]].forEach(x => {
                            self.elements.template.css(x[0], options[x[1]]);
                        });
                        self.elements.template.css("width", options.width > 0 ? options.width : "auto");

                        [["url", "template"], ["x", "ox"], ["y", "oy"], ["width", "tw"], ["opacity", "oo"], ["title", "title"]].forEach(x => {
                            query.set(x[1], self.options[x[0]], true);
                        });
                    }
                    if (updateDrawer) {
                        self.updateDrawer();
                    }
                    document.title = uiHelper.getTitle();
                },
                disableTemplate: function () {
                    self._update({ url: null });
                },
                draw: function (ctx2, pxl_x, pxl_y) {
                    if (!self.options.use) {
                        return;
                    }
                    var width = self.elements.template[0].width,
                        height = self.elements.template[0].height,
                        scale = board.getScale();
                    if (self.options.width !== -1) {
                        height *= (self.options.width / width);
                        width = self.options.width;
                    }
                    ctx2.globalAlpha = self.options.opacity;
                    ctx2.drawImage(self.elements.template[0], (self.options.x - pxl_x) * scale, (self.options.y - pxl_y) * scale, width * scale, height * scale);
                },
                init: function () {
                    self.elements.imageErrorWarning.hide();
                    drawer.create("#template-control", 84, "template_open", false);

                    self.elements.useCheckbox.change((e) => self._update({ use: e.target.checked }));
                    self.elements.titleInput.change((e) => self._update({ title: e.target.value }, false));
                    self.elements.urlInput.change((e) => self._update({ use: true, url: e.target.value }));

                    self.elements.opacityInput.on("change input", (e) => {
                        self.elements.opacityPercentage.text(`${Math.floor(e.target.value * 100)}%`);
                        self._update({ opacity: parseFloat(e.target.value) }, false);
                    });

                    self.elements.coordsXInput.on("change input", (e) => self._update({ x: parseInt(e.target.value) }, false));
                    self.elements.coordsYInput.on("change input", (e) => self._update({ y: parseInt(e.target.value) }, false));

                    self.elements.widthInput.on("change input", (e) => self._update({ width: parseFloat(e.target.value) }, false));
                    self.elements.widthResetBtn.on("click", (e) => self._update({ width: -1 }));

                    self.updateDrawer();

                    $(window).keydown(function (evt) {
                        if (["INPUT", "TEXTAREA"].includes(evt.target.nodeName)) {
                            // prevent inputs from triggering shortcuts
                            return;
                        }

                        if (self.options.use) {
                            switch(evt.originalEvent.code || evt.originalEvent.keyCode || evt.originalEvent.which || evt.originalEvent.key) {
                                case "ControlLeft":
                                case "ControlRight":
                                case "Control":
                                case 17:
                                case "AltLeft":
                                case "AltRight":
                                case "Alt":
                                case 18:
                                    evt.preventDefault();
                                    self.elements.template.css("pointer-events", "initial");
                                    break;
                            }
                        }
                        let newOpacity = 0;
                        switch (evt.code || evt.keyCode || evt.which || evt.key) {
                            case "PageUp":
                            case 33:
                                newOpacity = Math.min(1, self.options.opacity + 0.1);
                                self._update({ opacity: newOpacity });
                                break;
                            case "PageDown":
                            case 34:
                                newOpacity = Math.max(0, self.options.opacity - 0.1);
                                self._update({ opacity: newOpacity });
                                break;
                            case "KeyV":
                            case 86:
                            case "v":
                            case "V":
                                self._update({
                                    use: !self.options.use
                                });
                                break;
                        }
                    }).on("keyup blur", self.stopDragging);
                },
                stopDragging: function () {
                    if (self.options.use) {
                        self.elements.template.css("pointer-events", "none").data("dragging", false);
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
        })(),
        // here all the grid stuff happens
        grid = (function () {
            var self = {
                elements: {
                    grid: $("#grid")
                },
                init: function () {
                    self.elements.grid.hide();
                    $("#gridtoggle")[0].checked = ls.get("view_grid");
                    $("#gridtoggle").change(function () {
                        ls.set("view_grid", this.checked);
                        self.elements.grid.fadeToggle({ duration: 100 });
                    });
                    if (ls.get("view_grid")) {
                        self.elements.grid.fadeToggle({ duration: 100 });
                    }
                    $(document.body).on("keydown", function (evt) {
                        if (["INPUT", "TEXTAREA"].includes(evt.target.nodeName)) {
                            // prevent inputs from triggering shortcuts
                            return;
                        }

                        if (evt.key == "g" || evt.key == "G" || evt.keyCode === 71) {
                            $("#gridtoggle")[0].checked = !$("#gridtoggle")[0].checked;
                            $("#gridtoggle").trigger("change");
                        }
                    });
                },
                update: function () {
                    var a = board.fromScreen(0, 0, false),
                        scale = board.getScale();
                    self.elements.grid.css({
                        backgroundSize: scale + "px " + scale + "px",
                        transform: "translate(" + Math.floor(-a.x % 1 * scale) + "px," + Math.floor(-a.y % 1 * scale) + "px)",
                        opacity: (scale - 2) / 6
                    });
                }
            };
            return {
                init: self.init,
                update: self.update
            };
        })(),
        // this takes care of placing pixels, the palette, the reticule and stuff associated with that
        place = (function () {
            var self = {
                elements: {
                    palette: $("#palette"),
                    cursor: $("#cursor"),
                    reticule: $("#reticule"),
                    undo: $("#undo")
                },
                undoTimeout: false,
                palette: [],
                reticule: {
                    x: 0,
                    y: 0
                },
                audio: new Audio('place.wav'),
                color: -1,
                pendingPixel: {
                    x: 0,
                    y: 0,
                    color: -1
                },
                autoreset: true,
                setAutoReset: function (v) {
                    self.autoreset = !!v;
                    ls.set("auto_reset", self.autoreset);
                },
                switch: function (newColor) {
                    self.color = newColor;
                    ls.set('color', newColor);
                    $(".palette-color").removeClass("active");

                    $("body").toggleClass("show-placeable-bubble", newColor === -1);
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
                    self.elements.cursor.css("background-color", self.palette[newColor]);
                    self.elements.reticule.css("background-color", self.palette[newColor]);
                    if (newColor !== -1) {
                        $($(".palette-color[data-idx=" + newColor + "],.palette-color[data-idx=-1]")).addClass("active"); //Select both the new color AND the deselect button. Signifies more that it's a deselect button rather than a "delete pixel" button
                        try {
                            $(`.palette-color[data-idx="${newColor}"]`)[0].scrollIntoView({block:"nearest", inline:"nearest"});
                        } catch (e) {
                            $(`.palette-color[data-idx="${newColor}"]`)[0].scrollIntoView(false);
                        }
                    }
                },
                place: function (x, y) {
                    if (!timer.cooledDown() || self.color === -1) { // nope can't place yet
                        return;
                    }
                    self._place(x, y);
                },
                _place: function (x, y) {
                    self.pendingPixel.x = x;
                    self.pendingPixel.y = y;
                    self.pendingPixel.color = self.color;
                    socket.send({
                        type: "pixel",
                        x: x,
                        y: y,
                        color: self.color
                    });

                    analytics("send", "event", "Pixels", "Place");
                    if (self.autoreset) {
                        self.switch(-1);
                    }
                },
                update: function (clientX, clientY) {
                    if (clientX !== undefined) {
                        var boardPos = board.fromScreen(clientX, clientY);
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
                    if (ls.get('ui.show-reticule')) {
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
                    if (ls.get('ui.show-cursor')) {
                        self.toggleCursor(true);
                    }
                },
                setNumberedPaletteEnabled: function(shouldBeNumbered) {
                    self.elements.palette[0].classList.toggle('no-pills', !shouldBeNumbered);
                },
                toggleReticule: (show) => {
                    if (show && ls.get('ui.show-reticule')) {
                        self.elements.reticule.show();
                    } else if (!show) {
                        self.elements.reticule.hide();
                    }
                },
                toggleCursor: (show) => {
                    if (show && ls.get('ui.show-cursor')) {
                        self.elements.cursor.show();
                    } else if (!show) {
                        self.elements.cursor.hide();
                    }
                },
                setPalette: function (palette) {
                    self.palette = palette;
                    self.elements.palette.find(".palette-color").remove().end().append(
                        $.map(self.palette, function (p, idx) {
                            return $("<div>")
                                .attr("data-idx", idx)
                                .addClass("palette-color")
                                .addClass("ontouchstart" in window ? "touch" : "no-touch")
                                .css("background-color", self.palette[idx])
                                .append(
                                    $("<span>").addClass("palette-number").text(idx)
                                )
                                .click(function () {
                                    if (ls.get("auto_reset") === false || timer.cooledDown()) {
                                        self.switch(idx);
                                    }
                                });
                        })
                    );
                    self.elements.palette.prepend(
                        $("<div>")
                            .attr("data-idx", -1)
                            .addClass("palette-color no-border deselect-button")
                            .addClass("ontouchstart" in window ? "touch" : "no-touch").css("background-color", "transparent")
                            .append(
                                crel('i', {class: 'fas fa-times'})
                            )
                            .click(function () {
                                self.switch(-1);
                            })
                    );
                },
                can_undo: false,
                undo: function (evt) {
                    evt.stopPropagation();
                    socket.send({ type: 'undo' });
                    self.can_undo = false;
                    document.body.classList.remove("undo-visible");
                    self.elements.undo.removeClass("open");
                },
                init: function () {
                    self.toggleReticule(false);
                    self.toggleCursor(false);
                    document.body.classList.remove("undo-visible");
                    self.elements.undo.removeClass("open");
                    board.getRenderBoard().on("pointermove mousemove", function (evt) {
                        self.update(evt.clientX, evt.clientY);
                    });
                    $(window).on("pointermove mousemove touchstart touchmove", function (evt) {
                        let x = 0,
                            y = 0;
                        if (evt.changedTouches && evt.changedTouches[0]) {
                            x = evt.changedTouches[0].clientX;
                            y = evt.changedTouches[0].clientY;
                        } else {
                            x = evt.clientX;
                            y = evt.clientY;
                        }

                        if (ls.get('ui.show-cursor') !== false) {
                            self.elements.cursor.css("transform", "translate(" + x + "px, " + y + "px)");
                        }
                        if (self.can_undo) {
                            return;
                        }
                    }).keydown(function (evt) {
                        if (["INPUT", "TEXTAREA"].includes(evt.target.nodeName)) {
                            // prevent inputs from triggering shortcuts
                            return;
                        }

                        if (self.can_undo && (evt.key == "z" || evt.key == "Z" || evt.keyCode == 90) && evt.ctrlKey) {
                            self.undo(evt);
                        }
                    }).on("touchstart", function (evt) {
                        if (self.color === -1 || self.can_undo) {
                            return;
                        }
                    });
                    socket.on("pixel", function (data) {
                        $.map(data.pixels, function (px) {
                            board.setPixel(px.x, px.y, px.color, false);
                        });
                        board.refresh();
                        board.update(true);
                    });
                    socket.on("ACK", function (data) {
                        switch (data.ackFor) {
                            case "PLACE":
                                $(window).trigger('pxls:ack:place', [data.x, data.y]);
                                if (uiHelper.tabHasFocus() && !ls.get("audio_muted")) {
                                    var clone = self.audio.cloneNode(false);
                                    clone.volume = parseFloat(ls.get("alert.volume"));
                                    clone.play();
                                }
                                break;
                            case "UNDO":
                                $(window).trigger('pxls:ack:undo', [data.x, data.y]);
                                break;
                        }

                        if (uiHelper.getAvailable() === 0)
                            uiHelper.setPlaceableText(data.ackFor === "PLACE" ? 0 : 1);
                    });
                    socket.on("captcha_required", function (data) {
                        grecaptcha.reset();
                        grecaptcha.execute();

                        analytics("send", "event", "Captcha", "Execute")
                    });
                    socket.on("captcha_status", function (data) {
                        if (data.success) {
                            var pending = self.pendingPixel;
                            self.switch(pending.color);
                            self._place(pending.x, pending.y);

                            analytics("send", "event", "Captcha", "Accepted")
                        } else {
                            alert.show("Failed captcha verification");
                            analytics("send", "event", "Captcha", "Failed")
                        }
                    });
                    socket.on("can_undo", function (data) {
                        document.body.classList.add("undo-visible");
                        self.elements.undo.addClass("open");
                        self.can_undo = true;
                        if (self.undoTimeout !== false) clearTimeout(self.undoTimeout);
                        self.undoTimeout = setTimeout(function () {
                            document.body.classList.remove("undo-visible");
                            self.elements.undo.removeClass("open");
                            self.can_undo = false;
                            self.undoTimeout = false;
                        }, data.time * 1000);
                    });
                    self.elements.undo.click(self.undo);
                    window.recaptchaCallback = function (token) {
                        socket.send({
                            type: "captcha",
                            token: token
                        });
                        analytics("send", "event", "Captcha", "Sent")
                    };
                    self.elements.palette.on("wheel", e => {
                        if (ls.get("scrollSwitchEnabled") !== true) return;
                        let delta = e.originalEvent.deltaY * -40;
                        let newVal = (self.color + ((delta > 0 ? 1 : -1) * (ls.get("scrollSwitchDirectionInverted") === true ? -1 : 1))) % self.palette.length;
                        self.switch(newVal <= -1 ? self.palette.length - 1 : newVal);
                    });
                },
                hexToRgb: function (hex) {
                    var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
                    return result ? {
                        r: parseInt(result[1], 16),
                        g: parseInt(result[2], 16),
                        b: parseInt(result[3], 16)
                    } : null;
                },
                getPaletteRGB: function () {
                    var a = new Uint32Array(self.palette.length);
                    $.map(self.palette, function (c, i) {
                        var rgb = self.hexToRgb(c);
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
                getPaletteColor: (n, def = "#000000") => self.palette[n] || def,
                getPaletteRGB: self.getPaletteRGB,
                setAutoReset: self.setAutoReset,
                setNumberedPaletteEnabled: self.setNumberedPaletteEnabled,
                get color() {
                    return self.color;
                },
                toggleReticule: self.toggleReticule,
                toggleCursor: self.toggleCursor
            };
        })(),
        // this is the user lookup helper
        lookup = (function () {
            var self = {
                elements: {
                    lookup: $("#lookup"),
                    prompt: $("#prompt")
                },
                handle: null,
                report: function (id, x, y) {
                    self.elements.prompt.empty().append(
                        $("<p>").addClass("text").css({
                            fontWeight: 800,
                            marginTop: 0
                        }).text("Report pixel to moderator"),
                        $("<select>").append(
                            $("<option>").text("Rule #1: Hateful/derogatory speech or symbols"),
                            $("<option>").text("Rule #2: Nudity, genitalia, or non-PG-13 content"),
                            $("<option>").text("Rule #3: Multi-account"),
                            $("<option>").text("Rule #4: Botting"),
                            $("<option>").attr("value", "other").text("Other (specify below)")
                        ).css({
                            width: "100%",
                            "margin-bottom": "1em"
                        }),
                        $("<textarea>").attr("placeholder", "Additional information (if applicable)").css({
                            width: '100%',
                            height: '5em'
                        }).keydown(function (evt) {
                            evt.stopPropagation();
                        }),
                        $("<div>").addClass("buttons").append(
                            $("<div>").addClass("button").text("Cancel")
                                .click(function () {
                                    self.elements.prompt.fadeOut(200);
                                }),
                            $("<button>").addClass("button").text("Report")
                                .click(function () {
                                    this.disabled = true;
                                    this.textContent = "Sending...";

                                    var selectedRule = self.elements.prompt.find("select").val();
                                    var textarea = self.elements.prompt.find("textarea").val().trim();
                                    var msg = selectedRule;
                                    if (selectedRule === "other") {
                                        if (textarea === "") {
                                            alert.show("You must specify the details.");
                                            return;
                                        }
                                        msg = textarea;
                                    } else if (textarea !== "") {
                                        msg += "; additional information: " + textarea;
                                    }
                                    $.post("/report", {
                                        id: id,
                                        x: x,
                                        y: y,
                                        message: msg
                                    }, function () {
                                        alert.show("Sent report!");
                                        self.elements.prompt.hide();
                                        self.elements.lookup.hide();
                                    }).fail(function () {
                                        alert.show("Error sending report.");
                                    })
                                })
                        )
                    ).fadeIn(200);
                },
                /**
                 * All lookup hooks.
                 */
                hooks: [],
                /**
                 * Registers hooks.
                 * @param {Object} hooks Information about the hook.
                 * @param {String} hooks.id An ID for the hook.
                 * @param {String} hooks.name A user-facing name for the hook.
                 * @param {Boolean} hooks.sensitive Whenever the hook contains sensitive information.
                 * @param {Boolean} hooks.backgroundCompatible Whenever the hook should appear even if the pixel is background.
                 * @param {Function} hooks.get A function that returns the text information shown in the lookup.
                 * @param {Object} hooks.css An object mapping CSS rules to values for the hook value.
                 */
                registerHook: function (...hooks) {
                    return self.hooks.push(...$.map(hooks, function (hook) {
                        return {
                            id: hook.id || "hook",
                            name: hook.name || "Hook",
                            sensitive: hook.sensitive || false,
                            backgroundCompatible: hook.backgroundCompatible || false,
                            get: hook.get || function () { },
                            css: hook.css || {},
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
                    for (let idx in self.hooks) {
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
                unregisterHook: function (hookId) {
                    return self.hooks = $.grep(self.hooks, function (hook) {
                        return hook.id !== hookId;
                    });
                },
                create: function (data) {
                    const sensitive = localStorage.getItem("hide_sensitive") === "true";
                    let sensitiveElems = [];
                    self._makeShell(data).find(".content").first().append(() => {
                        if (!data.bg) {
                            return "";
                        }

                        return $("<p>").text("This pixel is background (was not placed by a user).")
                    }).append(() => {
                        let hooks = data.bg
                            ? self.hooks.filter((hook) => hook.backgroundCompatible)
                            : self.hooks;

                        return $.map(hooks, (hook) => {
                            const get = hook.get(data);
                            if (get == null) {
                                return null;
                            }

                            const value = typeof get === "object"
                                ? (get instanceof Node ? $(get) : get)
                                : $("<span>").text(get);

                            let _retVal = $("<div data-sensitive=\"" + hook.sensitive + "\">").append(
                                $("<b>").text(hook.name + ": "),
                                value.css(hook.css)
                            ).attr("id", "lookuphook_" + hook.id);
                            if (hook.sensitive) {
                                sensitiveElems.push(_retVal);
                                if (sensitive) {
                                    _retVal.css("display", "none");
                                }
                            }
                            return _retVal;
                        });
                    }).append(() => {
                        if (data.bg || sensitiveElems.length < 1) {
                            return "";
                        }

                        let label = $("<label>").text("Hide sensitive information");
                        let checkbox = $("<input type=\"checkbox\">").css("margin-top", "10px");
                        label.prepend(checkbox);
                        checkbox.prop("checked", sensitive);
                        checkbox.change(function() {
                            ls.set("hide_sensitive", this.checked);
                            sensitiveElems.forEach(v => {
                                v.css("display", this.checked ? "none" : "");
                            })
                        });
                        return label;
                    });
                    self.elements.lookup.fadeIn(200);
                },
                _makeShell: function (data) {
                    return self.elements.lookup.empty().append(
                        $("<div>").addClass("content"),
                        (!data.bg && user.isLoggedIn() ?
                            $("<div>").addClass("button").css("float", "left").addClass("report-button").text("Report").click(function () {
                                self.report(data.id, data.x, data.y);
                            })
                            : ""),
                        $("<div>").addClass("button").css("float", "right").text("Close").click(function () {
                            self.elements.lookup.fadeOut(200);
                        }),
                        (template.getOptions().use ? $("<div>").addClass("button").css("float", "right").text("Move Template Here").click(function () {
                            template.queueUpdate({
                                ox: data.x,
                                oy: data.y,
                            });
                        }) : "")
                    );
                },
                runLookup(clientX, clientY) {
                    const pos = board.fromScreen(clientX, clientY);
                    $.get("/lookup", pos, function (data) {
                        data = data || { x: pos.x, y: pos.y, bg: true };
                        if (data && data.username) {
                            chat.typeahead.helper.getDatabase('users').addEntry(data.username, data.username);
                        }
                        if (self.handle) {
                            self.handle(data);
                        } else {
                            self.create(data);
                        }
                    }).fail(function () {
                        self._makeShell(false).find(".content").first().append($("<p>").css("color", "#c00").text("An error occurred, either you aren't logged in or you may be attempting to look up users too fast. Please try again in 60 seconds"));
                        self.elements.lookup.fadeIn(200);
                    });
                },
                init: function () {
                    // Register default hooks
                    self.registerHook(
                        {
                            id: "coords",
                            name: "Coords",
                            get: data => $("<a>").text("(" + data.x + ", " + data.y + ")").attr("href", coords.getLinkToCoords(data.x, data.y)),
                            backgroundCompatible: true,
                        }, {
                            id: "username",
                            name: "Username",
                            get: data => data.username,
                        }, {
                            id: "time",
                            name: "Time",
                            get: data => {
                                const delta = ((new Date()).getTime() - data.time) / 1000;
                                const stamp = (new Date(data.time)).toLocaleString();

                                const span = $("<span>");
                                span.attr("title", stamp);

                                if (delta > 24 * 3600) {
                                    return span.text(stamp);
                                } else if (delta < 5) {
                                    return span.text("just now");
                                } else {
                                    var secs = Math.floor(delta % 60),
                                        secsStr = secs < 10 ? "0" + secs : secs,
                                        minutes = Math.floor((delta / 60)) % 60,
                                        minuteStr = minutes < 10 ? "0" + minutes : minutes,
                                        hours = Math.floor(delta / 3600),
                                        hoursStr = hours < 10 ? "0" + hours : hours;
                                    return span.text(hoursStr + ":" + minuteStr + ":" + secsStr + " ago");
                                }
                            }
                        }, {
                            id: "pixels",
                            name: "Pixels",
                            get: data => data.pixel_count,
                        }, {
                            id: "pixels_alltime",
                            name: "Alltime Pixels",
                            get: data => data.pixel_count_alltime,
                        }, {
                            id: "discord_name",
                            name: "Discord",
                            get: data => data.discordName,
                        }
                    );

                    self.elements.lookup.hide();
                    self.elements.prompt.hide();
                    board.getRenderBoard().on("click", function (evt) {
                        if (evt.shiftKey) {
                            evt.preventDefault();
                            self.runLookup(evt.clientX, evt.clientY);
                        }
                    });
                },
                registerHandle: function (fn) {
                    self.handle = fn;
                },
                clearHandle: function () {
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
        })(),
        // helper object for drawers
        drawer = (function () {
            var self = {
                elements: {
                    container: $("#drawers"),
                    opener: $("#drawers-opener")
                },
                create: function (html_class, keycode, localstorage, open) {
                    var elem = $(html_class);
                    $(html_class + " > .open").click(function () {
                        elem.toggleClass("open");
                        doTrigger();
                        ls.set(localstorage, elem.hasClass("open") ^ open);
                    });
                    $(html_class + " .close").click(function () {
                        elem.removeClass("open");
                        doTrigger();
                        ls.set(localstorage, false ^ open);
                    });
                    if (ls.get(localstorage) ^ open) {
                        elem.addClass("open");
                        doTrigger();
                    }
                    $(document.body).keydown(function (evt) {
                        if (["INPUT", "TEXTAREA"].includes(evt.target.nodeName)) {
                            // prevent inputs from triggering shortcuts
                            return;
                        }

                        if (evt.keyCode === keycode) {
                            elem.toggleClass("open");
                            ls.set(localstorage, elem.hasClass("open") ^ open);
                            doTrigger();
                        }
                    });

                    function doTrigger() {
                        elem.trigger("drawer-state-change", { isOpen: elem.hasClass("open") });
                    }
                },
                updateDropdown: function () {
                    $("#drawers-opener-content").empty().append(
                        $("#drawers > .drawer").map(function () {
                            var _self = $(this);
                            return $("<div>").text(_self.find(".open").text()).click(function (evt) {
                                evt.stopPropagation();
                                _self.toggleClass("open");
                                self.elements.opener.removeClass("open");
                                _self.trigger("drawer-state-change", { isOpen: _self.hasClass("open") });
                            });
                        }).get()
                    );
                },
                init: function () {
                    self.elements.opener.find(".open").click(function (evt) {
                        self.elements.opener.toggleClass("open");
                    });
                    self.elements.container.on("DOMNodeInserted", function (evt) {
                        if ($(evt.target).hasClass("drawer")) {
                            self.updateDropdown();
                        }
                    });
                    self.updateDropdown();
                }
            };
            return {
                create: self.create,
                init: self.init
            };
        })(),
        // this takes care of the info slidedown and some settings (audio)
        info = (function () {
            var self = {
                init: function () {
                    drawer.create("#info", 73, "info_closed", true);
                    $("#audiotoggle")
                        .prop("checked", ls.get("audio_muted"))
                        .change(function() {
                            ls.set("audio_muted", this.checked);
                        });

                    //stickyColorToggle ("Keep color selected"). Checked = don't auto reset.
                    var auto_reset = ls.get("auto_reset");
                    if (auto_reset === null) {
                        auto_reset = false;
                    }
                    place.setAutoReset(auto_reset);
                    $("#stickyColorToggle")
                        .prop("checked", !auto_reset)
                        .change(function() {
                            place.setAutoReset(!this.checked);
                        });

                    $("#monospaceToggle").change(function () {
                        ls.set("monospace_lookup", this.checked);
                        $(".monoVal").toggleClass("useMono", this.checked);
                    });
                }
            };
            return {
                init: self.init
            };
        })(),
        // this takes care of the custom alert look
        alert = (function () {
            var self = {
                elements: {
                    alert: $("#alert")
                },
                isOpen: false,
                removeContent: () => {
                    self.elements.alert.find(".text,.custWrapper").empty();
                },
                show: (content, hideControls = false) => {
                    self.removeContent();
                    if (typeof content === "string") {
                        self.elements.alert.find(".text").append(content);
                    } else {
                        self.elements.alert.find(".custWrapper").append(content);
                    }
                    if (!self.isOpen) {
                        self.elements.alert.fadeIn(200);
                    }
                    if (hideControls === true) {
                        self.elements.alert.find('.default-control').hide();
                    } else {
                        self.elements.alert.find('.default-control').show();
                    }
                    self.isOpen = true;
                },
                hide: function(clear = false) {
                    if (self.isOpen) {
                        self.elements.alert.fadeOut(200, () => {
                            if (clear) {
                                self.removeContent();
                            }
                        });
                    }
                    self.isOpen = false;
                },
                init: function () {
                    self.elements.alert.hide();
                    self.elements.alert.find(".button").click(self.hide);
                    socket.on("alert", (data) => self.show(data.message));
                }
            };
            return {
                init: self.init,
                show: self.show,
                hide: self.hide
            };
        })(),
        uiHelper = (function () {
            var self = {
                tabId: null,
                focus: false,
                _available: -1,
                maxStacked: -1,
                _alertUpdateTimer: false,
                initTitle: '',
                isLoadingBubbleShown: false,
                loadingStates: {},
                banner: {
                    HTMLs: [
                        crel('span', crel('i', {'class': 'fab fa-discord fa-is-left'}), ' We have a discord! Join here: ', crel('a', {'href': 'https://pxls.space/discord', 'target': '_blank'}, 'Discord Invite')).outerHTML,
                        crel('span', {'style': 'font-size: .75rem'}, crel('i', {'class': 'fas fa-gavel fa-is-left'}), 'Chat is moderated, ensure you read the rules in the info panel.').outerHTML,
                        crel('span', {'style': 'font-size: .8rem'}, crel('i', {'class': 'fas fa-question-circle fa-is-left'}), 'If you haven\'t already, make sure you read the FAQ top left!').outerHTML
                    ],
                    curElem: 0,
                    intervalID: 0,
                    timeout: 10000,
                    enabled: true,
                },
                elements: {
                    mainBubble: $("#main-bubble"),
                    loadingBubble: $("#loading-bubble"),
                    stackCount: $("#placeable-count, #placeableCount-cursor"),
                    coords: $("#coords-info .coords"),
                    txtAlertLocation: $("#txtAlertLocation"),
                    rangeAlertVolume: $("#rangeAlertVolume"),
                    lblAlertVolume: $("#lblAlertVolume"),
                    btnForceAudioUpdate: $("#btnForceAudioUpdate"),
                    themeSelect: $("#themeSelect"),
                    themeColorMeta: $("meta[name=\"theme-color\"]"),
                    txtDiscordName: $("#txtDiscordName"),
                    selUsernameColor: $("#selUsernameColor"),
                    bottomBanner: $("#bottom-banner"),
                },
                themes: [
                    {
                        name: "Dark",
                        location: '/themes/dark.css',
                        color: '#1A1A1A'
                    },
                    {
                        name: "Darker",
                        location: '/themes/darker.css',
                        color: '#000'
                    }
                ],
                specialChatColorClasses: ['rainbow'],
                init: function () {
                    self.initTitle = document.title;
                    self._initThemes();
                    self._initStack();
                    self._initAudio();
                    self._initAccount();
                    self._initBanner();
                    self._initMultiTabDetection();

                    self.elements.coords.click(() => coords.copyCoords(true));

                    var useMono = ls.get("monospace_lookup");
                    if (typeof useMono === 'undefined') {
                        ls.set("monospace_lookup", true);
                        useMono = true;
                    }
                    $("#monospaceToggle").prop('checked', useMono);
                    if (useMono) {
                        $(".monoVal").addClass("useMono");
                    }

                    var alertDelay = ls.get("alert_delay");
                    if (typeof alertDelay === 'undefined') {
                        ls.set("alert_delay", "0");
                        alertDelay = 0;
                    }
                    $("#alertDelay").val(alertDelay);
                    $("#alertDelay").change(function() {
                        if (!isNaN($(this).val())) {
                            ls.set("alert_delay", $(this).val());
                        }
                    });
                    $("#alertDelay").keydown(function (evt) {
                        switch (evt.code || evt.keyCode || evt.which || evt.key) {
                            case "KeyT":
                            case 84:
                            case "T":
                            case "t":
                            case "KeyEnter":
                            case 13:
                                $(this).blur();
                                break;
                        }
                    });

                    $("#increasedZoomToggle").prop("checked", ls.get("increased_zoom") === true);
                    $("#increasedZoomToggle").change(function () {
                        let checked = $(this).prop("checked") === true; //coerce to bool
                        ls.set("increased_zoom", checked);
                    });

                    $("#scrollSwitchToggle").prop("checked", ls.get("scrollSwitchEnabled") === true);
                    $("#scrollSwitchToggle").change(function () {
                        ls.set("scrollSwitchEnabled", this.checked === true);
                    });

                    $("#scrollDirectionToggle").prop("checked", ls.get("scrollSwitchDirectionInverted") === true);
                    $("#scrollDirectionToggle").change(function() {
                        ls.set("scrollSwitchDirectionInverted", this.checked === true);
                    });

                    if (ls.get("enableMiddleMouseSelect") == null) ls.set("enableMiddleMouseSelect", true);
                    $("#cbEnableMiddleMouseSelect").prop("checked", ls.get("enableMiddleMouseSelect") === true)
                        .change(function() {
                            ls.set("enableMiddleMouseSelect", this.checked === true);
                        });

                    place.setNumberedPaletteEnabled(ls.get("enableNumberedPalette") === true);
                    $("#cbNumberedPalette").prop("checked", ls.get("enableNumberedPalette") === true)
                        .change(function() {
                            ls.set("enableNumberedPalette", this.checked === true);
                            place.setNumberedPaletteEnabled(this.checked === true);
                        });


                    const numOrDefault = (n, def) => isNaN(n) ? def : n;
                    const colorBrightnessLevel = numOrDefault(parseFloat(ls.get("colorBrightness")), 1);
                    const colorBrightnessSlider = $("#color-brightness");
                    const colorBrightnessToggle = $("#color-brightness-toggle");

                    colorBrightnessToggle
                        .prop('checked', ls.get('brightness.enabled') === true)
                        .change(function(e) {
                            let isEnabled = !!this.checked;
                            ls.set('brightness.enabled', isEnabled);
                            colorBrightnessSlider.prop('disabled', !isEnabled);
                            self.adjustColorBrightness(isEnabled ? numOrDefault(parseFloat(ls.get("colorBrightness")), 1) : null);
                        });

                    colorBrightnessSlider
                        .val(colorBrightnessLevel)
                        .prop('disabled', ls.get('brightness.enabled') !== true)
                        .change((e) => {
                            if (ls.get('brightness.enabled') === true) {
                                const level = parseFloat(e.target.value);
                                ls.set("colorBrightness", level);
                                self.adjustColorBrightness(level);
                            }
                        });
                    self.adjustColorBrightness(ls.get('brightness.enabled') === true ? colorBrightnessLevel : null); //ensure we clear if it's disabled on init


                    const initialBubblePosition = ls.get('ui.bubble-position') || 'bottom left';
                    $(`#bubble-position input[value="${initialBubblePosition}"]`).prop('checked', true);
                    self.elements.mainBubble.attr('position', initialBubblePosition);
                    $("#bubble-position input")
                        .click((e) => {
                            ls.set('ui.bubble-position', e.target.value);
                            self.elements.mainBubble.attr('position', e.target.value);
                        });

                    const possiblyMobile = window.innerWidth < 768 && navigator.userAgent.includes('Mobile');

                    let initialShowReticule = ls.get('ui.show-reticule');
                    if (initialShowReticule === null) {
                        initialShowReticule = !possiblyMobile;
                        ls.set('ui.show-reticule', initialShowReticule);
                    }
                    $("#showReticuleToggle")
                        .prop("checked", initialShowReticule)
                        .change(function() {
                            ls.set("ui.show-reticule", this.checked === true);
                            place.toggleReticule(this.checked);
                        });

                    let initialShowCursor = ls.get('ui.show-cursor');
                    if (initialShowCursor === null) {
                        initialShowCursor = !possiblyMobile;
                        ls.set('ui.show-cursor', initialShowCursor);
                    }
                    $("#showCursorToggle")
                        .prop("checked", initialShowCursor)
                        .change(function() {
                            ls.set("ui.show-cursor", this.checked === true);
                            place.toggleCursor(this.checked);
                        });

                    $(window).keydown((evt) => {
                        if (["INPUT", "TEXTAREA"].includes(evt.target.nodeName)) {
                            // prevent inputs from triggering shortcuts
                            return;
                        }

                        switch (evt.key || evt.which) {
                            case "Escape":
                            case 27:
                                const selector = $("#lookup, #prompt, #alert, .popup.panels");
                                const openPanels = $(".panel.open");
                                if (selector.is(":visible")) {
                                    selector.fadeOut(200);
                                } else if (openPanels.length) {
                                    openPanels.each((i, elem) => panels.close(elem));
                                } else {
                                    place.switch(-1);
                                }
                                break;
                        }
                    }).focus(() => {
                        self.focus = true;
                    }).blur(() => {
                        self.focus = false;
                    });

                    let _info = document.querySelector('.panel[data-panel="info"]');
                    if (_info.classList.contains("open")) {
                        _info.querySelectorAll("iframe[data-lazysrc]").forEach(elem => {
                            elem.src = elem.dataset.lazysrc;
                            delete elem.dataset.lazysrc;
                        });
                    } else {
                        function toAttach(e, which) {
                            if (which === "info") {
                                let elems = document.querySelectorAll('iframe[data-lazysrc]');
                                if (elems && elems.length) {
                                    elems.forEach(elem => {
                                        elem.src = elem.dataset.lazysrc;
                                        delete elem.dataset.lazysrc;
                                    });
                                }
                                $(window).off('pxls:panel:opened', toAttach);
                            }
                        }
                        $(window).on("pxls:panel:opened", toAttach);
                    }
                },
                _initThemes: function () {
                    for (let i = 0; i < self.themes.length; i++) {
                        self.themes[i].element = $('<link data-theme="' + i + '" rel="stylesheet" href="' + self.themes[i].location + '">');
                        self.elements.themeSelect.append($("<option>", {
                            value: i,
                            text: self.themes[i].name
                        }));
                    }
                    let currentTheme = ls.get('currentTheme');
                    if (currentTheme == null || (currentTheme > self.themes.length || currentTheme < -1)) {
                        // If currentTheme hasn't been set, or it's out of bounds, reset it to default (-1)
                        ls.set('currentTheme', -1);
                    } else {
                        currentTheme = parseInt(currentTheme);
                        if (currentTheme !== -1) {
                            self.themes[currentTheme].element.appendTo(document.head);
                            self.elements.themeColorMeta.attr('content', self.themes[currentTheme].color);
                            self.elements.themeSelect.val(currentTheme);
                        }
                    }
                    self.elements.themeSelect.on("change", function() {
                        let theme = parseInt(this.value);
                        // If theme is -1, the user selected the default theme, so we should remove all other themes
                        if (theme === -1) {
                            console.info('Default theme - should reset!')
                            // Default theme
                            $('*[data-theme]').remove();
                            ls.set('currentTheme', -1);
                            self.elements.themeColorMeta.attr('content', null);
                            return;
                        }
                        self.themes[theme].element.appendTo(document.head);
                        self.elements.themeColorMeta.attr('content', self.themes[theme].color);
                        ls.set('currentTheme', theme);
                    })
                },
                _initStack: function () {
                    socket.on("pixels", function (data) {
                        self.updateAvailable(data.count, data.cause);
                    });
                },
                _initAudio: function () {
                    let parsedVolume = parseFloat(ls.get("alert.volume"));
                    if (isNaN(parseFloat(ls.get("alert.volume")))) {
                        parsedVolume = 1;
                        ls.set("alert.volume", 1);
                    } else {
                        parsedVolume = parseFloat(ls.get("alert.volume"));
                        timer.audioElem.volume = parsedVolume;
                    }
                    self.elements.lblAlertVolume.text(`${parsedVolume * 100 >> 0}%`);
                    self.elements.rangeAlertVolume.val(parsedVolume);

                    if (ls.get("alert.src")) {
                        self.updateAudio(ls.get("alert.src"));
                        self.elements.txtAlertLocation.val(ls.get("alert.src"));
                    }

                    timer.audioElem.addEventListener("error", err => {
                        if (console.warn) console.warn("An error occurred on the audioElem node: %o", err);
                    });

                    self.elements.txtAlertLocation.change(function () { //change should only fire on blur so we normally won't be calling updateAudio for each keystroke. just in case though, we'll lazy update.
                        if (self._alertUpdateTimer !== false) clearTimeout(self._alertUpdateTimer);
                        self._alertUpdateTimer = setTimeout(function (url) {
                            self.updateAudio(url);
                            self._alertUpdateTimer = false;
                        }, 250, this.value);
                    }).keydown(function (evt) {
                        if (evt.key == "Enter" || evt.which === 13) {
                            $(this).change();
                        }
                        evt.stopPropagation();
                    });
                    self.elements.btnForceAudioUpdate.click(() => self.elements.txtAlertLocation.change());

                    self.elements.rangeAlertVolume.change(function () {
                        const parsed = parseFloat(self.elements.rangeAlertVolume.val());
                        self.elements.lblAlertVolume.text(`${parsed * 100 >> 0}%`);
                        ls.set("alert.volume", parsed);
                        timer.audioElem.volume = parsed;
                    });

                    $("#btnAlertAudioTest").click(() => timer.audioElem.play());

                    $("#btnAlertReset").click(() => {
                        //TODO confirm with user
                        self.updateAudio("notify.wav");
                        self.elements.txtAlertLocation.val("");
                    });
                },
                _initAccount: function() {
                    self.elements.txtDiscordName.keydown(function (evt) {
                        if (evt.key == "Enter" || evt.which === 13) {
                            self.handleDiscordNameSet();
                        }
                        evt.stopPropagation();
                    });
                    $("#btnDiscordNameSet").click(() => {
                        self.handleDiscordNameSet();
                    });
                    $("#btnDiscordNameRemove").click(() => {
                        self.setDiscordName("");
                        self.handleDiscordNameSet();
                    });
                },
                _initBanner() {
                    self.banner.enabled = ls.get('chat.banner-enabled') !== false;
                    self._bannerIntervalTick();
                },
                _initMultiTabDetection() {
                    const openTabIds = ls.get('tabs.open') || [];
                    while (self.tabId === null || openTabIds.includes(self.tabId)) {
                        self.tabId = Math.floor(Math.random() * Number.MAX_SAFE_INTEGER);
                    }
                    openTabIds.push(self.tabId);
                    ls.set('tabs.open', openTabIds);
                    ls.set('tabs.has-focus', self.tabId);

                    window.addEventListener('focus', () => {
                        ls.set('tabs.has-focus', self.tabId);
                    });

                    let unloadHandled = false;
                    const handleUnload = () => {
                        if (unloadHandled) {
                            // try to avoid race conditions
                            return;
                        }
                        unloadHandled = true;
                        const openTabIds = ls.get('tabs.open') || [];
                        openTabIds.splice(openTabIds.indexOf(self.tabId), 1);
                        ls.set('tabs.open', openTabIds);
                    }
                    window.addEventListener("beforeunload", handleUnload, false);
                    window.addEventListener("unload", handleUnload, false);
                },
                _bannerIntervalTick() {
                    let nextElem = self.banner.HTMLs[self.banner.curElem++ % self.banner.HTMLs.length >> 0];
                    let banner = self.elements.bottomBanner[0];
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
                    self.banner.curElem = 1; //set to 1 so that when we re-enable, we don't show [0] again immediately.
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

                    //TODO confirm with user
                    $.post({
                        type: "POST",
                        url: "/setDiscordName",
                        data: {
                            discordName: name
                        },
                        success: function () {
                            alert.show("Discord name updated successfully");
                        },
                        error: function (data) {
                            let err = data.responseJSON && data.responseJSON.details ? data.responseJSON.details : data.responseText;
                            if (data.status === 200) { // seems to be caused when response body isn't json? just show whatever we can and trust server sent good enough details.
                                alert.show(err);
                            } else {
                                alert.show("Couldn't change discord name: " + err);
                            }
                        }
                    });
                },
                updateAudio: function (url) {
                    try {
                        if (!url) url = "notify.wav";
                        timer.audioElem.src = url;
                        ls.set("alert.src", url);
                    } catch (e) {
                        alert.show("Failed to update audio src, using default sound.");
                        timer.audioElem.src = "notify.wav";
                        ls.set("alert.src", "notify.wav");
                    }
                },
                updateAvailable: function (count, cause) {
                    if (count > 0 && cause === "stackGain") timer.playAudio();
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
                        "#board-container",
                        "#cursor",
                        "#reticule",
                        "#palette .palette-color"
                    ].join(", ")).css("filter", level != null ? `brightness(${level})` : '');
                },
                getAvailable() {
                    return self._available;
                },
                updateSelectedNameColor: (colorIdx) => {
                    let selUsernameColor = document.querySelector('.username-color-picker');
                    if (selUsernameColor) {
                        selUsernameColor.value = colorIdx;
                        self.styleElemWithChatNameColor(selUsernameColor, colorIdx);
                    }
                },
                styleElemWithChatNameColor: (elem, colorIdx, layer = 'bg') => {
                    elem.classList.remove(... self.specialChatColorClasses);
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
                setLoadingState: (process, state) => {
                    self.loadingStates[process] = state;
                    const processItem = self.elements.loadingBubble.children(`.loading-bubble-item[data-process="${process}"]`);

                    const hasVisibleItems = Object.values(self.loadingStates).some((v) => v);
                    if (hasVisibleItems && !self.isLoadingBubbleShown) {
                        processItem.show();
                        self.elements.loadingBubble.fadeIn(300);
                        self.isLoadingBubbleShown = true;
                    } else if(!hasVisibleItems && self.isLoadingBubbleShown) {
                        self.elements.loadingBubble.fadeOut(300, () => processItem.hide());
                        self.isLoadingBubbleShown = false;
                    } else {
                        processItem.toggle(state);
                    }
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
                getInitTitle: () => self.initTitle,
                getTitle: (prepend) => {
                    if (typeof prepend !== 'string') prepend = '';
                    let tplOpts = template.getOptions();
                    let append = self.initTitle;

                    if (tplOpts.use && tplOpts.title)
                        append = tplOpts.title;

                    return `${prepend ? prepend + ' ' : ''}${decodeURIComponent(append)}`;
                },
                setLoadingState: self.setLoadingState,
                tabHasFocus: () => ls.get('tabs.has-focus') === self.tabId,
                windowHasFocus: () => self.focus
            };
        })(),
        panels = (function() {
            let self = {
                init: () => {
                    Array.from(document.querySelectorAll(".panel-trigger")).forEach(panelTrigger => {
                        panelTrigger.addEventListener("click", e => {
                            if (!e.target) {
                                return console.debug('[PANELS:TRIGGER] No target?');
                            }

                            let closestTrigger = e.target.closest('.panel-trigger');
                            if (closestTrigger) {
                                let _panelDescriptor = closestTrigger.dataset['panel'];
                                if (_panelDescriptor && _panelDescriptor.trim()) {
                                    let targetPanel = document.querySelector(`.panel[data-panel="${_panelDescriptor.trim()}"]`);
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
                            let closestPanel = e.target.closest('.panel');
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
                        panelDescriptor = panel.dataset['panel'];
                    } else {
                        panel = document.querySelector(`.panel[data-panel="${panel}"]`);
                    }

                    if (panel) {
                        const panelPosition = panel.classList.contains('right') ? 'right' : 'left';

                        if (state) {
                            if (exclusive) {
                                document.querySelectorAll(`.panel[data-panel].${panelPosition}.open`).forEach(x => {
                                    x.classList.remove('open');
                                    $(window).trigger("pxls:panel:closed", x.dataset['panel']);
                                });
                            }
                            $(window).trigger("pxls:panel:opened", panelDescriptor);
                            document.body.classList.toggle("panel-open", true);
                            document.body.classList.toggle(`panel-${panelPosition}`, true);
                            if (panel.classList.contains('half-width')) {
                                document.body.classList.toggle(`panel-${panelPosition}-halfwidth`, true);
                            }
                        } else {
                            $(window).trigger("pxls:panel:closed", panelDescriptor);
                            document.body.classList.toggle("panel-open", document.querySelectorAll('.panel.open').length - 1 > 0);
                            document.body.classList.toggle(`panel-${panelPosition}`, false);
                            document.body.classList.toggle(`panel-${panelPosition}-halfwidth`, false);
                        }
                        panel.classList.toggle('open', state);
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
        })(),
        chat = (function() {
            const self = {
                seenHistory: false,
                stickToBottom: true,
                repositionTimer: false,
                pings: 0,
                pingsList: [],
                pingAudio: new Audio('chatnotify.wav'),
                lastPingAudioTimestamp: 0,
                last_opened_panel: ls.get('chat.last_opened_panel') >> 0,
                nonceLog: [],
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
                    message_icon: $("#message-icon"),
                    panel_trigger: $(".panel-trigger[data-panel=chat]"),
                    ping_counter: $("#ping-counter"),
                    input: $("#txtChatContent"),
                    body: $("#chat-body"),
                    rate_limit_overlay: $(".chat-ratelimit-overlay"),
                    rate_limit_counter: $("#chat-ratelimit"),
                    chat_panel: $(".panel[data-panel=chat]"),
                    chat_hint: $("#chat-hint"),
                    chat_settings_button: $("#btnChatSettings"),
                    pings_button: $("#btnPings"),
                    jump_button: $('#jump-to-bottom'),
                    emoji_button: $('#emojiPanelTrigger'),
                    typeahead: $('#typeahead'),
                    typeahead_list: $('#typeahead ul'),
                },
                picker: null,
                _anchorme: {
                    fnAttributes: urlObj => {},
                    fnExclude: urlObj => {}
                },
                TEMPLATE_ACTIONS: {
                    ASK: {
                        id: 0,
                        pretty: "Ask"
                    },
                    NEW_TAB: {
                        id: 1,
                        pretty: "Open in a new tab"
                    },
                    CURRENT_TAB: {
                        id: 2,
                        pretty: "Open in current tab (replacing template)"
                    },
                    JUMP_ONLY: {
                        id: 3,
                        pretty: "Jump to coordinates without replacing template"
                    }
                },
                init: () => {
                    self.initTypeahead();
                    self.reloadIgnores();
                    socket.on('ack_client_update', e => {
                        if (e.updateType && e.updateValue) {
                            switch(e.updateType) {
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
                        if (e.who && e.updates && typeof (e.updates) === "object") {
                            for (let update of Object.entries(e.updates)) {
                                switch(update[0]) {
                                    case 'NameColor': {
                                        self._updateAuthorNameColor(e.who, Math.floor(update[1]));
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
                    socket.on('chat_history', e => {
                        if (self.seenHistory) return;
                        for (let packet of e.messages.reverse()) {
                            self._process(packet, true);
                        }
                        let last = self.elements.body.find("li[data-nonce]").last()[0];
                        if (last) {
                            self._doScroll(last);
                            if (last.dataset.nonce && last.dataset.nonce !== ls.get("chat-last_seen_nonce")) {
                                self.elements.message_icon.addClass('has-notification');
                            }
                        }
                        self.seenHistory = true;
                        self.addServerAction('History loaded at ' + moment().format('MMM Do YYYY, hh:mm:ss A'));
                        setTimeout(() => socket.send({"type": "ChatbanState"}), 0);
                    });
                    socket.on('chat_message', e => {
                        self._process(e.message);
                        if (!self.elements.chat_panel.hasClass('open')) {
                            self.elements.message_icon.addClass('has-notification');
                        }
                        if (self.stickToBottom) {
                            let chatLine = self.elements.body.find(`[data-nonce="${e.message.nonce}"]`)[0];
                            if (chatLine) {
                                if (self.elements.chat_panel.hasClass('open')) {
                                    ls.set('chat-last_seen_nonce', e.message.nonce);
                                }
                                self._doScroll(chatLine);
                            }
                        }
                    });
                    socket.on('message_cooldown', e => {
                        self.timeout.ends = (new Date >> 0) + ((e.diff >> 0) * 1e3) + 1e3; //add 1 second so that we're 1-based instead of 0-based
                        self.elements.input.val(e.message);
                        if ((new Date >> 0) > self.timeout.ends) {
                            self.elements.rate_limit_overlay.fadeOut();
                        } else {
                            self.elements.rate_limit_overlay.fadeIn();
                        }
                        if (self.timeout.timer > 0) clearInterval(self.timeout.timer);
                        self.timeout.timer = setInterval(() => {
                            let delta = (self.timeout.ends - (new Date >> 0)) / 1e3 >> 0;
                            self.elements.rate_limit_counter.text(`${delta}s`);
                            if (delta <= 0) {
                                self.elements.rate_limit_overlay.fadeOut();
                                self.elements.rate_limit_counter.text('');
                                clearInterval(self.timeout.timer);
                                self.timeout.timer = 0;
                            }
                        }, 100);
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
                                self.elements.rate_limit_overlay.show();
                                self.elements.rate_limit_counter.text('You have been banned from chat.');
                                self.addServerAction(`You are banned ${e.permanent ? 'permanently from chat.' : 'until ' + self.chatban.banEndFormatted}`);
                                if (e.reason) {
                                    self.addServerAction(`Ban reason: ${e.reason}`);
                                }
                                self.chatban.timer = setInterval(() => {
                                    let timeLeft = self.chatban.banEnd - moment();
                                    if (timeLeft > 0) {
                                        self.elements.rate_limit_overlay.show();
                                        self.elements.rate_limit_counter.text(`Chatban expires in ${Math.ceil(timeLeft / 1e3)}s, at ${self.chatban.banEndFormatted}`);
                                    } else {
                                        self.elements.rate_limit_overlay.hide();
                                        self.elements.rate_limit_counter.text('');
                                        self.elements.emoji_button.show();
                                    }
                                }, 150);
                            } else if (e.permanent) {
                                self.elements.rate_limit_overlay.show();
                                self.elements.rate_limit_counter.text('You have been banned from chat.');
                                self.addServerAction(`You are banned from chat${e.permanent ? ' permanently.' : 'until ' + self.chatban.banEndFormatted}`);
                                if (e.reason) {
                                    self.addServerAction(`Ban reason: ${e.reason}`);
                                }
                            } else if (e.type !== "chat_ban_state") { //chat_ban_state is a query result, not an action notice.
                                self.elements.input.prop('disabled', false);
                                self.elements.rate_limit_overlay.hide();
                                self.elements.rate_limit_counter.text('');
                                self.elements.emoji_button.show();
                                self.addServerAction(`You have been unbanned from chat.`);
                            }
                        }, 0);
                    };
                    socket.on('chat_ban', handleChatban);
                    socket.on('chat_ban_state', handleChatban);

                    const _doPurge = (elem, e) => {
                        if (user.getRole() !== "USER") {
                            elem.classList.add('purged');
                            elem.setAttribute('title', `Purged by ${e.initiator} with reason: ${e.reason || 'none provided'}`);
                            elem.dataset.purgedBy = e.initiator;
                        } else {
                            elem.remove();
                        }
                    };
                    socket.on('chat_purge', e => {
                        let lines = Array.from(self.elements.body[0].querySelectorAll(`.chat-line[data-author="${e.target}"]`));
                        if (Array.isArray(lines) && lines.length) {
                            lines.sort((a,b) => (a.dataset.date >> 0)-(b.dataset.date >> 0));
                            for (let i = 0; i < e.amount; i++) {
                                let line = lines.pop();
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
                        let lines = [];
                        if (e.nonces && e.nonces.length) {
                            e.nonces.forEach(x => {
                                let line = self.elements.body.find(`.chat-line[data-nonce="${x}"]`)[0];
                                if (line) lines.push(line);
                            });
                        }
                        if (lines.length) {
                            lines.forEach(x => _doPurge(x, e));
                            if (user.getUsername().toLowerCase().trim() === e.target.toLowerCase().trim()) {
                                self.addServerAction(`${e.nonces.length} message${e.nonces.length !== 1 ? 's were' : ' was'} purged by ${e.initiator}`);
                            }
                        }
                    });

                    socket.send({"type": "ChatHistory"});

                    self.elements.rate_limit_overlay.hide();

                    let commandsCache = [['tempban', '/tempban  USER  BAN_LENGTH  SHOULD_PURGE  BAN_REASON'], ['permaban', '/permaban  USER  SHOULD_PURGE  BAN_REASON'], ['purge', '/purge  USER  PURGE_AMOUNT  PURGE_REASON']];
                    self.elements.input.on('keydown', e => {
                        e.stopPropagation();
                        let toSend = self.elements.input[0].value;
                        let trimmed = toSend.trim();
                        let handling = false;
                        if ((e.originalEvent.key == "Enter" || e.originalEvent.which === 13) && !e.shiftKey) {
                            if (trimmed.startsWith('/') && user.getRole() !== "USER") {
                                let args = trimmed.substr(1).split(' '),
                                    command = args.shift();
                                handling = true;
                                switch (command.toLowerCase().trim()) {
                                    case 'permaban': {
                                        let usage = `/permaban USER SHOULD_PURGE BAN_REASON\n/permaban help`;
                                        let help = [
                                            usage,
                                            `    USER:         The username`,
                                            `    SHOULD_PURGE: (1|0) Whether or not to remove all chat messages from the user`,
                                            `    BAN_REASON:   The reason for the ban`,
                                            ``,
                                            `    /permaban GlowingSocc 1 just generally don't like 'em`,
                                            `    /permaban GlowingSocc 0 time for you to go.`
                                        ].join('\n');
                                        if (args.length < 3) {
                                            if (args[0] && args[0].toLowerCase() === 'help') {
                                                self.showHint(help);
                                            } else {
                                                self.showHint(`Missing arguments.\n${usage}`, true);
                                            }
                                        } else {
                                            let user = args.shift(),
                                                shouldPurge = args.shift(),
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
                                                alert.show('Chatban initiated');
                                                self.elements.input[0].value = '';
                                                self.elements.input[0].disabled = false;
                                            }).fail(() => {
                                                alert.show('Failed to chatban');
                                                self.elements.input[0].disabled = false;
                                            });
                                        }
                                        break;
                                    }
                                    case 'tempban': {
                                        let usage = `/tempban USER BAN_LENGTH SHOULD_PURGE BAN_REASON\n/tempban help`;
                                        let help = [
                                            usage,
                                            `    USER:         The username`,
                                            `    BAN_LENGTH:   The banlength in seconds`,
                                            `    SHOULD_PURGE: (1|0) Whether or not to remove all chat messages from the user`,
                                            `    BAN_REASON:   The reason for the ban`,
                                            ``,
                                            `    /tempban GlowingSocc 600 1 just generally don't like 'em`,
                                            `    /tempban GlowingSocc 60 0 take a time out.`
                                        ].join('\n');
                                        if (args.length < 4) {
                                            if (args[0] && args[0].toLowerCase() === 'help') {
                                                self.showHint(help);
                                            } else {
                                                self.showHint(`Missing arguments.\n${usage}`, true);
                                            }
                                        } else {
                                            let user = args.shift(),
                                                banLength = args.shift() >> 0,
                                                shouldPurge = args.shift(),
                                                banReason = args.join(' ');
                                            if (!isNaN(shouldPurge)) {
                                                shouldPurge = !!(shouldPurge >> 0);
                                            } else {
                                                return self.showHint(`Invalid shouldPurge. Expected 1 or 0, got ${shouldPurge}`, true);
                                            }
                                            if (banLength <= 0) {
                                                return self.showHint(`Invalid banLength. Should be >0`, true);
                                            } else {
                                                $.post('/admin/chatban', {
                                                    who: user,
                                                    type: 'temp',
                                                    reason: banReason,
                                                    removalAmount: shouldPurge ? -1 : 0,
                                                    banLength: banLength
                                                }, () => {
                                                    alert.show('Chatban initiated');
                                                    self.elements.input[0].value = '';
                                                    self.elements.input[0].disabled = false;
                                                }).fail(() => {
                                                    alert.show('Failed to chatban');
                                                    self.elements.input[0].disabled = false;
                                                });
                                            }
                                        }
                                        break;
                                    }
                                    case 'purge': {
                                        let usage = `/purge USER PURGE_REASON\n/purge help`;
                                        let help = [
                                            usage,
                                            `    USER:         The username`,
                                            `    PURGE_REASON: The reason for the purge`,
                                            ``,
                                            `    /purge GlowingSocc 10 spam`
                                        ].join('\n');
                                        if (args.length < 2) {
                                            if (args[0] && args[0].toLowerCase() === 'help') {
                                                self.showHint(help);
                                            } else {
                                                self.showHint(`Missing arguments.\n${usage}`, true);
                                            }
                                        } else {
                                            let user = args.shift(),
                                                purgeReason = args.join(' ');
                                            $.post("/admin/chatPurge", {
                                                who: user,
                                                reason: purgeReason
                                            }, function () {
                                                alert.show('Chatpurge initiated');
                                                self.elements.input[0].value = '';
                                                self.elements.input[0].disabled = false;
                                            }).fail(() => {
                                                alert.show('Failed to chatpurge');
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
                                self.elements.input.val("");
                            }
                        } else if (e.originalEvent.key == "Tab" || e.originalEvent.which == 9) {
                            e.stopPropagation();
                            e.preventDefault();
                        }
                    }).on('keyup', e => {
                        let toSend = self.elements.input[0].value;
                        let trimmed = toSend.trim();
                        if (trimmed.length == 0) return self.showHint('');
                        if (!((e.originalEvent.key == "Enter" || e.originalEvent.which === 13) && !e.originalEvent.shiftKey) && trimmed.startsWith('/') && user.getRole() !== "USER") {
                            let searchAgainst = trimmed.substr(1).split(' ').shift();
                            let matches = [];
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

                    $(window).on("pxls:chat:userIgnored", (e, who) => {
                        Array.from(document.querySelectorAll(`.chat-line[data-author="${who}"]`)).forEach(x => x.remove());
                    });

                    $(window).on("pxls:panel:opened", (e, which) => {
                        if (which === "chat") {
                            ls.set('chat.last_opened_panel', new Date/1e3 >> 0);
                            self.clearPings();
                            let lastN = self.elements.body.find("[data-nonce]").last()[0];
                            if (lastN) {
                                ls.set("chat-last_seen_nonce", lastN.dataset.nonce);
                            }

                            self.updateInputLoginState(user.isLoggedIn());
                        }
                    });

                    $(window).on("pxls:panel:closed", (e, which) => {
                        if (which === "chat") {
                            if (document.querySelector('.chat-settings-title')) {
                                alert.hide(true);
                            }
                        }
                    });

                    $(window).on('pxls:user:loginState', (e, isLoggedIn) => self.updateInputLoginState(isLoggedIn));

                    $(window).on("mouseup", e => {
                        let target = e.target;
                        let popup = document.querySelector('.popup');
                        if (!popup) return;
                        if (e.originalEvent && e.originalEvent.target)
                            target = e.originalEvent.target;

                        if (target) {
                            let closestPopup = target.closest('.popup');
                            closestPopup || popup.remove();
                        }
                    });

                    $(window).on("resize", e => {
                        let popup = document.querySelector('.popup.panels[data-popup-for]');
                        if (!popup) return;
                        let cog = document.querySelector(`.chat-line[data-nonce="${popup.dataset.popupFor}"] [data-action="actions-panel"]`);
                        if (!cog) return console.warn('no cog');

                        if (self.repositionTimer) clearTimeout(self.repositionTimer);
                        self.repositionTimer = setTimeout(() => {self._positionPopupRelativeToX(popup, cog); self.repositionTimer = false}, 25);
                    });

                    self.elements.body[0].addEventListener('wheel', e => {
                        let popup = document.querySelector('.popup.panels');
                        if (popup) popup.remove();
                    });

                    if (ls.get('chat.pings-enabled') == null) {
                        ls.set('chat.pings-enabled', true);
                    }
                    if (ls.get('chat.ping-audio-state') == null) {
                        ls.set('chat.ping-audio-state', 'off');
                    }
                    if (ls.get('chat.ping-audio-volume') == null) {
                        ls.set('chat.ping-audio-volume', 0.5);
                    }

                    self.elements.chat_settings_button[0].addEventListener('click', () => self.popChatSettings());

                    self.elements.pings_button[0].addEventListener('click', function() {
                        const closeHandler = function() {
                            if (this && this.closest) {
                                let toClose = this.closest('.popup.panels');
                                if (toClose) toClose.remove();
                            }
                        };

                        let popupWrapper = crel('div', {'class': 'popup panels'});
                        let panelHeader = crel('header', {'style': 'text-align: center'},
                            crel('div', {'class': 'left'}, crel('i', {'class': 'fas fa-times text-red', onclick: closeHandler})),
                            crel('h2', 'Pings'),
                            crel('div', {'class': 'right'})
                        );
                        let mainPanel = crel('div', {'class': 'pane'});

                        const pingsList = crel('ul', {'class': 'pings-list'}, self.pingsList.map(packet => {
                            let _processed = self.processMessage('span', '', packet.message_raw);
                            return crel('li', {'title': _processed.textContent}, crel('i', {'class': 'fas fa-external-link-alt fa-is-left', 'style': 'font-size: .65rem; cursor: pointer;', 'data-nonce': packet.nonce, onclick: self._handlePingJumpClick}), `${packet.author}: `, _processed);
                        }));
                        let popup = crel(popupWrapper, panelHeader, crel('div', {'class': 'pane pane-full'}, pingsList));
                        document.body.appendChild(popup);
                        self._positionPopupRelativeToX(popup, this);
                        pingsList.scrollTop = pingsList.scrollHeight;
                    });

                    self.elements.jump_button[0].addEventListener('click', self.scrollToBottom);

                    if (ls.get("chat.font-size") == null) {
                        ls.set("chat.font-size", 16);
                    }

                    let cbChatSettingsFontSize = $("#cbChatSettingsFontSize");
                    let notifBody = document.querySelector('.panel[data-panel="notifications"] .panel-body');
                    cbChatSettingsFontSize.val(ls.get("chat.font-size") || 16);
                    self.elements.body.css("font-size", `${ls.get("chat.font-size") >> 0 || 16}px`);
                    notifBody.style.fontSize = `${ls.get("chat.font-size") >> 0 || 16}px`;

                    self.elements.body.on("scroll", e => {
                        self.updateStickToBottom();
                        if (self.stickToBottom && self.elements.chat_panel[0].classList.contains('open')) {
                            self.clearPings();
                        }
                        self.elements.jump_button[0].style.display = self.stickToBottom ? 'none' : 'block';
                    });

                    self.picker = new EmojiButton({position: 'left-start'});
                    self.picker.on('emoji', emojiStr => {
                        self.elements.input[0].value += emojiStr;
                        self.elements.input[0].focus();
                    });
                    self.elements.emoji_button.on('click', function() {
                        self.picker.pickerVisible ? self.picker.hidePicker() : self.picker.showPicker(this);
                        let searchEl = self.picker.pickerEl.querySelector('.emoji-picker__search'); //searchEl is destroyed every time the picker closes. have to re-attach
                        if (searchEl)
                            searchEl.addEventListener('keydown', e => e.stopPropagation());
                    })
                },
                initTypeahead() {
                    // init DBs
                    let dbEmojis = new TH.Database('emoji');
                    let dbUsers = new TH.Database('users');

                    if (window.emojiDB) {
                        Object.entries(window.emojiDB).sort((a,b) => a[0].toLocaleLowerCase().localeCompare(b[0].toLocaleLowerCase())).forEach(emojiEntry => {
                            dbEmojis.addEntry(emojiEntry[0], emojiEntry[1].char);
                        });
                    }

                    // init triggers
                    let triggerEmoji = new TH.Trigger(':', 'emoji', false, true);
                    let triggerUsers = new TH.Trigger('@', 'users', true, false);

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
                        switch(event.key || event.code || event.which || event.charCode) {
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
                                    let nextIndex = self.typeahead.highlightedIndex + (event.shiftKey ? -1 : 1); //if we're holding shift, walk backwards (up).
                                    let children = self.elements.typeahead_list[0].querySelectorAll('li:not(.no-results)');
                                    if (event.shiftKey && nextIndex < 0) { //if we're holding shift, we're walking backwards and need to check underflow.
                                        nextIndex = children.length-1;
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
                                    let children = self.elements.typeahead_list[0].querySelectorAll('li:not(.no-results)');
                                    if (nextIndex < 0) {
                                        nextIndex = children.length-1;
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
                                    let children = self.elements.typeahead_list[0].querySelectorAll('li:not(.no-results)');
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
                                    let selected = self.elements.typeahead_list[0].querySelector('li:not(.no-results).active');
                                    if (selected) {
                                        self._handleTypeaheadInsert(selected);
                                    } else {
                                        let topResult = self.elements.typeahead_list[0].querySelector('li:not(.no-results):first-child');
                                        if (topResult) {
                                            self._handleTypeaheadInsert(topResult);
                                        }
                                    }
                                    return;
                                }
                                break;
                            }
                        }
                        if (self.elements.input[0].value.length !== self.typeahead.lastLength) //stops it from scanning when we keyup with shift or some other control character.
                            scan();
                    });

                    function scan() {
                        let scanRes = self.typeahead.helper.scan(self.elements.input[0].selectionStart, self.elements.input[0].value);
                        let got = false;
                        self.typeahead.lastLength = self.elements.input[0].value.length;
                        self.typeahead.suggesting = scanRes !== false;
                        if (scanRes) {
                            got = self.typeahead.helper.suggestions(scanRes);
                            self.typeahead.hasResults = got.length > 0;
                            if (!got.length) {
                                self.elements.typeahead_list[0].innerHTML = `<li class="no-results">No Results</li>`; //no reason to crel this if we're just gonna innerHTML anyway.
                            } else {
                                self.elements.typeahead_list[0].innerHTML = ``;
                                let LIs = got.slice(0, 10).map(x =>
                                    crel('li', {'data-insert': `${x} `, 'data-start': scanRes.start, 'data-end': scanRes.end, onclick: self._handleTypeaheadInsert}, x)
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
                    let start = parseInt(elem.dataset.start),
                        end = parseInt(elem.dataset.end),
                        toInsert = elem.dataset.insert || "";
                    if (!toInsert || start >= end) {
                        return console.warn('Got invalid data on elem %o.');
                    }
                    self.elements.input[0].value = self.elements.input[0].value.substring(0, start) + toInsert + self.elements.input[0].value.substring(end);
                    self.elements.input[0].focus();
                    self.resetTypeahead();
                },
                resetTypeahead: () => { //close with reset
                    self.typeahead.suggesting = false;
                    self.typeahead.hasResults = false;
                    self.typeahead.highlightedIndex = 0;
                    self.elements.typeahead[0].style.display = 'none';
                    self.elements.typeahead_list[0].innerHTML = '';
                    document.body.classList.remove('typeahead-open');
                },
                reloadIgnores: () => self.ignored = (ls.get('chat.ignored') || '').split(','),
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
                    let index = self.ignored.indexOf(name);
                    if (index >= 0) {
                        let spliced = self.ignored.splice(index, 1);
                        self.saveIgnores();
                        $(window).trigger('pxls:chat:userUnignored', spliced && spliced[0] ? spliced[0] : false);
                        return spliced && spliced[0];
                    }
                    return false;
                },
                getIgnores: () => [].concat(self.ignored || []),
                popChatSettings() {
                    //dom generation
                    let body = crel('div', {'class': 'chat-settings-wrapper'});

                    let _cb24hTimestamps = crel('input', {'type': 'checkbox'});
                    let lbl24hTimestamps = crel('label', {'style': 'display: block;'}, _cb24hTimestamps, '24 Hour Timestamps');

                    let _cbPixelPlaceBadges = crel('input', {'type': 'checkbox'});
                    let lblPixelPlaceBadges = crel('label', {'style': 'display: block;'}, _cbPixelPlaceBadges, 'Show pixel-placed badges');

                    let _cbPings = crel('input', {'type': 'checkbox'});
                    let lblPings = crel('label', {'style': 'display: block;'}, _cbPings, 'Enable pings');

                    let _cbPingAudio = crel('select', {},
                        crel('option', {'value': 'off'}, 'Off'),
                        crel('option', {'value': 'discrete'}, 'Only when necessary'),
                        crel('option', {'value': 'always'}, 'Always')
                    );
                    let lblPingAudio = crel('div', {'style': 'display: block;'},
                        'Play sound on ping',
                        _cbPingAudio
                    );

                    let _rgPingAudioVol = crel('input', {'type': 'range', min: 0, max: 100});
                    let _txtPingAudioVol = crel('span');
                    let lblPingAudioVol = crel('label', {'style': 'display: block;'},
                        'Ping sound volume',
                        _rgPingAudioVol,
                        _txtPingAudioVol
                    );

                    let _cbBanner = crel('input', {'type': 'checkbox'});
                    let lblBanner = crel('label', {'style': 'display: block;'}, _cbBanner, 'Enable the rotating banner under chat');

                    let _cbTemplateTitles = crel('input', {'type': 'checkbox'});
                    let lblTemplateTitles = crel('label', {'style': 'display: block;'}, _cbTemplateTitles, 'Replace template titles with URLs in chat where applicable');

                    let _txtFontSize = crel('input', {'type': 'number', 'min': '1', 'max': '72'});
                    let _btnFontSizeConfirm = crel('button', {'class': 'buton'}, crel('i', {'class': 'fas fa-check'}));
                    let lblFontSize = crel('label', {'style': 'display: block;'}, 'Font Size: ', _txtFontSize, _btnFontSizeConfirm);

                    let _selInternalClick = crel('select',
                        Object.values(self.TEMPLATE_ACTIONS).map(action =>
                            crel('option', {'value': action.id}, action.pretty)
                        )
                    );
                    let lblInternalAction = crel('label', {'style': 'display: block;'}, 'Default internal link action click: ', _selInternalClick);

                    let _selUsernameColor = crel('select', {'class': 'username-color-picker'},
                        user.isStaff() ? crel('option', {value: -1, 'class': 'rainbow'}, 'rainbow') : null,
                        place.getPalette().map((x, i) => crel('option', {value: i, 'data-idx': i, style: `background-color: ${x}`}, x))
                    );
                    let lblUsernameColor = crel('label', {'style': 'display: block;'}, 'Username Color: ', _selUsernameColor);

                    let _selIgnores = crel('select', {'class': 'user-ignores', 'style': 'font-family: monospace; padding: 5px; border-radius: 5px;'},
                        self.getIgnores().sort((a, b) => a.toLocaleLowerCase().localeCompare(b.toLocaleLowerCase())).map(x =>
                            crel('option', {'value': x}, x)
                        )
                    );
                    let _btnUnignore = crel('button', {'class': 'button', 'style': 'margin-left: .5rem'}, 'Unignore');
                    let lblIgnores = crel('label', 'Ignores: ', _selIgnores, _btnUnignore);
                    let lblIgnoresFeedback = crel('label', {'style': 'display: none; margin-left: 1rem;'}, '');



                    //events/scaffolding
                    _selUsernameColor.value = user.getChatNameColor();
                    uiHelper.styleElemWithChatNameColor(_selUsernameColor);
                    _selUsernameColor.addEventListener('change', function() {
                        socket.send({type: "UserUpdate", updates: {NameColor: String(this.value >> 0)}});
                    });

                    _txtFontSize.value = ls.get('chat.font-size') >> 0 || 16;
                    _txtFontSize.addEventListener('change', function() {});
                    _btnFontSizeConfirm.addEventListener('click', function() {
                        if (isNaN(_txtFontSize.value)) {
                            alert.show("Invalid value. Expected a number between 1 and 72");
                        } else {
                            let val = _txtFontSize.value >> 0;
                            if (val < 1 || val > 72) {
                                alert.show("Invalid value. Expected a number between 1 and 72");
                            } else {
                                ls.set("chat.font-size", val);
                                self.elements.body.css("font-size", `${val}px`);
                                document.querySelector('.panel[data-panel="notifications"] .panel-body').style.fontSize = `${val}px`;
                            }
                        }
                    });

                    _selInternalClick.selectedIndex = ls.get('chat.internalClickDefault') >> 0;
                    _selInternalClick.addEventListener('change', function() {
                        ls.set('chat.internalClickDefault', this.value >> 0);
                    });

                    _cb24hTimestamps.checked = ls.get('chat.24h') === true;
                    _cb24hTimestamps.addEventListener('change', function() {
                        ls.set('chat.24h', this.checked === true);
                    });

                    _cbPixelPlaceBadges.checked = ls.get('chat.text-icons-enabled');
                    _cbPixelPlaceBadges.addEventListener('change', function() {
                        ls.set('chat.text-icons-enabled', this.checked === true);
                    });

                    _cbPings.checked = ls.get('chat.pings-enabled') === true;
                    _cbPings.addEventListener('change', function() {
                        ls.set('chat.pings-enabled', this.checked === true);
                    });

                    _cbPingAudio.value = ls.get('chat.ping-audio-state');
                    _cbPingAudio.addEventListener('change', function() {
                        ls.set('chat.ping-audio-state', this.value);
                    });

                    _rgPingAudioVol.value = ls.get('chat.ping-audio-volume') * 100;
                    _txtPingAudioVol.innerText = `${_rgPingAudioVol.value}%`;
                    _rgPingAudioVol.addEventListener('change', function() {
                        ls.set('chat.ping-audio-volume', this.value / 100);
                        _txtPingAudioVol.innerText = `${this.value}%`;
                    });

                    _cbBanner.checked = ls.get('chat.banner-enabled') !== false;
                    _cbBanner.addEventListener('change', function() {
                        ls.set('chat.banner-enabled', this.checked === true);
                        uiHelper.setBannerEnabled(this.checked === true);
                    });

                    _cbTemplateTitles.checked = ls.get('chat.use-template-urls') === true;
                    _cbTemplateTitles.addEventListener('change', function() {
                        ls.set('chat.use-template-urls', this.checked === true);
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

                    //show everything
                    alert.show(crel(body,
                        crel('h3', {'class': 'chat-settings-title'}, 'Chat Settings'),
                        lbl24hTimestamps,
                        lblPixelPlaceBadges,
                        lblPings,
                        lblPingAudio,
                        lblPingAudioVol,
                        lblBanner,
                        lblTemplateTitles,
                        lblFontSize,
                        lblInternalAction,
                        lblUsernameColor,
                        lblIgnores,
                        lblIgnoresFeedback
                    ));
                },
                _handlePingJumpClick: function() { //must be es5 for expected behavior. don't upgrade syntax, this is attached as an onclick and we need `this` to be bound by dom bubbles.
                    if (this && this.dataset && this.dataset.nonce) {
                        self.scrollToNonce(this.dataset.nonce);
                    }
                },
                updateStickToBottom() {
                    const obj = self.elements.body[0];
                    self.stickToBottom = self._numWithinDrift(obj.scrollTop >> 0, obj.scrollHeight - obj.offsetHeight, 2);
                },
                scrollToNonce(nonce) {
                    let elem = self.elements.body[0].querySelector(`.chat-line[data-nonce="${nonce}"]`);
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
                    self.elements.input.prop("maxlength", num);
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
                    let when = moment();
                    let toAppend =
                        crel('li', {'class': 'chat-line server-action'},
                            crel('span', {'title': when.format('MMM Do YYYY, hh:mm:ss A')}, when.format(ls.get('chat.24h') === true ? 'HH:mm' : 'hh:mm A')),
                            document.createTextNode(' - '),
                            crel('span', {'class': 'content'}, msg)
                        );

                    self.elements.body.append(toAppend);
                    if (self.stickToBottom) {
                        self._doScroll(toAppend);
                    }
                },
                _send: msg => {
                    socket.send({type: "ChatMessage", message: msg});
                },
                jump: (x, y, zoom) => {
                    if (typeof x !== 'number')
                        x = parseFloat(x);
                    if (typeof y !== 'number')
                        y = parseFloat(y);
                    if (zoom == null)
                        zoom = false;
                    else if (typeof zoom !== 'number')
                        zoom = parseFloat(zoom);

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
                _process: (packet, isHistory = false) => {
                    if (packet.nonce) {
                        if (self.nonceLog.includes(packet.nonce)) {
                            return;
                        } else {
                            self.nonceLog.unshift(packet.nonce); //sit this nonce in front so we short circuit sooner
                            if (self.nonceLog.length > 50) {
                                self.nonceLog.pop(); //ensure we pop off back instead of shift off front
                            }
                        }
                    }
                    self.typeahead.helper.getDatabase('users').addEntry(packet.author, packet.author);
                    if (self.ignored.indexOf(packet.author) >= 0) return;
                    let hasPing = ls.get('chat.pings-enabled') === true && user.isLoggedIn() && packet.message_raw
                        .toLowerCase()
                        .split(' ')
                        .some((s) => s.search(new RegExp(`@${user.getUsername().toLowerCase()}(?![a-zA-Z0-9_\-])`)) == 0);
                    let when = moment.unix(packet.date);
                    let badges = crel('span', {'class': 'badges'});
                    if (Array.isArray(packet.badges)) {
                        packet.badges.forEach(badge => {
                            switch(badge.type) {
                                case 'text':
                                    if (ls.get('chat.text-icons-enabled') !== true) return;
                                    crel(badges, crel('span', {'class': 'text-badge', 'title': badge.tooltip || ''}, badge.displayName || ''), document.createTextNode(' '));
                                    break;
                                case 'icon':
                                    crel(badges, crel('i', {'class': (badge.cssIcon || '') + ' icon-badge', 'title': badge.tooltip || ''}, document.createTextNode(' ')), document.createTextNode(' '));
                                    break;
                            }
                        });
                    }

                    let contentSpan = self.processMessage('span', 'content', packet.message_raw);
                    twemoji.parse(contentSpan);
                    //TODO basic markdown
                    let nameClasses = `user`;
                    if (Array.isArray(packet.authorNameClass)) nameClasses += ` ${packet.authorNameClass.join(' ')}`;

                    self.elements.body.append(
                        crel('li', {'data-nonce': packet.nonce, 'data-author': packet.author, 'data-date': packet.date, 'data-badges': JSON.stringify(packet.badges || []), 'class': `chat-line${hasPing ? ' has-ping' : ''} ${packet.author.toLowerCase().trim() === user.getUsername().toLowerCase().trim() ? 'is-from-us' : ''}`},
                            crel('span', {'class': 'actions'},
                                crel('i', {'class': 'fas fa-cog', 'data-action': 'actions-panel', 'title': 'Actions', onclick: self._popUserPanel})
                            ),
                            crel('span', {'title': when.format('MMM Do YYYY, hh:mm:ss A')}, when.format(ls.get('chat.24h') === true ? 'HH:mm' : 'hh:mm A')),
                            document.createTextNode(' '),
                            badges,
                            document.createTextNode(' '),
                            crel('span', {'class': nameClasses, style: `color: ${place.getPaletteColor(packet.authorNameColor)}`, onclick: self._popUserPanel, onmousemiddledown: self._addAuthorMentionToChatbox}, packet.author),
                            document.createTextNode(': '),
                            contentSpan,
                            document.createTextNode(' ')
                        )
                    );

                    if (hasPing) {
                        self.pingsList.push(packet);
                        if (!(panels.isOpen('chat') && self.stickToBottom || packet.date < self.last_opened_panel)) {
                            ++self.pings;
                            self.elements.panel_trigger.addClass('has-ping');
                            self.elements.pings_button.addClass('has-notification');
                        }

                        const pingAudioState = ls.get('chat.ping-audio-state');
                        const canPlayPingAudio = !isHistory && !ls.get("audio_muted")
                            && pingAudioState !== 'off' && Date.now() - self.lastPingAudioTimestamp > 5000;
                        if ((!panels.isOpen('chat') || !uiHelper.windowHasFocus() || pingAudioState === 'always')
                            && uiHelper.tabHasFocus() && canPlayPingAudio) {
                            self.pingAudio.volume = parseFloat(ls.get('chat.ping-audio-volume'));
                            self.pingAudio.play();
                            self.lastPingAudioTimestamp = Date.now();
                        }
                    }
                },
                processMessage: (elem, elemClass, str) => {
                    let toReturn = crel(elem, {'class': elemClass}, str);

                    try {
                        let list = anchorme(str, {emails: false, files: false, exclude: self._anchorme.fnExclude, attributes: [self._anchorme.fnAttributes], list: true});

                        //handle jump links (e.g. (500, 500[, 20[x]]))
                        str = str.replace(/\(([0-9]+)[., ]{1,2}([0-9]+)[., ]{0,2}([0-9]+)?x?\)/ig, function(match, group1, group2, group3) {
                            if (isNaN(group1) || isNaN(group2)) return match;
                            if (!board.validateCoordinates(parseFloat(group1), parseFloat(group2))) return match;
                            let group3Str = !(parseFloat(group3)) ? '' : `, ${group3}x`;
                            return `<span class="link -internal-jump" data-x="${group1}" data-y="${group2}" data-scale="${group3}">(${group1}, ${group2}${group3Str})</span>`;
                        });

                        //insert <a>'s
                        let _re = /^[?#]/;
                        for (let x of list) {
                            let url = false;

                            let anchorText = x.raw.substr(0, 78);
                            if (x.raw.length > 78) anchorText += '...';
                            let anchorTarget = null;
                            let jumpTarget = false;

                            try {
                                url = new URL(x.raw.indexOf(x.protocol) !== 0 ? `${x.protocol}${x.raw}` : x.raw);
                            } catch (ignored) {}
                            if (!url) {
                                console.warn('no url with %o!', x);
                            } else {
                                //process URL params for future use/manipulation
                                let params = {};
                                let toSplit = url.hash.substring(1);
                                if (url.search.length > 0)
                                    toSplit += ("&" + url.search.substring(1));

                                let _varsTemp = toSplit.split("&"),
                                    vars = {};
                                _varsTemp.forEach(val => {
                                    let split = val.split("="),
                                        key = split.shift().toLowerCase();
                                    if (!key.length) return;
                                    vars[key] = split.shift();
                                });

                                let varKeys = Object.keys(vars);
                                for (let i = 0; i < varKeys.length; i++) {
                                    let key = varKeys[i],
                                        value = vars[key];
                                    if (!params.hasOwnProperty(key)) {
                                        params[key] = vars[key];
                                    }
                                }

                                //check for any special URL needs and store the proper anchor `target`
                                if ((document.location.origin && url.origin) && document.location.origin === url.origin) { //URL is for this origin, run some checks for game features
                                    if (params.x != null && params.y != null) { //url has x/y so it's probably in the game window
                                        if (board.validateCoordinates(params.x, params.y)) {
                                            jumpTarget = Object.assign({displayText: `(${params.x}, ${params.y}${params.scale != null ? `, ${params.scale}x` : ''})`, raw: url.toString()}, params);
                                            if (params.template != null && params.template.length >= 11) { //we have a template, should probably make that known
                                                let title = decodeURIComponent(params.template);
                                                if (ls.get('chat.use-template-urls') !== true && params.title && params.title.trim())
                                                    title = decodeURIComponent(params.title);
                                                jumpTarget.displayText += ` (template: ${(title > 25) ? `${title.substr(0, 22)}...` : title})`;
                                            }
                                        }
                                    } else {
                                        anchorTarget = '_blank'; //probably `/stats` or something
                                    }
                                } else {
                                    anchorTarget = '_blank';
                                }
                            }

                            let elem = crel('a', {'href': x.raw.indexOf(x.protocol) !== 0 ? `${x.protocol}${x.raw}` : x.raw, 'title': x.raw}, anchorText);
                            if (jumpTarget !== false) {
                                elem.innerHTML = jumpTarget.displayText || elem.innerHTML;
                                elem.className = `link -internal-jump`;
                                for (let key in jumpTarget) {
                                    if (jumpTarget.hasOwnProperty(key)) {
                                        elem.dataset[key] = jumpTarget[key];
                                    }
                                }
                            } else {
                                if (anchorTarget) elem.target = anchorTarget;
                            }

                            str = str.replace(x.raw, elem.outerHTML);
                        }

                        //any other text manipulation after anchor insertion
                        //TODO markdown, it might be better to do it on the back-end so that burden of parsing+rendering is shifted

                        //parse HTML into DOM
                        toReturn.innerHTML = str;

                        //hook up any necessary event listeners
                        toReturn.querySelectorAll('.-internal-jump[data-x]').forEach(x => {
                            x.onclick = e => {
                                e.preventDefault();
                                if (x.dataset.template) {
                                    let internalClickDefault = ls.get('chat.internalClickDefault') >> 0;
                                    if (internalClickDefault === 0) {
                                        self._popTemplateOverwriteConfirm(x).then(action => {
                                            alert.hide();
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
                    switch(action) {
                        case false: break;
                        case self.TEMPLATE_ACTIONS.CURRENT_TAB.id: {
                            self._pushStateMaybe(); //ensure people can back button if available
                            document.location.href = linkElem.dataset.raw; //overwrite href since that will trigger hash-based update of template. no need to re-write that logic
                            break;
                        }
                        case self.TEMPLATE_ACTIONS.JUMP_ONLY.id: {
                            self._pushStateMaybe(); //ensure people can back button if available
                            self.jump(parseFloat(linkElem.dataset.x), parseFloat(linkElem.dataset.y), parseFloat(linkElem.dataset.scale));
                            break;
                        }
                        case self.TEMPLATE_ACTIONS.NEW_TAB.id: {
                            if (!window.open(linkElem.dataset.raw, '_blank')) { //what popup blocker still blocks _blank redirects? idk but i'm sure they exist.
                                alert.show(crel('div',
                                    crel('h3', 'Failed to automatically open in a new tab'),
                                    crel('a', {href: linkElem.dataset.raw, target: '_blank'}, 'Click here to open in a new tab instead')
                                ));
                            }
                            break;
                        }
                    }
                },
                _popTemplateOverwriteConfirm: (internalJumpElem) => {
                    return new Promise((resolve, reject) => {
                        let bodyWrapper = crel('div');
                        let buttons = crel('div', {'style': 'text-align: right; display: block; width: 100%;'});

                        alert.show(crel(bodyWrapper,
                            crel('h3', {'class': 'text-orange'}, 'This link will overwrite your current template. What would you like to do?'),
                            Object.values(self.TEMPLATE_ACTIONS).map(action => action.id === 0 ? null :
                                crel('label', {'style': 'display: block; margin: 3px 3px 3px 1rem; margin-left: 1rem;'},
                                    crel('input', {'type': 'radio', 'name': 'link-action-rb', 'data-action-id': action.id}),
                                    action.pretty
                                )
                            ),
                            crel('span', {'class': 'text-muted'}, 'Note: You can set a default action in the settings menu which bypasses this popup completely'),
                            crel('div', {'style': 'text-align: right; display: block; width: 100%'},
                                [
                                    ["Cancel", () => resolve(false)],
                                    ["OK", () => resolve(bodyWrapper.querySelector('input[type=radio]:checked').dataset.actionId >> 0)]
                                ].map(x =>
                                    crel('button', {'class': 'button', 'style': 'margin-left: 3px; position: initial !important; bottom: initial !important; right: initial !important;', onclick: x[1]}, x[0])
                                )
                            )
                        ), true);
                        bodyWrapper.querySelector(`input[type="radio"][data-action-id="${self.TEMPLATE_ACTIONS.NEW_TAB.id}"]`).checked = true;
                    });
                },
                _pushStateMaybe(url) {
                    if ((typeof history.pushState) === "function") {
                        history.pushState(null, document.title, url == null ? document.location.href : url); //ensure people can back button if available
                    }
                },
                // The following functions must use es5 syntax for expected behavior.
                // Don't upgrade syntax, `this` is attached to a DOM Event and we need `this` to be bound by DOM Bubbles.
                _addAuthorMentionToChatbox: function(e) {
                    e.preventDefault();
                    if (this && this.closest) {
                        const chatLineEl = this.closest('.chat-line[data-nonce]');
                        if (!chatLineEl) return console.warn('no closets chat-line on self: %o', this);

                        self.elements.input.val(self.elements.input.val() + '@' + chatLineEl.dataset.author + ' ');
                        self.elements.input.focus();
                    }
                },
                _popUserPanel: function(e) {
                    if (this && this.closest) {
                        let closest = this.closest('.chat-line[data-nonce]');
                        if (!closest) return console.warn('no closets chat-line on self: %o', this);

                        let nonce = closest.dataset.nonce;

                        let badgesArray = [];
                        try {
                            badgesArray = JSON.parse(closest.dataset.badges);
                        } catch (ignored) {}
                        let badges = crel('span', {'class': 'badges'});
                        badgesArray.forEach(badge => {
                            switch(badge.type) {
                                case 'text':
                                    crel(badges, crel('span', {'class': 'text-badge', 'title': badge.tooltip || ''}, badge.displayName || ''), document.createTextNode(' '));
                                    break;
                                case 'icon':
                                    crel(badges, crel('i', {'class': (badge.cssIcon || '') + ' icon-badge', 'title': badge.tooltip || ''}, document.createTextNode(' ')), document.createTextNode(' '));
                                    break;
                            }
                        });

                        const closeHandler = function() {
                            if (this && this.closest) {
                                let toClose = this.closest('.popup.panels');
                                if (toClose) toClose.remove();
                            }
                        };

                        let popupWrapper = crel('div', {'class': 'popup panels', 'data-popup-for': nonce});
                        let panelHeader = crel('header',
                            {'style': 'text-align: center;'},
                            crel('div', {'class': 'left'}, crel('i', {'class': 'fas fa-times text-red', onclick: closeHandler})),
                            crel('span', closest.dataset.author, badges),
                            crel('div', {'class': 'right'})
                        );
                        let leftPanel = crel('div', {'class': 'pane details-wrapper'});
                        let rightPanel = crel('div', {'class': 'pane actions-wrapper'});
                        let actionsList = crel('ul', {'class': 'actions-list'});

                        let popupActions = crel('ul', {'class': 'popup-actions'});
                        let actionReport = crel('li', {'class': 'text-red', 'data-action': 'report', 'data-nonce': nonce, onclick: self._handleActionClick}, 'Report');
                        let actionMention = crel('li', {'data-action': 'mention', 'data-nonce': nonce, onclick: self._handleActionClick}, 'Mention');
                        let actionIgnore = crel('li', {'data-action': 'ignore', 'data-nonce': nonce, onclick: self._handleActionClick}, 'Ignore');
                        let actionChatban = crel('li', {'data-action': 'chatban', 'data-nonce': nonce, onclick: self._handleActionClick}, 'Chat (un)ban');
                        let actionPurgeUser = crel('li', {'data-action': 'purge', 'data-nonce': nonce, onclick: self._handleActionClick}, 'Purge User');
                        let actionDeleteMessage = crel('li', {'data-action': 'delete', 'data-nonce': nonce, onclick: self._handleActionClick}, 'Delete');
                        let actionModLookup = crel('li', {'data-action': 'lookup', 'data-nonce': nonce, onclick: self._handleActionClick}, 'Mod Lookup');
                        let actionCopyNonce = crel('li', {'data-action': 'copy-nonce', 'data-nonce': nonce, onclick: self._handleActionClick}, 'Copy Nonce');

                        crel(leftPanel, crel('p', {'class': 'popup-timestamp-header'}, moment.unix(closest.dataset.date >> 0).format(`MMM Do YYYY, ${(ls.get('chat.24h') === true ? 'HH:mm:ss' : 'hh:mm:ss A')}`)));
                        crel(leftPanel, crel('p', {'style': 'margin-top: 3px; margin-left: 3px; text-align: left;'}, closest.querySelector('.content').textContent));

                        crel(actionsList, actionReport);
                        crel(actionsList, actionMention);
                        crel(actionsList, actionIgnore);
                        if (user.isStaff()) {
                            crel(actionsList, actionChatban);
                            crel(actionsList, actionDeleteMessage);
                            crel(actionsList, actionPurgeUser);
                            crel(actionsList, actionModLookup);
                            if (user.getRole() === "DEVELOPER") {
                                crel(actionsList, actionCopyNonce);
                            }
                        }
                        crel(rightPanel, actionsList);

                        let popup = crel(popupWrapper, panelHeader, leftPanel, rightPanel);
                        document.body.appendChild(popup);
                        self._positionPopupRelativeToX(popup, this);
                    }
                },
                _positionPopupRelativeToX(popup, x) {
                    let bodyRect = document.body.getBoundingClientRect();
                    let thisRect = x.getBoundingClientRect(); //this: span.user or i.fas.fa-cog
                    let popupRect = popup.getBoundingClientRect();

                    if (thisRect.left < (popupRect.width / 2)) {
                        popup.style.left = `${thisRect.left >> 0}px`;
                    } else {
                        popup.style.left = `${((thisRect.left + (thisRect.width / 2 >> 0)) - (popupRect.width / 2 >> 0)) >> 0}px`;
                    }

                    popup.style.top = `${thisRect.top + thisRect.height + 2}px`;

                    popupRect = popup.getBoundingClientRect(); //have to re-calculate after moving before fixing positioning. forces relayout though

                    if (popupRect.bottom > bodyRect.bottom) {
                        popup.style.bottom = `2px`;
                        popup.style.top = null;
                    }
                    if (popupRect.top < bodyRect.top) {
                        popup.style.top = `2px`;
                        popup.style.bottom = null;
                    }
                    if (popupRect.right > bodyRect.right) {
                        popup.style.right = `2px`;
                        popup.style.left = null;
                    }
                    if (popupRect.left < bodyRect.left) {
                        popup.style.left = `2px`;
                        popup.style.right = null;
                    }
                },
                _handleActionClick: function(e) { //must be es5 for expected behavior. don't upgrade syntax, this is attached as an onclick and we need `this` to be bound by dom bubbles.
                    if (!this.dataset) return console.trace('onClick attached to invalid object');

                    let chatLine = self.elements.body.find(`.chat-line[data-nonce="${this.dataset.nonce}"]`)[0];
                    if (!chatLine && !this.dataset.target) return console.warn('no chatLine/target? searched for nonce %o', this.dataset.nonce);
                    let mode = !!chatLine;

                    let reportingMessage = mode ? chatLine.querySelector('.content').textContent : '';
                    let reportingTarget = mode ? chatLine.dataset.author : this.dataset.target;

                    $(".popup").remove();
                    switch (this.dataset.action.toLowerCase().trim()) {
                        case 'report': {
                            let reportButton = crel('button', {'class': 'button', 'style': 'position: initial;', 'type': 'submit'}, 'Report');
                            let textArea = crel('textarea', {'placeholder': 'Enter a reason for your report', 'style': 'width: 100%; border: 1px solid #999;', 'required': 'true', onkeydown: e => e.stopPropagation()});

                            let chatReport =
                                crel('form', {'class': 'report chat-report', 'data-chat-nonce': this.dataset.nonce},
                                    crel('h3', 'Chat Report'),
                                    crel('p', 'Use this form to report chat offenses.'),
                                    crel('p', {'style': 'font-size: 1rem !important;'},
                                        `You are reporting a chat message from `,
                                        crel('span', {'style': 'font-weight: bold'}, reportingTarget),
                                        crel('span', {'title': reportingMessage}, ` with the content "${reportingMessage.substr(0, 60)}${reportingMessage.length > 60 ? '...' : ''}"`)
                                    ),
                                    textArea,
                                    crel('div', {'style': 'text-align: right'},
                                        crel('button', {'class': 'button', 'style': 'position: initial; margin-right: .25rem', 'type': 'button', onclick: () => {alert.hide(); chatReport.remove();}}, 'Cancel'),
                                        reportButton
                                    )
                                );
                            chatReport.onsubmit = e => {
                                e.preventDefault();
                                reportButton.disabled = true;
                                if (!this.dataset.nonce) return console.error('!! No nonce to report? !!', this);
                                $.post("/reportChat", {
                                    nonce: this.dataset.nonce,
                                    report_message: textArea.value
                                }, function () {
                                    chatReport.remove();
                                    alert.show("Sent report!");
                                }).fail(function () {
                                    alert.show("Error sending report.");
                                    reportButton.disabled = false;
                                });
                            };
                            alert.show(chatReport, true);
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
                                    alert.show('User ignored. You can unignore from chat settings.');
                                } else {
                                    alert.show('Failed to ignore user. Either they\'re already ignored, or an error occurred. If the problem persists, contact a developer.');
                                }
                            } else console.warn('no reportingTarget');
                            break;
                        }
                        case 'chatban': {
                            let messageTable = mode
                                ? crel('table', {'class': 'chatmod-table'},
                                    crel('tr',
                                        crel('th', 'Nonce: '),
                                        crel('td', this.dataset.nonce)
                                    ),
                                    crel('tr',
                                        crel('th', 'Message: '),
                                        crel('td', {'title': reportingMessage}, `${reportingMessage.substr(0, 120)}${reportingMessage.length > 120 ? '...' : ''}`)
                                    ),
                                    crel('tr',
                                        crel('th', 'User: '),
                                        crel('td', reportingTarget)
                                    )
                                )
                                : crel('table', {'class': 'chatmod-table'},
                                    crel('tr',
                                        crel('th', 'User: '),
                                        crel('td', reportingTarget)
                                    )
                                );

                            let banLengths = [['Unban', -3], ['Permanent', -1], ['Temporary', -2]];
                            let _selBanLength = crel('select', {'name': 'selBanLength'},
                                banLengths.map(lenPart =>
                                    crel('option', {'value': lenPart[1]}, lenPart[0])
                                )
                            );

                            let _customLenWrap = crel('div', {'style': 'display: block; margin-top: .5rem'});
                            let _selCustomLength = crel('select', {'name': 'selCustomLength', 'style': 'display: inline-block; width: auto;'},
                                crel('option', {'value': '1'}, 'Seconds'),
                                crel('option', {'value': '60'}, 'Minutes'),
                                crel('option', {'value': '3600'}, 'Hours'),
                                crel('option', {'value': '86400'}, 'Days')
                            );
                            let _txtCustomLength = crel('input', {'type': 'number', 'name': 'txtCustomLength', 'style': 'display: inline-block; width: auto;', 'min': '1', 'step': '1', 'value': '10'});

                            let _selBanReason = crel('select',
                                crel('option', 'Rule 3: Spam'),
                                crel('option', 'Rule 1: Chat civility'),
                                crel('option', 'Rule 5/6: NSFW'),
                                crel('option', 'Rule 4: Copy/pastas'),
                                crel('option', {'value': '0'}, 'Custom')
                            );

                            let _customReasonWrap = crel('div', {'style': 'display: none; margin-top: .5rem;'});
                            let _txtCustomBanReason = crel('input', {'type': 'text', 'name': 'txtCustomReason', 'style': 'display: inline-block; width: auto;'});

                            let _purgeWrap = crel('div', {'style': 'display: block;'});
                            let _rbPurgeYes = crel('input', {'type': 'radio', 'name': 'rbPurge', 'checked': 'true'});
                            let _rbPurgeNo = crel('input', {'type': 'radio', 'name': 'rbPurge'});

                            let _reasonWrap = crel('div', {'style': 'display: block;'});

                            let _btnCancel = crel('button', {'class': 'button', 'type': 'button', onclick: () => {chatbanContainer.remove(); alert.hide();}}, 'Cancel');
                            let _btnOK = crel('button', {'class': 'button', 'type': 'submit'}, 'Ban');

                            let chatbanContainer = crel('form', {'class': 'chatmod-container', 'data-chat-nonce': this.dataset.nonce},
                                crel('h3', 'Chatban'),
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
                                    crel(_customReasonWrap,
                                        crel('label', 'Reason: ', _txtCustomBanReason)
                                    )
                                ),
                                crel(_purgeWrap,
                                    crel('h5', 'Purge Messages'),
                                    crel('label', {'style': 'display: inline;'}, _rbPurgeYes, 'Yes'),
                                    crel('label', {'style': 'display: inline;'}, _rbPurgeNo, 'No')
                                ),
                                crel('div', {'class': 'buttons'},
                                    _btnCancel,
                                    _btnOK
                                )
                            );

                            _selBanLength.value = banLengths[2][1]; //10 minutes
                            _selBanLength.addEventListener('change', function() {
                                let isCustom = this.value === '-2';
                                _customLenWrap.style.display = isCustom ? 'block' : 'none';
                                _txtCustomLength.required = isCustom;

                                let isUnban = _selBanLength.value === '-3';
                                _reasonWrap.style.display = isUnban ? 'none' : 'block';
                                _purgeWrap.style.display = isUnban ? 'none' : 'block';
                                _btnOK.innerHTML = isUnban ? 'Unban' : 'Ban';
                            });
                            _selCustomLength.selectedIndex = 1; //minutes

                            _selBanReason.addEventListener('change', function() {
                                let isCustom = this.value === '0';
                                _customReasonWrap.style.display = isCustom ? 'block' : 'none';
                                _txtCustomBanReason.required = isCustom;
                            });

                            _txtCustomBanReason.onkeydown = e => e.stopPropagation();
                            _txtCustomLength.onkeydown = e => e.stopPropagation();

                            chatbanContainer.onsubmit = e => {
                                e.preventDefault();
                                let postData = {
                                    type: 'temp',
                                    reason: 'none provided',
                                    removalAmount: _rbPurgeYes.checked ? -1 : 0,
                                    banLength: 0
                                };

                                if (_selBanReason.value === '0') { //custom
                                    postData.reason = _txtCustomBanReason.value;
                                } else {
                                    postData.reason = _selBanReason.value;
                                }

                                if (_selBanLength.value === '-3') { //unban
                                    postData.type = 'unban';
                                    postData.reason = '(web shell unban)';
                                    postData.banLength = -1;
                                } else if (_selBanLength.value === '-2') { //custom
                                    postData.banLength = (_txtCustomLength.value >> 0) * (_selCustomLength.value >> 0);
                                } else if (_selBanLength.value === '-1') { //perma
                                    postData.type = 'perma';
                                    postData.banLength = 0;
                                } else {
                                    postData.banLength = _selBanLength.value >> 0;
                                }

                                if (mode)
                                    postData.nonce = this.dataset.nonce;
                                else
                                    postData.who = reportingTarget;

                                $.post("/admin/chatban", postData, () => {
                                    chatbanContainer.remove();
                                    alert.show("Chatban initiated");
                                }).fail(() => {
                                    alert.show("Error occurred while chatbanning");
                                });
                            };
                            alert.show(chatbanContainer, true);
                            break;
                        }
                        case 'delete': {
                            let _txtReason = crel('input', {
                                'type': 'text',
                                'name': 'txtReason',
                                'style': 'display: inline-block; width: 100%; font-family: sans-serif; font-size: 1rem;'
                            });

                            const doDelete = () => $.post('/admin/delete', {
                                nonce: this.dataset.nonce,
                                reason: _txtReason.value
                            }, () => {
                                deleteWrapper.remove();
                                alert.hide();
                            }).fail(() => {
                                alert.show('Failed to delete');
                            });

                            if (e.shiftKey === true) {
                                return doDelete();
                            }
                            let btnDelete = crel('button', {'class': 'button'}, 'Delete');
                            btnDelete.onclick = () => doDelete();
                            let deleteWrapper = crel('div', {'class': 'chatmod-container'},
                                crel('h3', 'Delete Message'),
                                crel('table',
                                    crel('tr',
                                        crel('th', 'Nonce: '),
                                        crel('td', this.dataset.nonce)
                                    ),
                                    crel('tr',
                                        crel('th', 'User: '),
                                        crel('td', reportingTarget)
                                    ),
                                    crel('tr',
                                        crel('th', 'Message: '),
                                        crel('td', {'title': reportingMessage}, `${reportingMessage.substr(0, 120)}${reportingMessage.length > 120 ? '...' : ''}`)
                                    ),
                                    crel('tr',
                                        crel('th', 'Reason: '),
                                        crel('td', _txtReason)
                                    )
                                ),
                                crel('div', {'class': 'buttons'},
                                    crel('button', { 'class': 'button', 'type': 'button', onclick: () => {deleteWrapper.remove(); alert.hide();} }, 'Cancel'),
                                    btnDelete
                                )
                            );
                            alert.show(deleteWrapper, true);
                            break;
                        }
                        case 'purge': {
                            let lblPurgeAmountError = crel('label', {'class': 'hidden error-label'});

                            let txtPurgeReason = crel('input', {'type': 'text', onkeydown: e => e.stopPropagation()});
                            let lblPurgeReasonError = crel('label', {'class': 'hidden error-label'});

                            let btnPurge = crel('button', {'class': 'button', 'type': 'submit'}, 'Purge');

                            let messageTable = mode
                                ? crel('table',
                                    crel('tr',
                                        crel('th', 'Nonce: '),
                                        crel('td', this.dataset.nonce)
                                    ),
                                    crel('tr',
                                        crel('th', 'Message: '),
                                        crel('td', {'title': reportingMessage}, `${reportingMessage.substr(0, 120)}${reportingMessage.length > 120 ? '...' : ''}`)
                                    )
                                )
                                : crel('table', {'class': 'chatmod-table'},
                                    crel('tr',
                                        crel('th', 'User: '),
                                        crel('td', reportingTarget)
                                    )
                                );

                            let purgeWrapper = crel('form', {'class': 'chatmod-container'},
                                crel('h3', 'Purge User'),
                                crel('h5', 'Selected Message'),
                                messageTable,
                                crel('div',
                                    crel('h5', 'Purge Reason'),
                                    txtPurgeReason,
                                    crel('br'),
                                    lblPurgeReasonError
                                ),
                                crel('div', {'class': 'buttons'},
                                    crel('button', { 'class': 'button', 'type': 'button', onclick: () => {purgeWrapper.remove(); alert.hide();} }, 'Cancel'),
                                    btnPurge
                                )
                            );
                            purgeWrapper.onsubmit = e => {
                                e.preventDefault();

                                $.post("/admin/chatPurge", {
                                    who: reportingTarget,
                                    reason: txtPurgeReason.value
                                }, function () {
                                    purgeWrapper.remove();
                                    alert.show("User purged");
                                }).fail(function () {
                                    alert.show("Error sending purge.");
                                });
                            };

                            alert.show(purgeWrapper, true);
                            break;
                        }
                        case 'lookup': {
                            if (user.admin && user.admin.checkUser && user.admin.checkUser.check) {
                                user.admin.checkUser.check(reportingTarget);
                            }
                            break;
                        }
                        case 'request-rename': {
                            let rbStateOn = crel('input', {'type': 'radio', 'name': 'rbState'});
                            let rbStateOff = crel('input', {'type': 'radio', 'name': 'rbState'});

                            let stateOn = crel('label', {'style': 'display: inline-block'}, rbStateOn, ' On');
                            let stateOff = crel('label', {'style': 'display: inline-block'}, rbStateOff, ' Off');

                            let btnSetState = crel('button', {'class': 'button', 'type': 'submit'}, 'Set');

                            let renameError = crel('p', {'style': 'display: none; color: #f00; font-weight: bold; font-size: .9rem', 'class': 'rename-error'}, '');

                            rbStateOff.checked = true;

                            let renameWrapper = crel('form', {'class': 'chatmod-container'},
                                crel('h3', 'Toggle Rename Request'),
                                crel('p', 'Select one of the options below to set the current rename request state.'),
                                crel('div', stateOn, stateOff),
                                renameError,
                                crel('div', {'class': 'buttons'},
                                    crel('button', {'class': 'button', 'type': 'button', onclick: () => {renameWrapper.remove(); alert.hide();}}, 'Cancel'),
                                    btnSetState
                                )
                            );

                            renameWrapper.onsubmit = e => {
                                e.preventDefault();
                                $.post('/admin/flagNameChange', {user: reportingTarget, flagState: rbStateOn.checked === true}, function() {
                                    renameWrapper.remove();
                                    alert.show("Rename request updated");
                                }).fail(function(xhrObj) {
                                    let resp = "An unknown error occurred. Please contact a developer";
                                    if (xhrObj.responseJSON) {
                                        resp = xhrObj.responseJSON.details || resp;
                                    } else if (xhrObj.responseText) {
                                        try {
                                            resp = JSON.parse(xhrObj.responseText).details;
                                        } catch (ignored) {}
                                    }

                                    renameError.style.display = null;
                                    renameError.innerHTML = resp;
                                });
                            };

                            alert.show(renameWrapper, true);
                            break;
                        }
                        case 'force-rename': {
                            let newNameInput = crel('input', {'type': 'text', 'required': 'true', onkeydown: e => e.stopPropagation()});
                            let newNameWrapper = crel('label', 'New Name: ', newNameInput);

                            let btnSetState = crel('button', {'class': 'button', 'type': 'submit'}, 'Set');

                            let renameError = crel('p', {'style': 'display: none; color: #f00; font-weight: bold; font-size: .9rem', 'class': 'rename-error'}, '');

                            let renameWrapper = crel('form', {'class': 'chatmod-container'},
                                crel('h3', 'Toggle Rename Request'),
                                crel('p', 'Select one of the options below to set the current rename request state.'),
                                newNameWrapper,
                                renameError,
                                crel('div', {'class': 'buttons'},
                                    crel('button', {'class': 'button', 'type': 'button', onclick: () => {renameWrapper.remove(); alert.hide();}}, 'Cancel'),
                                    btnSetState
                                )
                            );

                            renameWrapper.onsubmit = e => {
                                e.preventDefault();
                                $.post('/admin/forceNameChange', {user: reportingTarget, newName: newNameInput.value.trim()}, function() {
                                    renameWrapper.remove();
                                    alert.show("User renamed");
                                }).fail(function(xhrObj) {
                                    let resp = "An unknown error occurred. Please contact a developer";
                                    if (xhrObj.responseJSON) {
                                        resp = xhrObj.responseJSON.details || resp;
                                    } else if (xhrObj.responseText) {
                                        try {
                                            resp = JSON.parse(xhrObj.responseText).details;
                                        } catch (ignored) {}
                                    }

                                    renameError.style.display = null;
                                    renameError.innerHTML = resp;
                                });
                            };

                            alert.show(renameWrapper, true);
                            break;
                        }
                        case 'copy-nonce': {
                            // TODO(netux): use Clipboard API once it becomes Stable
                            const textArea = document.createElement('textarea');
                            textArea.value = this.dataset.nonce;
                            document.body.appendChild(textArea);
                            textArea.select();
                            document.execCommand('copy');
                            document.body.removeChild(textArea);
                            break;
                        }
                    }
                },
                _doScroll: elem => {
                    try { //Fixes iframes scrolling their parent. For context see https://github.com/pxlsspace/Pxls/pull/192's commit messages.
                        elem.scrollIntoView({block: "nearest", inline: "nearest"});
                    } catch (ignored) {
                        elem.scrollIntoView(false);
                    }
                }
            };
            return {
                init: self.init,
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
            }
        })(),
        // this takes care of the countdown timer
        timer = (function () {
            var self = {
                elements: {
                    palette: $("#palette"),
                    timer_overlay: $("#cd-timer-overlay"),
                    timer_bubble: $("#cooldown-timer")
                },
                isOverlay: false,
                hasFiredNotification: true,
                cooldown: 0,
                runningTimer: false,
                audio: new Audio('notify.wav'),
                title: "",
                cooledDown: function () {
                    return self.cooldown < (new Date()).getTime();
                },
                update: function (die) {
                    // subtract one extra millisecond to prevent the first displaying to be derped
                    var delta = (self.cooldown - (new Date()).getTime() - 1) / 1000;

                    if (self.runningTimer === false) {
                        self.isOverlay = ls.get("auto_reset") === true;
                        self.elements.timer = self.isOverlay ? self.elements.timer_overlay : self.elements.timer_bubble;
                        self.elements.timer_overlay.hide();
                    }

                    if (self.status) {
                        self.elements.timer.text(self.status);
                    }

                    var alertDelay = parseInt(ls.get("alert_delay"));
                    if (alertDelay < 0 && delta < Math.abs(alertDelay) && !self.hasFiredNotification) {
                        self.playAudio();
                        let notif;
                        if (!uiHelper.windowHasFocus()) {
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
                        self.elements.timer.show();
                        if (self.isOverlay) {
                            self.elements.palette.css("overflow-x", "hidden");
                            self.elements.timer.css("left", `${self.elements.palette.scrollLeft()}px`);
                        }
                        delta++; // real people don't count seconds zero-based (programming is more awesome)
                        var secs = Math.floor(delta % 60),
                            secsStr = secs < 10 ? "0" + secs : secs,
                            minutes = Math.floor(delta / 60),
                            minuteStr = minutes < 10 ? "0" + minutes : minutes;
                        self.elements.timer.text(minuteStr + ":" + secsStr);

                        document.title = uiHelper.getTitle(`[${minuteStr}:${secsStr}]`);

                        if (self.runningTimer && !die) {
                            return;
                        }
                        self.runningTimer = true;
                        setTimeout(function () {
                            self.update(true);
                        }, 1000);
                        return;
                    }

                    self.runningTimer = false;

                    document.title = uiHelper.getTitle();
                    if (self.isOverlay) {
                        self.elements.palette.css("overflow-x", "auto");
                        self.elements.timer.css("left", "0");
                    }
                    self.elements.timer.hide();

                    if (alertDelay > 0) {
                        setTimeout(() => {
                            self.playAudio();
                            if (!uiHelper.windowHasFocus()) {
                                const notif = nativeNotifications.maybeShow(`Your next pixel has been available for ${alertDelay} seconds!`);
                                if (notif) {
                                    $(window).one('pxls:ack:place', () => notif.close());
                                }
                            }
                            uiHelper.setPlaceableText(1);
                            self.hasFiredNotification = true;
                        }, alertDelay * 1000)
                        return;
                    }

                    if (!self.hasFiredNotification) {
                        self.playAudio();
                        if (!uiHelper.windowHasFocus()) {
                            const notif = nativeNotifications.maybeShow("Your next pixel is available!");
                            if (notif) {
                                $(window).one('pxls:ack:place', () => notif.close());
                            }
                        }
                        uiHelper.setPlaceableText(1);
                        self.hasFiredNotification = true;
                    }
                },
                init: function () {
                    self.title = document.title;
                    self.elements.timer = ls.get("auto_reset") === true
                        ? self.elements.timer_overlay
                        : self.elements.timer_bubble;
                    self.elements.timer.hide();

                    setTimeout(function () {
                        if (self.cooledDown() && uiHelper.getAvailable() === 0) {
                            uiHelper.setPlaceableText(1);
                        }
                    }, 250);
                    socket.on("cooldown", function (data) {
                        self.cooldown = (new Date()).getTime() + (data.wait * 1000);
                        self.hasFiredNotification = data.wait === 0;
                        self.update();
                    });
                },
                playAudio: function () {
                    if (uiHelper.tabHasFocus() && !ls.get("audio_muted")) {
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
        })(),
        // this takes care of displaying the coordinates the mouse is over
        coords = (function () {
            var self = {
                elements: {
                    coordsWrapper: $("#coords-info"),
                    coords: $("#coords-info .coords"),
                    lockIcon: $("#coords-info .icon-lock")
                },
                mouseCoords: null,
                init: function () {
                    self.elements.coordsWrapper.hide();
                    const _board = board.getRenderBoard()[0];
                    _board.addEventListener("pointermove", pointerHandler, { passive: false });
                    _board.addEventListener("mousemove", pointerHandler, { passive: false });
                    _board.addEventListener("touchstart", touchHandler, { passive: false });
                    _board.addEventListener("touchmove", touchHandler, { passive: false });
                    // board.getRenderBoard().on("pointermove mousemove", function (evt) {
                    // }).on("touchstart touchmove", function (evt) {
                    // });

                    function pointerHandler(evt) {
                        var boardPos = board.fromScreen(evt.clientX, evt.clientY);

                        self.mouseCoords = boardPos;
                        self.elements.coords.text("(" + (boardPos.x) + ", " + (boardPos.y) + ")");
                        if (!self.elements.coordsWrapper.is(":visible")) self.elements.coordsWrapper.fadeIn(200);
                    }

                    function touchHandler(evt) {
                        var boardPos = board.fromScreen(evt.changedTouches[0].clientX, evt.changedTouches[0].clientY);

                        self.mouseCoords = boardPos;
                        self.elements.coords.text("(" + (boardPos.x) + ", " + (boardPos.y) + ")");
                        if (!self.elements.coordsWrapper.is(":visible")) self.elements.coordsWrapper.fadeIn(200);
                    }

                    $(window).keydown((event) => {
                        if (["INPUT", "TEXTAREA"].includes(event.target.nodeName)) {
                            // prevent inputs from triggering shortcuts
                            return;
                        }

                        if (!event.ctrlKey && (event.key === "c" || event.key === "C" || event.keyCode === 67)) {
                            self.copyCoords();
                        }
                    });
                },
                copyCoords: function (useHash = false) {
                    if (!navigator.clipboard || !self.mouseCoords) {
                        return;
                    }
                    let x = useHash ? query.get('x') : self.mouseCoords.x;
                    let y = useHash ? query.get('y') : self.mouseCoords.y;
                    let scale = useHash ? query.get('scale') : 20;
                    navigator.clipboard.writeText(self.getLinkToCoords(x, y, scale));
                    self.elements.coordsWrapper.addClass("copyPulse");
                    setTimeout(() => {
                        self.elements.coordsWrapper.removeClass("copyPulse");
                    }, 200);
                },
                /**
                 * Returns a link to the website at a specific position.
                 * @param {number} x The X coordinate for the link to have.
                 * @param {number} y The Y coordinate for the link to have.
                 */
                getLinkToCoords: (x = 0, y = 0, scale = 20) => {
                    var append = "";
                    query.has("template") ? append += "&template=" + query.get("template") : 0;
                    query.has("tw") ? append += "&tw=" + query.get("tw") : 0;
                    query.has("oo") ? append += "&oo=" + query.get("oo") : 0;
                    query.has("ox") ? append += "&ox=" + query.get("ox") : 0;
                    query.has("oy") ? append += "&oy=" + query.get("oy") : 0;
                    query.has("title") ? append += "&title=" + query.get("title") : "";
                    return `${location.origin}/#x=${Math.floor(x)}&y=${Math.floor(y)}&scale=${scale}${append}`;
                }
            };
            return {
                init: self.init,
                copyCoords: self.copyCoords,
                getLinkToCoords: self.getLinkToCoords,
                lockIcon: self.elements.lockIcon,
            };
        })(),
        // this holds user stuff / info
        user = (function () {
            var self = {
                elements: {
                    users: $("#online-count"),
                    userInfo: $("#user-info"),
                    loginOverlay: $("#login-overlay"),
                    userMessage: $("#user-message"),
                    prompt: $("#prompt"),
                    signup: $("#signup")
                },
                role: "USER",
                pendingSignupToken: null,
                loggedIn: false,
                username: '',
                chatNameColor: 0,
                getRole: () => self.role,
                isStaff: () => ["MODERATOR", "DEVELOPER", "ADMIN", "TRIALMOD"].includes(self.getRole()),
                getUsername: () => self.username,
                signin: function () {
                    var data = ls.get("auth_respond");
                    if (!data) {
                        return;
                    }
                    ls.remove("auth_respond");
                    if (data.signup) {
                        self.pendingSignupToken = data.token;
                        self.elements.signup.fadeIn(200);
                    } else {
                        socket.reconnectSocket();
                    }
                    self.elements.prompt.fadeOut(200);
                },
                isLoggedIn: function () {
                    return self.loggedIn;
                },
                webinit: function (data) {
                    self.elements.loginOverlay.find("a").click(function (evt) {
                        evt.preventDefault();
                        self.elements.prompt.empty().append(
                            $("<h1>").html("Sign&nbsp;in&nbsp;with..."),
                            $("<ul>").append(
                                $.map(data.authServices, function (a) {
                                    return $("<li>").append(
                                        $("<a>").attr("href", "/signin/" + a.id + "?redirect=1").text(a.name).click(function (evt) {
                                            if (window.open(this.href, "_blank")) {
                                                evt.preventDefault();
                                                return;
                                            }
                                            ls.set("auth_same_window", true);
                                        })
                                    );
                                })
                            ),
                            $("<div>").addClass("buttons").append(
                                $("<div>").addClass("button").text("Cancel").click(function () {
                                    self.elements.prompt.fadeOut(200);
                                })
                            )
                        ).fadeIn(200);
                    });
                },
                wsinit: function () {
                    if (ls.get("auth_proceed")) {
                        // we need to authenticate...
                        ls.remove("auth_proceed");
                        self.signin();
                    }
                },
                doSignup: function () {
                    if (!self.pendingSignupToken) return;

                    $.post({
                        type: "POST",
                        url: "/signup",
                        data: {
                            token: self.pendingSignupToken,
                            username: self.elements.signup.find("input").val()
                        },
                        success: function () {
                            self.elements.signup.find("#error").text("");
                            self.elements.signup.find("input").val("");
                            self.elements.signup.fadeOut(200);
                            socket.reconnectSocket();
                            self.pendingSignupToken = null;
                        },
                        error: function (data) {
                            self.elements.signup.find("#error").text(data.responseJSON.message);
                        }
                    });
                    // self.pendingSignupToken = null;
                },
                init: function () {
                    self.elements.userMessage.hide();
                    self.elements.signup.hide();
                    self.elements.signup.find("input").keydown(function (evt) {
                        evt.stopPropagation();
                        if (evt.key == "Enter" || evt.which === 13) {
                            self.doSignup();
                        }
                    });
                    self.elements.signup.find("#signup-button").click(self.doSignup);
                    self.elements.users.hide();
                    self.elements.userInfo.hide();
                    self.elements.userInfo.find(".logout").click(function (evt) {
                        evt.preventDefault();
                        $.get("/logout", function () {
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
                    $(window).bind("storage", function (evt) {
                        if (evt.originalEvent.key == "auth") {
                            ls.remove("auth");
                            self.signin();
                        }
                    });
                    socket.on("users", function (data) {
                        self.elements.users.text(data.count + " online").fadeIn(200);
                    });
                    socket.on("session_limit", function (data) {
                        socket.close();
                        alert.show("Too many sessions open, try closing some tabs.");
                    });
                    socket.on("userinfo", function (data) {
                        let isBanned = false,
                            banelem = $("<div>").addClass("ban-alert-content");
                        self.username = data.username;
                        self.loggedIn = true;
                        self.chatNameColor = data.chatNameColor;
                        uiHelper.updateSelectedNameColor(data.chatNameColor);
                        $(window).trigger('pxls:user:loginState', [true]);
                        self.renameRequested = data.renameRequested;
                        uiHelper.setDiscordName(data.discordName || "");
                        self.elements.loginOverlay.fadeOut(200);
                        self.elements.userInfo.find("span#username").text(data.username);
                        if (data.method == 'ip') {
                            self.elements.userInfo.hide();
                        } else {
                            self.elements.userInfo.fadeIn(200);
                        }
                        self.role = data.role;

                        if (self.role == "BANNED") {
                            isBanned = true;
                            banelem.append(
                                $("<p>").text("You are permanently banned.")
                            );
                        } else if (data.banned === true) {
                            isBanned = true;
                            banelem.append(
                                $("<p>").text(`You are temporarily banned and will not be allowed to place until ${new Date(data.banExpiry).toLocaleString()}`)
                            );
                        } else if (["TRIALMOD", "MODERATOR", "DEVELOPER", "ADMIN"].indexOf(self.role) != -1) {
                            if (window.deInitAdmin) {
                                window.deInitAdmin();
                            }
                            $.getScript("admin/admin.js").done(function () {
                                window.initAdmin({
                                    socket: socket,
                                    user: user,
                                    place: place,
                                    alert: alert,
                                    lookup: lookup,
                                    chat: chat,
                                    cdOverride: data.cdOverride
                                }, admin => self.admin = admin);
                            });
                        } else if (window.deInitAdmin) {
                            window.deInitAdmin();
                        }
                        if (isBanned) {
                            self.elements.userMessage.empty().show().text("You can contact us using one of the links in the info menu.").fadeIn(200);
                            banelem.append(
                                $("<p>").text("If you think this was an error, please contact us using one of the links in the info tab.")
                            ).append(
                                $("<p>").append("Ban reason:")
                            ).append(
                                $("<p>").append(data.ban_reason)
                            );
                            alert.show(banelem);
                            if (window.deInitAdmin) {
                                window.deInitAdmin();
                            }
                        } else if (data.renameRequested) {
                            self.showRenameRequest();
                        } else {
                            self.elements.userMessage.hide();
                        }

                        if (instaban) {
                            ban.shadow(7);
                        }

                        analytics("send", "event", "Auth", "Login", data.method);
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
                        self.elements.userInfo.find("span.name").text(e.newName);
                    })
                },
                _handleSubmit: function(event) {
                    event.preventDefault();
                    const input = this.querySelector('.rename-input');
                    const btn = this.querySelector('.rename-submit');
                    const err = this.querySelector('.rename-error');
                    if (!input || !input.value || !btn || !err) return console.error('Missing one or more variables from querySelector. input: %o, btn: %o, err: %o', input, btn, err);
                    input.disabled = btn.disabled = true;
                    $.post("/execNameChange", {newName: input.value.trim()}, function() {
                        self.renameRequested = false;
                        self.hideRenameRequest();
                        alert.hide(true);
                    }).fail(function(xhrObj) {
                        let resp = "An unknown error occurred. Please contact staff on discord";
                        if (xhrObj.responseJSON) {
                            resp = xhrObj.responseJSON.details || resp;
                        } else if (xhrObj.responseText) {
                            try {
                                resp = JSON.parse(xhrObj.responseText).details;
                            } catch (ignored) {}
                        }
                        err.style.display = null;
                        err.innerHTML = resp;
                    }).always(function() {
                        input.disabled = btn.disabled = false;
                    });
                },
                _handleRenameClick: function(event) {
                    let renamePopup = crel('form', {onsubmit: self._handleSubmit},
                        crel('h3', 'Change Username'),
                        crel('hr'),
                        crel('p', 'Staff have required you to change your username, this usually means your name breaks one of our rules.'),
                        crel('p', 'If you disagree, please contact us on Discord (link in the info panel).'),
                        crel('label', 'New Username: ',
                            crel('input', {'type': 'text', 'class': 'rename-input', 'required': 'true', onkeydown: e => e.stopPropagation()})
                        ),
                        crel('p', {'style': 'display: none; font-weight: bold; color: #f00; font-size: .9rem;', 'class': 'rename-error'}, ''),
                        crel('div', {'style': 'text-align: right'},
                            crel('button', {'class': 'button', 'onclick': alert.hide}, 'Not now'),
                            crel('button', {'class': 'button rename-submit', 'type': 'submit'}, 'Change')
                        )
                    );
                    alert.show(renamePopup, true);
                },
                showRenameRequest: () => {
                    self.elements.userMessage.empty().show().append(
                        crel('span', 'You must change your username. Click ',
                            crel('span', {style: 'cursor: pointer; text-decoration: underline;', onclick: self._handleRenameClick}, 'here'),
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
                setChatNameColor: c => self.chatNameColor = c,
                get admin() {
                    return self.admin || false;
                }
            };
        })(),
        // this takes care of browser notifications
        nativeNotifications = (function () {
            var self = {
                elements: {
                    toggle: $('#native-notification-toggle')
                },
                init: () => {
                    let pixelAvailEnabled = ls.get('nativenotifications.pixel-avail');
                    if (pixelAvailEnabled === null) {
                        pixelAvailEnabled = true;
                        ls.set('nativenotifications.pixel-avail', pixelAvailEnabled);
                        self.request();
                    }
                    self.elements.toggle.prop('checked', pixelAvailEnabled);
                    self.elements.toggle.on('change', (e) => {
                        ls.set('nativenotifications.pixel-avail', e.target.checked);
                        if (e.target.checked) {
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
                    let title = uiHelper.getInitTitle();
                    const templateOpts = template.getOptions();
                    if (templateOpts.use && templateOpts.title) {
                        title = `${templateOpts.title} - ${title}`
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
                    if (ls.get('nativenotifications.pixel-avail')
                        && uiHelper.tabHasFocus()
                        && Notification.permission === 'granted') {
                        return self.show(body);
                    }
                }
            };
            return {
                init: self.init,
                maybeShow: self.maybeShow
            }
        })(),
        notifications = (function() {
            let self = {
                elems: {
                    body: document.querySelector('.panel[data-panel="notifications"] .panel-body'),
                    bell: document.getElementById('notifications-icon'),
                    pingCounter: document.getElementById('notifications-ping-counter')
                },
                init() {
                    $.get("/notifications", function(data) {
                        if (Array.isArray(data) && data.length) {
                            data.forEach((elem) => self._handleNotif(elem));
                            self._checkLatest(data[0].id);
                        }
                    }).fail(function() {
                        console.error('Failed to get initial notifications from server');
                    });
                    socket.on("notification", (data) => {
                        let notif = data && data.notification ? data.notification : false;
                        if (notif) {
                            self._handleNotif(notif, true);
                            self._checkLatest(notif.id);
                        }
                    });
                    $(window).on("pxls:panel:opened", (e, which) => {
                        if (which === "notifications" && self.elems.body && self.elems.body.firstChild) {
                            self.elems.bell.closest('.panel-trigger[data-panel]').classList.remove('has-ping');
                            self.elems.bell.classList.remove('has-notification');
                            ls.set('notifications.lastSeen', self.elems.body.firstChild.dataset.notificationId >> 0);
                        }
                    });
                },
                _checkLatest(id) {
                    if (ls.get("notifications.lastSeen") >= id) return;
                    if (self.elems.body.closest('.panel[data-panel]').classList.contains('open')) {
                        ls.set("notifications.lastSeen", id);
                    } else {
                        self.elems.bell.closest('.panel-trigger[data-panel]').classList.add('has-ping');
                        self.elems.bell.classList.add('has-notification');
                    }
                },
                _handleNotif(notif, prepend=false) {
                    if (notif === false) return;
                    if (prepend && self.elems.body.firstChild) {
                        self.elems.body.insertBefore(self.makeDomForNotification(notif), self.elems.body.firstChild);
                    } else {
                        crel(self.elems.body, self.makeDomForNotification(notif));
                    }
                },
                makeDomForNotification(notification) {
                    return crel('div', {'class': 'notification', 'data-notification-id': notification.id},
                        crel('div', {'class': 'notification-title'}, notification.title),
                        chat.processMessage('div', 'notification-body', notification.content),
                        crel('div', {'class': 'notification-footer'},
                            notification.who ? document.createTextNode(`Posted by ${notification.who}`) : null,
                            notification.expiry !== 0 ? crel('span', {'class': 'notification-expiry'},
                                crel('i', {'class': 'far fa-clock fa-is-left'}),
                                crel('span', {'title': moment.unix(notification.expiry).format('MMMM DD, YYYY, hh:mm:ss A')}, `Expires ${moment.unix(notification.expiry).format('MMM DD YYYY')}`)
                            ) : null
                        )
                    );
                }
            };
            return {
                init: self.init
            };
        })(),
        // this attempts to fix a problem with chromium based browsers offsetting the canvas
        // by a pixel when the window size is odd.
        chromeOffsetWorkaround = (function() {
            const self = {
                isEnabled: false,
                elements: {
                    boardContainer: board.getContainer(),
                    setting: $("#chrome-canvas-offset-setting"),
                    checkbox: $("#chrome-canvas-offset-toggle")
                },
                init: () => {
                    const chromeUAMatch = navigator.userAgent.match(/Chrome\/(\d+)/);
                    if (!chromeUAMatch || parseInt(chromeUAMatch[1]) < 78) {
                        self.elements.setting.hide();
                        return;
                    }

                    self.isEnabled = ls.get("chrome-canvas-offset-workaround");
                    if (self.isEnabled === null) {
                        // default to enabled
                        self.isEnabled = true;
                        ls.set("chrome-canvas-offset-workaround", self.isEnabled);
                    }

                    if (self.isEnabled) {
                        self.enable();
                    }

                    self.elements.checkbox.prop("checked", self.isEnabled);
                    self.elements.checkbox.on("change", (e) => {
                        self.isEnabled = e.target.checked;
                        ls.set("chrome-canvas-offset-workaround", self.isEnabled);
                        if (self.isEnabled) {
                            self.enable();
                        } else {
                            self.disable();
                        }
                    });
                },
                enable: () => {
                    self.isEnabled = true;
                    window.addEventListener("resize", self.updateContainer);
                    self.updateContainer();
                },
                updateContainer: () => {
                    let offsetWidth = (window.innerWidth + board.getWidth()) % 2;
                    let offsetHeight = (window.innerHeight + board.getHeight()) % 2;

                    self.elements.boardContainer.css("width", `${window.innerWidth - offsetWidth}px`);
                    self.elements.boardContainer.css("height", `${window.innerHeight - offsetHeight}px`);
                },
                disable: () => {
                    self.isEnabled = false;
                    window.removeEventListener("resize", self.updateContainer);
                    self.elements.boardContainer.css("width", "");
                    self.elements.boardContainer.css("height", "");
                }
            }
            return {
                init: self.init,
                update: () => {
                    if (self.isEnabled) {
                        self.updateContainer();
                    }
                }
            }
        }());
    // init progress
    query.init();
    board.init();
    heatmap.init();
    virginmap.init();
    drawer.init();
    lookup.init();
    template.init();
    ban.init();
    grid.init();
    place.init();
    info.init();
    alert.init();
    timer.init();
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


    return {
        ls: ls,
        ss: ss,
        query: query,
        heatmap: {
            clear: heatmap.clear
        },
        virginmap: {
            clear: virginmap.clear
        },
        uiHelper: {
            updateAudio: uiHelper.updateAudio
        },
        template: {
            update: function (t) {
                template.queueUpdate(t);
            },
            normalize: function (obj, dir = true) {
                return template.normalizeTemplateObj(obj, dir);
            }
        },
        lookup: {
            registerHook: function () {
                return lookup.registerHook(...arguments);
            },
            replaceHook: function () {
                return lookup.replaceHook(...arguments);
            },
            unregisterHook: function () {
                return lookup.unregisterHook(...arguments);
            },
        },
        centerBoardOn: function (x, y) {
            board.centerOn(x, y);
        },
        updateTemplate: function (t) {
            template.queueUpdate(t);
        },
        alert: function (s) {
            alert.show($('<span>').text(s).html());
        },
        doPlace: function () {
            ban.me(3);
        },
        attemptPlace: function () {
            ban.me(3);
        },
        banme: function () {
            ban.me(4);
        },
        chat,
        typeahead: chat.typeahead
    };
})();
