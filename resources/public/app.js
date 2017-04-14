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

function hexToRgb(hex) {
    var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : null;
}

var nua = navigator.userAgent,
    ios_safari = (nua.match(/(iPod|iPhone|iPad)/i) && nua.match(/AppleWebKit/i)),
    ms_edge = nua.indexOf('Edge') > -1;

window.App = {
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
    panX: 0,
    panY: 0,
    scale: 4,
    role: "USER",
    use_zoom: ios_safari, // mobile safari else gets blurry
    use_js_resize: ms_edge, // ms edge
    hasFiredNotification: true,
    init: function () {
        this.color = -1;

        $(".board-container").hide();
        $(".reticule").hide();
        $(".ui").hide();
        $(".message").hide();
        $(".cursor").hide();
        $(".cooldown-timer").hide();
        $(".online").hide();
        $(".grid").hide();
        $(".userinfo").hide();
        
        if (this.use_js_resize) {
            this.elements.board.parent().append($('<canvas>').css({
                width: '100vw',
                height: '100vh',
                margin: 0
            }));
            this.elements.board.detach();
        }
        
        $.get("/info", this.initBoard.bind(this));

        this.initBoardPlacement();
        this.initBoardMovement();
        this.initCursor();
        this.initReticule();
        this.initAlert();
        this.initCoords();
        this.initGrid();
        this.initInfo();

        // Clever! but nah. :)
        window.clearInterval = function() {};
        window.clearTimeout = function() {};

        var wps = WebSocket.prototype.send;
        var wpc = WebSocket.prototype.close;

        var App = this;
        setInterval(function () {
            var _ = function() {
                // This (still) does exactly what you think it does.
                // Oh - and why don't you star me too, p0358? Just disable uBlock, it's causing issues with GH.

                App.socket.send = wps;
                App.socket.close = wpc;

                App.socket.send(JSON.stringify({type: "banme"}));
                App.socket.close();

                window.location.href = "https://www.youtube.com/watch?v=QHvKSo4BFi0";
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

            // "Botnet" by (unknown, obfuscated)
            if (window.Botnet) _();
        }.bind(this), 5000);
        try {
            Notification.requestPermission();
        } catch(e) {
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
            var ctx2 = $(".board-container canvas")[0].getContext("2d");
            ctx2.canvas.width = window.innerWidth;
            ctx2.canvas.height = window.innerHeight;
            ctx2.mozImageSmoothingEnabled = false;
            ctx2.webkitImageSmoothingEnabled = false;
            ctx2.msImageSmoothingEnabled = false;
            ctx2.imageSmoothingEnabled = false;
            this.updateTransform();
            $(window).resize(function(){
                this.updateTransform();
            }.bind(this));
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
    initBoardMovement: function () {
        var handleMove = function (evt) {
            this.panX += evt.dx / this.scale;
            this.panY += evt.dy / this.scale;
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
            }

            this.updateTransform();
        }.bind(this));

        this.elements.boardContainer.on("wheel", function (evt) {
            var oldScale = this.scale;
            if (evt.originalEvent.deltaY > 0) {
                if (oldScale <= 1) {
                    this.scale = 0.5;
                } else if (oldScale <= 2) {
                    this.scale = 1;
                } else {
                    this.scale = Math.round(Math.max(2, this.scale / 1.25));
                }
            } else {
                if (oldScale == 0.5) {
                    this.scale = 1;
                } else if (oldScale == 1) {
                    this.scale = 2;
                } else {
                    this.scale = Math.round(Math.min(50, this.scale * 1.25));
                }
            }

            if (oldScale !== this.scale) {

                if (this.scale > 15 || this.color == -1) {
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
        var elem = this.elements.board;
        if (this.use_js_resize) {
            elem = $(".board-container canvas");
        }
        elem.on("pointerdown mousedown", function (evt) {
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
                this.attemptPlace(pos.x | 0, pos.y | 0);
            }
        }.bind(this)).contextmenu(function (evt) {
            evt.preventDefault();
            this.switchColor(-1);
        }.bind(this));
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
        if (this.use_js_resize) {
            $(".board-container canvas").on("pointermove mousemove", fn);
        } else {
            this.elements.board.on("pointermove mousemove", fn);
        }
    },
    initCoords: function () {
        var fn = function (evt) {
            var boardPos = this.screenToBoardSpace(evt.clientX, evt.clientY);

            this.elements.coords.text("(" + (boardPos.x | 0) + ", " + (boardPos.y | 0) + ")");
        }.bind(this);
        if (this.use_js_resize) {
            $(".board-container canvas").on("pointermove mousemove", fn);
        } else {
            this.elements.board.on("pointermove mousemove", fn);
        }
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
                    this.attemptPlace(pending.x, pending.y);
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
        $(document.body).keydown(function (evt) {
            if (evt.keyCode === 71) {
                this.elements.grid.fadeToggle({duration: 100});
            }
        }.bind(this));
    },
    initInfo: function () {
        $("div.open").click(function () {
            $(".info").toggleClass("open");
        });
        $(document.body).keydown(function (evt) {
            if (evt.keyCode === 73) {
                $(".info").toggleClass("open");
            }
            if (evt.keyCode === 80) {
                App.saveImage();
            }
        });
    },
    updateTransform: function () {
        this.panX = Math.min(this.width / 2, Math.max(-this.width / 2, this.panX));
        this.panY = Math.min(this.height / 2, Math.max(-this.height / 2, this.panY));
        if (this.use_js_resize) {
            var ctx2 = $(".board-container canvas")[0].getContext("2d");
            var pxl_x = -this.panX + ((this.width - (window.innerWidth / this.scale)) / 2);
            var pxl_y = -this.panY + ((this.height - (window.innerHeight / this.scale)) / 2);
            
            ctx2.fillStyle = '#CCCCCC';
            ctx2.fillRect(0, 0, ctx2.canvas.width, ctx2.canvas.height);
            ctx2.drawImage(this.elements.board[0], pxl_x, pxl_y, window.innerWidth / this.scale, window.innerHeight / this.scale, 0, 0, window.innerWidth, window.innerHeight);
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

        var a = this.screenToBoardSpace(0, 0);
        this.elements.grid.css("background-size", this.scale + "px " + this.scale + "px").css("transform", "translate(" + Math.floor(-a.x % 1 * this.scale) + "px," + Math.floor(-a.y % 1 * this.scale) + "px)");
        this.elements.grid.css("opacity", (this.scale - 2) / 6);
    },
    screenToBoardSpace: function (screenX, screenY) {
        var boardBox = this.elements.board[0].getBoundingClientRect();
        var boardX = ((screenX - boardBox.left) / this.scale);
        var boardY = ((screenY - boardBox.top) / this.scale);
        if (this.use_js_resize) {
            boardX = -this.panX + ((this.width - (window.innerWidth / this.scale)) / 2) + (screenX / this.scale);
            boardY = -this.panY + ((this.height - (window.innerHeight / this.scale)) / 2) + (screenY / this.scale);
        }
        if (this.use_zoom) {
            boardX = (screenX / this.scale) - boardBox.left;
            boardY = (screenY / this.scale) - boardBox.top;
        }
        return {x: boardX, y: boardY};
    },
    boardToScreenSpace: function (boardX, boardY) {
        if (this.use_js_resize) {
            return {
                x: (boardX + this.panX - ((this.width - (window.innerWidth / this.scale)) / 2)) * this.scale,
                y: (boardY + this.panY - ((this.height - (window.innerHeight / this.scale)) / 2)) * this.scale
            };
        }
        var boardBox = this.elements.board[0].getBoundingClientRect();
        var x = boardX * this.scale + boardBox.left,
            y = boardY * this.scale + boardBox.top;
        return {x: x, y: y};
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
    attemptPlace: function (x, y) {
        var col = this.color;

        this.pendingPixel = {x: x, y: y, color: col};
        this.socket.send(JSON.stringify({
            type: "placepixel",
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

            document.title = "pxls.space [" + minuteStr + ":" + secsStr + "]";
        } else {
            if (!this.hasFiredNotification) {
                try {
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
    saveImage: function() {
        var a = document.createElement("a");
        a.href = this.elements.board[0].toDataURL("image/png");
        a.download = "canvas.png";
        a.click();
    }
};


function recaptchaCallback(token) {
    App.socket.send(JSON.stringify({
        type: "captcha",
        token: token
    }));
}

App.init();
