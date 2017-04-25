$("<link/>", {rel: "stylesheet", href: "/admin/admin.css"}).appendTo(document.head);
var modPanelHTML = "<div class=\'admin panel\'>\n    <h1>MOD</h1>\n    <div>\n        <input type=\'checkbox\' id=\'admin-hr\'>\n        <label for=\'admin-hr\'>Disable hand reset</label>\n    </div>\n\n    <div>\n        <input type=\'checkbox\' id=\'admin-co\'>\n        <label for=\'admin-co\'>Override cooldown</label>\n    </div>\n\n    <input id=\'admin-ban\' type=\'text\' placeholder=\'Ban user (24h)\'>\n    <input id=\'admin-unban\' type=\'text\' placeholder=\'Unban user (24h)\'>\n    <input id=\'admin-checkrole\' type=\'text\' placeholder=\'Check user\'>\n</div>";
var lookupPanelHTML = "<div class=\'admin-lookup\'>\n    <div><b>Coords: </b><span id=\'lookup-coords\'></span></div>\n    <div><b>Username: </b><span id=\'lookup-user\'></span></div>\n    <div><b>Login: </b><span id=\'lookup-login\'></span></div>\n    <div><b>Time: </b><span id=\'lookup-time\'></span></div>\n    <div><input id=\'lookup-msg\' placeholder=\'Send alert...\'></div>\n    <div><div class=\'button\' id=\'lookup-ban\'>Ban (24h)</div><div class=\'button\' id=\'lookup-close\'>Close</div></div>\n</div>";

