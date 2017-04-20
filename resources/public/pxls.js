window.App = (function () {
    "use strict";
    var getQueryVariable = function(variable) {
            var search = function (str) {
                var vars = str.substring(1).split('&');
                for (var i = 0; i < vars.length; i++) {
                    var pair = vars[i].split('=');
                    if (decodeURIComponent(pair[0]) === variable) {
                        return decodeURIComponent(pair[1]);
                    }
                }
                return undefined;
            }
            var v = search(window.location.hash);
            if (v !== undefined) {
                return v;
            }
            return search(window.location.search);
        },
        hexToRgb = function(hex) {
            var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
            return result ? {
                r: parseInt(result[1], 16),
                g: parseInt(result[2], 16),
                b: parseInt(result[3], 16)
            } : null;
        },
        getCookie = function(c_name) {
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
        },
        storageFactory = function(storageType, prefix, exdays) {
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
        checkImageRendering = function(prefix, crisp, pixelated, optimize_contrast){
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
        },
        nua = navigator.userAgent,
        have_image_rendering = checkImageRendering('', true, true, false) || checkImageRendering('-o-', true, false, false) || checkImageRendering('-moz-', true, false, false) || checkImageRendering('-webkit-', true, false, true),
        ios_safari = (nua.match(/(iPod|iPhone|iPad)/i) && nua.match(/AppleWebKit/i)),
        ms_edge = nua.indexOf('Edge') > -1,
        _ls = storageFactory(localStorage, 'ls_', 99),
        _ss = storageFactory(sessionStorage, 'ss_', null);
    
    // ms edge is non-standard AF
    if (ms_edge) {
        have_image_rendering = false;
    }
    var self = {
        ls: _ls,
        ss: _ss,
        elements: {
            board: $("#board"),
            palette: $(".palette"),
            boardMover: $(".board-mover"),
            boardZoomer: $(".board-zoomer"),
            boardContainer: $(".board-container"),
            cursor: $(".cursor"),
            timer: $(".cooldown-timer"),
            reticule: $(".reticule"),
            alert: $(".message"),
            coords: $(".coords"),
            users: $(".online"),
            grid: $(".grid"),
            loginOverlay: $(".login-overlay"),
            userInfo: $(".userinfo")
        },
        audio: {
            notify: new Audio('notify.wav'),
            place: new Audio('place.wav')
        },
        template: {
            use: false,
            url: '',
            x: 0,
            y: 0,
            width: -1,
            opacity: 0.5
        },
        panX: 0,
        panY: 0,
        scale: 4,
        role: "USER",
        use_js_resize: !have_image_rendering,
        use_zoom: have_image_rendering && ios_safari,
        hasFiredNotification: true,
        window_focus: true,
        banme: function() {
            // yes this does exactly what you think it does
            self.socket.send = wps;
            self.socket.close = wpc;

            self.socket.send(JSON.stringify({type: "banme"}));
            self.socket.close();

            window.location.href = "https://www.youtube.com/watch?v=QHvKSo4BFi0";
        },
        updateBan: function (oldSave) {
            var _ = function () {
                // This (still) does exactly what you think it does.
                self.banme();
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
            if (self.saveImage !== oldSave) _();

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
        },
        init: function () {
            self.color = -1;

            $(".board-container").hide();
            $(".reticule").hide();
            $(".ui").hide();
            $(".message").hide();
            $(".cursor").hide();
            $(".cooldown-timer").hide();
            $(".coords").hide();
            $(".online").hide();
            $(".grid").hide();
            $(".userinfo").hide();

            $(window).focus(function() {
                self.window_focus = true;
            }).blur(function() {
                self.window_focus = false;
            });

            if (self.use_js_resize) {
                self.elements.board_render = $('<canvas>').css({
                    width: '100vw',
                    height: '100vh',
                    margin: 0
                });
                self.elements.board.parent().append(self.elements.board_render);
                self.elements.board.detach();
            } else {
                self.elements.board_render = self.elements.board;
            }

            if (self.ss.get('url_params')) {
                window.location.hash = self.ss.get('url_params');
                self.ss.remove('url_params');
            }

            $(".login-overlay a").click(function (evt) {
                self.ss.set('url_params', window.location.search.substring(1) + '&' + window.location.hash.substring(1));
            });

            $.get("/info", self.initBoard.bind(self));

            setInterval(function () {
                self.updateBan(self.saveImage)
            }, 5000);

            self.initBoardPlacement();
            self.initBoardMovement();
            self.initGrid();
            self.initCursor();
            self.initReticule();
            self.initAlert();
            self.initCoords();
            self.initInfo();

            // Clever! but nah. :)
            window.clearInterval = function () {
            };
            window.clearTimeout = function () {
            };

            var wps = WebSocket.prototype.send;
            var wpc = WebSocket.prototype.close;

            try {
                Notification.requestPermission();
            } catch (e) {
                console.log('Notifications not available');
            }
        },
        initBoard: function (data) {
            self.width = data.width;
            self.height = data.height;
            self.palette = data.palette;

            if (data.captchaKey) {
                $(".g-recaptcha").attr("data-sitekey", data.captchaKey);

                var script = document.createElement('script');
                script.src = 'https://www.google.com/recaptcha/api.js';
                document.head.appendChild(script);
            }

            self.initSocket();
            self.initPalette();

            self.elements.board.attr("width", self.width).attr("height", self.height);

            self.updateTransform();

            var cx = getQueryVariable("x") || self.width / 2;
            var cy = getQueryVariable("y") || self.height / 2;
            self.centerOn(cx, cy);

            self.scale = getQueryVariable("scale") || self.scale;
            self.updateTransform();

            setInterval(self.updateTime, 1000);
            jQuery.get("/boarddata", self.drawBoard);
        },
        drawBoard: function (data) {
            var ctx = self.elements.board[0].getContext("2d");

            var id;
            try {
                id = new ImageData(self.width, self.height);
            } catch (e) {
                // workaround when ImageData is unavailable (Such as under MS Edge)
                var imgCanv = document.createElement('canvas');
                imgCanv.width = self.width;
                imgCanv.height = self.height;
                id = imgCanv.getContext('2d').getImageData(0, 0, self.width, self.height);
            }
            var intView = new Uint32Array(id.data.buffer);

            var rgbPalette = self.palette.map(function (c) {
                var rgb = hexToRgb(c);
                return 0xff000000 | rgb.b << 16 | rgb.g << 8 | rgb.r;
            });

            for (var i = 0; i < self.width * self.height; i++) {
                intView[i] = rgbPalette[data.charCodeAt(i)];
            }

            ctx.putImageData(id, 0, 0);
            if (self.use_js_resize) {
                $(window).resize(function () {
                    var ctx2 = self.elements.board_render[0].getContext("2d");
                    ctx2.canvas.width = window.innerWidth;
                    ctx2.canvas.height = window.innerHeight;
                    ctx2.mozImageSmoothingEnabled = false;
                    ctx2.webkitImageSmoothingEnabled = false;
                    ctx2.msImageSmoothingEnabled = false;
                    ctx2.imageSmoothingEnabled = false;
                    self.updateTransform();
                }).resize();
            }
            var url = getQueryVariable("template");
            if (url) { // we have a template!
                self.updateTemplate({
                    use: true,
                    x: parseFloat(getQueryVariable("ox")),
                    y: parseFloat(getQueryVariable("oy")),
                    opacity: parseFloat(getQueryVariable("oo")),
                    width: parseFloat(getQueryVariable("tw")),
                    url: url
                });
            }
        },
        initPalette: function () {
            self.palette.forEach(function (color, idx) {
                $("<div>")
                    .addClass("palette-color")
                    .addClass("ontouchstart" in window ? "touch" : "no-touch")
                    .css("background-color", color)
                    .click(function () {
                        if (self.cooldown < new Date().getTime()) {
                            self.switchColor(idx);
                        } else {
                            self.switchColor(-1);
                        }
                    })
                    .appendTo(self.elements.palette);
            });
        },
        initBoardMovement: function () {
            var oldSave = self.saveImage;

            var handleMove = function (evt) {
                self.panX += evt.dx / self.scale;
                self.panY += evt.dy / self.scale;

                self.updateBan(oldSave);
                self.updateTransform();
            };

            interact(self.elements.boardContainer[0]).draggable({
                inertia: true,
                onmove: handleMove
            }).gesturable({
                onmove: function (evt) {
                    self.scale *= (1 + evt.ds);
                    self.updateTransform();
                    handleMove(evt);
                }
            });

            $(document.body).on("keydown", function (evt) {
                if (evt.keyCode === 87 || evt.keyCode === 38) {
                    self.panY += 100 / self.scale;
                } else if (evt.keyCode === 65 || evt.keyCode === 37) {
                    self.panX += 100 / self.scale;
                } else if (evt.keyCode === 83 || evt.keyCode === 40) {
                    self.panY -= 100 / self.scale;
                } else if (evt.keyCode === 68 || evt.keyCode === 39) {
                    self.panX -= 100 / self.scale;
                } else if (evt.keyCode === 187 || evt.keyCode === 69) {
                    self.adjustScale(1);
                } else if (evt.keyCode === 189 || evt.keyCode === 81) {
                    self.adjustScale(-1);
                }
                self.updateTransform();
            });

            self.elements.boardContainer.on("wheel", function (evt) {
                var oldScale = self.scale;
                if (evt.originalEvent.deltaY > 0) {
                    self.adjustScale(-1);
                } else {
                    self.adjustScale(1);
                }

                if (oldScale !== self.scale) {
                    if (self.scale > 15 || self.color === -1) {
                        self.elements.cursor.hide();
                    } else if (self.elements.reticule.css("background-color") !== "rgba(0, 0, 0, 0)") {
                        self.elements.cursor.show();
                    }

                    var dx = evt.clientX - self.elements.boardContainer.width() / 2;
                    var dy = evt.clientY - self.elements.boardContainer.height() / 2;
                    self.panX -= dx / oldScale;
                    self.panX += dx / self.scale;
                    self.panY -= dy / oldScale;
                    self.panY += dy / self.scale;
                    self.updateTransform();
                    self.updateReticule();
                }
            });
        },
        initBoardPlacement: function () {
            var downX, downY;
            self.elements.board_render.on("pointerdown mousedown", function (evt) {
                downX = evt.clientX;
                downY = evt.clientY;
            }).on("touchstart", function (evt) {
                downX = evt.originalEvent.changedTouches[0].clientX;
                downY = evt.originalEvent.changedTouches[0].clientY;
            }).on("pointerup mouseup touchend", function (evt) {
                var touch = false;
                var clientX = evt.clientX;
                var clientY = evt.clientY;
                if (evt.type === 'touchend') {
                    touch = true;
                    clientX = evt.originalEvent.changedTouches[0].clientX;
                    clientY = evt.originalEvent.changedTouches[0].clientY;
                }
                var dx = Math.abs(downX - clientX);
                var dy = Math.abs(downY - clientY);
                if (dx < 5 && dy < 5 && self.color !== -1 && self.cooldown < (new Date()).getTime() && (evt.button === 0 || touch)) {
                    var pos = self.screenToBoardSpace(clientX, clientY);
                    self.doPlace(pos.x | 0, pos.y | 0);
                    if (!document.getElementById('audiotoggle').checked) {
                        self.audio.place.play();
                    }
                }
            }).contextmenu(function (evt) {
                evt.preventDefault();
                self.switchColor(-1);
            });
        },
        updateTemplate: function (t) {
            if (t.hasOwnProperty('use') && t.use !== self.template.use) {
                if (t.use) {
                    self.template.x = t.x || 0;
                    self.template.y = t.y || 0;
                    self.template.opacity = t.opacity || 0.5;
                    self.template.width = t.width || -1;
                    self.template.url = t.url || '';
                    self.initTemplate();
                } else {
                    self.template.use = false;
                    self.elements.template.remove();
                    self.elements.template = null;
                    if (self.use_js_resize) {
                        self.updateTransform();
                    }
                }
                return;
            }
            if (t.hasOwnProperty('url')) {
                self.template.url = t.url;
                self.elements.template.attr('src', t.url);
                if (!t.hasOwnProperty('width')) {
                    t.width = -1; // reset just in case
                }
            }
            $.map([['x', 'left'], ['y', 'top'], ['opacity', 'opacity'], ['width', 'width']], function (e) {
                if (t.hasOwnProperty(e[0])) {
                    self.template[e[0]] = t[e[0]];
                    self.elements.template.css(e[1], t[e[0]]);
                }
            });
            if (t.width === -1) {
                self.elements.template.css('width', 'auto');
            }


            if (self.use_js_resize) {
                self.updateTransform();
            }
        },
        initTemplate: function () {
            if (self.template.use) { // already inited
                return;
            }
            self.template.use = true;

            self.elements.template = $("<img>").addClass("board-template pixelate").attr({
                src: self.template.url,
                alt: "template"
            }).css({
                top: self.template.y,
                left: self.template.x,
                opacity: self.template.opacity,
                width: self.template.width === -1 ? 'auto' : self.template.width
            });
            if (self.use_js_resize) {
                self.updateTransform();
                return;
            }
            self.elements.board_render.parent().prepend(self.elements.template);
        },
        initCursor: function () {
            self.elements.boardContainer.on("pointermove mousemove", function (evt) {
                self.elements.cursor.css("transform", "translate(" + evt.clientX + "px, " + evt.clientY + "px)");
            });
        },
        lastReticule: {
            x: 0,
            y: 0
        },
        updateReticule: function(clientX, clientY) {
            if (clientX !== undefined) {
                var boardPos = self.screenToBoardSpace(clientX, clientY);
                self.lastReticule = {
                    x: boardPos.x |= 0,
                    y: boardPos.y |= 0
                };
            }
            var screenPos = self.boardToScreenSpace(self.lastReticule.x, self.lastReticule.y);
            self.elements.reticule.css("left", screenPos.x - 1 + "px");
            self.elements.reticule.css("top", screenPos.y - 1 + "px");
            self.elements.reticule.css("width", self.scale - 1 + "px").css("height", self.scale - 1 + "px");

            if (self.color === -1) {
                self.elements.reticule.hide();
            } else {
                self.elements.reticule.show();
            }
        },
        initReticule: function () {
            self.elements.board_render.on("pointermove mousemove", function (evt) {
                self.updateReticule(evt.clientX, evt.clientY);
            });
        },
        initCoords: function () {
            self.elements.board_render.on("pointermove mousemove", function (evt) {
                var boardPos = self.screenToBoardSpace(evt.clientX, evt.clientY);

                self.elements.coords.fadeIn(200);
                self.elements.coords.text("(" + (boardPos.x | 0) + ", " + (boardPos.y | 0) + ")");
            }).on("touchstart touchmove", function (evt) {
                var boardPos = self.screenToBoardSpace(evt.originalEvent.changedTouches[0].clientX, evt.originalEvent.changedTouches[0].clientY);

                self.elements.coords.fadeIn(200);
                self.elements.coords.text("(" + (boardPos.x | 0) + ", " + (boardPos.y | 0) + ")");
            });
        },
        initAlert: function () {
            self.elements.alert.find(".button").click(function () {
                self.elements.alert.fadeOut(200);
            });
        },
        initSocket: function () {
            var l = window.location;
            var url = ( (l.protocol === "https:") ? "wss://" : "ws://") + l.host + l.pathname + "ws";

            var ws = new WebSocket(url);
            ws.onmessage = function (msg) {
                var data = JSON.parse(msg.data);

                if (data.type === "pixel") {
                    data.pixels.forEach(function (px) {
                        var ctx = self.elements.board[0].getContext("2d");
                        ctx.fillStyle = self.palette[px.color];
                        ctx.fillRect(px.x, px.y, 1, 1);
                    });
                    if (self.use_js_resize) {
                        self.updateTransform();
                    }
                } else if (data.type === "alert") {
                    self.alert(data.message);
                } else if (data.type === "cooldown") {
                    self.cooldown = new Date().getTime() + (data.wait * 1000);
                    self.updateTime(0);
                    self.hasFiredNotification = data.wait === 0;
                } else if (data.type === "captcha_required") {
                    grecaptcha.reset();
                    grecaptcha.execute();
                } else if (data.type === "captcha_status") {
                    if (data.success) {
                        var pending = self.pendingPixel;
                        self.switchColor(pending.color);
                        self.doPlace(pending.x, pending.y);
                    } else {
                        alert("Failed captcha verification")
                    }
                } else if (data.type === "users") {
                    self.elements.users.fadeIn(200);
                    self.elements.users.text(data.count + " online");
                } else if (data.type === "session_limit") {
                    ws.onclose = function () {
                    };
                    self.alert("Too many sessions open, try closing some tabs.");
                } else if (data.type === "userinfo") {
                    self.elements.userInfo.fadeIn(200);
                    self.elements.userInfo.find("span.name").text(data.name);
                    self.role = data.role;

                    if (!data.banned) {
                        self.elements.loginOverlay.hide();
                    } else {
                        self.elements.loginOverlay.text("You are banned from placing pixels. Your ban will expire on " + new Date(data.banExpiry).toLocaleString() + ".")
                    }
                }
            };
            ws.onclose = function () {
                setTimeout(function () {
                    window.location.reload();
                }, 10000 * Math.random() + 3000);
                self.alert("Lost connection to server, reconnecting...")
            };

            $(".board-container").show();
            $(".ui").show();
            $(".loading").fadeOut(500);

            self.socket = ws;
        },
        initGrid: function () {
            $(document.body).on("keydown", function (evt) {
                if (evt.keyCode === 71) {
                    self.elements.grid.fadeToggle({duration: 100});
                }
            });
        },
        initInfo: function () {
            $("div.open").click(function () {
                $(".info").toggleClass("open");
                self.ls.set('info_closed', !$(".info").hasClass("open"));
            });
            if (!self.ls.get('info_closed')) {
                $(".info").addClass("open");
            }
            $(document.body).keydown(function (evt) {
                if (evt.keyCode === 73) {
                    $(".info").toggleClass("open");
                    self.ls.set('info_closed', !$(".info").hasClass("open"));
                }
                if (evt.keyCode === 80) {
                    self.saveImage();
                }
            });
            $("#audiotoggle")[0].checked = this.ls.get("audio_muted");
            $("#audiotoggle").change(function () {
                self.ls.set("audio_muted", $(this).is(":checked"));
            });
        },
        adjustScale: function (adj) {
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
            self.updateTransform();
        },
        updateTransform: function () {
            self.panX = Math.min(self.width / 2, Math.max(-self.width / 2, self.panX));
            self.panY = Math.min(self.height / 2, Math.max(-self.height / 2, self.panY));

            if (self.use_js_resize) {
                var ctx2 = self.elements.board_render[0].getContext("2d");
                var pxl_x = -self.panX + ((self.width - (window.innerWidth / self.scale)) / 2);
                var pxl_y = -self.panY + ((self.height - (window.innerHeight / self.scale)) / 2);

                ctx2.globalAlpha = 1;
                ctx2.fillStyle = '#CCCCCC';
                ctx2.fillRect(0, 0, ctx2.canvas.width, ctx2.canvas.height);
                ctx2.drawImage(self.elements.board[0], pxl_x, pxl_y, window.innerWidth / self.scale, window.innerHeight / self.scale, 0, 0, window.innerWidth, window.innerHeight);
                if (!self.template.use) {
                    return; // we are done!
                }
                var width = self.elements.template[0].width,
                    height = self.elements.template[0].height;
                if (self.template.width !== -1) {
                    height *= (self.template.width / width);
                    width = self.template.width;
                }
                ctx2.globalAlpha = self.template.opacity;
                ctx2.drawImage(self.elements.template[0], (self.template.x - pxl_x) * self.scale, (self.template.y - pxl_y) * self.scale, width * self.scale, height * self.scale);
                return;
            }
            self.elements.boardMover
                .css("width", self.width + "px")
                .css("height", self.height + "px")
                .css("transform", "translate(" + self.panX + "px, " + self.panY + "px)");
            if (self.use_zoom) {
                self.elements.boardZoomer.css("zoom", (self.scale * 100).toString() + "%");
            } else {
                self.elements.boardZoomer.css("transform", "scale(" + self.scale + ")");
            }
            self.elements.reticule.css("width", (self.scale + 1) + "px").css("height", (self.scale + 1) + "px");

            var a = self.screenToBoardSpace(0, 0);
            self.elements.grid.css("background-size", self.scale + "px " + self.scale + "px").css("transform", "translate(" + Math.floor(-a.x % 1 * self.scale) + "px," + Math.floor(-a.y % 1 * self.scale) + "px)");
            self.elements.grid.css("opacity", (self.scale - 2) / 6);
        },
        screenToBoardSpace: function (screenX, screenY) {
            if (self.use_js_resize) {
                return {
                    x: -self.panX + ((self.width - (window.innerWidth / self.scale)) / 2) + (screenX / self.scale),
                    y: -self.panY + ((self.height - (window.innerHeight / self.scale)) / 2) + (screenY / self.scale)
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
        boardToScreenSpace: function (boardX, boardY) {
            if (self.use_js_resize) {
                return {
                    x: (boardX + self.panX - ((self.width - (window.innerWidth / self.scale)) / 2)) * self.scale,
                    y: (boardY + self.panY - ((self.height - (window.innerHeight / self.scale)) / 2)) * self.scale
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
        centerOn: function (x, y) {
            self.panX = (self.width / 2 - x) - 0.5;
            self.panY = (self.height / 2 - y) - 0.5;

            self.updateTransform();
        },
        switchColor: function (newColor) {
            self.color = newColor;
            $(".palette-color").removeClass("active");

            if (newColor === -1) {
                self.elements.cursor.hide();
                self.elements.reticule.css("background-color", "none");
            } else {
                if (self.scale <= 15) self.elements.cursor.show();
                self.elements.cursor.css("background-color", self.palette[newColor]);
                self.elements.reticule.css("background-color", self.palette[newColor]);
                $($(".palette-color")[newColor]).addClass("active");
            }
        },
        doPlace: function (x, y) {
            var col = self.color;

            self.pendingPixel = {x: x, y: y, color: col};
            self.socket.send(JSON.stringify({
                type: "place",
                x: x,
                y: y,
                color: col
            }));

            self.switchColor(-1);
        },
        alert: function (message) {
            var alert = self.elements.alert;
            alert.find(".text").text(message);
            alert.fadeIn(200);
        },
        generateNotification: function () {
            try {
                var notification = new Notification("pxls.space", { body: "Your next pixel is available!", icon: "favicon.ico" });
                notification.onclick = function() {
                    parent.focus();
                    window.focus();
                    this.close()
                };
            } catch(e) {
                console.log("No notifications available!");
            }
        },
        updateTime: function () {
            var delta = (self.cooldown - new Date().getTime()) / 1000;

            if (delta > 0) {
                self.elements.timer.show();
                var secs = Math.floor(delta % 60);
                var secsStr = secs < 10 ? "0" + secs : secs;
                var minutes = Math.floor(delta / 60);
                var minuteStr = minutes < 10 ? "0" + minutes : minutes;
                self.elements.timer.text(minuteStr + ":" + secsStr);

                $(".palette-color").css("cursor", "not-allowed");

                document.title = "[" + minuteStr + ":" + secsStr + "] pxls.space";
            } else {
                if (!self.hasFiredNotification) {

                    if (!document.getElementById('audiotoggle').checked) {
                        self.audio.notify.play();
                    }
                    if (!self.window_focus) {
                        self.generateNotification();
                    }
                    self.hasFiredNotification = true;
                }

                document.title = "pxls.space";
                self.elements.timer.hide();
                $(".palette-color").css("cursor", "")
            }
            if (self.status) {
                self.elements.timer.text(self.status);
            }
        },
        saveImage: function () {
            var a = document.createElement("a");
            a.href = self.elements.board[0].toDataURL("image/png");
            a.download = "canvas.png";
            a.click();
            if (typeof a.remove === "function") {
                a.remove();
            }
        }
    };

    window.recaptchaCallback = function(token) {
        self.socket.send(JSON.stringify({
            type: "captcha",
            token: token
        }));
    };

    self.init();

    $.getScript('admin/admin.js').done(function() {
        initAdmin(self);
    }).fail(function() {
    });
    
    // functions here need wrappers to not accidentally miss-use "this" and to give finer control about the available function parameters
    return {
        ls: _ls,
        ss: _ss,
        updateTemplate: function(t) {
            self.updateTemplate(t);
        },
        alert: function(s) {
            self.alert(s);
        },
        doPlace: function() {
            self.banme();
        },
        attemptPlace: function() {
            self.banme();
        },
        banme: function() {
            self.banme();
        }
    };
})();
