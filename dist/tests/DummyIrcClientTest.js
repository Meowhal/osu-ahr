"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const chai_1 = require("chai");
const DummyIrcClient_1 = require("../dummies/DummyIrcClient");
const CommandParser_1 = require("../parsers/CommandParser");
const TestUtils_1 = __importDefault(require("./TestUtils"));
describe('DummyIrcClientTest', function () {
    before(function () {
        TestUtils_1.default.configMochaAsSilent();
    });
    // ロビー作成テスト
    it('make lobby test', (done) => {
        const client = new DummyIrcClient_1.DummyIrcClient('osu_irc_server', 'owner');
        const lobbyTitle = 'testlobby';
        let f_joined = 0;
        let f_make_res = 0;
        let f_registered = 0;
        //logIrcEvent(client);
        client.on('registered', function (message) {
            f_registered++;
            client.say('BanchoBot', `!mp make ${lobbyTitle}`);
        });
        client.on('pm', function (nick, message) {
            const v = CommandParser_1.parser.ParseMpMakeResponse(nick, message);
            if (v !== null) {
                f_make_res++;
                //console.log(`--- parsed pm id=${v.id} title=${v.title}`);
                chai_1.assert.equal(v.title, lobbyTitle);
            }
            else {
                chai_1.assert.fail();
            }
        });
        client.on('join', function (channel, who) {
            f_joined++;
            setTimeout(() => {
                client.say(channel, '!mp close');
            }, 10);
        });
        client.on('part', function (channel, who, reason) {
            chai_1.assert.equal(f_joined, 1);
            chai_1.assert.equal(f_make_res, 1);
            chai_1.assert.equal(f_registered, 1);
            done();
        });
    });
    it('match test', (done) => {
        const client = new DummyIrcClient_1.DummyIrcClient('osu_irc_server', 'owner');
        const lobbyTitle = 'testlobby';
        const players = ['p1', 'p2', 'p3'];
        //logIrcEvent(client);
        client.on('registered', function (message) {
            client.say('BanchoBot', `!mp make ${lobbyTitle}`);
        });
        client.on('join', function (channel, who) {
            players.forEach((v, i, a) => client.emulateAddPlayerAsync(v));
            setTimeout(() => {
                client.say(channel, '!mp close');
            }, 10);
        });
        client.on('part', function (channel, who, reason) {
            done();
        });
    });
    it('make noname lobby test', (done) => {
        const client = new DummyIrcClient_1.DummyIrcClient('osu_irc_server', 'owner');
        //logIrcEvent(client);
        const lobbyTitle = '';
        client.on('registered', function (message) {
            client.say('BanchoBot', `!mp make ${lobbyTitle}`);
        });
        client.on('pm', function (nick, message) {
            chai_1.assert.equal(message, 'No name provided');
            done();
        });
    });
    it('mphost user not found test', (done) => {
        const client = new DummyIrcClient_1.DummyIrcClient('osu_irc_server', 'owner');
        const lobbyTitle = 'testlobby';
        const players = ['p1', 'p2', 'p3'];
        //logIrcEvent(client);
        client.on('registered', function (message) {
            client.say('BanchoBot', `!mp make ${lobbyTitle}`);
        });
        client.on('join', function (channel, who) {
            players.forEach((v, i, a) => client.emulateAddPlayerAsync(v));
            setTimeout(() => {
                client.say(channel, '!mp host p4');
            }, 10);
        });
        client.on('message', function (from, to, msg) {
            const r = CommandParser_1.parser.ParseBanchoResponse(msg);
            if (r.type === CommandParser_1.BanchoResponseType.UserNotFound) {
                done();
            }
        });
    });
});
//# sourceMappingURL=DummyIrcClientTest.js.map