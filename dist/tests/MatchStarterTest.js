"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const chai_1 = require("chai");
const Player_1 = require("../Player");
const CommandParser_1 = require("../parsers/CommandParser");
const MatchStarter_1 = require("../plugins/MatchStarter");
const TestUtils_1 = __importDefault(require("./TestUtils"));
describe('MatchStarterTest', function () {
    before(function () {
        TestUtils_1.default.configMochaAsSilent();
    });
    async function setupAsync(rate = 0.75, min = 2) {
        const li = await TestUtils_1.default.SetupLobbyAsync(false);
        const option = {
            vote_min: min,
            vote_rate: rate,
            vote_msg_defer_ms: 0,
            start_when_all_player_ready: true
        };
        const starter = new MatchStarter_1.MatchStarter(li.lobby, option);
        return { starter, ...li };
    }
    async function assertSendMpStart(lobby) {
        return TestUtils_1.default.assertEventFire(lobby.SentMessage, ({ message }) => {
            return message.startsWith('!mp start');
        });
    }
    function assertBeginTimer(lobby, time) {
        return TestUtils_1.default.assertEventFire(lobby.ReceivedBanchoResponse, a => {
            if (a.response.type === CommandParser_1.BanchoResponseType.CounteddownTimer) {
                chai_1.assert.equal(a.response.params[0], time);
                return true;
            }
            return false;
        });
    }
    function assertNeverBeginTimer(lobby, timeout) {
        return TestUtils_1.default.assertEventNeverFire(lobby.ReceivedBanchoResponse, a => {
            if (a.response.type === CommandParser_1.BanchoResponseType.CounteddownTimer) {
                return true;
            }
            return false;
        }, timeout);
    }
    it('all player ready test', async () => {
        const { starter, lobby, ircClient } = await setupAsync();
        await TestUtils_1.default.AddPlayersAsync(5, ircClient);
        chai_1.assert.isFalse(lobby.isMatching);
        const t = assertSendMpStart(lobby);
        await ircClient.emulateReadyAsync();
        await t;
    });
    describe('vote tests', function () {
        it('required votes test', async () => {
            const { starter, lobby, ircClient } = await setupAsync();
            for (let i = 1; i <= 16; i++) {
                const ex = Math.max(Math.ceil(i * starter.option.vote_rate), starter.option.vote_min);
                await TestUtils_1.default.AddPlayersAsync(1, ircClient);
                chai_1.assert.equal(starter.voting.required, ex, `players:${i}`);
            }
        });
        it('vote test', async () => {
            const { starter, lobby, ircClient } = await setupAsync();
            const players = await TestUtils_1.default.AddPlayersAsync(5, ircClient);
            await TestUtils_1.default.changeHostAsync(players[0], lobby);
            chai_1.assert.equal(starter.voting.required, 4);
            chai_1.assert.isFalse(lobby.isMatching);
            chai_1.assert.isFalse(starter.voting.passed);
            chai_1.assert.equal(starter.voting.count, 0);
            await ircClient.emulateMessageAsync(players[1], ircClient.channel, '!start');
            chai_1.assert.isFalse(lobby.isMatching);
            chai_1.assert.isFalse(starter.voting.passed);
            chai_1.assert.equal(starter.voting.count, 1);
            await ircClient.emulateMessageAsync(players[2], ircClient.channel, '!start');
            chai_1.assert.isFalse(lobby.isMatching);
            chai_1.assert.isFalse(starter.voting.passed);
            chai_1.assert.equal(starter.voting.count, 2);
            await ircClient.emulateMessageAsync(players[3], ircClient.channel, '!start');
            chai_1.assert.isFalse(lobby.isMatching);
            chai_1.assert.isFalse(starter.voting.passed);
            chai_1.assert.equal(starter.voting.count, 3);
            await ircClient.emulateMessageAsync(players[4], ircClient.channel, '!start');
            chai_1.assert.isTrue(lobby.isMatching);
            chai_1.assert.equal(starter.voting.count, 0);
        });
        it('sould ignore when player vote twice', async () => {
            const { starter, lobby, ircClient } = await setupAsync();
            const players = await TestUtils_1.default.AddPlayersAsync(5, ircClient);
            await TestUtils_1.default.changeHostAsync(players[0], lobby);
            chai_1.assert.equal(starter.voting.required, 4);
            chai_1.assert.isFalse(lobby.isMatching);
            chai_1.assert.isFalse(starter.voting.passed);
            chai_1.assert.equal(starter.voting.count, 0);
            await ircClient.emulateMessageAsync(players[1], ircClient.channel, '!start');
            chai_1.assert.isFalse(lobby.isMatching);
            chai_1.assert.isFalse(starter.voting.passed);
            chai_1.assert.equal(starter.voting.count, 1);
            await ircClient.emulateMessageAsync(players[1], ircClient.channel, '!start');
            chai_1.assert.isFalse(lobby.isMatching);
            chai_1.assert.isFalse(starter.voting.passed);
            chai_1.assert.equal(starter.voting.count, 1);
        });
        it('shold reset when host changed', async () => {
            const { starter, lobby, ircClient } = await setupAsync();
            const players = await TestUtils_1.default.AddPlayersAsync(5, ircClient);
            await TestUtils_1.default.changeHostAsync(players[0], lobby);
            await ircClient.emulateMessageAsync(players[1], ircClient.channel, '!start');
            await ircClient.emulateMessageAsync(players[2], ircClient.channel, '!start');
            await ircClient.emulateMessageAsync(players[3], ircClient.channel, '!start');
            chai_1.assert.isFalse(lobby.isMatching);
            chai_1.assert.isFalse(starter.voting.passed);
            chai_1.assert.equal(starter.voting.count, 3);
            await TestUtils_1.default.changeHostAsync(players[1], lobby);
            chai_1.assert.isFalse(lobby.isMatching);
            chai_1.assert.isFalse(starter.voting.passed);
            chai_1.assert.equal(starter.voting.count, 0);
            await ircClient.emulateMessageAsync(players[0], ircClient.channel, '!start');
            chai_1.assert.isFalse(lobby.isMatching);
            chai_1.assert.isFalse(starter.voting.passed);
            chai_1.assert.equal(starter.voting.count, 1);
            // host vote
            await ircClient.emulateMessageAsync(players[1], ircClient.channel, '!start');
            chai_1.assert.isTrue(lobby.isMatching);
        });
        it('shold ignore vote when matching', async () => {
            const { starter, lobby, ircClient } = await setupAsync();
            const players = await TestUtils_1.default.AddPlayersAsync(5, ircClient);
            await TestUtils_1.default.changeHostAsync(players[0], lobby);
            const t = ircClient.emulateMatchAsync(10);
            await TestUtils_1.default.delayAsync(1);
            chai_1.assert.isTrue(lobby.isMatching);
            chai_1.assert.isFalse(starter.voting.passed);
            chai_1.assert.equal(starter.voting.count, 0);
            for (const p of players) {
                await ircClient.emulateMessageAsync(p, ircClient.channel, '!start');
                chai_1.assert.isTrue(lobby.isMatching);
                chai_1.assert.isFalse(starter.voting.passed);
                chai_1.assert.equal(starter.voting.count, 0);
            }
            return t;
        });
    });
    describe('host and auth command tests', function () {
        it('host !start test', async () => {
            const { starter, lobby, ircClient } = await setupAsync();
            const players = await TestUtils_1.default.AddPlayersAsync(5, ircClient);
            await TestUtils_1.default.changeHostAsync(players[0], lobby);
            chai_1.assert.isFalse(lobby.isMatching);
            await ircClient.emulateMessageAsync(players[0], ircClient.channel, '!start');
            chai_1.assert.isTrue(lobby.isMatching);
        });
        it('host !mp start test', async () => {
            const { starter, lobby, ircClient } = await setupAsync();
            const players = await TestUtils_1.default.AddPlayersAsync(5, ircClient);
            await TestUtils_1.default.changeHostAsync(players[0], lobby);
            chai_1.assert.isFalse(lobby.isMatching);
            await ircClient.emulateMessageAsync(players[0], ircClient.channel, '!mp start');
            chai_1.assert.isTrue(lobby.isMatching);
        });
        it('auth *start test', async () => {
            const { starter, lobby, ircClient } = await setupAsync();
            const players = await TestUtils_1.default.AddPlayersAsync(5, ircClient);
            lobby.GetOrMakePlayer(players[0]).setRole(Player_1.Roles.Authorized);
            await TestUtils_1.default.changeHostAsync(players[1], lobby);
            chai_1.assert.isFalse(lobby.isMatching);
            await ircClient.emulateMessageAsync(players[0], ircClient.channel, '*start');
            chai_1.assert.isTrue(lobby.isMatching);
        });
        it('player *start test', async () => {
            const { starter, lobby, ircClient } = await setupAsync();
            const players = await TestUtils_1.default.AddPlayersAsync(5, ircClient);
            await TestUtils_1.default.changeHostAsync(players[1], lobby);
            chai_1.assert.isFalse(lobby.isMatching);
            await ircClient.emulateMessageAsync(players[0], ircClient.channel, '*start');
            chai_1.assert.isFalse(lobby.isMatching);
        });
    });
    describe('start timer tests', function () {
        it('!start timer test', async () => {
            const { starter, lobby, ircClient } = await setupAsync();
            const players = await TestUtils_1.default.AddPlayersAsync(5, ircClient);
            await TestUtils_1.default.changeHostAsync(players[0], lobby);
            chai_1.assert.isFalse(lobby.isMatching);
            chai_1.assert.isFalse(lobby.isStartTimerActive);
            chai_1.assert.isFalse(starter.IsSelfStartTimerActive);
            await ircClient.emulateMessageAsync(players[0], ircClient.channel, '!start 30');
            chai_1.assert.isFalse(lobby.isMatching);
            chai_1.assert.isFalse(lobby.isStartTimerActive);
            chai_1.assert.isTrue(starter.IsSelfStartTimerActive);
        });
        it('!start timer 0 test', async () => {
            const { starter, lobby, ircClient } = await setupAsync();
            const players = await TestUtils_1.default.AddPlayersAsync(5, ircClient);
            await TestUtils_1.default.changeHostAsync(players[0], lobby);
            chai_1.assert.isFalse(lobby.isMatching);
            chai_1.assert.isFalse(lobby.isStartTimerActive);
            chai_1.assert.isFalse(starter.IsSelfStartTimerActive);
            await ircClient.emulateMessageAsync(players[0], ircClient.channel, '!start 0');
            chai_1.assert.isTrue(lobby.isMatching);
            chai_1.assert.isFalse(lobby.isStartTimerActive);
            chai_1.assert.isFalse(starter.IsSelfStartTimerActive);
        });
        it('!start timer with negative | NaN test', async () => {
            const { starter, lobby, ircClient } = await setupAsync();
            const players = await TestUtils_1.default.AddPlayersAsync(5, ircClient);
            await TestUtils_1.default.changeHostAsync(players[0], lobby);
            chai_1.assert.isFalse(lobby.isMatching);
            const t = assertNeverBeginTimer(lobby, 10);
            await ircClient.emulateMessageAsync(players[0], ircClient.channel, '!start -100');
            chai_1.assert.isFalse(lobby.isMatching);
            await ircClient.emulateMessageAsync(players[0], ircClient.channel, '!start -454212');
            chai_1.assert.isFalse(lobby.isMatching);
            await ircClient.emulateMessageAsync(players[0], ircClient.channel, '!start -');
            chai_1.assert.isFalse(lobby.isMatching);
            await ircClient.emulateMessageAsync(players[0], ircClient.channel, '!start -0');
            chai_1.assert.isFalse(lobby.isMatching);
            await ircClient.emulateMessageAsync(players[0], ircClient.channel, '!start aaa');
            chai_1.assert.isFalse(lobby.isMatching);
            await ircClient.emulateMessageAsync(players[0], ircClient.channel, '!start 10 aaa');
            chai_1.assert.isFalse(lobby.isMatching);
            await ircClient.emulateMessageAsync(players[0], ircClient.channel, '!start aaa sdfa');
            chai_1.assert.isFalse(lobby.isMatching);
            await ircClient.emulateMessageAsync(players[0], ircClient.channel, '!start *231sd');
            chai_1.assert.isFalse(lobby.isMatching);
            chai_1.assert.isFalse(lobby.isStartTimerActive);
            chai_1.assert.isFalse(starter.IsSelfStartTimerActive);
        });
        it('!start timer from player test', async () => {
            const { starter, lobby, ircClient } = await setupAsync();
            const players = await TestUtils_1.default.AddPlayersAsync(5, ircClient);
            await TestUtils_1.default.changeHostAsync(players[0], lobby);
            chai_1.assert.isFalse(lobby.isMatching);
            await ircClient.emulateMessageAsync(players[1], ircClient.channel, '!start 100');
            chai_1.assert.isFalse(lobby.isMatching);
            chai_1.assert.isFalse(lobby.isStartTimerActive);
            chai_1.assert.isFalse(starter.IsSelfStartTimerActive);
        });
        it('!start timer from auth player test', async () => {
            const { starter, lobby, ircClient } = await setupAsync();
            const players = await TestUtils_1.default.AddPlayersAsync(5, ircClient);
            lobby.GetOrMakePlayer(players[0]).setRole(Player_1.Roles.Authorized);
            await TestUtils_1.default.changeHostAsync(players[1], lobby);
            chai_1.assert.isFalse(lobby.isMatching);
            chai_1.assert.isFalse(lobby.isStartTimerActive);
            chai_1.assert.isFalse(starter.IsSelfStartTimerActive);
            await ircClient.emulateMessageAsync(players[0], ircClient.channel, '!start 30');
            chai_1.assert.isFalse(lobby.isMatching);
            chai_1.assert.isFalse(lobby.isStartTimerActive);
            chai_1.assert.isTrue(starter.IsSelfStartTimerActive);
        });
        it('!stop test', async () => {
            const { starter, lobby, ircClient } = await setupAsync();
            const players = await TestUtils_1.default.AddPlayersAsync(5, ircClient);
            await TestUtils_1.default.changeHostAsync(players[0], lobby);
            chai_1.assert.isFalse(lobby.isMatching);
            chai_1.assert.isFalse(lobby.isStartTimerActive);
            chai_1.assert.isFalse(starter.IsSelfStartTimerActive);
            await ircClient.emulateMessageAsync(players[0], ircClient.channel, '!start 30');
            chai_1.assert.isFalse(lobby.isMatching);
            chai_1.assert.isFalse(lobby.isStartTimerActive);
            chai_1.assert.isTrue(starter.IsSelfStartTimerActive);
            await ircClient.emulateMessageAsync(players[0], ircClient.channel, '!stop');
            chai_1.assert.isFalse(lobby.isMatching);
            chai_1.assert.isFalse(lobby.isStartTimerActive);
            chai_1.assert.isFalse(starter.IsSelfStartTimerActive);
        });
        it('!stop from player test', async () => {
            const { starter, lobby, ircClient } = await setupAsync();
            const players = await TestUtils_1.default.AddPlayersAsync(5, ircClient);
            await TestUtils_1.default.changeHostAsync(players[0], lobby);
            chai_1.assert.isFalse(lobby.isMatching);
            chai_1.assert.isFalse(lobby.isStartTimerActive);
            chai_1.assert.isFalse(starter.IsSelfStartTimerActive);
            await ircClient.emulateMessageAsync(players[0], ircClient.channel, '!start 30');
            chai_1.assert.isFalse(lobby.isMatching);
            chai_1.assert.isFalse(lobby.isStartTimerActive);
            chai_1.assert.isTrue(starter.IsSelfStartTimerActive);
            await ircClient.emulateMessageAsync(players[1], ircClient.channel, '!stop');
            chai_1.assert.isFalse(lobby.isMatching);
            chai_1.assert.isFalse(lobby.isStartTimerActive);
            chai_1.assert.isTrue(starter.IsSelfStartTimerActive);
        });
    });
    it('with help test', async () => {
        const { starter, lobby, ircClient } = await setupAsync();
        const players = await TestUtils_1.default.AddPlayersAsync(5, ircClient);
        await TestUtils_1.default.changeHostAsync(players[0], lobby);
        starter.SendPluginMessage('mp_start', ['30', 'withhelp']);
    });
});
//# sourceMappingURL=MatchStarterTest.js.map