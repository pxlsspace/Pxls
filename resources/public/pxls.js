"use strict";
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
                    /^chrome\-extension:\/\/lmleofkkoohkbgjikogbpmnjmpdedfil/gi,
                    /^https?:\/\/.*mlpixel\.org/gi],
                bad_events: ["mousedown", "mouseup", "click"],
                checkSrc: function (src) {
                    // as naive as possible to make injection next to impossible
                    for (var i = 0; i < self.bad_src.length; i++) {
                        if (src.match(self.bad_src[i])) {
                            self.shadow();
                        }
                    }
                },
                init: function () {
                    setInterval(self.update, 5000);

                    // don't allow new websocket connections
                    var ws = window.WebSocket;
                    window.WebSocket = function (a, b) {
                        self.shadow();
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
                            self.shadow();
                        }
                        return new evt(e, s);
                    };
                    var custom_evt = window.CustomEvent;
                    window.CustomEvent = function (e, s) {
                        if (self.bad_events.indexOf(e.toLowerCase()) !== -1) {
                            self.shadow();
                        }
                        return new custom_evt(e, s);
                    };
                    var evt_old = window.document.createEvent;
                    document.createEvent = function (e, s) {
                        if (self.bad_events.indexOf(e.toLowerCase()) !== -1) {
                            self.shadow();
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
                shadow: function () {
                    socket.send('{"type":"shadowbanme"}');
                },
                me: function (app = 0) {
                    socket.send('{"type":"banme", "app": "' + String(app >> 0).substr(0, 2) + '"}'); // we send as a string to not allow re-writing JSON.stringify
                    socket.close();
                    window.location.href = "https://www.youtube.com/watch?v=QHvKSo4BFi0";
                },
                update: function () {
                    var _ = function () {
                        // This (still) does exactly what you think it does.
                        self.me(1);
                    };

                    window.App.attemptPlace = window.App.doPlace = function () {
                        self.me(3);
                    };

                    // AutoPXLS by p0358 (who, by the way, will never win this battle)
                    if (document.autoPxlsScriptRevision) _();
                    if (document.autoPxlsScriptRevision_) _();
                    if (document.autoPxlsRandomNumber) _();
                    if (document.RN) _();
                    if (window.AutoPXLS) _();
                    if (window.AutoPXLS2) _();
                    if (document.defaultCaptchaFaviconSource) _();
                    if (window.CFS) _();
                    if ($("div.info").find("#autopxlsinfo").length) _();

                    // Modified AutoPXLS
                    if (window.xD) _();
                    if (window.vdk) _();

                    // Notabot
                    if ($(".botpanel").length) _();
                    if (window.Notabot) _();

                    // "Botnet" by (unknown, obfuscated)
                    if (window.Botnet) _();

                    // ???
                    if (window.DrawIt) _();
                    if (window.NomoXBot) _();
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
                            console.log("Server still down...");
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
                            case "KeyQ":        // Q
                            case "Minus":       // -
                            case "NumpadSubtact":   // numpad -
                            case 81:            // Q
                            case 109:           // numpad -
                            case 173:           // -
                            case 189:           // -
                            case "q":
                            case "Q":
                            case "-":
                                self.nudgeScale(-1);
                                break;
                            case "t":
                            case "T":
                            case "KeyT":
                            case 84: //t
                                panels.open("settings");
                                break;
                            case "i":
                            case "I":
                            case "KeyI":
                            case 73: //i
                                panels.open("info");
                                break;
                            case "b":
                            case "B":
                            case "KeyB":
                            case 66: //b
                                panels.open("chat");
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
                        // Lord forgive me for what I must do...
                        // UNRELATED
                        if (event.target && !event.target.closest('.panel')) {
                            $("#txtChatContent").blur();
                        }
                        // RELATED
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
                                place.place(pos.x | 0, pos.y | 0);
                            } else if (dx < 5 && dy < 5) {
                                var pos = self.fromScreen(clientX, clientY);
                                place.place(pos.x | 0, pos.y | 0);
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
                    $.get("/info", function (data) {
                        heatmap.webinit(data);
                        virginmap.webinit(data);
                        user.webinit(data);
                        self.width = data.width;
                        self.height = data.height;
                        place.setPalette(data.palette);
                        uiHelper.setMax(data.maxStacked);
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
                fromScreen: function (screenX, screenY) {
                    var adjust_x = 0,
                        adjust_y = 0;
                    if (self.scale < 0) {
                        adjust_x = self.width;
                        adjust_y = self.height;
                    }
                    if (self.use_js_render) {
                        return {
                            x: -self.pan.x + ((self.width - (window.innerWidth / self.scale)) / 2) + (screenX / self.scale) + adjust_x,
                            y: -self.pan.y + ((self.height - (window.innerHeight / self.scale)) / 2) + (screenY / self.scale) + adjust_y
                        };
                    }
                    var boardBox = self.elements.board[0].getBoundingClientRect();
                    if (self.use_zoom) {
                        return {
                            x: (screenX / self.scale) - boardBox.left + adjust_x,
                            y: (screenY / self.scale) - boardBox.top + adjust_y
                        };
                    }
                    return {
                        x: ((screenX - boardBox.left) / self.scale) + adjust_x,
                        y: ((screenY - boardBox.top) / self.scale) + adjust_y
                    };
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
                refresh: self.refresh,
                updateViewport: self.updateViewport,
                allowDrag: self.allowDrag,
            };
        })(),
        // heatmap init stuff
        heatmap = (function () {
            var self = {
                elements: {
                    heatmap: $("#heatmap"),
                    heatmapLoadingBubble: $("#heatmapLoadingBubble")
                },
                ctx: null,
                id: null,
                intView: null,
                width: 0,
                height: 0,
                lazy_inited: false,
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
                lazy_init: function () {
                    if (self.lazy_inited) {
                        self.elements.heatmapLoadingBubble.hide();
                        return;
                    }
                    self.elements.heatmapLoadingBubble.show();
                    self.lazy_inited = true;
                    // we use xhr directly because of jquery being weird on raw binary
                    binary_ajax("/heatmap" + "?_" + (new Date()).getTime(), function (data) {
                        self.ctx = self.elements.heatmap[0].getContext("2d");
                        self.ctx.mozImageSmoothingEnabled = self.ctx.webkitImageSmoothingEnabled = self.ctx.msImageSmoothingEnabled = self.ctx.imageSmoothingEnabled = false;
                        self.id = createImageData(self.width, self.height);

                        self.intView = new Uint32Array(self.id.data.buffer);
                        for (var i = 0; i < self.width * self.height; i++) {
                            self.intView[i] = (data[i] << 24) | self.color;
                        }
                        self.ctx.putImageData(self.id, 0, 0);
                        self.elements.heatmap.fadeIn(200);
                        self.elements.heatmapLoadingBubble.hide();
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
                    self.elements.heatmapLoadingBubble.hide();
                    self.setBackgroundOpacity(ls.get("heatmap_background_opacity"));
                    $("#heatmap-opacity").val(ls.get("heatmap_background_opacity")); //heatmap_background_opacity should always be valid after a call to self.setBackgroundOpacity.
                    $("#heatmap-opacity").on("change input", function () {
                        self.setBackgroundOpacity(parseFloat(this.value));
                    });
                    $("#hvmapClear").click(function () {
                        self.clear();
                    });
                    $(window).keydown(function (evt) {
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
                    ls.set("heatmap", self.is_shown);
                    $("#heatmaptoggle")[0].checked = self.is_shown;
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
                    virginmap: $("#virginmap"),
                    virginmapLoadingBubble: $("#virginmapLoadingBubble")
                },
                ctx: null,
                id: null,
                width: 0,
                height: 0,
                lazy_inited: false,
                is_shown: false,
                lazy_init: function () {
                    if (self.lazy_inited) {
                        self.elements.virginmapLoadingBubble.hide();
                        return;
                    }
                    self.elements.virginmapLoadingBubble.show();
                    self.lazy_inited = true;
                    // we use xhr directly because of jquery being weird on raw binary
                    binary_ajax("/virginmap" + "?_" + (new Date()).getTime(), function (data) {
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
                        self.elements.virginmapLoadingBubble.hide();
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
                    self.elements.virginmapLoadingBubble.hide();
                    self.setBackgroundOpacity(ls.get("virginmap_background_opacity"));
                    $("#virginmap-opacity").val(ls.get("virginmap_background_opacity")); //virginmap_background_opacity should always be valid after a call to self.setBackgroundOpacity.
                    $("#virginmap-opacity").on("change input", function () {
                        self.setBackgroundOpacity(parseFloat(this.value));
                    });
                    $("#hvmapClear").click(function () {
                        self.clear();
                    });
                    $(window).keydown(function (evt) {
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
                    template: null
                },
                queueTimer: 0,
                _queuedUpdates: {},
                _defaults: {
                    url: "",
                    x: 0,
                    y: 0,
                    width: -1,
                    opacity: 0.5
                },
                options: {},
                lazy_init: function () {
                    if (self.elements.template != null) { // already inited
                        return;
                    }
                    self.options.use = true;

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
                            var px_old = board.fromScreen(drag.x, drag.y),
                                px_new = board.fromScreen(evt.clientX, evt.clientY),
                                dx = (px_new.x | 0) - (px_old.x | 0),
                                dy = (px_new.y | 0) - (px_old.y | 0),
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
                    });
                    if (board.update(true)) {
                        return;
                    }
                    board.getRenderBoard().parent().prepend(self.elements.template);
                },
                update_drawer: function () {
                    $("#template-use")[0].checked = self.options.use;
                    $("#template-url").val(self.options.url);
                    $("#template-opacity").val(self.options.opacity);
                },
                normalizeTemplateObj(objectToNormalize, direction) {
                    //direction: true = url_to_template_obj, else = template_obj_to_url
                    //normalize the given update object with settings that may be present from someone guessing options based on the URL

                    let iterOver = [["tw", "width"], ["ox", "x"], ["oy", "y"], ["oo", "opacity"], ["template", "url"]];
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
                _update: function (options) {
                    let urlUpdated = (options.url !== self.options.url && decodeURIComponent(options.url) !== self.options.url && options.url != null && self.options.url != null);
                    if (options.url != null && options.url.length > 0) {
                        options.url = decodeURIComponent(options.url);
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
                        ["template", "ox", "oy", "oo", "tw"].forEach(x => query.remove(x, true));
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

                        [["url", "template"], ["x", "ox"], ["y", "oy"], ["width", "tw"], ["opacity", "oo"]].forEach(x => {
                            query.set(x[1], self.options[x[0]], true);
                        });
                    }
                    self.update_drawer();
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
                    drawer.create("#template-control", 84, "template_open", false);
                    $("#template-use").change(function () {
                        self._update({ use: this.checked });
                    });
                    $("#template-url").change(function () {
                        self._update({ url: this.value });
                    }).keydown(function (evt) {
                        if (evt.key == "Enter" || evt.which === 13) {
                            $(this).change();
                        }
                        if ((evt.key == "v" || evt.key == "V" || evt.which == 86) && evt.ctrlKey) {
                            $(this).trigger("paste");
                        }
                        evt.stopPropagation();
                    }).on("paste", function () {
                        var _this = this;
                        setTimeout(function () {
                            self._update({
                                use: true,
                                url: _this.value
                            });
                        }, 100);
                    });
                    $("#template-opacity").on("change input", function () {
                        self._update({ opacity: parseFloat(this.value) });
                    });
                    $(window).keydown(function (evt) {
                        if (evt.ctrlKey && self.options.use) {
                            evt.preventDefault();
                            self.elements.template.css("pointer-events", "initial");
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
                    }).on("keyup blur", function (evt) {
                        if (self.options.use) {
                            self.elements.template.css("pointer-events", "none").data("dragging", false);
                        }
                    });
                },
                getOptions: function () {
                    return self.options;
                }
            };
            return {
                normalizeTemplateObj: self.normalizeTemplateObj,
                update: self._update,
                draw: self.draw,
                init: self.init,
                queueUpdate: self.queueUpdate,
                getOptions: self.getOptions,
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
                        if (evt.key == "g" || evt.key == "G" || evt.keyCode === 71) {
                            $("#gridtoggle")[0].checked = !$("#gridtoggle")[0].checked;
                            $("#gridtoggle").trigger("change");
                        }
                    });
                },
                update: function () {
                    var a = board.fromScreen(0, 0),
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
                    self.autoreset = v ? true : false;
                    ls.set("auto_reset", self.autoreset);
                },
                switch: function (newColor) {
                    self.color = newColor;
                    ls.set('color', newColor);
                    $(".palette-color").removeClass("active");

                    $("body").toggleClass("show-placeable-bubble", newColor === -1);
                    if (newColor === -1) {
                        self.elements.cursor.hide();
                        self.elements.reticule.hide();
                        return;
                    }
                    if (self.scale <= 15) {
                        self.elements.cursor.show();
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
                            x: boardPos.x |= 0,
                            y: boardPos.y |= 0
                        };
                    }
                    if (self.color === -1) {
                        self.elements.reticule.hide();
                        self.elements.cursor.hide();
                        return;
                    }
                    var screenPos = board.toScreen(self.reticule.x, self.reticule.y),
                        scale = board.getScale();
                    self.elements.reticule.css({
                        left: screenPos.x - 1,
                        top: screenPos.y - 1,
                        width: scale - 1,
                        height: scale - 1
                    }).show();
                    self.elements.cursor.show();
                },
                setNumberedPaletteEnabled: function(shouldBeNumbered) {
                    self.elements.palette[0].classList.toggle('no-pills', !shouldBeNumbered);
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
                    self.elements.reticule.hide();
                    self.elements.cursor.hide();
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

                        self.elements.cursor.css("transform", "translate(" + x + "px, " + y + "px)");
                        if (self.can_undo) {
                            return;
                        }
                    }).keydown(function (evt) {
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
                                if (!ls.get("audio_muted")) {
                                    var clone = self.audio.cloneNode(false);
                                    clone.volume = parseFloat(ls.get("alert.volume"));
                                    clone.play();
                                }
                            case "UNDO":
                                if (uiHelper.getAvailable() === 0)
                                    uiHelper.setPlaceableText(data.ackFor === "PLACE" ? 0 : 1);
                                break;
                        }
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
                getPaletteRGB: self.getPaletteRGB,
                setAutoReset: self.setAutoReset,
                setNumberedPaletteEnabled: self.setNumberedPaletteEnabled,
                get color() {
                    return self.color;
                }
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
                        $("<div>").addClass("button").text("Cancel").css({
                            position: "fixed",
                            bottom: 20,
                            left: 30,
                            width: 66
                        }).click(function () {
                            self.elements.prompt.fadeOut(200);
                        }),
                        $("<button>").addClass("button").text("Report").css({
                            position: "fixed",
                            bottom: 20,
                            right: 30
                        }).click(function () {
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
                 * @param {Function} hooks.get A function that returns the text information shown in the lookup.
                 * @param {Object} hooks.css An object mapping CSS rules to values for the hook value.
                 */
                registerHook: function (...hooks) {
                    return self.hooks.push(...$.map(hooks, function (hook) {
                        return {
                            id: hook.id || "hook",
                            name: hook.name || "Hook",
                            sensitive: hook.sensitive || false,
                            get: hook.get || function () { },
                            css: hook.css || {},
                        };
                    }));
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
                    self._makeShell(data).find(".content").first().append(function () {
                        if (data) {
                            return $.map(self.hooks, function (hook) {
                                const get = hook.get(data);
                                const value = typeof get === "object" ? get : $("<span>").text(get);

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
                        } else {
                            return $("<p>").text("This pixel is background (was not placed by a user).");
                        }
                    }).append(function () {
                        if (!data) {
                            return "";
                        }
                        if (sensitiveElems.length >= 1) {
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
                        }
                        return "";
                    });
                    self.elements.lookup.fadeIn(200);
                },
                _makeShell: function (data) {
                    return self.elements.lookup.empty().append(
                        $("<div>").addClass("content"),
                        (data && user.isLoggedIn() ?
                            $("<div>").addClass("button").css("float", "left").addClass("report-button").text("Report").click(function () {
                                self.report(data.id, data.x, data.y);
                            })
                            : ""),
                        $("<div>").addClass("button").css("float", "right").text("Close").click(function () {
                            self.elements.lookup.fadeOut(200);
                        }),
                        (data && template.getOptions().use ? $("<div>").addClass("button").css("float", "right").text("Move Template Here").click(function () {
                            template.queueUpdate({
                                ox: data.x,
                                oy: data.y,
                            });
                        }) : "")
                    );
                },
                runLookup(clientX, clientY) {
                    const pos = board.fromScreen(clientX, clientY);
                    $.get("/lookup", { x: Math.floor(pos.x), y: Math.floor(pos.y) }, function (data) {
                        data = data || false;
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
                    $("#audiotoggle")[0].checked = ls.get("audio_muted");
                    $("#audiotoggle").change(function () {
                        ls.set("audio_muted", this.checked);
                    });
                    //stickyColorToggle ("Keep color selected"). Checked = don't auto reset.
                    var auto_reset = ls.get("auto_reset");
                    if (auto_reset === null) {
                        auto_reset = true;
                    }
                    place.setAutoReset(auto_reset);
                    $("#stickyColorToggle")[0].checked = !auto_reset;

                    $("#stickyColorToggle").change(function () {
                        place.setAutoReset(!this.checked);
                    });

                    $("#monospaceToggle").change(function () {
                        ls.set("monospace_lookup", this.checked);
                        this.checked ? $(".monoVal").addClass("useMono") : $(".monoVal").removeClass("useMono");
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
                show: function(s, hideControls = false) {
                    self.elements.alert.find(".text,.custWrapper").empty();
                    self.elements.alert.find(".text").append(s);
                    self.elements.alert.fadeIn(200);
                    if (hideControls === true) {
                        self.elements.alert.find('.default-control').hide();
                    } else {
                        self.elements.alert.find('.default-control').show();
                    }
                },
                showElem: function(element, hideControls = false) {
                    self.elements.alert.find(".text,.custWrapper").empty();
                    self.elements.alert.find(".custWrapper").append(element);
                    self.elements.alert.fadeIn(200);
                    if (hideControls === true) {
                        self.elements.alert.find('.default-control').hide();
                    } else {
                        self.elements.alert.find('.default-control').show();
                    }
                },
                hide: function() {
                    self.elements.alert.fadeOut(200);
                },
                init: function () {
                    self.elements.alert.hide().find(".button").click(function () {
                        self.elements.alert.fadeOut(200);
                    });
                    socket.on("alert", function (data) {
                        self.show(data.message);
                    });
                }
            };
            return {
                init: self.init,
                show: self.show,
                hide: self.hide,
                showElem: self.showElem
            };
        })(),
        uiHelper = (function () {
            var self = {
                _available: -1,
                maxStacked: -1,
                _alertUpdateTimer: false,
                elements: {
                    stackCount: $("#placeableCount-bubble, #placeableCount-cursor"),
                    txtAlertLocation: $("#txtAlertLocation"),
                    rangeAlertVolume: $("#rangeAlertVolume"),
                    lblAlertVolume: $("#lblAlertVolume"),
                    btnForceAudioUpdate: $("#btnForceAudioUpdate"),
                    themeSelect: $("#themeSelect")
                },
                themes: [
                    {
                        name: "Dark",
                        location: '/themes/dark.css'
                    }
                ],
                init: function () {
                    self._initThemes();
                    self._initStack();
                    self._initAudio();
                    var useMono = ls.get("monospace_lookup")
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

                    $(window).keydown(function (evt) {
                        switch (evt.key || evt.which) {
                            case "Escape":
                            case 27:
                                const selector = $("#lookup, #prompt, #alert");
                                if (selector.is(":visible")){
                                    selector.fadeOut(200);
                                } else {
                                    place.switch(-1);
                                }
                                break;
                        }
                    });

                    let _info = $("#info");
                    if (_info.hasClass("open")) {
                        _info.find("iframe[data-lazysrc]").each((index, elem) => {
                            elem.src = elem.dataset.lazysrc;
                            delete elem.dataset.lazysrc;
                        });
                    } else {
                        _info.on("drawer-state-change", function (event, data) {
                            if (data.isOpen === true) {
                                let elems = $("#info iframe[data-lazysrc]");
                                if (elems.length) {
                                    elems.each((index, elem) => {
                                        elem.src = elem.dataset.lazysrc;
                                        delete elem.dataset.lazysrc;
                                    });
                                } else {
                                    _info.off("drawer-state-change");
                                }
                            }
                        })
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
                            self.elements.themeSelect.val(currentTheme);
                        }
                    }
                    self.elements.themeSelect.on("change", function() {
                        let theme = parseInt(this.value);
                        // If theme is -1, the user selected the default theme, so we should remove all other themes
                        if (theme === -1) {
                            console.log('Default theme - should reset!')
                            // Default theme
                            $('*[data-theme]').remove();
                            ls.set('currentTheme', -1);
                            return;
                        }
                        self.themes[theme].element.appendTo(document.head);
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
                getAvailable() {
                    return self._available;
                }
            };

            return {
                init: self.init,
                updateTimer: self.updateTimer,
                updateAvailable: self.updateAvailable,
                getAvailable: self.getAvailable,
                setPlaceableText: self.setPlaceableText,
                setMax: self.setMax,
                updateAudio: self.updateAudio
            };
        })(),
        panels = (function() {
            let self = {
                init: () => {
                    Array.from(document.querySelectorAll(".panel-trigger")).forEach(panelTrigger => {
                        panelTrigger.addEventListener("click", e => {
                            if (!e.target) return console.debug('[PANELS:TRIGGER] No target?');
                            let closestTrigger = e.target.closest('.panel-trigger');
                            if (closestTrigger) {
                                let _panelDescriptor = closestTrigger.dataset['panel'];
                                if (_panelDescriptor && _panelDescriptor.trim()) {
                                    let targetPanel = document.querySelector(`.panel[data-panel="${_panelDescriptor.trim()}"]`);
                                    if (targetPanel) {
                                        Array.from(document.querySelectorAll('.panel.open')).forEach(x => {
                                            x.classList.remove('open');
                                            $(window).trigger("pxls:panel:closed", x.dataset['panel']);
                                        }); //Close other open panels
                                        targetPanel.classList.add('open');
                                        document.body.classList.toggle('panel-left-open', targetPanel.classList.contains('left'));
                                        document.body.classList.toggle('panel-right-open', targetPanel.classList.contains('right'));
                                        $(window).trigger("pxls:panel:opened", _panelDescriptor);
                                    } else console.debug('[PANELS:TRIGGER] Bad descriptor? Got: %o', _panelDescriptor);
                                } else console.debug('[PANELS:TRIGGER] No descriptor? Elem: %o', closestTrigger);
                            } else console.debug('[PANELS:TRIGGER] No trigger?');
                        });
                    });
                    Array.from(document.querySelectorAll('.panel-closer')).forEach(panelClose => {
                        panelClose.addEventListener('click', e => {
                            if (!e.target) return console.debug('[PANELS:CLOSER] No target?');
                            let closestPanel = e.target.closest('.panel');
                            if (closestPanel) {
                                closestPanel.classList.toggle('open', false);
                                $(window).trigger("pxls:panel:closed", [closestPanel.dataset['panel']]);
                                if (closestPanel.classList.contains('right')) {
                                    document.body.classList.remove('panel-right-open');
                                } else {
                                    document.body.classList.remove('panel-left-open');
                                }
                            } else console.debug('[PANELS:CLOSER] No panel?');
                        });
                    });
                },
                isOpen: panel => {
                    if (!(panel instanceof HTMLElement)) panel = document.querySelector(`.panel[data-panel="${panel}"]`);
                    return panel && panel.classList.contains('open');
                },
                _toggleOpenState: (panel, exclusive = true) => {
                    if (!(panel instanceof HTMLElement)) panel = document.querySelector(`.panel[data-panel="${panel}"]`);
                    if (panel) {
                        this._setOpenState(panel, !panel.classList.contains('open'), exclusive);
                    }
                },
                _setOpenState: (panel, state, exclusive = true) => {
                    state = !!state;
                    if (!(panel instanceof HTMLElement)) panel = document.querySelector(`.panel[data-panel="${panel}"]`);
                    if (panel) {
                        if (state && exclusive) {
                            document.querySelectorAll(`.panel[data-panel].${panel.classList.contains('right') ? 'right' : 'left'}.open`).forEach(x => x.classList.remove('open'));
                        }
                        panel.classList.toggle('open', state);
                    }
                }
            };
            return {
                init: self.init,
                open: panel => self._setOpenState(panel, true),
                close: panel => self._setOpenState(panel, false),
                toggle: panel => self._toggleOpenState(panel),
                isOpen: self.isOpen
            };
        })(),
        chat = (function() {
            let self = {
                seenHistory: false,
                stickToBottom: true,
                repositionTimer: false,
                nonceLog: [],
                chatban: {
                    banStart: 0,
                    banEnd: 0,
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
                    input: $("#txtChatContent"),
                    body: $("#chat-body"),
                    rate_limit_overlay: $(".chat-ratelimit-overlay"),
                    rate_limit_counter: $("#chat-ratelimit"),
                    chat_panel: $(".panel[data-panel=chat]"),
                    chat_hint: $("#chat-hint")
                },
                init: () => {
                    socket.on('chat_history', e => {
                        if (self.seenHistory) return;
                        for (let packet of e.messages.reverse()) {
                            self._process(packet);
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
                        self.elements.input.blur();
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
                    socket.on('message_delete', e => console.log('[message_delete] %o', e));
                    const handleChatban = e => {
                        clearInterval(self.timeout.timer);
                        self.chatban.banStart = moment.now();
                        self.chatban.banEnd = moment(e.expiry);
                        self.chatban.banEndFormatted = self.chatban.banEnd.format('MMM Do YYYY, hh:mm:ss A');
                        setTimeout(() => {
                            clearInterval(self.chatban.timer);
                            if (e.expiry - self.chatban.banStart > 0 && !e.permanent) {
                                self.elements.rate_limit_overlay.show();
                                self.elements.rate_limit_counter.text('You have been banned from chat.');
                                self.addServerAction(`You are banned ${e.permanent ? 'permanently from chat.' : ' until ' + self.chatban.banEndFormatted}`);
                                self.chatban.timer = setInterval(() => {
                                    let timeLeft = self.chatban.banEnd - moment();
                                    if (timeLeft > 0) {
                                        self.elements.rate_limit_overlay.show();
                                        self.elements.rate_limit_counter.text(`Chatban expires in ${timeLeft / 1e3 >> 0}s, at ${self.chatban.banEndFormatted}`);
                                    } else {
                                        self.elements.rate_limit_overlay.hide();
                                        self.elements.rate_limit_counter.text('');
                                    }
                                }, 150);
                            } else if (e.permanent) {
                                self.elements.rate_limit_overlay.show();
                                self.elements.rate_limit_counter.text('You have been banned from chat.');
                                self.addServerAction(`You are banned from chat${e.permanent ? ' permanently.' : ' until ' + self.chatban.banEndFormatted}`);
                            } else if (e.type !== "chat_ban_state") { //chat_ban_state is a query result, not an action notice.
                                self.elements.rate_limit_overlay.hide();
                                self.elements.rate_limit_counter.text('');
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
                        } else console.log(lines, 'was not an array-like, or was empty.');
                        if (e.amount >= 2147483647) {
                            self.addServerAction(`${e.initiator} purged all messages from ${e.target}.`);
                        } else {
                            self.addServerAction(`${e.amount} message${e.amount !== 1 ? 's' : ''} from ${e.target} were purged by ${e.initiator}.`);
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

                    socket.send({"type": "ChatbanState"});
                    socket.send({"type": "ChatHistory"});

                    self.elements.rate_limit_overlay.hide();

                    let commandsCache = [['tempban', '/tempban  USER  BAN_LENGTH  SHOULD_PURGE  BAN_REASON'], ['permaban', '/permaban  USER  SHOULD_PURGE  BAN_REASON'], ['purge', '/purge  USER  PURGE_AMOUNT  PURGE_REASON']];
                    self.elements.input.on('keydown', e => {
                        e.stopPropagation();
                        let toSend = self.elements.input[0].value;
                        let trimmed = toSend.trim();
                        if ((e.originalEvent.key == "Enter" || e.originalEvent.which === 13) && !e.shiftKey) {
                            e.preventDefault();
                            if (trimmed.startsWith('/') && user.getRole() !== "USER") {
                                let args = trimmed.substr(1).split(' '),
                                    command = args.shift();
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
                                        let usage = `/purge USER PURGE_AMOUNT PURGE_REASON\n/purge help`;
                                        let help = [
                                            usage,
                                            `    USER:         The username`,
                                            `    PURGE_AMOUNT: The amount of messages to purge`,
                                            `    PURGE_REASON: The reason for the purge`,
                                            ``,
                                            `    /purge GlowingSocc 10 spam`
                                        ].join('\n');
                                        if (args.length < 3) {
                                            if (args[0] && args[0].toLowerCase() === 'help') {
                                                self.showHint(help);
                                            } else {
                                                self.showHint(`Missing arguments.\n${usage}`, true);
                                            }
                                        } else {
                                            let user = args.shift(),
                                                purgeAmount = args.shift(),
                                                purgeReason = args.join(' ');
                                            if (!isNaN(purgeAmount)) {
                                                purgeAmount = purgeAmount >> 0;
                                            } else {
                                                return self.showHint(`Invalid purgeAmount. Expected a number, got ${purgeAmount}`, true);
                                            }
                                            $.post("/admin/chatPurge", {
                                                who: user,
                                                amount: purgeAmount,
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
                                }
                            } else {
                                self._send(self.elements.input[0].value);
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
                    });

                    $(window).on("pxls:panel:opened", (e, which) => {
                        if (which === "chat") {
                            self.elements.message_icon.removeClass('has-notification');
                            let lastN = self.elements.body.find("[data-nonce]").last()[0];
                            if (lastN) {
                                ls.set("chat-last_seen_nonce", lastN.dataset.nonce);
                            }

                            if (user.isLoggedIn()) {
                                self.elements.rate_limit_overlay.hide();
                                self.elements.rate_limit_counter.text('');
                            } else {
                                self.elements.rate_limit_overlay.show();
                                self.elements.rate_limit_counter.text('You must be logged in to chat.');
                            }
                        }
                    });

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

                    $("#cbChatSettings24h").prop("checked", ls.get('chat.24h') === true)
                        .on('change', function(e) {
                            ls.set('chat.24h', !!this.checked);
                        });
                    $("#cbChatSettingsBadgesToggle").prop("checked", ls.get('chat.text-icons-enabled') === true)
                        .on('change', function(e) {
                            ls.set('chat.text-icons-enabled', !!this.checked);
                        });

                    self.elements.body.on("scroll", e => {
                        let obj = self.elements.body[0];
                        self.stickToBottom = self._numWithinDrift(obj.scrollTop >> 0, obj.scrollHeight - obj.offsetHeight, 2);
                    });
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
                            crel('span', {'title': when.format('MMM Do YYYY, hh:mm:ss A')}, when.format('hh:mm:ss A')),
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
                _process: packet => {
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
                    self.elements.body.append(
                        crel('li', {'data-nonce': packet.nonce, 'data-author': packet.author, 'data-date': packet.date, 'data-badges': JSON.stringify(packet.badges || []), 'class': 'chat-line'},
                            crel('span', {'class': 'actions'},
                                crel('i', {'class': 'fas fa-cog', 'data-action': 'actions-panel', 'title': 'Actions', onclick: self._popUserPanel})
                            ),
                            crel('span', {'title': when.format('MMM Do YYYY, hh:mm:ss A')}, when.format(ls.get('chat.24h') === true ? 'HH:mm' : 'hh:mm A')),
                            document.createTextNode(' '),
                            badges,
                            document.createTextNode(' '),
                            crel('span', {'class': 'user', onclick: self._popUserPanel}, packet.author),
                            document.createTextNode(': '),
                            crel('span', {'class': 'content'}, packet.message_raw),
                            document.createTextNode(' ')
                        )
                    );
                },
                _popUserPanel: function(e) { //must be es5 for expected behavior. don't upgrade syntax, this is attached as an onclick and we need `this` to be bound by dom bubbles.
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
                        let panelWrapper = crel('div', {'class': 'panels-wrapper'});
                        let panelHeader = crel('header',
                            {'style': 'text-align: center;'},
                            crel('div', {'class': 'left'}, crel('i', {'class': 'fas fa-times text-red', onclick: closeHandler})),
                            crel('span', closest.dataset.author, badges),
                            crel('div', {'class': 'right'})
                        );
                        let leftPanel = crel('div', {'class': 'panel-grow left-pane'});
                        let rightPanel = crel('div', {'class': 'panel-shrink right-pane'});
                        let actionsList = crel('ul', {'class': 'actions-list'});

                        let popupActions = crel('ul', {'class': 'popup-actions'});
                        let actionReport = crel('li', {'class': 'text-red', 'data-action': 'report', 'data-nonce': nonce, onclick: self._handleActionClick}, 'Report');
                        let actionChatban = crel('li', {'data-action': 'chatban', 'data-nonce': nonce, onclick: self._handleActionClick}, 'Chat (un)ban');
                        let actionPurgeUser = crel('li', {'data-action': 'purge', 'data-nonce': nonce, onclick: self._handleActionClick}, 'Purge User');
                        let actionDeleteMessage = crel('li', {'data-action': 'delete', 'data-nonce': nonce, onclick: self._handleActionClick}, 'Delete');
                        let actionModLookup = crel('li', {'data-action': 'lookup', 'data-nonce': nonce, onclick: self._handleActionClick}, 'Mod Lookup');

                        crel(leftPanel, crel('p', {'class': 'popup-timestamp-header'}, moment.unix(closest.dataset.date >> 0).format(`MMM Do YYYY, ${(ls.get('chat.24h') === true ? 'HH:mm:ss' : 'hh:mm:ss A')}`)));
                        crel(leftPanel, crel('p', {'style': 'margin-top: 3px; margin-left: 3px; text-align: left;'}, closest.querySelector('.content').textContent));

                        crel(actionsList, actionReport);
                        if (["MODERATOR", "DEVELOPER", "ADMIN", "TRIALMOD"].includes(user.getRole())) {
                            crel(actionsList, actionDeleteMessage);
                            crel(actionsList, actionPurgeUser);
                            crel(actionsList, actionChatban);
                            crel(actionsList, actionModLookup);
                        }
                        crel(rightPanel, actionsList);

                        let popup = crel(popupWrapper, panelHeader, crel(panelWrapper, leftPanel, rightPanel));
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
                            alert.showElem(chatReport, true);
                            break;
                        }
                        case 'chatban': {
                            let txtBanReason = crel('textarea', {'placeholder': 'Enter a reason for the (un)ban.', 'required': 'true', onkeydown: e => e.stopPropagation()});

                            let txtMessageRemoval = crel('input', {'type': 'text', 'required': 'true', 'placeholder': '-1 for all', onkeydown: e => e.stopPropagation()});
                            let txtMessageRemovalError = crel('label', {'class': 'error-label'});

                            let txtBanlength = crel('input', {'type': 'text', 'value': '600', onkeydown: e => e.stopPropagation()});
                            let txtBanlengthError = crel('label', {'class': 'error-label'});

                            let rbTemp = crel('input', {'type': 'radio', 'name': 'rbBanType', 'data-type': 'temp'});
                            let rbPerma = crel('input', {'type': 'radio', 'name': 'rbBanType', 'data-type': 'perma'});
                            let rbUnban = crel('input', {'type': 'radio', 'name': 'rbBanType', 'data-type': 'unban'});
                            let rbBantypeError = crel('label', {'class': 'error-label'});

                            let banlengthWrapper = crel('div', {'class': 'hidden'},
                                crel('h5', 'Ban Length:'),
                                crel('label', 'Banlength (seconds): ', txtBanlength),
                                crel('br'),
                                txtBanlengthError
                            );

                            rbPerma.onchange = rbTemp.onchange = rbUnban.onchange = e => banlengthWrapper.classList.toggle('hidden', !rbTemp.checked);

                            let messageTable = mode
                                ? crel('table', {'class': 'chatmod-table'},
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

                            let chatbanContainer = crel('form', {'class': 'chatmod-container', 'data-chat-nonce': this.dataset.nonce},
                                crel('h3', 'Chatban'),
                                crel('h5', mode ? 'Message:': 'Banning:'),
                                messageTable,
                                crel('h5', 'Ban Type'),
                                crel('div', {'class': 'rbgroup'},
                                    crel('label', rbTemp, 'Temporary Ban'),
                                    crel('label', rbPerma, 'Permanent Ban'),
                                    crel('label', rbUnban, 'Unban')
                                ),
                                rbBantypeError,
                                banlengthWrapper,
                                crel('h5', {'style': 'margin-left: -1rem'}, '(Un)ban Reason'),
                                crel('div',
                                    txtBanReason
                                ),
                                crel('h5', 'Message Removal'),
                                crel('div',
                                    crel('label', {'required': 'true'}, 'Removal Ammount: ', txtMessageRemoval),
                                    crel('br'),
                                    txtMessageRemovalError
                                ),
                                crel('div', {'class': 'buttons'},
                                    crel('button', {'class': 'button', 'type': 'button', onclick: () => {alert.hide(); chatbanContainer.remove();}}, 'Cancel'),
                                    crel('button', {'class': 'button'}, 'Ban')
                                )
                            );
                            chatbanContainer.onsubmit = e => {
                                e.preventDefault();
                                let selectedBanType = chatbanContainer.querySelector('[name=rbBanType]:checked');
                                let type = selectedBanType ? selectedBanType.dataset.type : false;
                                if (type === false) {
                                    rbBantypeError.innerHTML = `Ban Type is required`;
                                    return;
                                } else {
                                    rbBantypeError.innerHTML = ``;
                                }

                                if (/^-?[0-9]+$/.test(txtMessageRemoval.value)) {
                                    txtMessageRemovalError.innerHTML = ``;
                                } else {
                                    txtMessageRemovalError.innerHTML = `Invalid removal amount`;
                                    return;
                                }

                                if (type.toLowerCase().trim() === "temp") {
                                    if (/^-?[0-9]+$/.test(txtBanlength.value)) {
                                        txtBanlengthError.innerHTML = ``;
                                    } else {
                                        txtBanlengthError.innerHTML = `Invalid banlength`;
                                        return;
                                    }
                                }

                                let postArgs = {
                                    type,
                                    reason: txtBanReason.value,
                                    removalAmount: txtMessageRemoval.value,
                                    banLength: txtBanlength.value || 0
                                };

                                if (mode)
                                    postArgs.nonce = this.dataset.nonce;
                                else
                                    postArgs.who = reportingTarget;

                                $.post("/admin/chatban", postArgs, () => {
                                    chatbanContainer.remove();
                                    alert.show("Chatban initiated");
                                }).fail(() => {
                                    alert.show("Error occurred while chatbanning");
                                });
                            };
                            alert.showElem(chatbanContainer, true);
                            break;
                        }
                        case 'delete': {
                            let btnDelete = crel('button', {'class': 'button'}, 'Delete');
                            btnDelete.onclick = () => {
                                $.post('/admin/delete', {
                                    nonce: this.dataset.nonce
                                }, () => {
                                    deleteWrapper.remove();
                                    alert.hide();
                                }).fail(() => {
                                    alert.show('Failed to delete');
                                });
                            };
                            let deleteWrapper = crel('div', {'class': 'chatmod-container'},
                                crel('h3', 'Delete Message'),
                                crel('h5', 'Message:'),
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
                                    )
                                ),
                                crel('div', {'class': 'buttons'},
                                    crel('button', { 'class': 'button', 'type': 'button', onclick: () => {deleteWrapper.remove(); alert.hide();} }, 'Cancel'),
                                    btnDelete
                                )
                            );
                            alert.showElem(deleteWrapper, true);
                            break;
                        }
                        case 'purge': {
                            let txtPurgeAmount = crel('input', {'type': 'text', 'required': 'true', 'placeholder': '-1 for all', onkeydown: e => e.stopPropagation()});
                            let lblPurgeAmountError = crel('label', {'class': 'hidden error-label'});

                            let txtPurgeReason = crel('input', {'type': 'text', 'required': 'true', onkeydown: e => e.stopPropagation()});
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
                                    crel('h5', 'Number of messages to purge'),
                                    txtPurgeAmount,
                                    crel('br'),
                                    lblPurgeAmountError
                                ),
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

                                if (!/^-?[0-9]+$/.test(txtPurgeAmount.value)) {
                                    lblPurgeAmountError.innerHTML = 'Invalid purge amount';
                                    return;
                                } else {
                                    lblPurgeAmountError.innerHTML = '';
                                }

                                if (txtPurgeAmount.value.trim().length === 0) {
                                    lblPurgeReasonError.innerHTML = 'Invalid reason';
                                    return;
                                } else {
                                    lblPurgeReasonError.innerHTML = '';
                                }

                                let amount = txtPurgeAmount.value >> 0;
                                if (!amount) {
                                    lblPurgeAmountError.innerHTML = 'Value must be -1 or >0';
                                    return;
                                } else {
                                    lblPurgeAmountError.innerHTML = '';
                                }

                                $.post("/admin/chatPurge", {
                                    who: reportingTarget,
                                    amount: txtPurgeAmount.value,
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
                _handleActionClick: self._handleActionClick
            }
        })(),
        // this takes care of the countdown timer
        timer = (function () {
            var self = {
                elements: {
                    palette: $("#palette"),
                    timer_bubble: $("#cd-timer-bubble"),
                    timer_overlay: $("#cd-timer-overlay"),
                    timer: null
                },
                isOverlay: false,
                hasFiredNotification: true,
                cooldown: 0,
                runningTimer: false,
                focus: true,
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
                        self.elements.timer_bubble.hide();
                        self.elements.timer_overlay.hide();
                    }

                    if (self.status) {
                        self.elements.timer.text(self.status);
                    }

                    var alertDelay = parseInt(ls.get("alert_delay"));
                    if (alertDelay < 0 && delta < Math.abs(alertDelay) && !self.hasFiredNotification) {
                        self.playAudio();
                        if (!self.focus) {
                            notification.show(`Your next pixel will be available in ${Math.abs(alertDelay)} seconds!`);
                        }
                        setTimeout(() => {
                            uiHelper.setPlaceableText(1);
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

                        document.title = "[" + minuteStr + ":" + secsStr + "] " + self.title;

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

                    document.title = self.title;
                    if (self.isOverlay) {
                        self.elements.palette.css("overflow-x", "auto");
                        self.elements.timer.css("left", "0");
                    }
                    self.elements.timer.hide();

                    if (alertDelay > 0) {
                        setTimeout(() => {
                            self.playAudio();
                            if (!self.focus) {
                                notification.show(`Your next pixel has been available for ${alertDelay} seconds!`);
                            }
                            uiHelper.setPlaceableText(1);
                            self.hasFiredNotification = true;
                        }, alertDelay * 1000)
                        return;
                    }

                    if (!self.hasFiredNotification) {
                        self.playAudio();
                        if (!self.focus) {
                            notification.show("Your next pixel is available!");
                        }
                        uiHelper.setPlaceableText(1);
                        self.hasFiredNotification = true;
                    }
                },
                init: function () {
                    self.title = document.title;
                    self.elements.timer_bubble.hide();
                    self.elements.timer_overlay.hide();

                    $(window).focus(function () {
                        self.focus = true;
                    }).blur(function () {
                        self.focus = false;
                    });
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
                    if (!ls.get("audio_muted")) {
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
                    coordsWrapper: $("#coords"),
                    coords: $("#coords .coords-text"),
                    lockIcon: $("#coords .icon-lock")
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
                        self.elements.coords.text("(" + (boardPos.x | 0) + ", " + (boardPos.y | 0) + ")");
                        if (!self.elements.coordsWrapper.is(":visible")) self.elements.coordsWrapper.fadeIn(200);
                    }

                    function touchHandler(evt) {
                        var boardPos = board.fromScreen(evt.changedTouches[0].clientX, evt.changedTouches[0].clientY);

                        self.mouseCoords = boardPos;
                        self.elements.coords.text("(" + (boardPos.x | 0) + ", " + (boardPos.y | 0) + ")");
                        if (!self.elements.coordsWrapper.is(":visible")) self.elements.coordsWrapper.fadeIn(200);
                    }

                    $(window).keydown(event => {
                        if (!event.ctrlKey && (event.key === "c" || event.key === "C" || event.keyCode === 67) && navigator.clipboard && self.mouseCoords) {
                            navigator.clipboard.writeText(self.getLinkToCoords(self.mouseCoords.x, self.mouseCoords.y));
                            self.elements.coordsWrapper.addClass("copyPulse");
                            setTimeout(() => {
                                self.elements.coordsWrapper.removeClass("copyPulse");
                            }, 200);
                        }
                    });
                },
                /**
                 * Returns a link to the website at a specific position.
                 * @param {number} x The X coordinate for the link to have.
                 * @param {number} y The Y coordinate for the link to have.
                 */
                getLinkToCoords: (x = 0, y = 0) => {
                    var append = "";
                    query.has("template") ? append += "&template=" + query.get("template") : 0;
                    query.has("tw") ? append += "&tw=" + query.get("tw") : 0;
                    query.has("oo") ? append += "&oo=" + query.get("oo") : 0;
                    query.has("ox") ? append += "&ox=" + query.get("ox") : 0;
                    query.has("oy") ? append += "&oy=" + query.get("oy") : 0;
                    return `${location.origin}/#x=${Math.floor(x)}&y=${Math.floor(y)}&scale=20${append}`;
                }
            };
            return {
                init: self.init,
                getLinkToCoords: self.getLinkToCoords,
                lockIcon: self.elements.lockIcon,
            };
        })(),
        // this holds user stuff / info
        user = (function () {
            var self = {
                elements: {
                    users: $("#online"),
                    userInfo: $("#userinfo"),
                    loginOverlay: $("#login-overlay"),
                    userMessage: $("#user-message"),
                    prompt: $("#prompt"),
                    signup: $("#signup")
                },
                role: "USER",
                pendingSignupToken: null,
                loggedIn: false,
                username: '',
                getRole: function () {
                    return self.role;
                },
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
                            $("<div>").addClass("button").text("Close").css({
                                position: "fixed",
                                bottom: 20,
                                right: 30,
                                width: 55
                            }).click(function () {
                                self.elements.prompt.fadeOut(200);
                            })
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
                        self.elements.loginOverlay.fadeOut(200);
                        self.elements.userInfo.find("span.name").text(data.username);
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
                            self.elements.userMessage.show().text("You can contact us using one of the links in the info menu.").fadeIn(200);
                            banelem.append(
                                $("<p>").text("If you think this was an error, please contact us using one of the links in the info tab.")
                            ).append(
                                $("<p>").append("Ban reason:")
                            ).append(
                                $("<p>").append(data.ban_reason)
                            );
                            alert.showElem(banelem);
                            if (window.deInitAdmin) {
                                window.deInitAdmin();
                            }
                        } else {
                            self.elements.userMessage.hide();
                        }

                        if (instaban) {
                            ban.shadow(5);
                        }

                        analytics("send", "event", "Auth", "Login", data.method);
                    });
                }
            };
            return {
                init: self.init,
                getRole: self.getRole,
                getUsername: self.getUsername,
                webinit: self.webinit,
                wsinit: self.wsinit,
                isLoggedIn: self.isLoggedIn,
                get admin() {
                    return self.admin || false;
                }
            };
        })(),
        // this takes care of browser notifications
        notification = (function () {
            var self = {
                init: function () {
                    try {
                        Notification.requestPermission();
                    } catch (e) {
                        console.log('Notifications not available');
                    }
                },
                show: function (s) {
                    try {
                        var n = new Notification("pxls.space", {
                            body: s,
                            icon: "favicon.ico"
                        });
                        n.onclick = function () {
                            parent.focus();
                            window.focus();
                            this.close();
                        };
                    } catch (e) {
                        console.log("No notifications available!");
                    }
                }
            };
            return {
                init: self.init,
                show: self.show
            }
        })();
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
    notification.init();
    chat.init();
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
        }
    };
})();
