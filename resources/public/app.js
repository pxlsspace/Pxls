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
        grid: $(".grid")
    },
    panX: 0,
    panY: 0,
    scale: 4,
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

        $.get("/boardinfo", this.initBoard.bind(this));

        this.initBoardMovement();
        this.initBoardPlacement();
        this.initCursor();
        this.initReticule();
        this.initAlert();
        this.initCoords();
        this.initUsers();
        this.initGrid();
        this.initInfo();
        Notification.requestPermission();
    },
    initBoard: function (data) {
        this.width = data.width;
        this.height = data.height;
        this.palette = data.palette;

        this.initPalette();

        this.elements.board.attr("width", this.width).attr("height", this.height);

        this.updateTransform();

        var cx = getQueryVariable("x") || this.width / 2;
        var cy = getQueryVariable("y") || this.height / 2;
        this.centerOn(cx, cy);

        this.scale = getQueryVariable("scale") || this.scale;
        this.updateTransform();

        this.initSocket();
        setInterval(this.updateTime.bind(this), 1000);
        jQuery.get("/boarddata", this.drawBoard.bind(this));
    },
    drawBoard: function (data) {
        var ctx = this.elements.board[0].getContext("2d");

        var id = new ImageData(this.width, this.height);
        var intView = new Uint32Array(id.data.buffer);

        var rgbPalette = this.palette.map(function (c) {
            var rgb = hexToRgb(c);
            return 0xff000000 | rgb.b << 16 | rgb.g << 8 | rgb.r;
        });

        for (var i = 0; i < this.width * this.height; i++) {
            intView[i] = rgbPalette[data.charCodeAt(i)];
        }

        ctx.putImageData(id, 0, 0);
    },
    initPalette: function () {
        this.palette.forEach(function (color, idx) {
            $("<div>")
                .addClass("palette-color")
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
        var dragX = 0;
        var dragY = 0;
        var down = false;

        this.elements.boardContainer.on("mousedown", function (evt) {
            dragX = evt.screenX;
            dragY = evt.screenY;
            down = true;
        }.bind(this)).on("mousemove", function (evt) {
            if (!down) return;
            var dx = evt.screenX - dragX,
                dy = evt.screenY - dragY;
            this.panX += dx / this.scale;
            this.panY += dy / this.scale;
            dragX = evt.screenX;
            dragY = evt.screenY;

            this.updateTransform()
        }.bind(this)).on("mouseup", function (evt) {
            down = false;
        }.bind(this)).on("mouseout", function (evt) {
            down = false;
        }.bind(this)).on("wheel", function (evt) {
            var oldScale = this.scale;

            if (evt.originalEvent.deltaY > 0) {
                this.scale /= 2
            } else {
                this.scale *= 2;
            }

            this.scale = Math.min(40, Math.max(2, this.scale));

            var dx = evt.clientX - this.elements.boardContainer.width() / 2;
            var dy = evt.clientY - this.elements.boardContainer.height() / 2;

            this.panX -= dx / oldScale;
            this.panX += dx / this.scale;

            this.panY -= dy / oldScale;
            this.panY += dy / this.scale;

            this.updateTransform();
        }.bind(this));

        $(document.body).on("keydown", function(evt) {
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
    },
    initBoardPlacement: function () {
        var downX, downY;

        this.elements.board.on("mousedown", function (evt) {
            downX = evt.clientX;
            downY = evt.clientY;
        }).on("click", function (evt) {
            if (downX === evt.clientX && downY === evt.clientY && this.color !== -1 && this.cooldown < new Date().getTime()) {
                var pos = this.screenToBoardSpace(evt.clientX, evt.clientY);
                this.place(pos.x | 0, pos.y | 0);
            }
        }.bind(this)).contextmenu(function (evt) {
            evt.preventDefault();
            this.switchColor(-1);
        }.bind(this));
    },
    initCursor: function () {
        $(document.body).on("mousemove", function (evt) {
            this.elements.cursor.css("transform", "translate(" + evt.clientX + "px, " + evt.clientY + "px)");
        }.bind(this));
    },
    initReticule: function () {
        this.elements.board.on("mousemove", function (evt) {
            var boardPos = this.screenToBoardSpace(evt.clientX, evt.clientY);
            boardPos.x |= 0;
            boardPos.y |= 0;

            var screenPos = this.boardToScreenSpace(boardPos.x, boardPos.y);
            this.elements.reticule.css("transform", "translate(" + screenPos.x + "px, " + screenPos.y + "px)");
            this.elements.reticule.css("width", this.scale - 1 + "px").css("height", this.scale - 1 + "px");

            if (this.color === -1) {
                this.elements.reticule.hide();
            } else {
                this.elements.reticule.show();
            }
        }.bind(this));
    },
    initCoords: function () {
        this.elements.board.on("mousemove", function (evt) {
            var boardPos = this.screenToBoardSpace(evt.clientX, evt.clientY);

            this.elements.coords.text("(" + (boardPos.x | 0) + ", " + (boardPos.y | 0) + ")");
        }.bind(this));
    },
    initAlert: function () {
        this.elements.alert.find(".close").click(function () {
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
                var ctx = this.elements.board[0].getContext("2d");
                ctx.fillStyle = this.palette[data.color];
                ctx.fillRect(data.x, data.y, 1, 1);
            } else if (data.type === "alert") {
                this.alert(data.message);
            } else if (data.type === "cooldown") {
                this.cooldown = new Date().getTime() + (data.wait * 1000);
                this.updateTime(0);
                this.hasFiredNotification = data.wait === 0;
            }
        }.bind(this);
        ws.onclose = function () {
            setTimeout(function () {
                window.location.reload();
            }, 10000 * Math.random());
        };

        $(".board-container").show();
        $(".ui").show();
        $(".loading").fadeOut(500);

        this.socket = ws;
    },
    initUsers: function () {
        var update = function () {
            $.get("/users", function (data) {
                this.elements.users.fadeIn(200);
                this.elements.users.text(data + " online");
            }.bind(this));
        };
        setInterval(update.bind(this), 15000);
        update.bind(this)();
    },
    initGrid: function () {
        $(document.body).keydown(function(evt) {
            if (evt.keyCode === 71) {
                this.elements.grid.fadeToggle(200);
            }
        }.bind(this));
    },
    initInfo: function() {
        $(document.body).keydown(function(evt) {
            if (evt.keyCode === 72) {
                $(".instructions").fadeToggle(200);
                $(".bubble-container").fadeToggle(200);
            }
        });
    },
    updateTransform: function () {
        this.elements.boardMover
            .css("width", this.width + "px")
            .css("height", this.height + "px")
            .css("transform", "translate(" + this.panX + "px, " + this.panY + "px)");
        this.elements.boardZoomer.css("transform", "scale(" + this.scale + ")");

        var xx = this.screenToBoardSpace(0, 0);
        this.elements.grid
            .css("background-size", this.scale + "px " + this.scale + "px")
            .css("transform", "translate(" + Math.floor((-xx.x % 1) * this.scale) + "px," + Math.floor((-xx.y % 1) * this.scale) + "px)");
    },
    screenToBoardSpace: function (screenX, screenY) {
        var boardBox = this.elements.board[0].getBoundingClientRect();
        var boardX = (((screenX - boardBox.left) / this.scale)),
            boardY = (((screenY - boardBox.top) / this.scale));
        return {x: boardX, y: boardY};
    },
    boardToScreenSpace: function (boardX, boardY) {
        var boardBox = this.elements.board[0].getBoundingClientRect();
        var x = boardX * this.scale + boardBox.left,
            y = boardY * this.scale + boardBox.top;
        return {x: x, y: y};
    },
    centerOn: function (x, y) {
        this.panX = (500 - x) - 0.5;
        this.panY = (500 - y) - 0.5;
        this.updateTransform();
    },
    switchColor: function (newColor) {
        this.color = newColor;

        if (newColor === -1) {
            this.elements.cursor.hide();
        } else {
            this.elements.cursor.show();
            this.elements.cursor.css("background-color", this.palette[newColor]);
        }
    },
    place: function (x, y) {
        this.socket.send(JSON.stringify({
            x: x,
            y: y,
            color: this.color
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

            document.title = "Pxls.space [" + minuteStr + ":" + secsStr + "]";
        } else {
            if (!this.hasFiredNotification) {
                new Notification("Pxls.space", {
                    body: "Your next pixel is available!"
                });
                this.hasFiredNotification = true;
            }

            document.title = "Pxls.space";
            this.elements.timer.hide();
            $(".palette-color").css("cursor", "")
        }
    }
};

App.init();