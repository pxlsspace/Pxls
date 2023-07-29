$(document).ready(function() {
    function makeNumberRenderer(key) {
        return (data, type, row) => {
            const val = row[key];
            if (type !== 'display') {
                return val;
            }
            return val.toLocaleString();
        }
    }

    $.get("stats.json", statsData => {
        try {
            if (typeof statsData === "string") {
                statsData = JSON.parse(statsData);
            }
        } catch (e) {/* ignored */}
        if (statsData && statsData.toplist) {
            const whoamiRoot = "/";
            $.ajax({
                url: `${whoamiRoot}whoami`,
                xhrFields: {
                    withCredentials: true
                }
            }).done(authData => {
                try {
                    if (typeof authData === "string") {
                        authData = JSON.parse(authData);
                    }
                } catch (e) {/* ignored */}
                statsData.authData = authData;
            }).fail((data, textStatus, err) => {
                console.error("Failed to fetch auth status. textStatus: %s, data: %o, error: %o", textStatus, data, err);
            }).always((data, status, thrown) => {
                statsData.authData = statsData.authData || false;
                handleTables(statsData);
            });
        } else {
            console.error("Data is invalid: %o", statsData);
        }
    });

    function handleTables(data) {
        console.log(data);
        var leaderboardColumns = [
            {data: "place", searchable: false},
            {
                data: "username",
                render: (data, type, row, meta) => {
                    return `<a href="/profile/${data}">${data}</a>`
                }
            },
            {
                data: "pixels",
                searchable: false,
                render: makeNumberRenderer('pixels')
            }
        ];
        let rowRenderer = null;
        if (data.authData && data.authData.id !== -1) {
            rowRenderer = (row, rowData) => {
                if (rowData.username == data.authData.username) row.classList.add("self");
            }
        }
        const tblToplistCurrent = $("#tblToplistCurrent").DataTable({
            data: data.toplist.canvas,
            columns: leaderboardColumns,
            paging: false,
            scrollY: 480,
            rowCallback: rowRenderer,
            deferRender: true,
            scroller: true
        });
        const tblToplistAlltime = $("#tblToplistAlltime").DataTable({
            data: data.toplist.alltime,
            columns: leaderboardColumns,
            paging: false,
            scrollY: 480,
            rowCallback: rowRenderer,
            deferRender: true,
            scroller: true
        });
        window.toplistCurrent = tblToplistCurrent;
        window.toplistAlltime = tblToplistAlltime;

        let breakdowns = $("#breakdowns")[0];
        breakdowns.appendChild(generateBreakdownSection("Last 15 Minutes", data.breakdown.last15m, data.board_info, data.authData));
        breakdowns.appendChild(generateBreakdownSection("Last Hour", data.breakdown.lastHour, data.board_info, data.authData));
        breakdowns.appendChild(generateBreakdownSection("Last Day", data.breakdown.lastDay, data.board_info, data.authData));
        breakdowns.appendChild(generateBreakdownSection("Last Week", data.breakdown.lastWeek, data.board_info, data.authData));

        document.getElementById("tdGeneralTotalUsers").textContent = data.general.total_users >> 0;
        document.getElementById("tdGeneralUsersActiveCanvas").textContent = data.general.users_active_this_canvas >> 0;
        document.getElementById("tdGeneralTotalPixelsPlaced").textContent = data.general.total_pixels_placed >> 0;
        document.getElementById("tdGeneralTotalFactions").textContent = data.general.total_factions >> 0;
        document.getElementById("lastUpdated").textContent = `Last updated: ${data.generatedAt}`;
        if (data.general.nth_list) {
            let generalTbody = document.getElementById('tblGeneralStats').querySelector('tbody');
            data.general.nth_list.forEach(x => {
                if (x.res !== false) {
                    let tr = _ce('tr'),
                        tdName = _ce('td', {'class': 'text-right pr-2'}, `${x.pretty} pixel:`),
                        tdValue = _ce('td', x.res);
                    tr.appendChild(tdName);
                    tr.appendChild(tdValue);
                    generalTbody.appendChild(tr);
                }
            });
        } else console.log('no nth_list: %o', data);

        $('#tblFactions').DataTable({
            data: data.factions,
            columns: [
                {
                    data: 'Faction',
                    render: (data, type, row) => `<span>${data}</span><small class="d-block text-muted">(ID: ${row.fid})</small>`
                },
                {
                    render: makeNumberRenderer('Canvas_Pixels')
                },
                {
                    render: makeNumberRenderer('Alltime_Pixels')
                },
                {
                    render: makeNumberRenderer('Member_Count')
                }
            ],
            order: [[3, 'desc']]
        });

        $(".card-title").addClass("pull-down").css("z-index", "9669");
        $(".gscWrapper").addClass("pulled");

        let alltimeStanding = document.getElementById("alltimeStanding");
        let thisCanvasStanding = document.getElementById("thisCanvasStanding");

        if (data.authData && data.authData.id !== -1) {
            alltimeStanding.style.display = data.toplist.alltime.filter(x => x.username == data.authData.username).length ? "inline-block" : "none";
            thisCanvasStanding.style.display = data.toplist.canvas.filter(x => x.username == data.authData.username).length ? "inline-block" : "none";
            $(thisCanvasStanding).click(() => {
                let node = tblToplistCurrent.row(function(idx, rowData) {
                    return rowData.username == data.authData.username;
                }).node();
                const scrollBody = $("#tblToplistCurrent").closest(".dataTables_scrollBody");
                scrollBody.scrollTo(node, {offset: -Math.abs((scrollBody[0].getBoundingClientRect().height / 2) - (node.getBoundingClientRect().height / 2))});
            });
            $(alltimeStanding).click(() => {
                let node = tblToplistAlltime.row(function(idx, rowData) {
                    return rowData.username == data.authData.username;
                }).node();
                const scrollBody = $("#tblToplistAlltime").closest(".dataTables_scrollBody");
                scrollBody.scrollTo(node, {offset: -Math.abs((scrollBody[0].getBoundingClientRect().height / 2) - (node.getBoundingClientRect().height / 2))});
            });
        } else {
            alltimeStanding.style.display = "none";
            thisCanvasStanding.style.display = "none";
        }
        $(".gscLoading").remove();
    }

    function generateBreakdownSection(headerString, data, board_info, auth_data, zero_based_colors=true) {
        let
            wrapper = _ce("div", {class: "breakdown"}),
            header = _ce("h4", {class: "text-center"}, headerString),
            groupHolder = _ce("div", {class: "row justify-content-between"}),
            groupTopUsers = _ce("div", {class: "col-md-6"}),
            groupTopColors = _ce("div", {class: "col-md-6"});
        groupTopUsers.appendChild(_ce("h6", "Top 10 users"));
        groupTopColors.appendChild(_ce("h6", "Top 10 colors"));
        wrapper.appendChild(header);

        {
            let table = _ce("table", {class: "table table-bordered table-striped table-hover"}),
                thead = _ce("thead"),
                tbody = _ce("tbody");
            thead.appendChild(generateTableRow(true, "Place", "Username", "Pixels"));

            table.appendChild(thead);
            table.appendChild(tbody);

            let tableOpts = {
                data: data.users,
                columns: [
                    {data: "place", searchable: false},
                    {
                        data: "username",
                        render: (data, type, row, meta) => {
                            return `<a href="/profile/${data}">${data}</a>`
                        }
                    },
                    {
                        data: "pixels",
                        searchable: false,
                        render: makeNumberRenderer('pixels')
                    }
                ],
                searching: false,
                paging: false
            };
            if (auth_data && auth_data.id !== -1) {
                tableOpts.rowCallback = (row, data) => {
                    if (data.username == auth_data.username) row.classList.add("self");
                };
            }
            $(table).DataTable(tableOpts);

            groupTopUsers.appendChild(table);
        }

        {
            let table = _ce("table", {class: "table table-bordered table-striped table-hover"}),
                thead = _ce("thead"),
                tbody = _ce("tbody");
            thead.appendChild(generateTableRow(true, "Place", "Color", "Count"));

            table.appendChild(thead);
            table.appendChild(tbody);

            (zero_based_colors => {
                $(table).DataTable({
                    data: data.colors,
                    columns: [
                        {data: "place"},
                        {
                            data: "colorID", render: function(renderData, type, row, meta) {
                                return `<div class="pixelColor" style="background-color:#${board_info.palette[renderData].value}"></div> ${renderData + (zero_based_colors ? 0 : 1)}`;
                            }
                        },
                        {data: "count"}
                    ],
                    searching: false,
                    paging: false
                });
            })(zero_based_colors);

            groupTopColors.appendChild(table);
        }

        groupHolder.appendChild(groupTopUsers);
        groupHolder.appendChild(groupTopColors);
        wrapper.appendChild(groupHolder);
        return wrapper;


        function generateTableRow(isHeader, ...items) {
            let tr = document.createElement("tr");
            for (let i = 0; i < items.length; i++) {
                let item = document.createElement(isHeader ? "th" : "td");
                item.textContent = items[i];
                tr.appendChild(item);
            }
            return tr;
        }
    }

    function _ce(name, options, textContent) {
        let toRet = document.createElement(name);
        if (options) {
            if (typeof options === "string") {
                textContent = options;
            } else {
                if (options.id) toRet.id = options.id;
                if (options.class || options.classes) toRet.setAttribute("class", options.class || options.classes);
            }
        }
        if (textContent) toRet.textContent = textContent;
        return toRet;
    }
    console.log("%c" + fox(), "background: -webkit-linear-gradient(#632705,#b75800,#632705);  -webkit-background-clip: text; color:transparent; font-size:16px;display: inline-block;");
});

