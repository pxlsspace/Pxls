"use strict";
(function () {
    var admin = null,
        genButton = function (s) {
            return $("<div>").css({
                position: "initial",
                right: "auto",
                left: "auto",
                bottom: "auto"
            }).addClass("button").text(s);
        },
        sendAlert = function(username) {
            return $("<div>").append(
                $("<input>").attr("placeholder", "Send alert...").keydown(function (evt) {
                    if (evt.which === 13) {
                        admin.socket.send({
                            type: "admin_message",
                            username: username,
                            message: this.value
                        });
                        this.value = "";
                    }
                    evt.stopPropagation();
                })
            )
        },
        ban = (function() {
            var self = {
                elements: {
                    prompt: $("#prompt")
                },
                init: function () {
                },
                deinit: function () {
                },
                prompt: function (s, time, fn) {
                    var time_input = $("<input>").attr("type", "number").addClass("admin-bannumber").val(time);
                    self.elements.prompt.empty().append(
                        $("<p>").addClass("text").text(s),
                        $("<input>").addClass("prompt").attr("type","text").css("width", "100%").keydown(function (evt) {
                            if (evt.which === 13) {
                                fn(self.elements.prompt.find(".prompt").val());
                                self.elements.prompt.fadeOut(200);
                            }
                            evt.stopPropagation();
                        }),
                        $("<div>").addClass("text").append(
                            "Revert pixels of the last ", time_input, " hours"
                        ),
                        genButton("Cancel").css({
                            position: "fixed",
                            bottom: 20,
                            left: 30,
                        }).click(function () {
                            self.elements.prompt.fadeOut(200);
                        }),
                        genButton("OK").css({
                            position: "fixed",
                            bottom: 20,
                            right: 30
                        }).click(function () {
                            fn(self.elements.prompt.find(".prompt").val(), parseFloat(time_input.val()));
                            self.elements.prompt.fadeOut(200);
                        })
                    ).fadeIn(200);
                },
                ban_internal: function (username, fn, msg, done_msg, path, time) {
                    self.prompt(msg, time ? 0 : 24, function (reason, length) {
                        var data = {
                            username: username,
                            reason: reason,
                            rollback_time: length*3600
                        };
                        if (time) {
                            data.time = time;
                        }
                        $.post(path, data, function () {
                            admin.alert.show(done_msg + " " + username);
                            if (fn) {
                                fn();
                            }
                        }).fail(function () {
                            admin.alert.show("Something went wrong! Perhaps insufficient permissions?");
                        });
                    })
                },
                shadow: function (username, fn) {
                    self.ban_internal(username, fn, "Shadowban reason", "Shadowbanned user", "/admin/shadowban");
                },
                perma: function (username, fn) {
                    self.ban_internal(username, fn, "Permaban reason", "Permabanned user", "/admin/permaban");
                },
                ban: function (username, time, fn) {
                    self.ban_internal(username, fn, "Ban reason", "Banned user", "/admin/ban", time);
                },
                ban_24h: function (username, fn) {
                    self.ban(username, 24*3600, fn);
                },
                unban: function (username, fn) {
                    $.post("/admin/unban", {
                        username: username
                    }, function () {
                        admin.alert.show("Unbanned user "+username);
                        if (fn) {
                            fn();
                        }
                    });
                },
            };
            return {
                init: self.init,
                deinit: self.deinit,
                shadow: self.shadow,
                perma: self.perma,
                ban: self.ban,
                ban_24h: self.ban_24h,
                unban: self.unban
            };
        })(),
        style = (function() {
            var self = {
                elements: {
                    sheet: $("<link>", {rel: "stylesheet", href: "/admin/admin.css"})
                },
                init: function () {
                    self.elements.sheet.appendTo(document.head);
                },
                deinit: function () {
                    self.elements.sheet.remove();
                }
            };
            return {
                init: self.init,
                deinit: self.deinit
            };
        })(),
        checkUser = (function() {
            var self = {
                elements: {
                    check: $("<div>").addClass("admin-check")
                },
                callback: function (data) {
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
                    var items = [
                        ["Username", data.username],
                        ["Login", data.login],
                        ["Role", data.role],
                        ["Banned", bannedStr]
                    ];
                    if (banned) {
                        items.push(["Ban Reason", data.ban_reason]);
                        items.push(["Ban Expiracy", expiracyStr]);
                    }
                    self.elements.check.empty().append(
                        $.map(items, function (o) {
                            return $("<div>").append(
                                $("<b>").text(o[0]+": "),
                                $("<span>").text(o[1])
                            );
                        }),
                        sendAlert(data.username),
                        $("<div>").append(
                            genButton("Ban (24h)").click(function () {
                                ban.ban_24h(data.username, function () {
                                    self.elements.check.fadeOut(200);
                                });
                            }),
                            genButton("Permaban").click(function () {
                                ban.perma(data.username, function () {
                                    self.elements.check.fadeOut(200);
                                });
                            })
                        ),
                        $("<div>").append(
                            genButton("Unban").click(function () {
                                ban.unban(data.username, function () {
                                    self.elements.check.fadeOut(200);
                                });
                            }),
                            (admin.user.getRole() == "ADMIN" ?
                                genButton("Shadowban").click(function () {
                                    ban.shadow(data.username, function () {
                                        self.elements.check.fadeOut(200);
                                    });
                                })
                            : "")
                        ),
                        $("<div>").append(
                            $("<b>").text("Custom ban length: "), "<br>",
                            $("<input>").attr("type", "number").addClass("admin-bannumber").val(24),
                            " hours ",
                            genButton("Ban").click(function () {
                                ban.ban(data.username, parseFloat($(this).parent().find("input").val())*3600, function () {
                                    self.elements.check.fadeOut(200);
                                });
                            })
                        ),
                        genButton("Close").css({
                            position: "fixed",
                            bottom: 20,
                            right: 30
                        }).click(function () {
                            self.elements.check.fadeOut(200);
                        })
                    ).fadeIn(200);
                },
                init: function () {
                    self.elements.check.hide().appendTo(document.body);
                },
                deinit: function () {
                    self.elements.check.remove();
                },
                check: function (username) {
                    $.post("/admin/check", {
                        username: username
                    }, self.callback).fail(function () {
                        admin.alert.show("User "+username+" not found");
                    });
                }
            };
            return {
                init: self.init,
                deinit: self.deinit,
                check: self.check
            };
        })(),
        panel = (function() {
            var self = {
                elements: {
                    panel: $("<div>")
                },
                init: function () {
                    self.elements.panel.hide().addClass("admin panel").append(
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
                            $.map([
                                ["Ban user (24h)", ban.ban_24h],
                                ["Unban user", ban.unban],
                                ["Check user", checkUser.check]
                            ], function (o) {
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
                    ).appendTo(document.body).fadeIn(200);
                },
                deinint: function () {
                    self.elements.panel.remove();
                }
            };
            return {
                init: self.init,
                deinit: self.deinint
            };
        })(),
        lookup = (function() {
            var self = {
                elements: {
                    lookup: $("#lookup")
                },
                create: function (data) {
                    data.coords = "(" + data.x + ", " + data.y + ")";
                    data.time = (new Date(data.time)).toLocaleString();
                    self.elements.lookup.empty().append(
                        $.map([
                            ["Coords", "coords"],
                            ["Username", "username"],
                            ["Login", "login"],
                            ["Time", "time_str"],
                            ["Total Pixels", "pixel_count"]
                        ], function (o) {
                            return $("<div>").append(
                                $("<b>").text(o[0]+": "),
                                $("<span>").text(data[o[1]])
                            );
                        }),
                        sendAlert(data.username),
                        $("<div>").append(
                            genButton("Ban (24h)").click(function () {
                                ban.ban_24h(data.username, function () {
                                    self.elements.lookup.fadeOut(200);
                                });
                            }),
                            genButton("More...").click(function () {
                                checkUser.check(data.username);
                                self.elements.lookup.fadeOut(200);
                            }),
                            genButton("Close").click(function () {
                                self.elements.lookup.fadeOut(200);
                            })
                        )
                    ).fadeIn(200);
                },
                init: function () {
                    admin.lookup.registerHandle(self.create);
                },
                deinit: function () {
                    admin.lookup.clearHandle(self.create);
                }
            };
            return {
                init: self.init,
                deinit: self.deinit
            };
        })();
    window.initAdmin = function (_admin) {
        admin = _admin;
        ban.init();
        style.init();
        checkUser.init();
        panel.init();
        lookup.init();
    };
    window.deInitAdmin = function () {
        ban.deinit();
        style.deinit();
        checkUser.deinit();
        panel.deinit();
        lookup.deinit();
    };
})();
