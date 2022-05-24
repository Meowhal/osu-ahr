"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const chai_1 = require("chai");
const DummyIrcClient_1 = require("../dummies/DummyIrcClient");
const Lobby_1 = require("../Lobby");
const Player_1 = require("../Player");
const config_1 = __importDefault(require("config"));
const TestUtils_1 = __importDefault(require("./TestUtils"));
const HostSkipper_1 = require("../plugins/HostSkipper");
const StatParser_1 = require("../parsers/StatParser");
describe('HostSkipperTest', function () {
    before(function () {
        TestUtils_1.default.configMochaAsSilent();
    });
    async function prepare(timer_delay = 0, vote_delay = 0, logIrc = false) {
        const li = await TestUtils_1.default.SetupLobbyAsync();
        const option = {
            vote_min: 2,
            vote_rate: 0.5,
            vote_msg_defer_ms: 10,
            vote_cooltime_ms: vote_delay,
            afk_check_timeout_ms: 1000,
            afk_check_interval_first_ms: timer_delay,
            afk_check_interval_ms: timer_delay,
            afk_check_do_skip: true
        };
        const skipper = new HostSkipper_1.HostSkipper(li.lobby, option);
        return { skipper, ...li };
    }
    async function resolveSkipAsync(lobby, callback = null) {
        const t = TestUtils_1.default.assertEventFire(lobby.PluginMessage, a => a.type === 'skip');
        if (callback !== null) {
            t.then(a => {
                callback();
                return a;
            });
        }
        return t;
    }
    async function rejectSkipAsync(lobby, timeout) {
        return TestUtils_1.default.assertEventNeverFire(lobby.PluginMessage, a => a.type === 'skip', timeout);
    }
    async function resolveSkiptoAsync(lobby, userid) {
        return TestUtils_1.default.assertEventFire(lobby.PluginMessage, a => a.type === 'skipto' && a.args[0] === userid);
    }
    async function rejectSkiptoAsync(lobby, timeout) {
        return TestUtils_1.default.assertEventNeverFire(lobby.PluginMessage, a => a.type === 'skipto', timeout);
    }
    describe('construction test', () => {
        it('default', async () => {
            const ircClient = new DummyIrcClient_1.DummyIrcClient('osu_irc_server', 'creator');
            const lobby = new Lobby_1.Lobby(ircClient);
            await lobby.MakeLobbyAsync('test');
            const skipper = new HostSkipper_1.HostSkipper(lobby);
            const option = config_1.default.get('HostSkipper');
            chai_1.assert.deepEqual(skipper.option, option);
        });
        it('with option partial', async () => {
            const ircClient = new DummyIrcClient_1.DummyIrcClient('osu_irc_server', 'creator');
            const lobby = new Lobby_1.Lobby(ircClient);
            await lobby.MakeLobbyAsync('test');
            const option = {
                vote_rate: 2,
            };
            const defaultOption = config_1.default.get('HostSkipper');
            const skipper = new HostSkipper_1.HostSkipper(lobby, option);
            chai_1.assert.equal(skipper.option.vote_min, defaultOption.vote_min);
            chai_1.assert.notEqual(skipper.option.vote_rate, defaultOption.vote_rate);
            chai_1.assert.equal(skipper.option.vote_rate, option.vote_rate);
            chai_1.assert.equal(skipper.option.afk_check_interval_ms, defaultOption.afk_check_interval_ms);
            skipper.StopTimer();
        });
        it('prepare function', async () => {
            const { skipper, lobby, ircClient } = await prepare(10);
            await TestUtils_1.default.AddPlayersAsync(['p1', 'p2', 'p3'], ircClient);
            lobby.TransferHost(lobby.GetPlayer('p1'));
            chai_1.assert.isNotNull(lobby.host);
            TestUtils_1.default.assertHost('p1', lobby);
            skipper.StopTimer();
        });
    });
    describe('skip timer test', function () {
        let dslow = 0;
        before(function () {
            dslow = this.slow();
            this.slow(500);
        });
        after(function () {
            this.slow(dslow);
        });
        it('skip 10ms', async () => {
            const { skipper, lobby, ircClient } = await prepare(10);
            await TestUtils_1.default.AddPlayersAsync(['p1', 'p2', 'p3'], ircClient);
            ircClient.SetStat(new StatParser_1.StatResult('p1', 0, StatParser_1.StatStatuses.Afk));
            chai_1.assert.isUndefined(skipper.afkTimer);
            await TestUtils_1.default.changeHostAsync('p1', lobby);
            chai_1.assert.isDefined(skipper.afkTimer);
            chai_1.assert.equal(skipper.voting.count, 0);
            await resolveSkipAsync(lobby);
            skipper.StopTimer();
        });
        it('skip time check', async () => {
            const { skipper, lobby, ircClient } = await prepare(10);
            await TestUtils_1.default.AddPlayersAsync(['p1', 'p2', 'p3'], ircClient);
            ircClient.SetStat(new StatParser_1.StatResult('p1', 0, StatParser_1.StatStatuses.Afk));
            const test = async (waitTime) => {
                skipper.option.afk_check_interval_first_ms = waitTime;
                skipper.option.afk_check_interval_ms = waitTime;
                skipper.Reset();
                const startTime = await TestUtils_1.default.changeHostAsync('p1', lobby);
                const endTime = await resolveSkipAsync(lobby);
                const elapsed = endTime - startTime;
                chai_1.assert.closeTo(elapsed, waitTime, 20);
                skipper.StopTimer();
            };
            await test(10);
            await test(50);
            await test(100);
        });
        it('timer reset when host changed', async function () {
            const { skipper, lobby, ircClient } = await prepare(30);
            await TestUtils_1.default.AddPlayersAsync(['p1', 'p2', 'p3'], ircClient);
            ircClient.SetStat(new StatParser_1.StatResult('p1', 0, StatParser_1.StatStatuses.Afk));
            ircClient.SetStat(new StatParser_1.StatResult('p2', 0, StatParser_1.StatStatuses.Afk));
            const startTime = await TestUtils_1.default.changeHostAsync('p1', lobby);
            const rt = resolveSkipAsync(lobby);
            TestUtils_1.default.assertHost('p1', lobby);
            await TestUtils_1.default.delayAsync(10);
            await TestUtils_1.default.changeHostAsync('p2', lobby);
            const endTime = await rt;
            TestUtils_1.default.assertHost('p2', lobby);
            const elapsed = endTime - startTime;
            chai_1.assert.closeTo(elapsed, 10 + 30, 50);
            skipper.StopTimer();
        });
        it('timer reset when host changing map', async () => {
            const { skipper, lobby, ircClient } = await prepare(10);
            await TestUtils_1.default.AddPlayersAsync(['p1', 'p2', 'p3'], ircClient);
            ircClient.SetStat(new StatParser_1.StatResult('p1', 0, StatParser_1.StatStatuses.Afk));
            const startTime = await TestUtils_1.default.changeHostAsync('p1', lobby);
            const t = rejectSkipAsync(lobby, 10);
            await TestUtils_1.default.delayAsync(5);
            chai_1.assert.isDefined(skipper.afkTimer);
            ircClient.emulateChangeMapAsync(0);
            await t;
            await resolveSkipAsync(lobby);
            skipper.StopTimer();
        });
        it('timer stop when host chated', async () => {
            const { skipper, lobby, ircClient } = await prepare(10);
            await TestUtils_1.default.AddPlayersAsync(['p1', 'p2', 'p3'], ircClient);
            ircClient.SetStat(new StatParser_1.StatResult('p1', 0, StatParser_1.StatStatuses.Afk));
            const startTime = await TestUtils_1.default.changeHostAsync('p1', lobby);
            const t = rejectSkipAsync(lobby, 10);
            await TestUtils_1.default.delayAsync(5);
            chai_1.assert.isDefined(skipper.afkTimer);
            await ircClient.emulateMessageAsync('p1', ircClient.channel, 'hello');
            await t;
            await resolveSkipAsync(lobby);
            skipper.StopTimer();
        });
        it('if delay time is 0, timer dosent work', async () => {
            const { skipper, lobby, ircClient } = await prepare(0);
            await TestUtils_1.default.AddPlayersAsync(['p1', 'p2', 'p3'], ircClient);
            ircClient.SetStat(new StatParser_1.StatResult('p1', 0, StatParser_1.StatStatuses.Afk));
            await TestUtils_1.default.changeHostAsync('p1', lobby);
            chai_1.assert.isUndefined(skipper.afkTimer);
            await TestUtils_1.default.delayAsync(10);
            chai_1.assert.isUndefined(skipper.afkTimer);
            await rejectSkipAsync(lobby, 30);
            skipper.StopTimer();
        });
        it('dosent skip if option is false', async () => {
            const { skipper, lobby, ircClient } = await prepare(10);
            skipper.option.afk_check_do_skip = false;
            ircClient.SetStat(new StatParser_1.StatResult('p1', 0, StatParser_1.StatStatuses.Afk));
            await TestUtils_1.default.AddPlayersAsync(['p1', 'p2', 'p3'], ircClient);
            await TestUtils_1.default.changeHostAsync('p1', lobby);
            await rejectSkipAsync(lobby, 15);
            skipper.StopTimer();
        });
        it('skip afk host when a player join', async () => {
            const { skipper, lobby, ircClient } = await prepare(10);
            ircClient.SetStat(new StatParser_1.StatResult('p1', 0, StatParser_1.StatStatuses.Afk));
            await TestUtils_1.default.AddPlayersAsync(['p1'], ircClient);
            await TestUtils_1.default.changeHostAsync('p1', lobby);
            await resolveSkipAsync(lobby);
            const t = resolveSkipAsync(lobby);
            let n = Date.now();
            await TestUtils_1.default.AddPlayersAsync(['p2'], ircClient);
            n = (await t) - n;
            chai_1.assert.isBelow(n, 10);
            skipper.StopTimer();
        });
    });
    describe('skip vote test', function () {
        it('vote required check', async () => {
            const { skipper, lobby, ircClient } = await prepare();
            chai_1.assert.equal(skipper.voting.required, 2);
            await TestUtils_1.default.AddPlayersAsync(1, ircClient);
            chai_1.assert.equal(skipper.voting.required, 2);
            await TestUtils_1.default.AddPlayersAsync(1, ircClient);
            chai_1.assert.equal(skipper.voting.required, 2);
            await TestUtils_1.default.AddPlayersAsync(1, ircClient);
            chai_1.assert.equal(skipper.voting.required, 2); // player:3
            await TestUtils_1.default.AddPlayersAsync(1, ircClient);
            chai_1.assert.equal(skipper.voting.required, 2);
            await TestUtils_1.default.AddPlayersAsync(1, ircClient);
            chai_1.assert.equal(skipper.voting.required, 3); // player:5
            await TestUtils_1.default.AddPlayersAsync(1, ircClient);
            chai_1.assert.equal(skipper.voting.required, 3);
            await TestUtils_1.default.AddPlayersAsync(1, ircClient);
            chai_1.assert.equal(skipper.voting.required, 4); // player:7
            await TestUtils_1.default.AddPlayersAsync(1, ircClient);
            chai_1.assert.equal(skipper.voting.required, 4);
        });
        it('host skip', async () => {
            const { skipper, lobby, ircClient } = await prepare(0, 0);
            await TestUtils_1.default.AddPlayersAsync(3, ircClient);
            await TestUtils_1.default.changeHostAsync('p0', lobby);
            const rt = resolveSkipAsync(lobby);
            ircClient.emulateMessage('p0', ircClient.channel, '!skip');
            await rt;
        });
        it('host skip should be ignored during cool time', async () => {
            const { skipper, lobby, ircClient } = await prepare(0, 10000);
            await TestUtils_1.default.AddPlayersAsync(3, ircClient);
            await TestUtils_1.default.changeHostAsync('p0', lobby);
            const r = rejectSkipAsync(lobby, 20);
            ircClient.emulateMessage('p0', ircClient.channel, '!skip');
            await r;
        });
        it('host invalid skip', async () => {
            const { skipper, lobby, ircClient } = await prepare(0, 0);
            await TestUtils_1.default.AddPlayersAsync(5, ircClient);
            await TestUtils_1.default.changeHostAsync('p0', lobby);
            ircClient.emulateMessage('p0', ircClient.channel, '!skipaaaaa');
            await rejectSkipAsync(lobby, 10);
        });
        it('skip by players', async () => {
            const { skipper, lobby, ircClient } = await prepare(0, 0);
            await TestUtils_1.default.AddPlayersAsync(5, ircClient);
            await TestUtils_1.default.changeHostAsync('p0', lobby);
            let skipped = false;
            const task = resolveSkipAsync(lobby, () => skipped = true);
            ircClient.emulateMessage('p1', ircClient.channel, '!skip');
            await TestUtils_1.default.delayAsync(10);
            chai_1.assert.equal(skipper.voting.count, 1);
            chai_1.assert.isFalse(skipped);
            ircClient.emulateMessage('p2', ircClient.channel, '!skip');
            await TestUtils_1.default.delayAsync(10);
            chai_1.assert.equal(skipper.voting.count, 2);
            chai_1.assert.isFalse(skipped);
            ircClient.emulateMessage('p3', ircClient.channel, '!skip');
            await TestUtils_1.default.delayAsync(10);
            await task;
            chai_1.assert.equal(skipper.voting.count, 3);
            chai_1.assert.isTrue(skipped);
        });
        it('ignored vote when cooltime', async () => {
            const { skipper, lobby, ircClient } = await prepare(0, 30);
            await TestUtils_1.default.AddPlayersAsync(5, ircClient);
            await TestUtils_1.default.changeHostAsync('p0', lobby);
            const task = rejectSkipAsync(lobby, 30);
            ircClient.emulateMessage('p1', ircClient.channel, '!skip');
            ircClient.emulateMessage('p2', ircClient.channel, '!skip');
            ircClient.emulateMessage('p3', ircClient.channel, '!skip');
            await task;
            chai_1.assert.equal(skipper.voting.count, 0);
            ircClient.emulateMessage('p2', ircClient.channel, '!skip');
            await TestUtils_1.default.delayAsync(1);
            chai_1.assert.equal(skipper.voting.count, 1);
        });
        it('duplicate vote', async () => {
            const { skipper, lobby, ircClient } = await prepare(0, 0);
            await TestUtils_1.default.AddPlayersAsync(5, ircClient);
            await TestUtils_1.default.changeHostAsync('p0', lobby);
            ircClient.emulateMessage('p1', ircClient.channel, '!skip');
            ircClient.emulateMessage('p2', ircClient.channel, '!skip');
            await TestUtils_1.default.delayAsync(10);
            chai_1.assert.equal(skipper.voting.count, 2);
            ircClient.emulateMessage('p1', ircClient.channel, '!skip');
            await TestUtils_1.default.delayAsync(10);
            chai_1.assert.equal(skipper.voting.count, 2);
        });
        it('vote can valid after mapchanging', async () => {
            const { skipper, lobby, ircClient } = await prepare(0, 0);
            await TestUtils_1.default.AddPlayersAsync(5, ircClient);
            await TestUtils_1.default.changeHostAsync('p0', lobby);
            let skipped = false;
            const task = resolveSkipAsync(lobby, () => skipped = true);
            ircClient.emulateMessage('p1', ircClient.channel, '!skip');
            ircClient.emulateMessage('p2', ircClient.channel, '!skip');
            await TestUtils_1.default.delayAsync(10);
            chai_1.assert.isFalse(skipped);
            ircClient.emulateChangeMapAsync(0);
            await TestUtils_1.default.delayAsync(10);
            ircClient.emulateMessage('p3', ircClient.channel, '!skip');
            await TestUtils_1.default.delayAsync(10);
            await task;
            chai_1.assert.equal(skipper.voting.count, 3);
            chai_1.assert.isTrue(skipped);
        });
        it('vote reject when match', async () => {
            const { skipper, lobby, ircClient } = await prepare(0);
            await TestUtils_1.default.AddPlayersAsync(5, ircClient);
            await TestUtils_1.default.changeHostAsync('p0', lobby);
            ircClient.emulateMessage('p1', ircClient.channel, '!skip');
            ircClient.emulateMessage('p2', ircClient.channel, '!skip');
            await TestUtils_1.default.delayAsync(10);
            ircClient.emulateMatchAsync(10);
            await TestUtils_1.default.delayAsync(1);
            ircClient.emulateMessage('p3', ircClient.channel, '!skip');
            ircClient.emulateMessage('p4', ircClient.channel, '!skip');
            await TestUtils_1.default.delayAsync(1);
            chai_1.assert.equal(skipper.voting.count, 0);
            await TestUtils_1.default.delayAsync(10);
            chai_1.assert.equal(skipper.voting.count, 0);
        });
        it('is lots of vote ignored', async () => {
            const { skipper, lobby, ircClient } = await prepare(0);
            const numplayers = 16;
            await TestUtils_1.default.AddPlayersAsync(numplayers, ircClient);
            await TestUtils_1.default.changeHostAsync('p0', lobby);
            let skipped = false;
            const task = resolveSkipAsync(lobby, () => skipped = true);
            for (let i = 1; i < numplayers; i++) {
                ircClient.emulateMessage(`p${i}`, ircClient.channel, '!skip');
                await TestUtils_1.default.delayAsync(1);
                chai_1.assert.equal(skipper.voting.count, Math.min(i, skipper.voting.required));
                chai_1.assert.equal(skipped, skipper.voting.required <= i);
            }
        });
        it('accept !skip with host id', async () => {
            const { skipper, lobby, ircClient } = await prepare();
            await TestUtils_1.default.AddPlayersAsync(5, ircClient);
            await TestUtils_1.default.changeHostAsync('p0', lobby);
            ircClient.emulateMessage('p1', ircClient.channel, '!skip p0');
            //assert.equal(skipper.voting.count, 1);
        });
        it('accept !skip with complex host id', async () => {
            const { skipper, lobby, ircClient } = await prepare();
            const players = ['abc xxx[aaui]', 'a', 'b', 'c'];
            await TestUtils_1.default.AddPlayersAsync(players, ircClient);
            await TestUtils_1.default.changeHostAsync(players[0], lobby);
            ircClient.emulateMessage(players[1], ircClient.channel, `!skip ${players[0]}`);
            chai_1.assert.equal(skipper.voting.count, 1);
        });
        it('accept !skip with space', async () => {
            const { skipper, lobby, ircClient } = await prepare();
            const players = await TestUtils_1.default.AddPlayersAsync(5, ircClient);
            await TestUtils_1.default.changeHostAsync(players[0], lobby);
            ircClient.emulateMessage(players[1], ircClient.channel, '!skip ');
            chai_1.assert.equal(skipper.voting.count, 1);
        });
        it('ignore !skip if none host player targeted', async () => {
            const { skipper, lobby, ircClient } = await prepare();
            await TestUtils_1.default.AddPlayersAsync(5, ircClient);
            await TestUtils_1.default.changeHostAsync('p0', lobby);
            ircClient.emulateMessage('p1', ircClient.channel, '!skip abc');
            chai_1.assert.equal(skipper.voting.count, 0);
        });
    });
    describe('custom command tests', function () {
        it('*skip by authorized user test', async () => {
            const { skipper, lobby, ircClient } = await prepare();
            lobby.GetOrMakePlayer('p1').setRole(Player_1.Roles.Authorized);
            const t = resolveSkipAsync(lobby);
            await TestUtils_1.default.AddPlayersAsync(5, ircClient);
            await TestUtils_1.default.changeHostAsync('p0', lobby);
            ircClient.emulateMessage('p1', ircClient.channel, '*skip');
            await t;
        });
        it('*skip by authorized user with param test', async () => {
            const { skipper, lobby, ircClient } = await prepare();
            lobby.GetOrMakePlayer('p1').setRole(Player_1.Roles.Authorized);
            const t = resolveSkipAsync(lobby);
            await TestUtils_1.default.AddPlayersAsync(5, ircClient);
            await TestUtils_1.default.changeHostAsync('p0', lobby);
            ircClient.emulateMessage('p1', ircClient.channel, '*skip aaa');
            await t;
        });
        it('*skip by Unauthorized test', async () => {
            const { skipper, lobby, ircClient } = await prepare();
            lobby.GetOrMakePlayer('p1').setRole(Player_1.Roles.Authorized);
            const t = rejectSkipAsync(lobby, 25);
            await TestUtils_1.default.AddPlayersAsync(5, ircClient);
            await TestUtils_1.default.changeHostAsync('p0', lobby);
            ircClient.emulateMessage('p2', ircClient.channel, '*skip');
            await t;
        });
        it('*skipto test', async () => {
            const { skipper, lobby, ircClient } = await prepare();
            lobby.GetOrMakePlayer('p1').setRole(Player_1.Roles.Authorized);
            const t = resolveSkiptoAsync(lobby, 'p3');
            await TestUtils_1.default.AddPlayersAsync(5, ircClient);
            await TestUtils_1.default.changeHostAsync('p0', lobby);
            ircClient.emulateMessage('p1', ircClient.channel, '*skipto p3');
            await t;
        });
        it('failed *skipto if param isn\'t userid', async () => {
            const { skipper, lobby, ircClient } = await prepare();
            lobby.GetOrMakePlayer('p1').setRole(Player_1.Roles.Authorized);
            const t = rejectSkiptoAsync(lobby, 25);
            await TestUtils_1.default.AddPlayersAsync(5, ircClient);
            await TestUtils_1.default.changeHostAsync('p0', lobby);
            ircClient.emulateMessage('p1', ircClient.channel, '*skipto pvv3 asdv');
            await t;
        });
    });
    describe('cleared host tests', function () {
        it('skip vote', async () => {
            const { skipper, lobby, ircClient } = await prepare(0, 0);
            await TestUtils_1.default.AddPlayersAsync(5, ircClient);
            await TestUtils_1.default.changeHostAsync('p0', lobby);
            let skipped = false;
            const task = resolveSkipAsync(lobby, () => skipped = true);
            lobby.SendMessage('!mp clearhost');
            chai_1.assert.isTrue(lobby.isClearedHost);
            chai_1.assert.isNull(lobby.host);
            ircClient.emulateMessage('p1', ircClient.channel, '!skip');
            await TestUtils_1.default.delayAsync(10);
            chai_1.assert.equal(skipper.voting.count, 1);
            chai_1.assert.isFalse(skipped);
            ircClient.emulateMessage('p2', ircClient.channel, '!skip');
            await TestUtils_1.default.delayAsync(10);
            chai_1.assert.equal(skipper.voting.count, 2);
            chai_1.assert.isFalse(skipped);
            ircClient.emulateMessage('p3', ircClient.channel, '!skip');
            await TestUtils_1.default.delayAsync(10);
            await task;
            chai_1.assert.equal(skipper.voting.count, 3);
            chai_1.assert.isTrue(skipped);
        });
        it('skip vote and clearhost on the way', async () => {
            const { skipper, lobby, ircClient } = await prepare(0, 0);
            await TestUtils_1.default.AddPlayersAsync(5, ircClient);
            await TestUtils_1.default.changeHostAsync('p0', lobby);
            let skipped = false;
            const task = resolveSkipAsync(lobby, () => skipped = true);
            ircClient.emulateMessage('p1', ircClient.channel, '!skip');
            await TestUtils_1.default.delayAsync(10);
            chai_1.assert.equal(skipper.voting.count, 1);
            chai_1.assert.isFalse(skipped);
            lobby.SendMessage('!mp clearhost');
            chai_1.assert.isTrue(lobby.isClearedHost);
            chai_1.assert.isNull(lobby.host);
            ircClient.emulateMessage('p2', ircClient.channel, '!skip');
            await TestUtils_1.default.delayAsync(10);
            chai_1.assert.equal(skipper.voting.count, 2);
            chai_1.assert.isFalse(skipped);
            ircClient.emulateMessage('p3', ircClient.channel, '!skip');
            await TestUtils_1.default.delayAsync(10);
            await task;
            chai_1.assert.equal(skipper.voting.count, 3);
            chai_1.assert.isTrue(skipped);
        });
        it('*skip by authorized user test', async () => {
            const { skipper, lobby, ircClient } = await prepare();
            lobby.GetOrMakePlayer('p1').setRole(Player_1.Roles.Authorized);
            const t = resolveSkipAsync(lobby);
            await TestUtils_1.default.AddPlayersAsync(5, ircClient);
            await TestUtils_1.default.changeHostAsync('p0', lobby);
            lobby.SendMessage('!mp clearhost');
            chai_1.assert.isTrue(lobby.isClearedHost);
            chai_1.assert.isNull(lobby.host);
            ircClient.emulateMessage('p1', ircClient.channel, '*skip');
            await t;
        });
    });
});
//# sourceMappingURL=HostSkipperTest.js.map