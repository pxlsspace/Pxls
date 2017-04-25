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
                    try {
                        return JSON.parse(s);
                    } catch(e) {
                        return undefined;
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
        ios_safari = (nua.match(/(iPod|iPhone|iPad)/i) && nua.match(/AppleWebKit/i)),
        ms_edge = nua.indexOf('Edge') > -1;
    if (ms_edge) {
        have_image_rendering = false;
    }
    var ls = storageFactory(localStorage, 'ls_', 99),
        ss = storageFactory(sessionStorage, 'ss_', null),
        // this object is used to access the query parameters (and in the future probably to set them), it is prefered to use # now instead of ? as JS can change them
        query = (function() {
            var self = {
                search: function(variable, str) {
                    var vars = str.split('&');
                    for (var i = 0; i < vars.length; i++) {
                        var pair = vars[i].split('=');
                        if (decodeURIComponent(pair[0]) === variable) {
                            return decodeURIComponent(pair[1]);
                        }
                    }
                    return undefined;
                },
                get: function(variable) {
                    var v = self.search(variable, window.location.hash.substring(1));
                    if (v !== undefined) {
                        return v;
                    }
                    return self.search(variable, window.location.search.substring(1));
                }
            };
            return {
                get: self.get
            };
        })(),
        // this object is responsible for detecting pxls placement and banning them
        ban = (function() {
            var self = {
                bad_src: [/^https?:\/\/[^\/]*raw[^\/]*git[^\/]*\/(metonator|Deklost)/gi,
                        /^chrome\-extension:\/\/lmleofkkoohkbgjikogbpmnjmpdedfil/gi],
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
                    window.clearInterval = function () {};
                    window.clearTimeout = function () {};
                    
                    // don't allow new websocket connections
                    var ws = window.WebSocket;
                    window.WebSocket = function (a, b) {
                        self.shadow();
                        return new ws(a, b);
                    };
                    
                    // don't even try to generate mouse events. I am being nice
                    window.MouseEvent = function() {
                        self.me();
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
                init: function() {
                    if (self.ws !== null) {
                        return; // already inited!
                    }
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
                        setTimeout(function () {
                            window.location.reload();
                        }, 10000 * Math.random() + 3000);
                        alert.show("Lost connection to server, reconnecting...");
                    };
                    
                    $(window).on("beforeunload", function () {
                        self.ws.onclose = function () {};
                        self.close();
                    });
                    
                    $(".board-container").show();
                    $(".ui").show();
                    $(".loading").fadeOut(500);
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
                close: self.close
            };
        })(),
        // this object holds all board information and is responsible of rendering the board
        board = (function() {
            var self = {
                elements: {
                    board: $("#board"),
                    board_render: null, // populated on init based on rendering method
                    mover: $(".board-mover"),
                    zoomer: $(".board-zoomer"),
                    container: $(".board-container")
                },
                use_js_render: !have_image_rendering,
                use_zoom: have_image_rendering && ios_safari,
                width: 0,
                height: 0,
                scale: 4,
                pan: {
                    x: 0,
                    y: 0
                },
                centerOn: function (x, y) {
                    self.pan.x = (self.width / 2 - x) - 0.5;
                    self.pan.y = (self.height / 2 - y) - 0.5;
                    self.update();
                },
                draw: function (data) {
                    var ctx = self.elements.board[0].getContext("2d"),
                        id;
                    try {
                        id = new ImageData(self.width, self.height);
                    } catch (e) {
                        // workaround when ImageData is unavailable (Such as under MS Edge)
                        var imgCanv = document.createElement('canvas');
                        imgCanv.width = self.width;
                        imgCanv.height = self.height;
                        id = imgCanv.getContext('2d').getImageData(0, 0, self.width, self.height);
                    }
                    var intView = new Uint32Array(id.data.buffer),
                        rgbPalette = place.getPaletteRGB();

                    for (var i = 0; i < self.width * self.height; i++) {
                        intView[i] = rgbPalette[data.charCodeAt(i)];
                    }

                    ctx.putImageData(id, 0, 0);
                    self.update();
                },
                initInteraction: function () {
                    // first zooming and stuff
                    var handleMove = function (evt) {
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
                        if (evt.keyCode === 87 || evt.keyCode === 38) {
                            self.pan.y += 100 / self.scale;
                        } else if (evt.keyCode === 65 || evt.keyCode === 37) {
                            self.pan.x += 100 / self.scale;
                        } else if (evt.keyCode === 83 || evt.keyCode === 40) {
                            self.pan.y -= 100 / self.scale;
                        } else if (evt.keyCode === 68 || evt.keyCode === 39) {
                            self.pan.x -= 100 / self.scale;
                        } else if (evt.keyCode === 187 || evt.keyCode === 69) {
                            self.setScale(1);
                        } else if (evt.keyCode === 189 || evt.keyCode === 81) {
                            self.setScale(-1);
                        } else if (evt.keyCode === 80) {
                            self.save();
                        }
                        self.update();
                    });
                    
                    self.elements.container.on("wheel", function (evt) {
                        var oldScale = self.scale;
                        if (evt.originalEvent.deltaY > 0) {
                            self.setScale(-1);
                        } else {
                            self.setScale(1);
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
                    });
                    
                    // now init the movement
                    var downX, downY;
                    self.elements.board_render.on("pointerdown mousedown", function (evt) {
                        downX = evt.clientX;
                        downY = evt.clientY;
                    }).on("touchstart", function (evt) {
                        downX = evt.originalEvent.changedTouches[0].clientX;
                        downY = evt.originalEvent.changedTouches[0].clientY;
                    }).on("pointerup mouseup touchend", function (evt) {
                        var touch = false,
                            clientX = evt.clientX,
                            clientY = evt.clientY;
                        if (evt.type === 'touchend') {
                            touch = true;
                            clientX = evt.originalEvent.changedTouches[0].clientX;
                            clientY = evt.originalEvent.changedTouches[0].clientY;
                        }
                        var dx = Math.abs(downX - clientX),
                            dy = Math.abs(downY - clientY);
                        if (dx < 5 && dy < 5 && (evt.button === 0 || touch)) {
                            var pos = self.fromScreen(clientX, clientY);
                            place.place(pos.x | 0, pos.y | 0);
                        }
                    }).contextmenu(function (evt) {
                        evt.preventDefault();
                        place.switch(-1);
                    });
                },
                init: function () {
                    $(".ui").hide();
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
                    self.initInteraction();
                },
                start: function () {
                    $.get("/info", function (data) {
                        self.width = data.width;
                        self.height = data.height;
                        place.setPalette(data.palette);
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
                        $.get("/boarddata", self.draw);
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
                            template.update({
                                use: true,
                                x: parseFloat(query.get("ox")),
                                y: parseFloat(query.get("oy")),
                                opacity: parseFloat(query.get("oo")),
                                width: parseFloat(query.get("tw")),
                                url: url
                            });
                        }
                    });
                },
                update: function (optional) {
                    self.pan.x = Math.min(self.width / 2, Math.max(-self.width / 2, self.pan.x));
                    self.pan.y = Math.min(self.height / 2, Math.max(-self.height / 2, self.pan.y));
                    if (self.use_js_render) {
                        var ctx2 = self.elements.board_render[0].getContext("2d"),
                            pxl_x = -self.pan.x + ((self.width - (window.innerWidth / self.scale)) / 2),
                            pxl_y = -self.pan.y + ((self.height - (window.innerHeight / self.scale)) / 2);
                        
                        ctx2.canvas.width = window.innerWidth;
                        ctx2.canvas.height = window.innerHeight;
                        ctx2.mozImageSmoothingEnabled = ctx2.webkitImageSmoothingEnabled = ctx2.msImageSmoothingEnabled = ctx2.imageSmoothingEnabled = (self.scale < 1);

                        ctx2.globalAlpha = 1;
                        ctx2.fillStyle = '#CCCCCC';
                        ctx2.fillRect(0, 0, ctx2.canvas.width, ctx2.canvas.height);
                        ctx2.drawImage(self.elements.board[0], pxl_x, pxl_y, window.innerWidth / self.scale, window.innerHeight / self.scale, 0, 0, window.innerWidth, window.innerHeight);
                        
                        template.draw(ctx2, pxl_x, pxl_y);
                        
                        place.update();
                        grid.update();
                        return true;
                    }
                    if (optional) {
                        return false;
                    }
                    if (self.scale < 1) {
                        self.elements.board.removeClass("pixelate");
                    } else {
                        self.elements.board.addClass("pixelate");
                    }
                    self.elements.mover.css({
                        width: self.width,
                        height: self.height,
                        transform: "translate(" + self.pan.x + "px, " + self.pan.y + "px)"
                    });
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
                    return self.scale;
                },
                setScale: function (adj) {
                    var oldScale = self.scale;
                    if (adj === -1) {
                        if (oldScale <= 1) {
                            self.scale = 0.5;
                        } else if (oldScale <= 2) {
                            self.scale = 1;
                        } else {
                            self.scale = Math.round(Math.max(2, self.scale / 1.25));
                        }
                    } else {
                        if (oldScale === 0.5) {
                            self.scale = 1;
                        } else if (oldScale === 1) {
                            self.scale = 2;
                        } else {
                            self.scale = Math.round(Math.min(50, self.scale * 1.25));
                        }
                    }
                    self.update();
                },
                setPixel: function (x, y, c) {
                    var ctx = self.elements.board[0].getContext("2d");
                    ctx.fillStyle = c;
                    ctx.fillRect(x, y, 1, 1);
                },
                fromScreen: function (screenX, screenY) {
                    if (self.use_js_render) {
                       return {
                           x: -self.pan.x + ((self.width - (window.innerWidth / self.scale)) / 2) + (screenX / self.scale),
                           y: -self.pan.y + ((self.height - (window.innerHeight / self.scale)) / 2) + (screenY / self.scale)
                       };
                   }
                   var boardBox = self.elements.board[0].getBoundingClientRect();
                   if (self.use_zoom) {
                       return {
                           x: (screenX / self.scale) - boardBox.left,
                           y: (screenY / self.scale) - boardBox.top
                       };
                   }
                   return {
                       x: ((screenX - boardBox.left) / self.scale),
                       y: ((screenY - boardBox.top) / self.scale)
                   };
                },
                toScreen: function (boardX, boardY) {
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
                    a.download = "canvas.png";
                    a.click();
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
                setScale: self.setScale,
                setPixel: self.setPixel,
                fromScreen: self.fromScreen,
                toScreen: self.toScreen,
                save: self.save,
                getRenderBoard: self.getRenderBoard
            };
        })(),
        // here all the template stuff happens
        template = (function () {
            var self = {
                elements: {
                    template: null
                },
                t: {
                    use: false,
                    url: '',
                    x: 0,
                    y: 0,
                    width: -1,
                    opacity: 0.5
                },
                lazy_init: function () {
                    if (self.t.use) { // already inited
                        return;
                    }
                    self.t.use = true;

                    self.elements.template = $("<img>").addClass("board-template noselect pixelate").attr({
                        src: self.t.url,
                        alt: "template"
                    }).css({
                        top: self.t.y,
                        left: self.t.x,
                        opacity: self.t.opacity,
                        width: self.t.width === -1 ? 'auto' : self.t.width
                    });
                    if (board.update(true)) {
                        return;
                    }
                    board.getRenderBoard().parent().prepend(self.elements.template);
                },
                update: function (t) {
                    if (t.hasOwnProperty('use') && t.use !== self.t.use) {
                        if (t.use) {
                            self.t.x = t.x || 0;
                            self.t.y = t.y || 0;
                            self.t.opacity = t.opacity || 0.5;
                            self.t.width = t.width || -1;
                            self.t.url = t.url || '';
                            self.lazy_init();
                        } else {
                            self.t.use = false;
                            self.elements.template.remove();
                            self.elements.template = null;
                            board.update(true);
                        }
                        return;
                    }
                    if (t.hasOwnProperty('url')) {
                        self.t.url = t.url;
                        self.elements.template.attr('src', t.url);
                        if (!t.hasOwnProperty('width')) {
                            t.width = -1; // reset just in case
                        }
                    }
                    $.map([['x', 'left'], ['y', 'top'], ['opacity', 'opacity'], ['width', 'width']], function (e) {
                        if (t.hasOwnProperty(e[0])) {
                            self.t[e[0]] = t[e[0]];
                            self.elements.template.css(e[1], t[e[0]]);
                        }
                    });
                    if (t.width === -1) {
                        self.elements.template.css('width', 'auto');
                    }
                    
                    board.update(true);
                },
                draw: function (ctx2, pxl_x, pxl_y) {
                    if (!self.t.use) {
                        return;
                    }
                    var width = self.elements.template[0].width,
                        height = self.elements.template[0].height,
                        scale = board.getScale();
                    if (self.t.width !== -1) {
                        height *= (self.t.width / width);
                        width = self.t.width;
                    }
                    ctx2.globalAlpha = self.t.opacity;
                    ctx2.drawImage(self.elements.template[0], (self.t.x - pxl_x) * scale, (self.t.y - pxl_y) * scale, width * scale, height * scale);
                }
            };
            return {
                update: self.update,
                draw: self.draw
            };
        })(),
        // here all the grid stuff happens
        grid = (function() {
            var self = {
                elements: {
                    grid: $(".grid")
                },
                init: function () {
                    self.elements.grid.hide();
                    $(document.body).on("keydown", function (evt) {
                        if (evt.keyCode === 71) {
                            self.elements.grid.fadeToggle({duration: 100});
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
                    palette: $(".palette"),
                    cursor: $(".cursor"),
                    reticule: $(".reticule")
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
                },
                switch: function (newColor) {
                    self.color = newColor;
                    $(".palette-color").removeClass("active");

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
                    if (!ls.get("audio_muted")) {
                        self.audio.play();
                    }
                    self._place(x, y);
                },
                _place: function (x, y) {
                    self.pendingPixel.x = x;
                    self.pendingPixel.y = y;
                    self.pendingPixel.color = self.color;
                    socket.send({
                        type: "place",
                        x: x,
                        y: y,
                        color: self.color
                    });
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
                    self.elements.palette.empty().append(
                        $.map(self.palette, function(p, idx) {
                            return $("<div>")
                                .addClass("palette-color")
                                .addClass("ontouchstart" in window ? "touch" : "no-touch")
                                .css("background-color", self.palette[idx])
                                .click(function () {
                                    if (timer.cooledDown()) {
                                        self.switch(idx);
                                    }
                                });
                        })
                    );
                },
                init: function () {
                    self.elements.reticule.hide();
                    self.elements.cursor.hide();
                    board.getRenderBoard().on("pointermove mousemove", function (evt) {
                        self.update(evt.clientX, evt.clientY);
                    });
                    $(window).on("pointermove mousemove", function (evt) {
                        self.elements.cursor.css("transform", "translate(" + evt.clientX + "px, " + evt.clientY + "px)");
                    });
                    socket.on("pixel", function (data) {
                        $.map(data.pixels, function (px) {
                            board.setPixel(px.x, px.y, self.palette[px.color]);
                        });
                        board.update(true);
                    });
                    socket.on("captcha_required", function (data) {
                        grecaptcha.reset();
                        grecaptcha.execute();
                    });
                    socket.on("captcha_status", function (data) {
                        if (data.success) {
                            var pending = self.pendingPixel;
                            self.switch(pending.color);
                            self._place(pending.x, pending.y);
                        } else {
                            alert.show("Failed captcha verification");
                        }
                    });
                    window.recaptchaCallback = function (token) {
                        socket.send({
                            type: "captcha",
                            token: token
                        });
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
                    return $.map(self.palette, function (c) {
                        var rgb = self.hexToRgb(c);
                        return 0xff000000 | rgb.b << 16 | rgb.g << 8 | rgb.r;
                    });
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
        // this takes care of the info slidedown and some settings (audio)
        info = (function() {
            var self = {
                init: function () {
                    $("div.open").click(function () {
                        $(".info").toggleClass("open");
                        ls.set('info_closed', !$(".info").hasClass("open"));
                    });
                    if (!ls.get('info_closed')) {
                        $(".info").addClass("open");
                    }
                    $(document.body).keydown(function (evt) {
                        if (evt.keyCode === 73) {
                            $(".info").toggleClass("open");
                            ls.set('info_closed', !$(".info").hasClass("open"));
                        }
                    });
                    $("#audiotoggle")[0].checked = ls.get("audio_muted");
                    $("#audiotoggle").change(function () {
                        ls.set("audio_muted", $(this).is(":checked"));
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
                    alert: $(".message")
                },
                show: function (s) {
                    self.elements.alert.find(".text").empty().append(s);
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
                show: self.show
            };
        })(),
        // this takes care of the countdown timer
        timer = (function() {
            var self = {
                elements: {
                    timer: $(".cooldown-timer")
                },
                hasFiredNotification: true,
                cooldown: 0,
                runningTimer: false,
                focus: true,
                audio: new Audio('notify.wav'),
                cooledDown: function () {
                    return self.cooldown < (new Date()).getTime();
                },
                update: function (die) {
                    // subtract one extra millisecond to prevent the first displaying to be derped
                    var delta = (self.cooldown - (new Date()).getTime() - 1) / 1000;

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

                        $(".palette-color").css("cursor", "not-allowed");

                        document.title = "[" + minuteStr + ":" + secsStr + "] pxls.space";

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
                        if (!ls.get("audio_muted")) {
                            self.audio.play();
                        }
                        if (!self.focus) {
                            notification.show("Your next pixel is available!");
                        }
                        self.hasFiredNotification = true;
                    }

                    document.title = "pxls.space";
                    self.elements.timer.hide();
                    $(".palette-color").css("cursor", "");
                },
                init: function () {
                    self.elements.timer.hide();
                    
                    $(window).focus(function() {
                        self.focus = true;
                    }).blur(function() {
                        self.focus = false;
                    });
                    socket.on("cooldown", function (data) {
                        self.cooldown = (new Date()).getTime() + (data.wait * 1000);
                        self.hasFiredNotification = data.wait === 0;
                        self.update();
                    });
                }
            };
            return {
                init: self.init,
                cooledDown: self.cooledDown
            };
        })(),
        // this takes care of displaying the coordinates the mouse is over
        coords = (function() {
            var self = {
                elements: {
                    coords: $(".coords")
                },
                init: function () {
                    self.elements.coords.hide();
                    board.getRenderBoard().on("pointermove mousemove", function (evt) {
                        var boardPos = board.fromScreen(evt.clientX, evt.clientY);

                        self.elements.coords.text("(" + (boardPos.x | 0) + ", " + (boardPos.y | 0) + ")").fadeIn(200);
                    }).on("touchstart touchmove", function (evt) {
                        var boardPos = board.fromScreen(evt.originalEvent.changedTouches[0].clientX, evt.originalEvent.changedTouches[0].clientY);

                        self.elements.coords.text("(" + (boardPos.x | 0) + ", " + (boardPos.y | 0) + ")").fadeIn(200);
                    });
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
                    users: $(".online"),
                    userInfo: $(".userinfo"),
                    loginOverlay: $(".login-overlay")
                },
                role: "USER",
                getRole: function () {
                    return self.role;
                },
                init: function () {
                    self.elements.users.hide();
                    self.elements.userInfo.hide();
                    socket.on("users", function (data) {
                        self.elements.users.text(data.count + " online").fadeIn(200);
                    });
                    socket.on("session_limit", function (data) {
                        socket.close();
                        alert.show("Too many sessions open, try closing some tabs.");
                    });
                    socket.on("userinfo", function (data) {
                        var banmsg = '';
                        self.elements.userInfo.find("span.name").text(data.name);
                        self.elements.userInfo.fadeIn(200);
                        self.role = data.role;
                        
                        if (self.role == "BANNED") {
                            banmsg = "You are permanently banned from placing pixels. Reason: "+data.ban_reason+". If you think this is wrong, please check it with us.";
                        } else if (data.banned) {
                            banmsg = "You are banned from placing pixels. Reason: "+data.ban_reason+". Your ban will expire on " + new Date(data.banExpiry).toLocaleString() + ".";
                        } else if (["MODERATOR", "ADMIN"].indexOf(self.role) != -1) {
                            if (window.deInitAdmin) {
                                window.deInitAdmin();
                            }
                            $.getScript("admin/admin.js").done(function () {
                                initAdmin({
                                    board: board,
                                    socket: socket,
                                    user: user,
                                    place: place,
                                    alert: alert
                                });
                            });
                        } else if (window.deInitAdmin) {
                            deInitAdmin();
                        }
                        if (banmsg) {
                            self.elements.loginOverlay.text(banmsg).fadeIn(200);
                        } else {
                            self.elements.loginOverlay.hide();
                        }
                    });
                }
            };
            return {
                board: self.board,
                init: self.init,
                getRole: self.getRole
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
    if (ss.get("url_params")) {
        window.location.hash = ss.get("url_params");
        ss.remove("url_params");
    }
    $(".login-overlay a").click(function (evt) {
        var hash = window.location.hash.substring(1),
            search = window.location.search.substring(1),
            url = hash;
        if (!url) {
            url = search;
        } else if (search) {
            url += '&' + search;
        }
        ss.set('url_params',  url);
    });
    board.init();
    ban.init();
    grid.init();
    place.init();
    info.init();
    alert.init();
    timer.init();
    coords.init();
    user.init();
    notification.init();
    // and here we finally go...
    board.start();
    
    
    return {
        ls: ls,
        ss: ss,
        updateTemplate: function(t) {
            template.update(t);
        },
        alert: function(s) {
            alert.show(s);
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
