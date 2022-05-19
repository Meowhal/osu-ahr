"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DummyIrcClient = void 0;
const CommandParser_1 = require("../parsers/CommandParser");
const StatParser_1 = require("../parsers/StatParser");
const Player_1 = require("../Player");
const events_1 = require("events");
// テスト用の実際に通信を行わないダミーIRCクライアント
class DummyIrcClient extends events_1.EventEmitter {
    constructor(server, nick, opts) {
        super();
        this.hostMask = '';
        this.latency = 0;
        this.mapidSeed = 1000;
        this.nick = nick;
        this.channel = '';
        this.connected = false;
        this.players = new Set();
        this.stats = new Map();
        this.conn = null;
        this.isMatching = false;
        this.referees = [this.nick];
        this.msg = {
            command: 'dummy command',
            rawCommand: 'dummy command',
            commandType: 0,
            args: []
        };
        // autoConnect default:true
        if (opts?.autoConnect !== false) {
            this.connect();
        }
    }
    // サーバーとの接続イベントを発行する
    raiseRegistered() {
        this.connected = true;
        this.hostMask = 'osu!Bancho.';
        this.emit('registered', this.msg);
    }
    // チャンネル参加イベントを発行する
    raiseJoin(channel, who) {
        if (who === this.nick) {
            this.channel = channel;
        }
        this.emit('join', channel, who, this.msg);
        this.emit(`join${channel}`, who, this.msg);
    }
    // チャンネル退出イベントを発行する
    raisePart(channel, who) {
        if (who === this.nick) {
            this.channel = '';
        }
        this.emit('part', channel, who, this.msg);
        this.emit(`part${channel}`, who, this.msg);
    }
    // メッセージイベントを発行する
    emulateMessage(from, to, message) {
        const lines = message.split('\n');
        if (lines.length > 1) {
            lines.forEach(v => this.emulateMessage(from, to, v));
            return;
        }
        this.onMessage(from, to, message);
        if (from === this.nick)
            return;
        this.emit('message', from, to, message, this.msg);
        if (to === this.channel) {
            this.emit('message#', from, to, message, this.msg);
            this.emit(`message${to}`, from, message, this.msg);
        }
        if (to === this.nick) {
            this.emit('pm', from, message, this.msg);
        }
    }
    // メッセージイベントを非同期で発生させる
    emulateMessageAsync(from, to, message) {
        return new Promise(resolve => {
            const body = () => {
                this.emulateMessage(from, to, message);
                resolve();
            };
            if (this.latency !== 0) {
                setTimeout(body, this.latency);
            }
            else {
                body();
            }
        });
    }
    emulateBanchoResponse(message) {
        this.emulateMessage('BanchoBot', this.channel, message);
    }
    emulateChatAsync(from, message) {
        return this.emulateMessageAsync(from, this.channel, message);
    }
    // ロビーにプレイヤーが参加した際の動作をエミュレートする
    async emulateAddPlayerAsync(name) {
        const ename = (0, Player_1.escapeUserName)(name);
        if (!this.players.has(ename)) {
            this.players.add(ename);
        }
        await this.emulateMessageAsync('BanchoBot', this.channel, `${name} joined in slot ${this.players.size}.`);
    }
    // ロビーからプレイヤーが退出した際の動作をエミュレートする
    async emulateRemovePlayerAsync(name) {
        const ename = (0, Player_1.escapeUserName)(name);
        if (this.players.has(ename)) {
            this.players.delete(ename);
        }
        await this.emulateMessageAsync('BanchoBot', this.channel, `${name} left the game.`);
    }
    // async呼び出し用のディレイ関数
    delay(ms) {
        if (ms === 0)
            return Promise.resolve();
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    // ホストがマップを変更する動作をエミュレートする
    async emulateChangeMapAsync(delay = 0, mapid = 0) {
        if (mapid === 0) {
            mapid = this.mapidSeed++;
        }
        await this.emulateMessageAsync('BanchoBot', this.channel, 'Host is changing map...');
        await this.delay(delay);
        await this.emulateMessageAsync('BanchoBot', this.channel, `Beatmap changed to: mapname [version] (https://osu.ppy.sh/b/${mapid})`);
    }
    // 全員が準備完了になった動作をエミュレートする
    async emulateReadyAsync() {
        await this.emulateMessageAsync('BanchoBot', this.channel, 'All players are ready');
    }
    // 試合をエミュレートする
    async emulateMatchAsync(delay = 0, scores) {
        this.isMatching = true;
        await this.emulateMessageAsync('BanchoBot', this.channel, 'The match has started!');
        if (delay) {
            await this.delay(delay);
        }
        const tasks = [];
        if (scores) {
            for (const u of scores) {
                if (!this.isMatching)
                    return;
                tasks.push(this.emulateMessageAsync('BanchoBot', this.channel, `${u.name} finished playing (Score: ${u.score}, ${u.passed ? 'PASSED' : 'FAILED'}).`));
            }
        }
        else {
            for (const u of this.players) {
                if (!this.isMatching)
                    return;
                tasks.push(this.emulateMessageAsync('BanchoBot', this.channel, `${u} finished playing (Score: 100000, PASSED).`));
            }
        }
        await Promise.all(tasks);
        if (!this.isMatching)
            return;
        this.isMatching = false;
        await this.emulateMessageAsync('BanchoBot', this.channel, 'The match has finished!');
    }
    // 試合中断をエミュレートする
    async emulateMatchAndAbortAsync(delay = 0, finishers = 0) {
        this.isMatching = true;
        await this.emulateMessageAsync('BanchoBot', this.channel, 'The match has started!');
        if (delay) {
            await this.delay(delay);
        }
        const tasks = [];
        if (Array.isArray(finishers)) {
            for (const p of finishers) {
                tasks.push(this.emulatePlayerFinishAsync(p));
            }
        }
        else {
            const players = Array.from(this.players);
            for (let i = 0; i < finishers && i < players.length; i++) {
                const p = players[i];
                tasks.push(this.emulatePlayerFinishAsync(p));
            }
        }
        await Promise.all(tasks);
        if (!this.isMatching) {
            await this.emulateMessageAsync('BanchoBot', this.channel, 'The match is not in progress');
            return;
        }
        this.isMatching = false;
        await this.emulateMessageAsync('BanchoBot', this.channel, 'Aborted the match');
    }
    async emulatePlayerFinishAsync(username) {
        await this.emulateMessageAsync('BanchoBot', this.channel, `${username} finished playing (Score: 100000, PASSED).`);
    }
    async emulateMpSettings(testcase) {
        this.players.clear();
        for (const p of testcase.result.players) {
            this.players.add((0, Player_1.escapeUserName)(p.name));
        }
        for (const t of testcase.texts) {
            this.emulateBanchoResponse(t);
        }
    }
    async emulateChangeHost(name) {
        await this.emulateMessageAsync('BanchoBot', this.channel, `${name} became the host.`);
    }
    // IRCClientのjoin
    join(channel, callback) {
        if (callback) {
            this.once('join', callback);
        }
        setImmediate(() => this.raiseJoin(channel, ''));
    }
    // IRCClientのpart
    part(channel, message, callback) {
        if (callback) {
            this.once('part', callback);
        }
        setImmediate(() => {
            this.raisePart(channel, this.nick);
        });
    }
    // IRCClientのsay
    say(target, message) {
        this.emulateMessageAsync(this.nick, target, message);
    }
    onMessage(from, to, message) {
        if (this.referees.includes(from)) {
            const mp = CommandParser_1.parser.ParseMPCommand(message);
            if (mp) {
                this.processMpCommand(to, message, mp);
            }
        }
        if (message.startsWith('!stat')) {
            const m = message.match(/^!stats? (.+)/);
            if (m) {
                this.sendStat(m[1], to === 'BanchoBot');
            }
        }
    }
    processMpCommand(target, message, mp) {
        const m = (msg) => this.emulateMessageAsync('BanchoBot', this.channel, msg);
        if (target === 'BanchoBot' && mp.command === 'make') {
            const title = mp.arg;
            if (title === '') {
                this.emulateMessage('BanchoBot', this.nick, 'No name provided');
                return;
            }
            setImmediate(() => {
                const id = '12345';
                this.raiseJoin(`#mp_${id}`, this.nick);
                this.emulateMessage('BanchoBot', this.nick, `Created the tournament match https://osu.ppy.sh/mp/${id} ${title}`);
            });
        }
        else if (target === this.channel) {
            switch (mp.command) {
                case 'host':
                    if (this.players.has((0, Player_1.escapeUserName)(mp.arg))) {
                        m(`${mp.arg} became the host.`);
                    }
                    else {
                        m('User not found');
                    }
                    break;
                case 'password':
                    if (mp.arg === '') {
                        m('Removed the match password');
                    }
                    else {
                        m('Changed the match password');
                    }
                    break;
                case 'invite':
                    m(`Invited ${mp.arg} to the room`);
                    break;
                case 'close':
                    setImmediate(() => {
                        this.emulateMessage('BanchoBot', this.channel, 'Closed the match');
                        this.raisePart(this.channel, this.nick);
                    });
                    break;
                case 'abort':
                    if (this.isMatching) {
                        this.isMatching = false;
                        m('Aborted the match');
                    }
                    else {
                        m('The match is not in progress');
                    }
                    break;
                case 'settings':
                    m('Room name: lobby name, History: https://osu.ppy.sh/mp/123');
                    m('Beatmap: https://osu.ppy.sh/b/1562893 Feryquitous feat. Aitsuki Nakuru - Kairikou [Miura\'s Extra]');
                    m('Team mode: HeadToHead, Win condition: Score');
                    m('Active mods: Freemod');
                    m(`Players: ${this.players.size}`);
                    let i = 1;
                    for (const p of this.players) {
                        m(`Slot ${i}  Not Ready https://osu.ppy.sh/u/123 ${p}       `);
                        i++;
                    }
                    break;
                case 'start':
                    if (mp.arg === '') {
                        m('The match has started!');
                        m('Started the match');
                    }
                    else {
                        // カウントダウンや分表示は面倒なので省略
                        m(`Match starts in ${mp.arg} seconds`);
                        m(`Queued the match to start in ${mp.arg} seconds`);
                    }
                    break;
                case 'aborttimer':
                    m('Countdown aborted');
                    break;
                case 'map':
                    if (mp.arg.match(/\d+/)) {
                        m(`Changed beatmap to https://osu.ppy.sh/b/${mp.arg} map name`);
                    }
                    else {
                        m('Invalid map ID provided');
                    }
                    break;
                case 'clearhost':
                    m('Cleared match host');
                    break;
                case 'kick':
                    const ename = (0, Player_1.escapeUserName)(mp.arg);
                    if (this.players.has(ename)) {
                        this.players.delete(ename);
                        m(`${ename} left the game.`);
                        m(`Kicked ${ename} from the match.`);
                    }
                    else {
                        m('User not found');
                    }
                    break;
                default:
                    //logger.warn("unhandled command", mp.command, mp.arg);
                    break;
            }
        }
    }
    SetStat(stat) {
        this.stats.set((0, Player_1.escapeUserName)(stat.name), stat);
    }
    sendStat(arg, toPm) {
        const ename = (0, Player_1.escapeUserName)(arg);
        let stat = this.stats.get(ename);
        const to = toPm ? this.nick : this.channel;
        if (stat === undefined) {
            const status = this.players.has(ename) ? StatParser_1.StatStatuses.Multiplayer : StatParser_1.StatStatuses.None;
            stat = new StatParser_1.StatResult(arg, 0, status);
            this.stats.set(ename, stat);
        }
        stat.toString().split('\n').forEach(t => {
            this.emulateMessage('BanchoBot', to, t);
        });
    }
    connect(retryCount, callback) {
        this.conn = true;
        setImmediate(() => this.raiseRegistered());
    }
    disconnect(message, callback) {
        setImmediate(() => callback());
    }
}
exports.DummyIrcClient = DummyIrcClient;
//# sourceMappingURL=DummyIrcClient.js.map