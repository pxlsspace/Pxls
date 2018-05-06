"use strict";
window.App = (function () {
    // first we define the global helperfunctions and figure out what kind of settings our browser needs to use
    var storageFactory = function(storageType, prefix, exdays) {
            var getCookie = function(c_name) {
                var i, x, y, ARRcookies = document.cookie.split(";");
                    for (i = 0; i < ARRcookies.length; i++) {
                        x = ARRcookies[i].substr(0, ARRcookies[i].indexOf("="));
                        y = ARRcookies[i].substr(ARRcookies[i].indexOf("=") + 1);
                        x = x.replace(/^\s+|\s+$/g,"");
                        if (x == c_name){
                            return unescape(y);
                        }
                }
            },
            setCookie = function(c_name, value, exdays) {
                var exdate = new Date(),
                    c_value = escape(value);
                exdate.setDate(exdate.getDate() + exdays);
                c_value += ((exdays===null) ? '' : '; expires=' + exdate.toUTCString());
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
                        } catch(e) {
                            this.haveSupport = false;
                        }
                    }
                    return this.haveSupport;
                },
                get: function(name) {
                    var s;
                    if (this.support()) {
                        s = storageType.getItem(name)
                    } else {
                        s = getCookie(prefix+name);
                    }
                    if (s === undefined) {
                        s = null;
                    }
                    try {
                        return JSON.parse(s);
                    } catch(e) {
                        return null;
                    }
                },
                set: function(name, value) {
                    value = JSON.stringify(value);
                    if (this.support()) {
                        storageType.setItem(name, value);
                    } else {
                        setCookie(prefix+name, value, exdays)
                    }
                },
                remove: function(name) {
                    if (this.support()) {
                        storageType.removeItem(name);
                    } else {
                        setCookie(prefix+name, '', -1);
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
        createImageData = function(w, h) {
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
        have_image_rendering = (function() {
            var checkImageRendering = function(prefix, crisp, pixelated, optimize_contrast){
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
            ('' + (/CPU.*OS ([0-9_]{1,5})|(CPU like).*AppleWebKit.*Mobile/i.exec(navigator.userAgent) || [0,''])[1])
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
        query = (function() {
            var self = {
                params: {},
                initialized: false,
                _trigger: function(propName, oldValue, newValue) {
                    $(window).trigger("pxls:queryUpdated", [propName, oldValue, newValue]); //window.on("queryUpdated", (event, propName, oldValue, newValue) => {...});
                    //this will cause issues if you're not paying attention. always check for `newValue` to be null in the event of a deleted key.
                },
                _update: function(fromEvent) {
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
                setIfDifferent: function() {
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
                            window.onhashchange = function() {
                                self._update(true);
                            };
                        }
                    }
                },
                has: function(key) {
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
                                s += "="+toSet;
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
        ban = (function() {
            var self = {
                bad_src: [/^https?:\/\/[^\/]*raw[^\/]*git[^\/]*\/(metonator|Deklost|NomoX|RogerioBlanco)/gi,
                        /^chrome\-extension:\/\/lmleofkkoohkbgjikogbpmnjmpdedfil/gi,
                        /^https?:\/\/.*mlpixel\.org/gi],
                bad_events: ["mousedown", "mouseup", "click"],
                checkSrc: function(src) {
                    // as naive as possible to make injection next to impossible
                    for (var i = 0; i < self.bad_src.length; i++) {
                        if (src.match(self.bad_src[i])) {
                            self.shadow();
                        }
                    }
                },
                init: function() {
                    setInterval(self.update, 5000);

                    // don't allow new websocket connections
                    var ws = window.WebSocket;
                    window.WebSocket = function (a, b) {
                        self.shadow();
                        return new ws(a, b);
                    };

                    // don't even try to generate mouse events. I am being nice
                    window.MouseEvent = function () {
                        self.me();
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
                me: function () {
                    socket.send('{"type":"banme"}'); // we send as a string to not allow re-writing JSON.stringify
                    socket.close();
                    window.location.href = "https://www.youtube.com/watch?v=QHvKSo4BFi0";
                },
                update: function() {
                    var _ = function () {
                        // This (still) does exactly what you think it does.
                        self.me();
                    };

                    window.App.attemptPlace = window.App.doPlace = _;

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

                    // Chrome extension (PXLS RUS MOD)
                    if ($("div:contains(Настройки)").length) _();

                    // "Botnet" by (unknown, obfuscated)
                    if (window.Botnet) _();

                    // ???
                    if (window.DrawIt) _();
                    if (window.NomoXBot) _();
                }
            };
            return {
                init: self.init,
                me: self.me
            };
        })(),
        // this object is takes care of the websocket connection
        socket = (function() {
            var self = {
                ws: null,
                ws_constructor: WebSocket,
                hooks: [],
                wps: WebSocket.prototype.send, // make sure we have backups of those....
                wpc: WebSocket.prototype.close,
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
                reconnectSocket: function() {
                    self.ws.onclose = function(){};
                    self.connectSocket();
                },
                connectSocket: function() {
                    var l = window.location,
                        url = ( (l.protocol === "https:") ? "wss://" : "ws://") + l.host + l.pathname + "ws";
                    self.ws = new self.ws_constructor(url);
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
                        self.ws.onclose = function () {};
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
                    self.ws.send = self.wps;
                    if (typeof s == "string") {
                        self.ws.send(s);
                    } else {
                        self.ws.send(JSON.stringify(s));
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
        board = (function() {
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
                    handler: function(args) { //self.holdTimer.handler
                        self.holdTimer.id = -1;
                        lookup.runLookup(args.x, args.y);
                    }
                },
                centerOn: function (x, y) {
                    self.pan.x = (self.width / 2 - x);
                    self.pan.y = (self.height / 2 - y);
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
                        switch(evt.key || evt.keyCode) {
                            case "ArrowUp":
                            case 87:
                            case 38:
                                self.pan.y += 100 / self.scale;
                                break;
                            case "ArrowRight":
                            case 68:
                            case 39:
                                self.pan.x -= 100 / self.scale;
                                break;
                            case "ArrowDown":
                            case 83:
                            case 40:
                                self.pan.y -= 100 / self.scale;
                                break;
                            case "ArrowLeft":
                            case 65:
                            case 37:
                                self.pan.x += 100 / self.scale;
                                break;
                            case "=":
                            case 187:
                            case 69:
                            case 171:
                                self.nudgeScale(1);
                                break;
                            case "-":
                            case 189:
                            case 81:
                            case 173:
                                self.nudgeScale(-1);
                                break;
                            case "p":
                            case 80:
                                self.save();
                                break;
                            case "l":
                            case 76:
                                self.allowDrag = !self.allowDrag;
                                break;
                        }
                        self.pannedWithKeys = true;
                        self.update();
                    });

                    self.elements.container[0].addEventListener("wheel", function(evt) {
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
                    }, {passive: true});

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
                    self.elements.board_render[0].addEventListener("touchstart", handleInputDown, {passive: false});
                    self.elements.board_render[0].addEventListener("touchmove", handleInputMove, {passive: false});

                    function handleInputDown(event) {
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
                            self.holdTimer.id = setTimeout(self.holdTimer.handler, self.holdTimer.holdTimeout, {x: clientX, y: clientY});
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
                        if (event.shiftKey === true) return;
                        if (self.holdTimer.id !== -1) {
                            clearTimeout(self.holdTimer.id);
                        }
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
                        if (dx < 5 && dy < 5 && (event.button === 0 || touch) && downDelta < 500) {
                            var pos = self.fromScreen(clientX, clientY);
                            place.place(pos.x | 0, pos.y | 0);
                        }
                        downDelta = 0;
                    }
                },
                init: function () {
                    $(window).on("pxls:queryUpdated", (evt, propName, oldValue, newValue) => {
                        switch(propName.toLowerCase()) {
                            case "x":
                            case "y":
                                board.centerOn(query.get("x") >> 0, query.get("y") >> 0);
                                break;
                            case "scale":
                                board.setScale(newValue >> 0);
                                break;

                            case "template":
                                template.queueUpdate({template: newValue, use: newValue !== null});
                                break;
                            case "ox":
                                template.queueUpdate({ox: newValue === null ? null : newValue >> 0});
                                break;
                            case "oy":
                                template.queueUpdate({oy: newValue === null ? null : newValue >> 0});
                                break;
                            case "tw":
                                template.queueUpdate({tw: newValue === null ? null : newValue >> 0});
                                break;
                            case "oo":
                                let parsed = parseFloat(newValue);
                                if (!Number.isFinite(parsed)) parsed = null;
                                template.queueUpdate({oo: parsed === null ? null : parsed});
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
                },
                start: function () {
                    $.get("/info", function (data) {
                        heatmap.webinit(data);
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
                                    self.elements.container.css("transform", "rotate("+degree+"deg)");
                                    window.requestAnimationFrame(spiiiiiin);
                                };
                            window.requestAnimationFrame(spiiiiiin);
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
                            transform: "translate(" + self.pan.x + "px, " + self.pan.y + "px)"
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
                setScale: function(scale) {
                    if (scale > 50) scale = 50;
                    else if (scale <= 0) scale = 0.5; //enforce the [0.5, 50] limit without blindly resetting to 0.5 when the user was trying to zoom in farther than 50x
                    self.scale = scale;
                    self.update();
                },
                nudgeScale: function (adj) {
                    var oldScale = Math.abs(self.scale),
                        sign = Math.sign(self.scale);
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
                            self.scale = Math.round(Math.min(50, oldScale * 1.25));
                        }
                    }
                    self.scale *= sign;
                    self.update();
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
                        self.intView[y*self.width + x] = 0x00000000;
                    } else {
                        self.intView[y*self.width + x] = self.rgbPalette[c];
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
                    a.href = self.elements.board[0].toDataURL("image/png");
                    a.download = (new Date()).toISOString().replace(/^(\d+-\d+-\d+)T(\d+):(\d+):(\d).*$/,"pxls canvas $1 $2.$3.$4.png");
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
                setPixel: self.setPixel,
                fromScreen: self.fromScreen,
                toScreen: self.toScreen,
                save: self.save,
                centerOn: self.centerOn,
                getRenderBoard: self.getRenderBoard,
                refresh: self.refresh
            };
        })(),
        // heatmap init stuff
        heatmap = (function() {
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
                clear: function() {
                    if (ls.get("hm_clearable") === true) {
                        self._clear();
                    }
                },
                _clear: function() {
                    for (var i = 0; i < self.width * self.height; i++) {
                        self.intView[i] = 0;
                    }
                    self.ctx.putImageData(self.id, 0, 0);
                },
                setBackgroundOpacity: function(opacity) {
                    if (typeof(opacity) === "string") {
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
                    $("#heatmap-opacity").on("change input", function() {
                        self.setBackgroundOpacity(parseFloat(this.value));
                    });
                    $("#heatmapClearable")[0].checked = ls.get("hm_clearable");
                    $("#heatmapClearable").change(function () {
                        ls.set("hm_clearable", this.checked);
                    });
                    $(window).keydown(function (evt) {
                        if (evt.key == "o" || evt.which == 79) { //O key
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
                        if (e.key == "h" || e.which == 72) { // h key
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
                            self._update({x: newX, y: newY});
                            query.set({ox: newX, oy: newY}, true);
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
                _update: function(options) {
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

                        [["url", "template"],["x", "ox"],["y", "oy"],["width", "tw"],["opacity", "oo"]].forEach(x => {
                            query.set(x[1], self.options[x[0]], true);
                        });
                    }
                    self.update_drawer();
                },
                disableTemplate: function() {
                    self._update({url: null});
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
                        self._update({use: this.checked});
                    });
                    $("#template-url").change(function () {
                        self._update({url: this.value});
                    }).keydown(function (evt) {
                        if (evt.key == "Enter" || evt.which === 13) {
                            $(this).change();
                        }
                        if ((evt.key == "p" || evt.which == 86) && evt.ctrlKey) {
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
                        self._update({opacity: parseFloat(this.value)});
                    });
                    $(window).keydown(function (evt) {
                        if (evt.ctrlKey && self.options.use) {
                            evt.preventDefault();
                            self.elements.template.css("pointer-events", "initial");
                        }
                        let newOpacity = 0;
                        switch(evt.key || evt.which) {
                            case "PageUp":
                            case 33:
                                newOpacity = Math.min(1, self.options.opacity+0.1);
                                self._update({opacity: newOpacity});
                                break;
                            case "PageDown":
                            case 34:
                                newOpacity = Math.max(0, self.options.opacity-0.1);
                                self._update({opacity: newOpacity});
                                break;
                            case "v":
                            case "86":
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
                }
            };
            return {
                normalizeTemplateObj: self.normalizeTemplateObj,
                update: self._update,
                draw: self.draw,
                init: self.init,
                queueUpdate: self.queueUpdate
            };
        })(),
        // here all the grid stuff happens
        grid = (function() {
            var self = {
                elements: {
                    grid: $("#grid")
                },
                init: function () {
                    self.elements.grid.hide();
                    $("#gridtoggle")[0].checked = ls.get("view_grid");
                    $("#gridtoggle").change(function () {
                        ls.set("view_grid", this.checked);
                        self.elements.grid.fadeToggle({duration: 100});
                    });
                    if (ls.get("view_grid")) {
                        self.elements.grid.fadeToggle({duration: 100});
                    }
                    $(document.body).on("keydown", function (evt) {
                        if (evt.key == "g" || evt.keyCode === 71) {
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
        place = (function() {
            var self = {
                elements: {
                    palette: $("#palette"),
                    cursor: $("#cursor"),
                    reticule: $("#reticule"),
                    undo: $("#undo")
                },
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
                    $($(".palette-color")[newColor]).addClass("active");
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
                setPalette: function (palette) {
                    self.palette = palette;
                    self.elements.palette.find(".palette-color").remove().end().append(
                        $.map(self.palette, function(p, idx) {
                            return $("<div>")
                                .addClass("palette-color")
                                .addClass("ontouchstart" in window ? "touch" : "no-touch")
                                .css("background-color", self.palette[idx])
                                .click(function () {
                                    if (ls.get("auto_reset") === false || timer.cooledDown()) {
                                        self.switch(idx);
                                    }
                                });
                        })
                    );
                },
                can_undo: false,
                undo: function (evt) {
                    evt.stopPropagation();
                    socket.send({type: 'undo'});
                    self.can_undo = false;
                    self.elements.undo.hide();
                },
                init: function () {
                    self.elements.reticule.hide();
                    self.elements.cursor.hide();
                    self.elements.undo.hide();
                    board.getRenderBoard().on("pointermove mousemove", function (evt) {
                        self.update(evt.clientX, evt.clientY);
                    });
                    $(window).on("pointermove mousemove touchstart touchmove", function (evt) {
                        if (self.color === -1) {
                            return;
                        }
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
                        self.elements.undo.css("transform", "translate(" + x + "px, " + y + "px)");
                    }).keydown(function (evt) {
                        if (self.can_undo && (evt.key == "z" || evt.keyCode == 90) && evt.ctrlKey) {
                            self.undo(evt);
                        }
                    }).on("touchstart", function (evt) {
                        if (self.color === -1 || self.can_undo) {
                            return;
                        }
                        self.elements.undo.css("transform", "translate(" + evt.originalEvent.changedTouches[0].clientX + "px, " + evt.originalEvent.changedTouches[0].clientY + "px)");
                    });
                    socket.on("pixel", function (data) {
                        $.map(data.pixels, function (px) {
                            board.setPixel(px.x, px.y, px.color, false);
                        });
                        board.refresh();
                        board.update(true);
                    });
                    socket.on("ACK", function(data) {
                        switch(data.ackFor) {
                            case "PLACE":
                                if (!ls.get("audio_muted")) {
                                    self.audio.cloneNode(false).play();
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
                        self.elements.undo.show();
                        self.can_undo = true;
                        setTimeout(function () {
                            self.elements.undo.hide();
                            self.can_undo = false;
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
                },
                hexToRgb: function(hex) {
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
                setAutoReset: self.setAutoReset
            };
        })(),
        // this is the user lookup helper
        lookup = (function() {
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
                        $("<p>").addClass("text").text("message:"),
                        $("<textarea>").css({
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
                        $("<div>").addClass("button").text("Report").css({
                            position: "fixed",
                            bottom: 20,
                            right: 30
                        }).click(function () {
                            var msg = self.elements.prompt.find("textarea").val().trim();
                            if (!msg) {
                                alert.show("You must enter a message!");
                                return;
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
                create: function (data) {
                    self._makeShell().find(".content").first().append(
                        data ? $.map([
                            ["Coords", "coords"],
                            ["Username", "username"],
                            ["Time", "time_str"],
                            ["Total Pixels", "pixel_count"],
                            ["Alltime Pixels", "pixel_count_alltime"]
                        ], function (o) {
                            return $("<div>").append(
                                $("<b>").text(o[0]+": "),
                                $("<span>").text(data[o[1]])
                            );
                        }) : $("<p>").text("This pixel is background (was not placed by a user).")
                    );
                    self.elements.lookup.fadeIn(200);
                },
                _makeShell: function(allowReport=true) {
                    return self.elements.lookup.empty().append(
                        $("<div>").addClass("content"),
                        (allowReport && user.isLoggedIn() ?
                            $("<div>").addClass("button").css("float", "left").addClass("report-button").text("Report").click(function () {
                                self.report(data.id, data.x, data.y);
                            })
                        : ""),
                        $("<div>").addClass("button").css("float", "right").text("Close").click(function () {
                            self.elements.lookup.fadeOut(200);
                        })
                    );
                },
                runLookup(clientX, clientY) {
                    const pos = board.fromScreen(clientX, clientY);
                    $.get("/lookup", {x: Math.floor(pos.x), y: Math.floor(pos.y)}, function (data) {
                        if (data) {
                            data.coords = "(" + data.x + ", " + data.y + ")";
                            var delta = ((new Date()).getTime() - data.time) / 1000;
                            if (delta > 24*3600) {
                                data.time_str = (new Date(data.time)).toLocaleString();
                            } else if (delta < 5) {
                                data.time_str = 'just now';
                            } else {
                                var secs = Math.floor(delta % 60),
                                    secsStr = secs < 10 ? "0" + secs : secs,
                                    minutes = Math.floor((delta / 60)) % 60,
                                    minuteStr = minutes < 10 ? "0" + minutes : minutes,
                                    hours = Math.floor(delta / 3600),
                                    hoursStr = hours < 10 ? "0" + hours : hours;
                                data.time_str = hoursStr+":"+minuteStr+":"+secsStr+" ago";
                            }
                        }
                        data = data || false;
                        if (self.handle) {
                            self.handle(data);
                        } else {
                            self.create(data);
                        }
                    }).fail(function () {
                        self._makeShell(false).find(".content").first().append($("<p>").css("color", "#c00").text("An error occurred, you may be attempting to look up users too fast. Please try again in 60 seconds"));
                        self.elements.lookup.fadeIn(200);
                    });
                },
                init: function () {
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
                runLookup: self.runLookup,
                clearHandle: self.clearHandle
            };
        })(),
        // helper object for drawers
        drawer = (function() {
            var self = {
                elements: {
                    container: $("#drawers"),
                    opener: $("#drawers-opener")
                },
                create: function (html_class, keycode, localstorage, open) {
                    var elem = $(html_class);
                    $(html_class+" > .open").click(function () {
                        elem.toggleClass("open");
                        ls.set(localstorage, elem.hasClass("open") ^ open);
                    });
                    $(html_class+" .close").click(function () {
                        elem.removeClass("open");
                        ls.set(localstorage, false ^ open);
                    });
                    if (ls.get(localstorage) ^ open) {
                        elem.addClass("open");
                    }
                    $(document.body).keydown(function (evt) {
                        if (evt.keyCode === keycode) {
                            elem.toggleClass("open");
                            ls.set(localstorage, elem.hasClass("open") ^ open);
                        }
                    });
                },
                updateDropdown: function () {
                    $("#drawers-opener-content").empty().append(
                        $("#drawers > .drawer").map(function () {
                            var _self = $(this);
                            return $("<div>").text(_self.find(".open").text()).click(function (evt) {
                                evt.stopPropagation();
                                _self.toggleClass("open");
                                self.elements.opener.removeClass("open");
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
        info = (function() {
            var self = {
                init: function () {
                    drawer.create("#info", 73, "info_closed", true);
                    $("#audiotoggle")[0].checked = ls.get("audio_muted");
                    $("#audiotoggle").change(function () {
                        ls.set("audio_muted", this.checked);
                    });
                    $("#rules-button").click(function (evt) {
                        evt.stopPropagation();
                        alert.show($("#rules-content").html());
                    });
                    //stickyColorToggle ("Keep color selected"). Checked = don't auto reset.
                    var auto_reset = ls.get("auto_reset");
                    if (auto_reset === null) {
                        auto_reset = true;
                    }
                    place.setAutoReset(auto_reset);
                    $("#stickyColorToggle")[0].checked = !auto_reset;
                    
                    $("#stickyColorToggle").change(function() {
                        place.setAutoReset(!this.checked);
                    });
                }
            };
            return {
                init: self.init
            };
        })(),
        // this takes care of the custom alert look
        alert = (function() {
            var self = {
                elements: {
                    alert: $("#alert")
                },
                show: function (s) {
                    self.elements.alert.find(".text,.custWrapper").empty();
                    self.elements.alert.find(".text").append(s);
                    self.elements.alert.fadeIn(200);
                },
                showElem: function(element) {
                    self.elements.alert.find(".text,.custWrapper").empty();
                    self.elements.alert.find(".custWrapper").append(element);
                    self.elements.alert.fadeIn(200);
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
                showElem: self.showElem
            };
        })(),
        uiHelper = (function() {
            var self = {
                _available: -1,
                maxStacked: -1,
                elements: {
                    stackCount: $("#placeableCount-bubble, #placeableCount-cursor")
                },
                init: function() {
                    socket.on("pixels", function(data) {
                        self.updateAvailable(data.count, data.cause);
                    });
                },
                updateAvailable: function(count, cause) {
                    if (count > 0 && cause === "stackGain") timer.playAudio();
                    self.setPlaceableText(count);
                },
                setMax(maxStacked) {
                    self.maxStacked = maxStacked+1;
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
                setMax: self.setMax
            };
        })(),
        // this takes care of the countdown timer
        timer = (function() {
            var self = {
                elements: {
                    timer_bubble: $("#cd-timer-bubble"),
                    timer_overlay: $("#cd-timer-overlay"),
                    timer: null
                },
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
                        self.elements.timer = ls.get("auto_reset") === false ? self.elements.timer_bubble : self.elements.timer_overlay;
                        self.elements.timer_bubble.hide();
                        self.elements.timer_overlay.hide();
                    }

                    if (self.status) {
                        self.elements.timer.text(self.status);
                    }

                    if (delta > 0) {
                        self.elements.timer.show();
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
                    if (!self.hasFiredNotification) {
                            self.playAudio();
                        if (!self.focus) {
                            notification.show("Your next pixel is available!");
                        }
                        uiHelper.setPlaceableText(1);
                        self.hasFiredNotification = true;
                    }

                    document.title = self.title;
                    self.elements.timer.hide();
                },
                init: function () {
                    self.title = document.title;
                    self.elements.timer_bubble.hide();
                    self.elements.timer_overlay.hide();

                    $(window).focus(function() {
                        self.focus = true;
                    }).blur(function() {
                        self.focus = false;
                    });
                    setTimeout(function() {
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
                playAudio: function() {
                    if (!ls.get("audio_muted")) {
                        self.audio.play();
                    }
                }
            };
            return {
                init: self.init,
                cooledDown: self.cooledDown,
                playAudio: self.playAudio
            };
        })(),
        // this takes care of displaying the coordinates the mouse is over
        coords = (function() {
            var self = {
                elements: {
                    coords: $("#coords")
                },
                init: function () {
                    self.elements.coords.hide();
                    const _board = board.getRenderBoard()[0];
                    _board.addEventListener("pointermove", pointerHandler, {passive: false});
                    _board.addEventListener("mousemove", pointerHandler, {passive: false});
                    _board.addEventListener("touchstart", touchHandler, {passive: false});
                    _board.addEventListener("touchmove", touchHandler, {passive: false});
                    // board.getRenderBoard().on("pointermove mousemove", function (evt) {
                    // }).on("touchstart touchmove", function (evt) {
                    // });

                    function pointerHandler(evt) {
                        var boardPos = board.fromScreen(evt.clientX, evt.clientY);

                        self.elements.coords.text("(" + (boardPos.x | 0) + ", " + (boardPos.y | 0) + ")").fadeIn(200);
                    }

                    function touchHandler(evt) {
                        var boardPos = board.fromScreen(evt.changedTouches[0].clientX, evt.changedTouches[0].clientY);

                        self.elements.coords.text("(" + (boardPos.x | 0) + ", " + (boardPos.y | 0) + ")").fadeIn(200);
                    }
                }
            };
            return {
                init: self.init
            };
        })(),
        // this holds user stuff / info
        user = (function() {
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
                getRole: function () {
                    return self.role;
                },
                signin: function() {
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
                doSignup: function() {
                    if (!self.pendingSignupToken) return;

                    $.post({
                        type: "POST",
                        url: "/signup",
                        data: {
                            token: self.pendingSignupToken,
                            username: self.elements.signup.find("input").val()
                        },
                        success: function() {
                            self.elements.signup.find("#error").text("");
                            self.elements.signup.find("input").val("");
                            self.elements.signup.fadeOut(200);
                            socket.reconnectSocket();
                            self.pendingSignupToken = null;
                        },
                        error: function(data) {
                            self.elements.signup.find("#error").text(data.responseJSON.message);
                        }
                    });
                    // self.pendingSignupToken = null;
                },
                init: function () {
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
                        self.loggedIn = true;
                        self.elements.loginOverlay.fadeOut(200);
                        self.elements.userInfo.find("span.name").text(data.username);
                        self.elements.userInfo.fadeIn(200);
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
                        } else if (["MODERATOR", "ADMIN"].indexOf(self.role) != -1) {
                            if (window.deInitAdmin) {
                                window.deInitAdmin();
                            }
                            $.getScript("admin/admin.js").done(function () {
                                window.initAdmin({
                                    socket: socket,
                                    user: user,
                                    place: place,
                                    alert: alert,
                                    lookup: lookup
                                });
                            });
                        } else if (window.deInitAdmin) {
                            window.deInitAdmin();
                        }
                        if (isBanned) {
                            self.elements.userMessage.text("You can contact us using one of the links in the info menu.").fadeIn(200);
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

                        analytics("send", "event", "Auth", "Login", data.method);
                    });
                }
            };
            return {
                init: self.init,
                getRole: self.getRole,
                webinit: self.webinit,
                wsinit: self.wsinit,
                isLoggedIn: self.isLoggedIn
            };
        })(),
        // this takes care of browser notifications
        notification = (function() {
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
    coords.init();
    user.init();
    notification.init();
    // and here we finally go...
    board.start();


    return {
        ls: ls,
        ss: ss,
        query: query,
        heatmap: {
            clear: heatmap.clear
        },
        template: {
            update: function(t) {
                template.queueUpdate(t);
            },
            normalize: function(obj, dir=true) {
                return template.normalizeTemplateObj(obj, dir);
            }
        },
        centerBoardOn: function(x, y) {
            board.centerOn(x, y);
        },
        updateTemplate: function(t) {
            template.queueUpdate(t);
        },
        alert: function(s) {
            alert.show($('<span>').text(s).html());
        },
        doPlace: function() {
            ban.me();
        },
        attemptPlace: function() {
            ban.me();
        },
        banme: function() {
            ban.me();
        }
    };
})();