(function () {
    var elements = [],
        admin = null,
        checkUserCallback = function (data) {
            var delta = (data.ban_expiry - (new Date()).getTime()) / 1000,
                secs = Math.floor(delta % 60),
                secsStr = secs < 10 ? "0" + secs : secs,
                minutes = Math.floor((delta / 60)) % 60,
                minuteStr = minutes < 10 ? "0" + minutes : minutes,
                hours = Math.floor(delta / 3600),
                hoursStr = hours < 10 ? "0" + hours : hours,
                banned = data.banned,
                bannedStr = "",
                expiracyStr = hoursStr+":"+minuteStr+":"+secsStr;
            if (data.role == "SHADOWBANNED") {
                bannedStr = "shadow";
                banned = true;
                expiracyStr = "never";
            } else if (data.role == "BANNED") {
                bannedStr = "permanent";
                banned = true;
                expiracyStr = "never";
            } else {
                bannedStr = banned ? "yes" : "no";
            }
            function genButton () {
                return $("<div>").css("position","initial").addClass("button");
            }
            admin.alert.show($("<div>").append("Username: "+data.name+"<br>"+
                "Role: "+data.role+"<br>"+
                "Banned: "+bannedStr+(banned?"<br>"+
                    "Ban Reason: "+$("<div>").text(data.ban_reason).html()+"<br>"+
                    "Ban Expiracy: "+expiracyStr
                :""),
                $("<div>").append(
                    genButton().text("Ban (24h)").click(function () {
                        $.post("/admin/ban", {
                            username: data.name,
                            reason: prompt("Ban reason")
                        }, function () {
                            admin.alert.show("Banned!");
                        });
                    }),
                    genButton().text("Permaban").click(function () {
                        $.post("/admin/permaban", {
                            username: data.name,
                            reason: prompt("Ban reason")
                        }, function () {
                            admin.alert.show("Banned permanently!");
                        });
                    })
                ),
                $("<div>").append(
                    genButton().text("Unban").click(function () {
                        $.post("/admin/unban", {
                            username: data.name
                        }, function () {
                            admin.alert.show("Unbanned!");
                        });
                    }),
                    (admin.user.getRole() == "ADMIN" ?
                        genButton().text("Shadowban").click(function () {
                            $.post("/admin/shadowban", {
                                username: data.name,
                                reason: prompt("Ban reason")
                            }, function () {
                                admin.alert.show("Shadowbanned!");
                            });
                        })
                    : "")
                )
            ));
        },
        checkUser = function (username) {
            $.post("/admin/check", {username: username}, checkUserCallback).fail(function () {
                admin.alert.show("User not found");
            });
        },
        modPanel = function () {
            return $("<div>").addClass("admin panel").append(
                $("<h1>").text("MOD"),
                $("<div>").append(
                    // first do the checkboxes
                    $.map([["Disable hand reset", function () {
                        admin.place.setAutoReset(!this.checked);
                    }], ["Override cooldown", function () {
                        admin.socket.send({type: "admin_cdoverride", override: this.checked});
                    }]], function (o) {
                        return $("<label>").text(o[0]).append(
                            $("<input>").attr("type", "checkbox").change(o[1])
                        )
                    }),
                    // next do the text input
                    $.map([["Ban user (24h)", function (username) {
                        $.post("/admin/ban", {
                            username: username,
                            reason: prompt("Ban reason")}
                        );
                    }], ["Unban user", function (username) {
                        $.post("/admin/unban", {username: unbanInput.val()});
                    }], ["Check user", checkUser]], function (o) {
                        return $("<input>").attr({
                            type: "text",
                            placeholder: o[0]
                        }).on("keydown", function (evt) {
                            if (evt.which === 13) {
                                o[1](this.value);
                                this.value = "";
                            }
                            evt.stopPropagation();
                        })
                    })
                )
            );
        },
        lookupPaneElements = {
            pane: null,
            coords: $("<span>"),
            user: $("<span>"),
            login: $("<span>"),
            time: $("<span>")
        },
        lookupPaneUser = {
            u: null
        },
        lookupPanelEvt = function (evt) {
            if (evt.shiftKey) {
                var pos = admin.board.fromScreen(evt.clientX, evt.clientY);

                $.get("/lookup", {x: Math.floor(pos.x), y: Math.floor(pos.y)}, function (data) {
                    if (data) {
                        lookupPaneUser.u = data;
                        lookupPaneElements.pane.fadeIn(200);

                        lookupPaneElements.coords.text("(" + data.x + ", " + data.y + ")");
                        lookupPaneElements.user.text(data.username);
                        lookupPaneElements.login.text(data.login);
                        lookupPaneElements.time.text(new Date(data.time).toLocaleString());
                    }
                });
            }
        },
        lookupPanel = function () {
            lookupPaneElements.pane =  $("<div>").addClass("admin-lookup").append(
                $.map([
                    ["Coords", "coords"],
                    ["Username", "user"],
                    ["Login", "login"],
                    ["Time", "time"]
                ], function (o) {
                    return $("<div>").append(
                        $("<b>").text(o[0]+": "),
                        lookupPaneElements[o[1]]
                    );
                }),
                $("<div>").append(
                    $("<input>").attr("placeholder", "Send alert...").on("keydown", function (evt) {
                        if (evt.which === 13) {
                            admin.socket.send({
                                type: "admin_message",
                                username: lookupPaneUser.u.username,
                                message: this.value
                            });
                            this.value = "";
                        }
                        evt.stopPropagation();
                    })
                ),
                $("<div>").append(
                    $("<div>").addClass("button").text("Ban (24h)").click(function () {
                        $.post("/admin/ban", {
                            username: lookupPaneUser.u.username,
                            reason: prompt("Ban reason")
                        });
                        lookupPaneElements.pane.fadeOut(200);
                        lookupPaneUser.u = null;
                    }),
                    $("<div>").addClass("button").text("More...").click(function () {
                        checkUser(lookupPaneUser.u.username);
                        lookupPaneElements.pane.fadeOut(200);
                        lookupPaneUser.u = null;
                    }),
                    $("<div>").addClass("button").text("Close").click(function () {
                        lookupPaneElements.pane.fadeOut(200);
                        lookupPaneUser.u = null;
                    })
                )
            ).hide();
            return lookupPaneElements.pane;
        };
    window.initAdmin = function (_admin) {
        admin = _admin;
        elements = [
            modPanel(),
            lookupPanel()
        ];
        elements.map(function (e) {
            e.appendTo(document.body);
        });
        admin.board.getRenderBoard().on("click", lookupPanelEvt);
    };
    window.deInitAdmin = function () {
        elements.map(function (e) {
            e.remove();
        });
        elements = [];
        admin.board.getRenderBoard().off("click", lookupPanelEvt);
    };
})();
