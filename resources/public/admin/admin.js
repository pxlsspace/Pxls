$("<link/>", {rel: "stylesheet", href: "/admin/admin.css"}).appendTo(document.head);
var modPanelHTML = "<div class=\'admin panel\'>\n    <h1>MOD</h1>\n    <div>\n        <input type=\'checkbox\' id=\'admin-hr\'>\n        <label for=\'admin-hr\'>Disable hand reset</label>\n    </div>\n\n    <div>\n        <input type=\'checkbox\' id=\'admin-co\'>\n        <label for=\'admin-co\'>Override cooldown</label>\n    </div>\n\n    <input id=\'admin-ban\' type=\'text\' placeholder=\'Ban user (24h)\'>\n    <input id=\'admin-unban\' type=\'text\' placeholder=\'Unban user (24h)\'>\n</div>";
var lookupPanelHTML = "<div class=\'admin-lookup\'>\n    <div><b>Coords: </b><span id=\'lookup-coords\'></span></div>\n    <div><b>Username: </b><span id=\'lookup-user\'></span></div>\n    <div><b>Login: </b><span id=\'lookup-login\'></span></div>\n    <div><b>Time: </b><span id=\'lookup-time\'></span></div>\n    <div><input id=\'lookup-msg\' placeholder=\'Send alert...\'></div>\n    <div><div class=\'button\' id=\'lookup-ban\'>Ban (24h)</div><div class=\'button\' id=\'lookup-close\'>Close</div></div>\n</div>";

function initAdmin(admin) {
    function addAdminPanel() {
        var adminRoot = $("<div></div>").appendTo(document.body).html(modPanelHTML);

        var handReset = $("#admin-hr").change(function () {
            var state = this.checked;
            admin.place.setAutoReset(!state);
        });

        var cooldownOverride = $("#admin-co").change(function () {
            var state = this.checked;
            admin.socket.send({type: "admin_cdoverride", override: state});
        });

        var banInput = $("#admin-ban").on("keydown", function (evt) {
            if (evt.which === 13) {
                $.post("/admin/ban", {username: banInput.val()}, function () {
                });
                banInput.val("");
            }
            evt.stopPropagation();
        });

        var unbanInput = $("#admin-unban").on("keydown", function (evt) {
            if (evt.which === 13) {
                $.post("/admin/unban", {username: unbanInput.val()}, function () {
                });
                unbanInput.val("");
            }
            evt.stopPropagation();
        });

        if (admin.user.getRole() !== "ADMIN") {
            banInput.hide();
            unbanInput.hide();
        }
    }

    function addLookupPanel() {
        var u = {u: null};
        var lookupPanel = $("<div />").html(lookupPanelHTML).hide().appendTo(document.body);

        var coords = $("#lookup-coords");
        var user = $("#lookup-user");
        var login = $("#lookup-login");
        var time = $("#lookup-time");
        var message = $("#lookup-msg").on("keydown", function (evt) {
            if (evt.which === 13) {
                admin.socket.send({
                    type: "admin_message",
                    username: u.u.username,
                    message: $(this).val()
                });
                message.val("");
            }
            evt.stopPropagation();
        });

        var ban = $("#lookup-ban").on("click", function () {
            $.post("/admin/ban", {username: u.u.username}, function () {
            });

            lookupPanel.fadeOut(200);
            u.u = null;
        });
        if (admin.user.getRole() !== "ADMIN") {
            ban.hide();
        }

        var close = $("#lookup-close").on("click", function () {
            lookupPanel.fadeOut(200);
            u.u = null;
        });

        admin.board.getRenderBoard().on("click", function (evt) {
            if (evt.shiftKey) {
                var pos = admin.board.fromScreen(evt.clientX, evt.clientY);

                $.get("/lookup", {x: Math.floor(pos.x), y: Math.floor(pos.y)}, function (data) {
                    if (data) {
                        u.u = data;
                        lookupPanel.fadeIn(200);

                        coords.text("(" + data.x + ", " + data.y + ")");
                        user.text(data.username);
                        login.text(data.login);
                        time.text(new Date(data.time).toLocaleString());
                    }
                });
            }
        });
    }

    setTimeout(function () {
        addAdminPanel();
        addLookupPanel();
    }, 2000);
}