function fox() {
    var fox = "                                                                   ,-,\n" +
        "                                                             _.-=;~ /_\n" +
        "                                                          _-~   '     ;.\n" +
        "                                                      _.-~     '   .-~-~`-._\n" +
        "                                                _.--~~:.             --.____88\n" +
        "                              ____.........--~~~. .' .  .        _..-------~~\n" +
        "                     _..--~~~~               .' .'             ,'\n" +
        "                 _.-~                        .       .     ` ,'\n" +
        "               .'                                    :.    ./\n" +
        "             .:     ,/          `                   ::.   ,'\n" +
        "           .:'     ,(            ;.                ::. ,-'\n" +
        "          .'     ./'.`.     . . /:::._______.... _/:.o/\n" +
        "         /     ./'. . .)  . _.,'               `88;?88|\n" +
        "       ,'  . .,/'._,-~ /_.o8P'                  88P ?8b\n" +
        "    _,'' . .,/',-~    d888P'                    88'  88|\n" +
        " _.'~  . .,:oP'        ?88b              _..--- 88.--'8b.--..__\n" +
        ":     ...' 88o __,------.88o ...__..._.=~- .    `~~   `~~      ~-.________.\n" +
        "`.;;;:='    ~~            ~~~                ~-    -       -   -\n";
    return fox;
}
