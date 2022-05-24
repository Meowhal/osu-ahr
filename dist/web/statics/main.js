"use strict";
(function () {
    function* parseLogs(lines) {
        if (!lines)
            return;
        let c = null;
        for (const l of lines) {
            const b = parseLogLine(l);
            if (b) {
                if (c)
                    yield c;
                c = b;
            }
            else if (c) {
                c.message += `<br />${l}`;
            }
        }
        if (c)
            yield c;
    }
    function* filterLogs(logs) {
        if (!logs)
            return;
        for (const l of logs) {
            if (l.tag === 'mapChecker') {
                continue;
            }
            yield l;
        }
    }
    function parseLogLine(line) {
        const m = line.match(/^\[(.+?)\] \[(\w+)\] (\w+) - (.*)/);
        if (m) {
            const d = {
                date: m[1],
                level: m[2],
                tag: m[3],
                message: m[4]
            };
            return d;
        }
    }
    function decolate(log) {
        convertLink(log);
        decolateChat(log);
    }
    function convertLink(log) {
        log.message = log.message.replace(/https?:\/\/(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&//=]*)/, '<a target=\'osubmp\' href=\'$&\'>$&</a>');
    }
    function decolateChat(log) {
        let sender = 'system';
        let message = '';
        let cl = '';
        if (log.tag === 'chat') {
            const m = log.message.match(/^(\*?[^:]+):(.*)$/);
            sender = m[1];
            message = m[2];
            cl = (sender === 'bot') ? ' bot' : ' user';
        }
        else if (log.tag === 'inout') {
            for (const v of log.message.split('\x1b')) {
                const m = v.match(/^\[(\d+)m(.*)/);
                if (m) {
                    message += `<span class='fg${m[1]}'>${m[2]}</span>`;
                }
                else {
                    message += v;
                }
            }
        }
        else {
            message = log.message;
            cl = ' system';
        }
        log.message = `<span class='sender${cl}'>${sender}:</span><div class='message${cl}'>${message}</div>`;
    }
    function formatDate(date) {
        const M = date.getMonth() + 1;
        const d = (`${date.getDate()}`).padStart(2, '0');
        const h = (`${date.getHours()}`).padStart(2, '0');
        const m = (`${date.getMinutes()}`).padStart(2, '0');
        const s = (`${date.getSeconds()}`).padStart(2, '0');
        return `${M}/${d} ${h}:${m}:${s}`;
    }
    function AppendLog(log) {
        decolate(log);
        const li = document.createElement('li');
        const spDate = document.createElement('time');
        spDate.className = 'date';
        spDate.setAttribute('datetime', log.date);
        spDate.innerText = formatDate(new Date(log.date));
        const spLevel = document.createElement('span');
        spLevel.className = 'level';
        spLevel.innerText = log.level;
        const spTag = document.createElement('span');
        spTag.className = 'tag';
        spTag.innerText = log.tag;
        const spMsg = document.createElement('span');
        spMsg.className = 'message';
        spMsg.innerHTML = log.message;
        li.classList.add(`lvl_${log.level}`);
        li.classList.add(`tag_${log.tag}`);
        li.appendChild(spMsg);
        li.appendChild(spDate);
        li.appendChild(spLevel);
        li.appendChild(spTag);
        const listElem = document.getElementById('list');
        listElem.appendChild(li);
    }
    function test_static_data() {
        const logs = [
            '[2020-10-13T00:32:03.815] [TRACE] skipper - stop timer',
            '[2020-10-13T00:32:12.081] [TRACE] selector - removed TheDqvex from host queue',
            '[2020-10-13T00:36:45.544] [INFO] lobby - beatmap changed(by ChickenNugget) : https://osu.ppy.sh/b/173391 Igorrr - Pavor Nocturnus [Insane]',
            '[2020-10-14T01:50:32.278] [INFO] chat - picked map: https://osu.ppy.sh/beatmaps/2017496 Until The World Ends star=5.78 length=5:10',
            'Violation of Regulation : 5.00 <= difficulty <= 6.00, length <= 5:00',
            'The map is a bit out of regulation. you can skip current host with \'!skip\' voting command.',
            '      ',
            '[2020-10-14T01:50:32.279] [TRACE] chat - bot:Queued the match to start in 90 seconds',
            '[2020-10-14T01:50:51.570] [INFO] chat - bappojappo:is this a stream',
            '[2020-10-14T01:50:53.941] [INFO] chat - bappojappo:map',
            '[2020-10-15T02:58:35.191] [INFO] inout - -[31m mcclennys [0m',
            '[2020-10-15T03:08:26.782] [INFO] inout - +[32m Tobymusen [0m, -[31m leon4chanel [0m'
        ];
        const al = parseLogs(logs);
        const bl = filterLogs(al);
        for (const v of bl) {
            AppendLog(v);
        }
    }
    function test_api() {
        fetchLogsAsync();
    }
    function setMapId(mapId) {
        document.getElementsByName('mapid')[0].value = mapId;
        document.location.search = `mapid=${mapId}`;
    }
    function updateClicked() {
        const value = document.getElementsByName('mapid')[0].value;
        document.location.search = `mapid=${value}`;
    }
    function closeClicked() {
        fetch('/api/close').then(async (res) => {
            const r = await res.json();
            alert(r.result);
        });
    }
    let cursor = 0;
    let timeid = 0;
    function fetchLogsAsync() {
        const mapId = document.getElementsByName('mapid')[0].value;
        const autoScrollCheckBox = document.getElementsByName('autoScroll')[0];
        clearTimeout(timeid);
        return fetch(`/api/clilog/${mapId}?from=${cursor}`).then(res => {
            return res.json();
        }).then(data => {
            cursor = data.end;
            const al = parseLogs(data.lines);
            const bl = filterLogs(al);
            for (const l of bl) {
                AppendLog(l);
            }
            if (autoScrollCheckBox.checked) {
                ScrollToBottom();
            }
            timeid = setTimeout(() => {
                timeid = 0;
                fetchLogsAsync();
            }, 10000);
        });
    }
    function fetchLogSize(mapId) {
        return fetch(`/api/clilog/size/${mapId}`).then(res => {
            return res.json();
        }).then(data => {
            cursor = Math.max(0, data - 100000);
        });
    }
    function fetchMapIds() {
        return fetch('/api/clilog').then(res => {
            return res.json();
        }).then(data => {
            const idElem = document.getElementById('ids');
            for (const id of data) {
                const c = document.createElement('option');
                c.value = id;
                idElem.appendChild(c);
            }
        });
    }
    function ScrollToBottom() {
        const doc = document.documentElement;
        const bottom = doc.scrollHeight - doc.clientHeight;
        window.scroll(0, bottom);
    }
    function init() {
        const params = (new URL(document.location)).searchParams;
        const mapId = params.get('mapid');
        fetchMapIds();
        if (mapId) {
            document.getElementsByName('mapid')[0].value = mapId;
            fetchLogSize(mapId).then(() => {
                fetchLogsAsync(mapId);
            });
            const his = document.getElementById('history');
            his.href = `https://osu.ppy.sh/community/matches/${mapId}`;
            his.innerText = 'history';
        }
        document.getElementById('update').addEventListener('click', () => updateClicked());
        document.getElementById('close').addEventListener('click', () => closeClicked());
        document.getElementById('fetchlog').addEventListener('click', () => fetchLogsAsync());
    }
    init();
})();
//# sourceMappingURL=main.js.map