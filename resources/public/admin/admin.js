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
            if (admin.user.getRole() === "TRIALMOD") return "";
            return $("<input>").attr("placeholder", "Send alert...").keydown(function (evt) {
				if (evt.which === 13) {
					admin.socket.send({
						type: "admin_message",
						username: username,
						message: this.value
					});
					this.value = "";
				}
				evt.stopPropagation();
			});
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
                    var time_input = $("<input>").attr("type", "number").attr("step", "any").addClass("admin-bannumber").val(time);
                    self.elements.prompt.empty().append(
                        $("<p>").addClass("text").css({
                            fontWeight: 800,
                            marginTop: 0
                        }).text(s),
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
                            fn(msg, parseFloat(time_input.val()));
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
                    self.ban_internal(username, fn, "Shadowban user", "Shadowbanned user", "/admin/shadowban");
                },
                perma: function (username, fn) {
                    self.ban_internal(username, fn, "Permaban user", "Permabanned user", "/admin/permaban");
                },
                ban: function (username, time, fn) {
                    self.ban_internal(username, fn, "Ban user", "Banned user", "/admin/ban", time);
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
                    var delta = (data.banExpiry - (new Date()).getTime()) / 1000,
                        chatbanDelta = (data.chatbanExpiry - (new Date()).getTime()) / 1000,
                        secs = Math.floor(delta % 60),
                        secsStr = secs < 10 ? "0" + secs : secs,
                        minutes = Math.floor((delta / 60)) % 60,
                        minuteStr = minutes < 10 ? "0" + minutes : minutes,
                        hours = Math.floor(delta / 3600),
                        hoursStr = hours < 10 ? "0" + hours : hours,
                        banned = data.banned,
                        bannedStr = "",
                        expiracyStr = hoursStr+":"+minuteStr+":"+secsStr,
                        chatbannedStr = "",
                        chabannedExpiracyStr = `${chatbanDelta >> 0}s`;
                        // chabannedExpiracyStr = `${(chatbanDelta/3600) >> 0}h ${((chatbanDelta/60) >> 0) % 60}m ${(delta % 60) >> 0}s`;
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
                    chatbannedStr = data.chatbanIsPerma ? `Yes (permanent)` : (data.chatBanned ? `Yes` : `No`);
                    var items = [
                        ["Username", data.username],
                        ["Login", data.login],
                        ["Role", data.role],
                        ["Rename Requested", data.renameRequested ? "Yes" : "No"],
                        ["Banned", bannedStr],
                        ["Chatbanned", chatbannedStr]
                    ];
                    if (banned) {
                        items.push(["Ban Reason", data.ban_reason]);
                        items.push(["Ban Expiracy", expiracyStr]);
                    }
                    if (data.chatBanned) {
                        items.push(["Chatban Reason", data.chatbanReason]);
                        if (!data.isChatbanPerma) {
                            items.push(["Chatban Expires", chabannedExpiracyStr])
                        }
                    }
                    self.elements.check.empty().append(
                        $.map(items, function (o) {
                            return $("<div>").append(
                                $("<b>").text(o[0]+": "),
                                $("<span>").text(o[1])
                            );
                        }),
                        $("<div>").append(sendAlert(data.username)),
                        $("<div>").append(
                            genButton("Ban (24h)").click(function () {
                                ban.ban_24h(data.username, function () {
                                    self.elements.check.fadeOut(200);
                                });
                            }),
                            (admin.user.getRole() !== "TRIALMOD" ? genButton("Permaban").click(function () {
                                ban.perma(data.username, function () {
                                    self.elements.check.fadeOut(200);
                                });
                            }) : "")
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
                        crel('div',
                            crel('button', {'data-action': 'chatban', 'data-target': data.username, 'class': 'button', 'style': 'position: initial; right: auto; left: auto; bottom: auto;', onclick: admin.chat._handleActionClick}, 'Chat (un)ban'),
                            crel('button', {'data-action': 'purge', 'data-target': data.username, 'class': 'button', 'style': 'position: initial; right: auto; left: auto; bottom: auto;', onclick: admin.chat._handleActionClick}, 'Chat purge')
                        ),
                        (admin.user.getRole() !== "TRIALMOD"
                                ? crel('div',
                                    crel('button', {'data-action': 'request-rename', 'data-target': data.username, 'class': 'button', 'style': 'position: initial; right: auto; left: auto; bottom: auto;', onclick: admin.chat._handleActionClick}, 'Request Rename'),
                                    (admin.user.getRole() == "ADMIN" || admin.user.getRole() == "DEVELOPER" ? crel('button', {'data-action': 'force-rename', 'data-target': data.username, 'class': 'button', 'style': 'position: initial; right: auto; left: auto; bottom: auto;', onclick: admin.chat._handleActionClick}, 'Force Rename') : '')
                                )
                                : ''
                        ),
                        $("<div>").append(
                            $("<b>").text("Custom ban length: "), "<br>",
                            $("<input>").attr("type", "number").attr("step", "any").addClass("admin-bannumber").val(24),
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
                    self.elements.panel.hide().addClass("admin").append(
                        $("<h1>").text("MOD"),
                        $("<div>").append(
                            // first do the checkboxes
                            $.map(
                                [
                                    {
                                        text: "Disable hand reset",
                                        onChange: function() {
                                            admin.place.setAutoReset(!this.checked);
                                        },
                                        checkState: false,
                                        disabled: false
                                    },
                                    {
                                        text: "Override cooldown",
                                        onChange: function() {
                                            admin.socket.send({type: "admin_cdoverride", override: this.checked});
                                        },
                                        checkState: admin.cdOverride,
                                        disabled: admin.user.getRole() === "TRIALMOD"
                                    }
                                ],
                                function(cbox) {
                                    return $("<label>").text(cbox.text).append(
                                        $("<input>").attr("type", "checkbox").prop("checked", !!cbox.checkState).prop("disabled", !!cbox.disabled).change(cbox.onChange)
                                    )
                                }
                            ),
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
                /**
                 * Register hooks for admin-specific lookups.
                 */
                init: function () {
                    App.lookup.registerHook({
                        id: "login",
						name: "Login",
						sensitive: true,
						get: data => {
                            var addMonoClass = localStorage.getItem("monospace_lookup") === "true" ? " useMono" : ""
                            return $("<div class=\"monoVal" + addMonoClass + "\">").text(data.login)
                        }
                    }, {
                        id: "user_agent",
						name: "User Agent",
						sensitive: true,
						get: data => {
                            var addMonoClass = localStorage.getItem("monospace_lookup") === "true" ? " useMono" : ""
                            return $("<div class=\"monoVal" + addMonoClass + "\">").text(data.userAgent)
                        }
                    }, {
						id: "alert",
						name: "Send Alert",
						sensitive: true,
						get: data => sendAlert(data.username),
					}, {
                        id: "admin_actions",
                        name: "Mod Actions",
                        sensitive: true,
                        get: data => $("<span>").append(
							genButton("Ban (24h)").click(() => {
								ban.ban_24h(data.username, function () {
									self.elements.lookup.fadeOut(200);
								});
							}),
							genButton("More...").click(() => {
								checkUser.check(data.username);
								self.elements.lookup.fadeOut(200);
							}),
						),
                    });
                },
                /**
                 * Unregister hooks for admin-specific lookups.
                 */
                deinit: function () {
                    App.lookup.unregisterHook("login");
                    App.lookup.unregisterHook("user_agent");
                    App.lookup.unregisterHook("day_ban");
                    App.lookup.unregisterHook("more");
                }
            };
            return {
                init: self.init,
                deinit: self.deinit
            };
        })();
    window.initAdmin = function (_admin, cb) {
        admin = _admin;
        ban.init();
        style.init();
        checkUser.init();
        panel.init();
        lookup.init();
        if (cb && (typeof cb === "function")) {
            cb({ban, style, checkUser, panel, lookup});
        }
    };
    window.deInitAdmin = function () {
        ban.deinit();
        style.deinit();
        checkUser.deinit();
        panel.deinit();
        lookup.deinit();
    };
})();
