"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const chai_1 = require("chai");
const StatParser_1 = require("../parsers/StatParser");
const AfkKicker_1 = require("../plugins/AfkKicker");
const TestUtils_1 = __importDefault(require("./TestUtils"));
describe('AfkKicker Tests', function () {
    before(function () {
        TestUtils_1.default.configMochaAsSilent();
    });
    async function setupAsync() {
        const li = await TestUtils_1.default.SetupLobbyAsync();
        const kicker = new AfkKicker_1.AfkKicker(li.lobby, { cooltime_ms: 0, threshold: 6, enabled: true });
        return { kicker, ...li };
    }
    it('stat afk test', async () => {
        const { kicker, lobby, ircClient } = await setupAsync();
        const players = (await TestUtils_1.default.AddPlayersAsync(['p1', 'p2'], ircClient))
            .map(name => lobby.GetOrMakePlayer(name));
        ircClient.SetStat(new StatParser_1.StatResult(players[0].escaped_name, 100, StatParser_1.StatStatuses.Afk));
        chai_1.assert.equal(kicker.playerStats.get(players[0])?.afkPoint, 0);
        chai_1.assert.equal(kicker.playerStats.get(players[1])?.afkPoint, 0);
        lobby.SendMessage('!stat p1');
        lobby.SendMessage('!stat p2');
        chai_1.assert.equal(kicker.playerStats.get(players[0])?.afkPoint, 3);
        chai_1.assert.equal(kicker.playerStats.get(players[1])?.afkPoint, 0);
    });
    it('zero score test', async () => {
        const { kicker, lobby, ircClient } = await setupAsync();
        const players = (await TestUtils_1.default.AddPlayersAsync(['p1', 'p2'], ircClient))
            .map(name => lobby.GetOrMakePlayer(name));
        chai_1.assert.equal(kicker.playerStats.get(players[0])?.afkPoint, 0);
        chai_1.assert.equal(kicker.playerStats.get(players[1])?.afkPoint, 0);
        await ircClient.emulateMatchAsync(0, [{ name: 'p1', score: 0, passed: false }, { name: 'p2', score: 100, passed: true }]);
        chai_1.assert.equal(kicker.playerStats.get(players[0])?.afkPoint, 2);
        chai_1.assert.equal(kicker.playerStats.get(players[1])?.afkPoint, 0);
        await ircClient.emulateMatchAsync(0, [{ name: 'p1', score: 100, passed: true }, { name: 'p2', score: 100, passed: true }]);
        chai_1.assert.equal(kicker.playerStats.get(players[0])?.afkPoint, 0);
        chai_1.assert.equal(kicker.playerStats.get(players[1])?.afkPoint, 0);
    });
    it('no map test', async () => {
        const { kicker, lobby, ircClient } = await setupAsync();
        const players = (await TestUtils_1.default.AddPlayersAsync(['p1', 'p2'], ircClient))
            .map(name => lobby.GetOrMakePlayer(name));
        chai_1.assert.equal(kicker.playerStats.get(players[0])?.afkPoint, 0);
        chai_1.assert.equal(kicker.playerStats.get(players[1])?.afkPoint, 0);
        await ircClient.emulateMatchAsync(0, [{ name: 'p2', score: 100, passed: true }]);
        chai_1.assert.equal(kicker.playerStats.get(players[0])?.afkPoint, 2);
        chai_1.assert.equal(kicker.playerStats.get(players[1])?.afkPoint, 0);
        await ircClient.emulateMatchAsync(0, [{ name: 'p1', score: 100, passed: true }, { name: 'p2', score: 100, passed: true }]);
        chai_1.assert.equal(kicker.playerStats.get(players[0])?.afkPoint, 0);
        chai_1.assert.equal(kicker.playerStats.get(players[1])?.afkPoint, 0);
    });
    it('chat test', async () => {
        const { kicker, lobby, ircClient } = await setupAsync();
        const players = (await TestUtils_1.default.AddPlayersAsync(['p1', 'p2'], ircClient))
            .map(name => lobby.GetOrMakePlayer(name));
        ircClient.SetStat(new StatParser_1.StatResult(players[0].escaped_name, 100, StatParser_1.StatStatuses.Afk));
        lobby.SendMessage('!stat p1');
        chai_1.assert.equal(kicker.playerStats.get(players[0])?.afkPoint, 3);
        chai_1.assert.equal(kicker.playerStats.get(players[1])?.afkPoint, 0);
        ircClient.emulateMessage('p1', ircClient.channel, 'hello');
        chai_1.assert.equal(kicker.playerStats.get(players[0])?.afkPoint, 2);
        ircClient.emulateMessage('p1', ircClient.channel, 'hello');
        chai_1.assert.equal(kicker.playerStats.get(players[0])?.afkPoint, 1);
        ircClient.emulateMessage('p1', ircClient.channel, 'hello');
        chai_1.assert.equal(kicker.playerStats.get(players[0])?.afkPoint, 0);
        ircClient.emulateMessage('p1', ircClient.channel, 'hello');
        chai_1.assert.equal(kicker.playerStats.get(players[0])?.afkPoint, 0);
        ircClient.emulateMessage('p2', ircClient.channel, 'hello');
        chai_1.assert.equal(kicker.playerStats.get(players[1])?.afkPoint, 0);
    });
    it('kick test', async () => {
        const { kicker, lobby, ircClient } = await setupAsync();
        const players = (await TestUtils_1.default.AddPlayersAsync(['p1', 'p2'], ircClient))
            .map(name => lobby.GetOrMakePlayer(name));
        ircClient.SetStat(new StatParser_1.StatResult(players[0].escaped_name, 100, StatParser_1.StatStatuses.Afk));
        lobby.SendMessage('!stat p1');
        chai_1.assert.equal(kicker.playerStats.get(players[0])?.afkPoint, 3);
        lobby.SendMessage('!stat p1');
        chai_1.assert.notInclude(lobby.players, players[0]);
        chai_1.assert.include(lobby.players, players[1]);
    });
    it('cooltime test', async () => {
        const { kicker, lobby, ircClient } = await setupAsync();
        const players = (await TestUtils_1.default.AddPlayersAsync(['p1', 'p2'], ircClient))
            .map(name => lobby.GetOrMakePlayer(name));
        kicker.option.threshold = 100;
        kicker.option.cooltime_ms = 0;
        ircClient.SetStat(new StatParser_1.StatResult(players[0].escaped_name, 100, StatParser_1.StatStatuses.Afk));
        lobby.SendMessage('!stat p1');
        lobby.SendMessage('!stat p1');
        chai_1.assert.equal(kicker.playerStats.get(players[0])?.afkPoint, 6);
        kicker.option.cooltime_ms = 1000;
        lobby.SendMessage('!stat p1');
        chai_1.assert.equal(kicker.playerStats.get(players[0])?.afkPoint, 6);
        kicker.option.cooltime_ms = 0;
        lobby.SendMessage('!stat p1');
        chai_1.assert.equal(kicker.playerStats.get(players[0])?.afkPoint, 9);
    });
    it('enabled / disabled test', async () => {
        const { kicker, lobby, ircClient } = await setupAsync();
        const players = (await TestUtils_1.default.AddPlayersAsync(['p1', 'p2'], ircClient))
            .map(name => lobby.GetOrMakePlayer(name));
        kicker.option.threshold = 100;
        kicker.option.cooltime_ms = 0;
        ircClient.SetStat(new StatParser_1.StatResult(players[0].escaped_name, 100, StatParser_1.StatStatuses.Afk));
        lobby.SendMessage('!stat p1');
        chai_1.assert.equal(kicker.playerStats.get(players[0])?.afkPoint, 3);
        kicker.option.enabled = false;
        lobby.SendMessage('!stat p1');
        chai_1.assert.equal(kicker.playerStats.get(players[0])?.afkPoint, 3);
        kicker.option.enabled = true;
        lobby.SendMessage('!stat p1');
        chai_1.assert.equal(kicker.playerStats.get(players[0])?.afkPoint, 6);
        kicker.option.enabled = false;
        lobby.SendMessage('!stat p1');
        chai_1.assert.equal(kicker.playerStats.get(players[0])?.afkPoint, 6);
    });
    it('command tests', async () => {
        const { kicker, lobby } = await setupAsync();
        kicker.option.enabled = false;
        kicker.option.cooltime_ms = 0;
        kicker.option.threshold = 0;
        await TestUtils_1.default.sendMessageAsOwner(lobby, '*afkkick_enable');
        chai_1.assert.isTrue(kicker.option.enabled);
        chai_1.assert.equal(kicker.option.cooltime_ms, 0);
        chai_1.assert.equal(kicker.option.threshold, 0);
        await TestUtils_1.default.sendMessageAsOwner(lobby, '*afkkick_disable');
        chai_1.assert.isFalse(kicker.option.enabled);
        chai_1.assert.equal(kicker.option.cooltime_ms, 0);
        chai_1.assert.equal(kicker.option.threshold, 0);
        await TestUtils_1.default.sendMessageAsOwner(lobby, '*afkkick_threshold 100');
        chai_1.assert.isFalse(kicker.option.enabled);
        chai_1.assert.equal(kicker.option.cooltime_ms, 0);
        chai_1.assert.equal(kicker.option.threshold, 100);
        await TestUtils_1.default.sendMessageAsOwner(lobby, '*afkkick_threshold 0');
        chai_1.assert.isFalse(kicker.option.enabled);
        chai_1.assert.equal(kicker.option.cooltime_ms, 0);
        chai_1.assert.equal(kicker.option.threshold, 1); // min v = 1
        await TestUtils_1.default.sendMessageAsOwner(lobby, '*afkkick_cooltime 100000000');
        chai_1.assert.isFalse(kicker.option.enabled);
        chai_1.assert.equal(kicker.option.cooltime_ms, 100000000);
        chai_1.assert.equal(kicker.option.threshold, 1);
        await TestUtils_1.default.sendMessageAsOwner(lobby, '*afkkick_cooltime 0');
        chai_1.assert.isFalse(kicker.option.enabled);
        chai_1.assert.equal(kicker.option.cooltime_ms, 10000);
        chai_1.assert.equal(kicker.option.threshold, 1);
    });
});
//# sourceMappingURL=AfkKickerTest.js.map