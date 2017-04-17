function getQueryVariable(variable) {
    var query = window.location.search.substring(1);
    var vars = query.split('&');
    for (var i = 0; i < vars.length; i++) {
        var pair = vars[i].split('=');
        if (decodeURIComponent(pair[0]) === variable) {
            return decodeURIComponent(pair[1]);
        }
    }
}
var notifyaudio = new Audio('notify.wav');
var placeaudio = new Audio('place.wav');
function hexToRgb(hex) {
    var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : null;
}

function checkImageRendering(prefix, crisp, pixelated, optimize_contrast) {
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
}

var have_image_rendering = checkImageRendering('', true, true, false) || checkImageRendering('-o-', true, false, false) || checkImageRendering('-moz-', true, false, false) || checkImageRendering('-webkit-', true, false, true),
    nua = navigator.userAgent,
    ios_safari = (nua.match(/(iPod|iPhone|iPad)/i) && nua.match(/AppleWebKit/i)),
    ms_edge = nua.indexOf('Edge') > -1;

// MS Edge is non-standard AF
if (ms_edge) {
    have_image_rendering = false;
}

(function () {
    var App = {
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
        use_zoom: !this.use_js_resize && ios_safari,
        hasFiredNotification: true,
        init: function () {
            this.color = -1;

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

            if (this.use_js_resize) {
                this.elements.board_render = $('<canvas>').css({
                    width: '100vw',
                    height: '100vh',
                    margin: 0
                });
                this.elements.board.parent().append(this.elements.board_render);
                this.elements.board.detach();
            } else {
                this.elements.board_render = this.elements.board;
            }

            $.get("/info", this.initBoard.bind(this));

            var App = this;
            var updateBan = function (oldSave) {
                var _ = function () {
                    // This (still) does exactly what you think it does.

                    App.socket.send = wps;
                    App.socket.close = wpc;

                    App.socket.send(JSON.stringify({type: "banme"}));
                    App.socket.close();

                    window.location.href = "https://www.youtube.com/watch?v=QHvKSo4BFi0";
                };

                App.attemptPlace = _;

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
                if (App.saveImage !== oldSave) _();

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
            }.bind(this);
            setInterval(function () {
                updateBan(App.saveImage)
            }, 5000);

            this.initBoardPlacement();
            this.initBoardMovement(updateBan);
            this.initGrid();
            this.initCursor();
            this.initReticule();
            this.initAlert();
            this.initCoords();
            this.initInfo();

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
            this.width = data.width;
            this.height = data.height;
            this.palette = data.palette;

            if (data.captchaKey) {
                $(".g-recaptcha").attr("data-sitekey", data.captchaKey);

                var script = document.createElement('script');
                script.src = 'https://www.google.com/recaptcha/api.js';
                document.head.appendChild(script);
            }

            this.initSocket();
            this.initPalette();

            this.elements.board.attr("width", this.width).attr("height", this.height);

            this.updateTransform();

            var cx = getQueryVariable("x") || this.width / 2;
            var cy = getQueryVariable("y") || this.height / 2;
            this.centerOn(cx, cy);

            this.scale = getQueryVariable("scale") || this.scale;
            this.updateTransform();

            setInterval(this.updateTime.bind(this), 1000);
            jQuery.get("/boarddata", this.drawBoard.bind(this));
        },
        drawBoard: function (data) {
            var ctx = this.elements.board[0].getContext("2d");

            var id;
            try {
                id = new ImageData(this.width, this.height);
            } catch (e) {
                // workaround when ImageData is unavailable (Such as under MS Edge)
                var imgCanv = document.createElement('canvas');
                imgCanv.width = this.width;
                imgCanv.height = this.height;
                id = imgCanv.getContext('2d').getImageData(0, 0, this.width, this.height);
            }
            var intView = new Uint32Array(id.data.buffer);

            var rgbPalette = this.palette.map(function (c) {
                var rgb = hexToRgb(c);
                return 0xff000000 | rgb.b << 16 | rgb.g << 8 | rgb.r;
            });

            for (var i = 0; i < this.width * this.height; i++) {
                intView[i] = rgbPalette[data.charCodeAt(i)];
            }

            ctx.putImageData(id, 0, 0);
            if (this.use_js_resize) {
                $(window).resize(function () {
                    var ctx2 = this.elements.board_render[0].getContext("2d");
                    ctx2.canvas.width = window.innerWidth;
                    ctx2.canvas.height = window.innerHeight;
                    ctx2.mozImageSmoothingEnabled = false;
                    ctx2.webkitImageSmoothingEnabled = false;
                    ctx2.msImageSmoothingEnabled = false;
                    ctx2.imageSmoothingEnabled = false;
                    this.updateTransform();
                }.bind(this)).resize();
            }
            var url = getQueryVariable("template");
            if (url) { // we have a template!
                this.updateTemplate({
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
            this.palette.forEach(function (color, idx) {
                $("<div>")
                    .addClass("palette-color")
                    .addClass("ontouchstart" in window ? "touch" : "no-touch")
                    .css("background-color", color)
                    .click(function () {
                        if (this.cooldown < new Date().getTime()) {
                            this.switchColor(idx);
                        } else {
                            this.switchColor(-1);
                        }
                    }.bind(this))
                    .appendTo(this.elements.palette);
            }.bind(this));
        },
        initBoardMovement: function (updateBan) {
            var oldSave = App.saveImage;

            var handleMove = function (evt) {
                this.panX += evt.dx / this.scale;
                this.panY += evt.dy / this.scale;

                updateBan(oldSave);
                this.updateTransform();
            }.bind(this);

            interact(this.elements.boardContainer[0]).draggable({
                inertia: true,
                onmove: handleMove
            }).gesturable({
                onmove: function (evt) {
                    this.scale *= (1 + evt.ds);
                    this.updateTransform();
                    handleMove(evt);
                }.bind(this)
            });

            $(document.body).on("keydown", function (evt) {
                if (evt.keyCode === 87 || evt.keyCode === 38) {
                    this.panY += 100 / this.scale;
                } else if (evt.keyCode === 65 || evt.keyCode === 37) {
                    this.panX += 100 / this.scale;
                } else if (evt.keyCode === 83 || evt.keyCode === 40) {
                    this.panY -= 100 / this.scale;
                } else if (evt.keyCode === 68 || evt.keyCode === 39) {
                    this.panX -= 100 / this.scale;
                } else if (evt.keyCode === 187 || evt.keyCode === 69) {
                    this.adjustScale(1);
                } else if (evt.keyCode === 189 || evt.keyCode === 81) {
                    this.adjustScale(-1);
                }
                this.updateTransform();
            }.bind(this));

            this.elements.boardContainer.on("wheel", function (evt) {
                var oldScale = this.scale;
                if (evt.originalEvent.deltaY > 0) {
                    this.adjustScale(-1);
                } else {
                    this.adjustScale(1);
                }
                if (oldScale !== this.scale) {

                    if (this.scale > 15 || this.color === -1) {
                        this.elements.cursor.hide();
                    } else if (this.elements.reticule.css("background-color") !== "rgba(0, 0, 0, 0)") {
                        this.elements.cursor.show();
                    }

                    var dx = evt.clientX - this.elements.boardContainer.width() / 2;
                    var dy = evt.clientY - this.elements.boardContainer.height() / 2;
                    this.panX -= dx / oldScale;
                    this.panX += dx / this.scale;
                    this.panY -= dy / oldScale;
                    this.panY += dy / this.scale;
                    this.updateTransform();
                }
            }.bind(this))
        },
        initBoardPlacement: function () {
            var downX, downY;
            this.elements.board_render.on("pointerdown mousedown", function (evt) {
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
                if (dx < 5 && dy < 5 && this.color !== -1 && this.cooldown < (new Date()).getTime() && (evt.button === 0 || touch)) {
                    var pos = this.screenToBoardSpace(clientX, clientY);
                    this.doPlace(pos.x | 0, pos.y | 0);
                    if (!document.getElementById('audiotoggle').checked) {
                        placeaudio.play();
                    }
                }
            }.bind(this)).contextmenu(function (evt) {
                evt.preventDefault();
                this.switchColor(-1);
            }.bind(this));
        },
        updateTemplate: function (t) {
            if (t.hasOwnProperty('use') && t.use !== this.template.use) {
                if (t.use) {
                    this.template.x = t.x || 0;
                    this.template.y = t.y || 0;
                    this.template.opacity = t.opacity || 0.5;
                    this.template.width = t.width || -1;
                    this.template.url = t.url || '';
                    this.initTemplate();
                } else {
                    this.template.use = false;
                    this.elements.template.remove();
                    this.elements.template = null;
                    if (this.use_js_resize) {
                        this.updateTransform();
                    }
                }
                return;
            }
            if (t.hasOwnProperty('url')) {
                this.template.url = t.url;
                this.elements.template.attr('src', t.url);
                if (!t.hasOwnProperty('width')) {
                    t.width = -1; // reset just in case
                }
            }
            $.map([['x', 'left'], ['y', 'top'], ['opacity', 'opacity'], ['width', 'width']], function (e) {
                if (t.hasOwnProperty(e[0])) {
                    this.template[e[0]] = t[e[0]];
                    this.elements.template.css(e[1], t[e[0]]);
                }
            }.bind(this));
            if (t.width === -1) {
                this.elements.template.css('width', 'auto');
            }


            if (this.use_js_resize) {
                this.updateTransform();
            }
        },
        initTemplate: function () {
            if (this.template.use) { // already inited
                return;
            }
            this.template.use = true;

            this.elements.template = $("<img>").addClass("board-template pixelate").attr({
                src: this.template.url,
                alt: "template"
            }).css({
                top: this.template.y,
                left: this.template.x,
                opacity: this.template.opacity,
                width: this.template.width === -1 ? 'auto' : this.template.width
            });
            if (this.use_js_resize) {
                this.updateTransform();
                return;
            }
            this.elements.board_render.parent().prepend(this.elements.template);
        },
        initCursor: function () {
            var fn = function (evt) {
                this.elements.cursor.css("transform", "translate(" + evt.clientX + "px, " + evt.clientY + "px)");
            }.bind(this);
            this.elements.boardContainer.on("pointermove", fn).on("mousemove", fn);
        },
        initReticule: function () {
            var fn = function (evt) {
                var boardPos = this.screenToBoardSpace(evt.clientX, evt.clientY);
                boardPos.x |= 0;
                boardPos.y |= 0;

                var screenPos = this.boardToScreenSpace(boardPos.x, boardPos.y);
                this.elements.reticule.css("left", screenPos.x - 1 + "px");
                this.elements.reticule.css("top", screenPos.y - 1 + "px");
                this.elements.reticule.css("width", this.scale - 1 + "px").css("height", this.scale - 1 + "px");

                if (this.color === -1) {
                    this.elements.reticule.hide();
                } else {
                    this.elements.reticule.show();
                }
            }.bind(this);
            this.elements.board_render.on("pointermove mousemove", fn);
        },
        initCoords: function () {
            var fn = function (evt) {
                var boardPos = this.screenToBoardSpace(evt.clientX, evt.clientY);

                this.elements.coords.fadeIn(200);
                this.elements.coords.text("(" + (boardPos.x | 0) + ", " + (boardPos.y | 0) + ")");
            }.bind(this);
            var fn_touch = function (evt) {
                var boardPos = this.screenToBoardSpace(evt.originalEvent.changedTouches[0].clientX, evt.originalEvent.changedTouches[0].clientY);

                this.elements.coords.fadeIn(200);
                this.elements.coords.text("(" + (boardPos.x | 0) + ", " + (boardPos.y | 0) + ")");
            }.bind(this);
            this.elements.board_render.on("pointermove mousemove", fn).on("touchstart touchmove", fn_touch);
        },
        initAlert: function () {
            this.elements.alert.find(".button").click(function () {
                this.elements.alert.fadeOut(200);
            }.bind(this));
        },
        initSocket: function () {
            var l = window.location;
            var url = ( (l.protocol === "https:") ? "wss://" : "ws://") + l.host + l.pathname + "ws";

            var ws = new WebSocket(url);
            ws.onmessage = function (msg) {
                var data = JSON.parse(msg.data);

                if (data.type === "pixel") {
                    data.pixels.forEach(function (px) {
                        var ctx = this.elements.board[0].getContext("2d");
                        ctx.fillStyle = this.palette[px.color];
                        ctx.fillRect(px.x, px.y, 1, 1);
                    }.bind(this));
                    if (this.use_js_resize) {
                        this.updateTransform();
                    }
                } else if (data.type === "alert") {
                    this.alert(data.message);
                } else if (data.type === "cooldown") {
                    this.cooldown = new Date().getTime() + (data.wait * 1000);
                    this.updateTime(0);
                    this.hasFiredNotification = data.wait === 0;
                } else if (data.type === "captcha_required") {
                    grecaptcha.reset();
                    grecaptcha.execute();
                } else if (data.type === "captcha_status") {
                    if (data.success) {
                        var pending = this.pendingPixel;
                        this.switchColor(pending.color);
                        this.doPlace(pending.x, pending.y);
                    } else {
                        alert("Failed captcha verification")
                    }
                } else if (data.type === "users") {
                    this.elements.users.fadeIn(200);
                    this.elements.users.text(data.count + " online");
                } else if (data.type === "session_limit") {
                    ws.onclose = function () {
                    };
                    this.alert("Too many sessions open, try closing some tabs.");
                } else if (data.type === "userinfo") {
                    this.elements.userInfo.fadeIn(200);
                    this.elements.userInfo.find("span.name").text(data.name);
                    this.role = data.role;

                    if (!data.banned) {
                        this.elements.loginOverlay.hide();
                    } else {
                        this.elements.loginOverlay.text("You are banned from placing pixels. Your ban will expire on " + new Date(data.banExpiry).toLocaleString() + ".")
                    }
                }
            }.bind(this);
            ws.onclose = function () {
                setTimeout(function () {
                    window.location.reload();
                }, 10000 * Math.random() + 3000);
                this.alert("Lost connection to server, reconnecting...")
            }.bind(this);

            $(".board-container").show();
            $(".ui").show();
            $(".loading").fadeOut(500);

            this.socket = ws;
        },
        initGrid: function () {
            $(document.body).on("keydown", function (evt) {
                if (evt.keyCode === 71) {
                    this.elements.grid.fadeToggle({duration: 100});
                }
            }.bind(this));
        },
        initInfo: function () {
            $("div.open").click(function () {
                $(".info").toggleClass("open");
            });
            $(".info").addClass("open");
            $(document.body).keydown(function (evt) {
                if (evt.keyCode === 73) {
                    $(".info").toggleClass("open");
                }
                if (evt.keyCode === 80) {
                    App.saveImage();
                }
            });
            try {
                $("#audiotoggle")[0].checked = localStorage.getItem("audio_muted") === "on";
                $("#audiotoggle").change(function () {
                    localStorage.setItem("audio_muted", $(this).is(":checked") ? "on" : "off");
                });
            } catch (e) {
                console.log("Local Storage not available");
            }
        },
        adjustScale: function (adj) {
            var oldScale = this.scale;
            if (adj === -1) {
                if (oldScale <= 1) {
                    this.scale = 0.5;
                } else if (oldScale <= 2) {
                    this.scale = 1;
                } else {
                    this.scale = Math.round(Math.max(2, this.scale / 1.25));
                }
            } else {
                if (oldScale === 0.5) {
                    this.scale = 1;
                } else if (oldScale === 1) {
                    this.scale = 2;
                } else {
                    this.scale = Math.round(Math.min(50, this.scale * 1.25));
                }
            }
            this.updateTransform();
        },
        updateTransform: function () {
            this.panX = Math.min(this.width / 2, Math.max(-this.width / 2, this.panX));
            this.panY = Math.min(this.height / 2, Math.max(-this.height / 2, this.panY));

            var a = this.screenToBoardSpace(0, 0);
            this.elements.grid.css("background-size", this.scale + "px " + this.scale + "px").css("transform", "translate(" + Math.floor(-a.x % 1 * this.scale) + "px," + Math.floor(-a.y % 1 * this.scale) + "px)");
            this.elements.grid.css("opacity", (this.scale - 2) / 6);

            if (this.use_js_resize) {
                var ctx2 = this.elements.board_render[0].getContext("2d");
                var pxl_x = -this.panX + ((this.width - (window.innerWidth / this.scale)) / 2);
                var pxl_y = -this.panY + ((this.height - (window.innerHeight / this.scale)) / 2);

                ctx2.globalAlpha = 1;
                ctx2.fillStyle = '#CCCCCC';
                ctx2.fillRect(0, 0, ctx2.canvas.width, ctx2.canvas.height);
                ctx2.drawImage(this.elements.board[0], pxl_x, pxl_y, window.innerWidth / this.scale, window.innerHeight / this.scale, 0, 0, window.innerWidth, window.innerHeight);
                if (!this.template.use) {
                    return; // we are done!
                }
                var width = this.elements.template[0].width,
                    height = this.elements.template[0].height;
                if (this.template.width !== -1) {
                    height *= (this.template.width / width);
                    width = this.template.width;
                }
                ctx2.globalAlpha = this.template.opacity;
                ctx2.drawImage(this.elements.template[0], (this.template.x - pxl_x) * this.scale, (this.template.y - pxl_y) * this.scale, width * this.scale, height * this.scale);
                return;
            }
            this.elements.boardMover
                .css("width", this.width + "px")
                .css("height", this.height + "px")
                .css("transform", "translate(" + this.panX + "px, " + this.panY + "px)");
            if (this.use_zoom) {
                this.elements.boardZoomer.css("zoom", (this.scale * 100).toString() + "%");
            } else {
                this.elements.boardZoomer.css("transform", "scale(" + this.scale + ")");
            }
            this.elements.reticule.css("width", (this.scale + 1) + "px").css("height", (this.scale + 1) + "px");
        },
        screenToBoardSpace: function (screenX, screenY) {
            if (this.use_js_resize) {
                return {
                    x: -this.panX + ((this.width - (window.innerWidth / this.scale)) / 2) + (screenX / this.scale),
                    y: -this.panY + ((this.height - (window.innerHeight / this.scale)) / 2) + (screenY / this.scale)
                };
            }
            var boardBox = this.elements.board[0].getBoundingClientRect();
            if (this.use_zoom) {
                return {
                    x: (screenX / this.scale) - boardBox.left,
                    y: (screenY / this.scale) - boardBox.top
                };
            }
            return {
                x: ((screenX - boardBox.left) / this.scale),
                y: ((screenY - boardBox.top) / this.scale)
            };
        },
        boardToScreenSpace: function (boardX, boardY) {
            if (this.use_js_resize) {
                return {
                    x: (boardX + this.panX - ((this.width - (window.innerWidth / this.scale)) / 2)) * this.scale,
                    y: (boardY + this.panY - ((this.height - (window.innerHeight / this.scale)) / 2)) * this.scale
                };
            }
            var boardBox = this.elements.board[0].getBoundingClientRect();
            if (this.use_zoom) {
                return {
                    x: (boardX + boardBox.left) * this.scale,
                    y: (boardY + boardBox.top) * this.scale
                };
            }
            return {
                x: boardX * this.scale + boardBox.left,
                y: boardY * this.scale + boardBox.top
            };
        },
        centerOn: function (x, y) {
            this.panX = (this.width / 2 - x) - 0.5;
            this.panY = (this.height / 2 - y) - 0.5;

            this.updateTransform();
        },
        switchColor: function (newColor) {
            this.color = newColor;
            $(".palette-color").removeClass("active");

            if (newColor === -1) {
                this.elements.cursor.hide();
                this.elements.reticule.css("background-color", "none");
            } else {
                if (this.scale <= 15) this.elements.cursor.show();
                this.elements.cursor.css("background-color", this.palette[newColor]);
                this.elements.reticule.css("background-color", this.palette[newColor]);
                $($(".palette-color")[newColor]).addClass("active");
            }
        },
        doPlace: function (x, y) {
            var col = this.color;

            this.pendingPixel = {x: x, y: y, color: col};
            this.socket.send(JSON.stringify({
                type: "place",
                x: x,
                y: y,
                color: col
            }));

            this.switchColor(-1);
        },
        alert: function (message) {
            var alert = this.elements.alert;
            alert.find(".text").text(message);
            alert.fadeIn(200);
        },
        updateTime: function () {
            var delta = (this.cooldown - new Date().getTime()) / 1000;

            if (delta > 0) {
                this.elements.timer.show();
                var secs = Math.floor(delta % 60);
                var secsStr = secs < 10 ? "0" + secs : secs;
                var minutes = Math.floor(delta / 60);
                var minuteStr = minutes < 10 ? "0" + minutes : minutes;
                this.elements.timer.text(minuteStr + ":" + secsStr);

                $(".palette-color").css("cursor", "not-allowed");

                document.title = "[" + minuteStr + ":" + secsStr + "] pxls.space";
            } else {
                if (!this.hasFiredNotification) {

                    try {
                        if (!document.getElementById('audiotoggle').checked) {
                            notifyaudio.play();
                        }
                        new Notification("pxls.space", {
                            body: "Your next pixel is available!"
                        });
                    } catch (e) {
                        console.log("No notificatons available!");
                    }
                    this.hasFiredNotification = true;
                }

                document.title = "pxls.space";
                this.elements.timer.hide();
                $(".palette-color").css("cursor", "")
            }
            if (this.status) {
                this.elements.timer.text(this.status);
            }
        },
        saveImage: function () {
            var a = document.createElement("a");
            a.href = this.elements.board[0].toDataURL("image/png");
            a.download = "canvas.png";
            a.click();
            if (typeof a.remove === "function") {
                a.remove();
            }
        }
    };

    window.recaptchaCallback = function(token) {
        App.socket.send(JSON.stringify({
            type: "captcha",
            token: token
        }));
    };

    App.init();

    // Object.defineProperty(window, "App", {
    //     get: function () {
    //         App.socket.send(JSON.stringify({type: "banme"}));
    //         App.socket.close();
    //
    //         window.location.href = "https://www.youtube.com/watch?v=QHvKSo4BFi0";
    //     }
    // });

    if (window.initAdmin) initAdmin(App);
})();