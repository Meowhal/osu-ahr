"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const Lobby_1 = require("../Lobby");
const IIrcClient_1 = require("../IIrcClient");
const Player_1 = require("../Player");
const DummyIrcClient_1 = require("../dummies/DummyIrcClient");
const chai_1 = require("chai");
const log4js_1 = __importDefault(require("log4js"));
class TestUtils {
    constructor() {
        this.ownerNickname = 'creator';
        this.lobbyName = 'test';
        this.loggerMode = '';
    }
    async SetupLobbyAsync(logging = false) {
        const ircClient = new DummyIrcClient_1.DummyIrcClient('osu_irc_server', this.ownerNickname);
        if (logging) {
            (0, IIrcClient_1.logIrcEvent)(ircClient);
        }
        const lobby = new Lobby_1.Lobby(ircClient);
        await lobby.MakeLobbyAsync(this.lobbyName);
        return { lobby, ircClient };
    }
    async AddPlayersAsync(names, client) {
        if (typeof names === 'number') {
            const start = client.players.size;
            const p = [];
            for (let i = 0; i < names; i++) {
                p[i] = `p${i + start}`;
                await client.emulateAddPlayerAsync(p[i]);
            }
            return p;
        }
        else {
            names.forEach(async (name) => await client.emulateAddPlayerAsync(name));
            return names;
        }
    }
    async sendMessageAsOwner(lobby, message) {
        const owner = lobby.GetOrMakePlayer(this.ownerNickname);
        lobby.RaiseReceivedChatCommand(owner, message);
    }
    // async呼び出し用のディレイ関数
    delayAsync(ms) {
        if (ms === 0)
            return Promise.resolve();
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    assertHost(username, lobby) {
        const host = lobby.host;
        if (host === null) {
            chai_1.assert.fail('No one is host now.');
        }
        else {
            chai_1.assert.equal(host.name, username);
        }
        for (const p of lobby.players) {
            if (p === host) {
                chai_1.assert.isTrue(p.isHost);
            }
            else {
                chai_1.assert.isFalse(p.isHost);
            }
        }
    }
    async changeHostAsync(name, lobby) {
        const p = new Promise(resolve => {
            lobby.HostChanged.once(async () => {
                resolve(Date.now());
            });
        });
        lobby.TransferHost(lobby.GetPlayer(name));
        return p;
    }
    configMochaVerbosely() {
        if (this.loggerMode !== 'Verbosely') {
            this.loggerMode = 'Verbosely';
            log4js_1.default.shutdown();
            log4js_1.default.configure('config/log_mocha_verbose.json');
        }
    }
    configMochaAsSilent() {
        if (this.loggerMode !== 'Silent') {
            this.loggerMode = 'Silent';
            log4js_1.default.shutdown();
            log4js_1.default.configure('config/log_mocha.json');
        }
    }
    /**
     * 時間内に指定したイベントが発生することを確認する
     * @param event 対象のイベント
     * @param cb イベント発生時に引数をチェックするためのコールバック関数。falseを返すと監視が継続される
     * @param timeout リジェクトまでのミリ秒時間
     */
    async assertEventFire(event, cb, timeout = 0) {
        return new Promise((resolve, reject) => {
            let id;
            if (timeout !== 0) {
                id = setTimeout(() => {
                    d.dispose();
                    reject('The expected event was not fired');
                }, timeout);
            }
            const d = event.on(a => {
                if (cb !== null && cb(a) === false)
                    return;
                d.dispose();
                clearTimeout(id);
                resolve(Date.now());
            });
        });
    }
    /**
     * 時間内に指定したイベントが"発生しない"ことを確認する
     * @param event 対象のイベント
     * @param cb イベント発生時に引数をチェックするためのコールバック関数。falseを返すと監視が継続される
     * @param timeout イベント発生までの待ち時間
     */
    async assertEventNeverFire(event, cb, timeout) {
        return new Promise((resolve, reject) => {
            const id = setTimeout(() => {
                d.dispose();
                resolve(Date.now());
            }, timeout);
            const d = event.on(a => {
                if (cb !== null && cb(a) === false)
                    return;
                clearTimeout(id);
                d.dispose();
                reject('The event expected not to fire was fired');
            });
        });
    }
    /**
     * 時間内に指定したBanchoResponseが返されることを確認する
     * @param lobby 対象のlobby
     * @param expected 期待されるBanshoResponseの種類
     * @param cb BanchoResponseを評価するためのコールバック関数。falseを返すと監視が継続される
     * @param timeout リジェクトまでのミリ秒時間
     */
    async assertBanchoRespond(lobby, expected, cb, timeout = 0) {
        return new Promise((resolve, reject) => {
            let id;
            if (timeout !== 0) {
                id = setTimeout(() => {
                    d.dispose();
                    reject('the expected response was not returned.');
                }, timeout);
            }
            const d = lobby.ReceivedBanchoResponse.on(a => {
                if (a.response.type !== expected)
                    return;
                if (cb !== null && cb(a.response) === false)
                    return;
                d.dispose();
                clearTimeout(id);
                resolve(Date.now());
            });
        });
    }
    /**
     * 時間内に指定したBanchoResponseが"返されない"ことを確認する
     * @param lobby 対象のlobby
     * @param expected 期待されるBanshoResponseの種類
     * @param cb BanchoResponseを評価するためのコールバック関数。falseを返すと監視が継続される
     * @param timeout 監視継続ミリ秒時間
     */
    async assertBanchoNotRespond(lobby, notExpected, cb, timeout) {
        return new Promise((resolve, reject) => {
            const id = setTimeout(() => {
                d.dispose();
                resolve(Date.now());
            }, timeout);
            const d = lobby.ReceivedBanchoResponse.on(a => {
                if (a.response.type !== notExpected)
                    return;
                if (cb !== null && cb(a.response) === false)
                    return;
                clearTimeout(id);
                d.dispose();
                reject('the response not expected was returned.');
            });
        });
    }
    assertMpSettingsResult(lobby, result) {
        chai_1.assert.equal(lobby.players.size, result.players.length);
        for (const r of result.players) {
            const p = lobby.GetPlayer(r.name);
            if (p === null) {
                chai_1.assert.fail();
                return;
            }
            chai_1.assert.isTrue(lobby.players.has(p));
            chai_1.assert.isTrue(p.is(Player_1.Roles.Player));
            chai_1.assert.equal(p.isHost, r.isHost);
        }
    }
}
const instance = new TestUtils();
exports.default = instance;
//# sourceMappingURL=TestUtils.js.map