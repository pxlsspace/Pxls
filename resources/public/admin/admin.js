var App = window.App;
App.attemptPlace_ = App.attemptPlace;
App.attemptPlace = function (x, y) {
    var oldColor = App.color;
    App.attemptPlace_(x, y);

    if (handReset.prop("checked")) {
        App.switchColor(oldColor);
    }
};

$("<link/>", {rel: "stylesheet", href: "/admin/admin.css"}).appendTo(document.head);

var adminRoot = $("<div></div>").appendTo(document.body);

var adminPanel = $("<div></div>").addClass("admin panel").appendTo(adminRoot);
$("<h1/>").text("MOD").appendTo(adminPanel);

var handReset = $("<input/>", {type: 'checkbox', id: 'admin-hr'}).appendTo(adminPanel);
$("<label/>", {for: 'admin-hr', text: 'Disable hand reset'}).appendTo(adminPanel);

$("<br/>").appendTo(adminPanel);

var cooldownOverride = $("<input/>", {type: 'checkbox', id: 'admin-co'}).appendTo(adminPanel).click(function () {
    var state = cooldownOverride.prop("checked");
    App.socket.send(JSON.stringify({type: "admin_cdoverride", override: state}));
});
$("<label/>", {for: 'admin-co', text: "Override cooldown"}).appendTo(adminPanel);

var lookupPanel = $("<div />").addClass("admin-lookup").appendTo(document.body).hide();

var row = $("<div/>").appendTo(lookupPanel);
$("<b/>").text("Coords: ").appendTo(row);
var coordsRow = $("<span/>").text("Test").appendTo(row);

var row = $("<div/>").appendTo(lookupPanel);
$("<b/>").text("Username: ").appendTo(row);
var userRow = $("<span/>").text("Test").appendTo(row);

var row = $("<div/>").appendTo(lookupPanel);
$("<b/>").text("Login: ").appendTo(row);
var loginRow = $("<span/>").text("Test").appendTo(row);

var row = $("<div/>").appendTo(lookupPanel);
$("<b/>").text("Time: ").appendTo(row);
var timeRow = $("<span/>").text("Test").appendTo(row);

var row = $("<div/>").appendTo(lookupPanel);
var messageInput = $("<input/>", {placeholder: "Send alert..."}).addClass("admin-lookup-msg").appendTo(row);

var user = {u: null};
App.elements.board.on("click", function (evt) {
    if (evt.shiftKey) {
        var pos = App.screenToBoardSpace(evt.clientX, evt.clientY);

        $.get("/lookup", {x: Math.floor(pos.x), y: Math.floor(pos.y)}, function (data) {
            if (data) {
                user.u = data;
                lookupPanel.css("top", evt.clientY).css("left", evt.clientX).fadeIn(200);

                coordsRow.text("(" + data.x + ", " + data.y + ")");
                userRow.text(data.username);
                loginRow.text(data.login);
                timeRow.text(new Date(data.time).toLocaleString());
            }
        });
    }
});

messageInput.on("keydown", function(evt) {
    if (evt.which === 13) {
        App.socket.send(JSON.stringify({type: "admin_message", username: user.u.username, message: messageInput.val()}));
        messageInput.val("");
    }
    evt.stopPropagation();
});

setTimeout(function() {
    var row = $("<div/>").appendTo(lookupPanel);
    if (App.role === "ADMIN") var banButton = $("<div/>").addClass("button").text("Ban (24h)").appendTo(row);
    var closeButton = $("<div/>").addClass("button").text("Close").appendTo(row);

    if (banButton) banButton.on("click", function() {
        App.socket.send(JSON.stringify({type: "admin_ban", username: user.u.username}));

        lookupPanel.fadeOut(200);
        user.u = null;
    });

    closeButton.on("click", function() {
        lookupPanel.fadeOut(200);
        user.u = null;
    });
}, 2000);