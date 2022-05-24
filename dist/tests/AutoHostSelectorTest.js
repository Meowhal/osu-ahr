"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const chai_1 = require("chai");
const Player_1 = require("../Player");
const AutoHostSelector_1 = require("../plugins/AutoHostSelector");
const MpSettingsCases_1 = require("./cases/MpSettingsCases");
const TestUtils_1 = __importDefault(require("./TestUtils"));
describe('AutoHostSelectorTest', function () {
    before(function () {
        TestUtils_1.default.configMochaAsSilent();
    });
    this.afterEach(() => {
        AutoHostSelector_1.DENY_LIST.players.clear();
    });
    async function prepareSelector(logIrc = false) {
        const { lobby, ircClient } = await TestUtils_1.default.SetupLobbyAsync();
        return { selector: new AutoHostSelector_1.AutoHostSelector(lobby, { deny_list: [] }), lobby, ircClient };
    }
    function assertStateIs(state, s) {
        const l = s.lobby;
        switch (state) {
            case 's0': // no players
                chai_1.assert.equal(s.hostQueue.length, 0);
                break;
            case 's1': // no host
                chai_1.assert.isTrue(s.hostQueue.length > 0);
                chai_1.assert.isTrue(!l.isMatching);
                chai_1.assert.isTrue(l.host === null);
                break;
            case 'hr': // has host and needs to rotate
                chai_1.assert.isTrue(s.hostQueue.length > 0, 's.hostQueue.length > 0');
                chai_1.assert.isTrue(!l.isMatching), '!l.isMatching';
                chai_1.assert.isTrue(s.needsRotate, 's.needsRotate');
                chai_1.assert.isTrue(l.host !== null, 'l.host !== null');
                break;
            case 'hn': // has host and no needs to rotate
                chai_1.assert.isTrue(s.hostQueue.length > 0);
                chai_1.assert.isTrue(!l.isMatching);
                chai_1.assert.isFalse(s.needsRotate);
                chai_1.assert.isTrue(l.host !== null);
                break;
            case 'm': // matching
                chai_1.assert.isTrue(s.hostQueue.length > 0);
                chai_1.assert.isTrue(l.isMatching);
                break;
            default:
                chai_1.assert.fail();
        }
    }
    it('constructor test', async () => {
        const { selector } = await prepareSelector();
        assertStateIs('s0', selector);
    });
    it('dispose event test', (done) => {
        prepareSelector().then(({ selector, ircClient }) => {
            ircClient.part(ircClient.channel, '', () => {
                chai_1.assert.isEmpty(selector.eventDisposers);
                done();
            });
        });
    });
    describe('state transition tests', function () {
        it('s0 -> h test', async () => {
            const { selector, lobby, ircClient } = await prepareSelector();
            assertStateIs('s0', selector);
            await ircClient.emulateAddPlayerAsync('player1');
            assertStateIs('hr', selector);
        });
        it('s0 -> s1 -> hr test', async () => {
            const { selector, lobby, ircClient } = await prepareSelector();
            ircClient.latency = 1;
            let s1checked = false;
            lobby.PlayerJoined.once(({ player, slot }) => {
                chai_1.assert.equal(player.name, 'player1');
                assertStateIs('s1', selector);
                s1checked = true;
            });
            assertStateIs('s0', selector);
            await ircClient.emulateAddPlayerAsync('player1');
            TestUtils_1.default.assertEventFire(lobby.HostChanged, (a) => {
                assertStateIs('hr', selector);
                chai_1.assert.isTrue(s1checked);
                return true;
            });
        });
        it('s0 -> hr -> s0 test', async () => {
            const { selector, lobby, ircClient } = await prepareSelector();
            assertStateIs('s0', selector);
            await ircClient.emulateAddPlayerAsync('player1');
            assertStateIs('hr', selector);
            await TestUtils_1.default.delayAsync(10);
            await ircClient.emulateRemovePlayerAsync('player1');
            assertStateIs('s0', selector);
        });
        it('hr[1] -> hr[3] -> s0', async () => {
            const { selector, lobby, ircClient } = await prepareSelector();
            assertStateIs('s0', selector);
            const pids = ['player1', 'player2', 'player3'];
            await TestUtils_1.default.AddPlayersAsync(pids, ircClient);
            TestUtils_1.default.assertHost('player1', lobby);
            assertStateIs('hr', selector);
            await ircClient.emulateRemovePlayerAsync('player2');
            assertStateIs('hr', selector);
            TestUtils_1.default.assertHost('player1', lobby);
            await ircClient.emulateRemovePlayerAsync('player1');
            assertStateIs('hr', selector);
            TestUtils_1.default.assertHost('player3', lobby);
            await ircClient.emulateRemovePlayerAsync('player3');
            assertStateIs('s0', selector);
        });
        it('hr -> m -> hr', async () => {
            const { selector, lobby, ircClient } = await prepareSelector();
            await TestUtils_1.default.AddPlayersAsync(['player1', 'player2', 'player3'], ircClient);
            assertStateIs('hr', selector);
            TestUtils_1.default.assertHost('player1', lobby);
            await ircClient.emulateMatchAsync(0);
            assertStateIs('hr', selector);
            TestUtils_1.default.assertHost('player2', lobby);
        });
        it('hr -> m -> hr repeat', async () => {
            const { selector, lobby, ircClient } = await prepareSelector();
            await TestUtils_1.default.AddPlayersAsync(['player1', 'player2', 'player3'], ircClient);
            assertStateIs('hr', selector);
            TestUtils_1.default.assertHost('player1', lobby);
            await ircClient.emulateMatchAsync(0);
            assertStateIs('hr', selector);
            TestUtils_1.default.assertHost('player2', lobby);
            await ircClient.emulateMatchAsync(0);
            assertStateIs('hr', selector);
            TestUtils_1.default.assertHost('player3', lobby);
            await ircClient.emulateMatchAsync(0);
            assertStateIs('hr', selector);
            TestUtils_1.default.assertHost('player1', lobby);
        });
        it('hr -> hn -> m -> hr', async () => {
            const { selector, lobby, ircClient } = await prepareSelector();
            await TestUtils_1.default.AddPlayersAsync(['player1', 'player2', 'player3'], ircClient);
            assertStateIs('hr', selector);
            TestUtils_1.default.assertHost('player1', lobby);
            await ircClient.emulateChangeMapAsync(0);
            assertStateIs('hr', selector);
            await ircClient.emulateRemovePlayerAsync('player1');
            assertStateIs('hn', selector);
            TestUtils_1.default.assertHost('player2', lobby);
            await ircClient.emulateMatchAsync(0);
            assertStateIs('hr', selector);
            TestUtils_1.default.assertHost('player2', lobby);
        });
        it('hr -[leave]-> hn -[change map]-> hr -> m -> hr', async () => {
            const { selector, lobby, ircClient } = await prepareSelector();
            await TestUtils_1.default.AddPlayersAsync(['player1', 'player2', 'player3'], ircClient);
            assertStateIs('hr', selector);
            TestUtils_1.default.assertHost('player1', lobby);
            await ircClient.emulateChangeMapAsync(0);
            await ircClient.emulateRemovePlayerAsync('player1');
            assertStateIs('hn', selector);
            TestUtils_1.default.assertHost('player2', lobby);
            await ircClient.emulateChangeMapAsync(0);
            assertStateIs('hr', selector);
            TestUtils_1.default.assertHost('player2', lobby);
            await ircClient.emulateMatchAsync(0);
            assertStateIs('hr', selector);
            TestUtils_1.default.assertHost('player3', lobby);
        });
        it('hr -[transfer]-> hn -[change map]-> hr -> m -> hr', async () => {
            const { selector, lobby, ircClient } = await prepareSelector();
            await TestUtils_1.default.AddPlayersAsync(['player1', 'player2', 'player3'], ircClient);
            assertStateIs('hr', selector);
            TestUtils_1.default.assertHost('player1', lobby);
            await ircClient.emulateChangeMapAsync(0);
            await ircClient.emulateChangeHost('player2');
            assertStateIs('hn', selector);
            TestUtils_1.default.assertHost('player2', lobby);
            await ircClient.emulateChangeMapAsync(0);
            assertStateIs('hr', selector);
            TestUtils_1.default.assertHost('player2', lobby);
            await ircClient.emulateMatchAsync(0);
            assertStateIs('hr', selector);
            TestUtils_1.default.assertHost('player3', lobby);
        });
        it('hr -> m -[abort]-> hn', async () => {
            const { selector, lobby, ircClient } = await prepareSelector();
            await TestUtils_1.default.AddPlayersAsync(['player1', 'player2', 'player3'], ircClient);
            assertStateIs('hr', selector);
            TestUtils_1.default.assertHost('player1', lobby);
            await ircClient.emulateChangeMapAsync(0);
            assertStateIs('hr', selector);
            await ircClient.emulateMatchAndAbortAsync(0, 0);
            assertStateIs('hn', selector);
            TestUtils_1.default.assertHost('player1', lobby);
        });
        // アボート後にホストがマップを変更するとhostが切り替わる
        it('hr -> m -[abort]-> hn -[mapchange]-> hn -> hr', async () => {
            const { selector, lobby, ircClient } = await prepareSelector();
            await TestUtils_1.default.AddPlayersAsync(['player1', 'player2', 'player3'], ircClient);
            assertStateIs('hr', selector);
            TestUtils_1.default.assertHost('player1', lobby);
            await ircClient.emulateChangeMapAsync(0);
            assertStateIs('hr', selector);
            await ircClient.emulateMatchAndAbortAsync(0, 0);
            assertStateIs('hn', selector);
            TestUtils_1.default.assertHost('player1', lobby);
            await ircClient.emulateChangeMapAsync(0);
            assertStateIs('hn', selector);
            TestUtils_1.default.assertHost('player2', lobby);
            await ircClient.emulateChangeMapAsync(0);
            assertStateIs('hr', selector);
            TestUtils_1.default.assertHost('player2', lobby);
        });
        it('hr -> m -[abort]-> hn -[leave]-> hn -> hr', async () => {
            const { selector, lobby, ircClient } = await prepareSelector();
            await TestUtils_1.default.AddPlayersAsync(['player1', 'player2', 'player3'], ircClient);
            assertStateIs('hr', selector);
            TestUtils_1.default.assertHost('player1', lobby);
            await ircClient.emulateChangeMapAsync(0);
            assertStateIs('hr', selector);
            await ircClient.emulateMatchAndAbortAsync(0, 0);
            assertStateIs('hn', selector);
            TestUtils_1.default.assertHost('player1', lobby);
            await ircClient.emulateRemovePlayerAsync('player1');
            assertStateIs('hn', selector);
            TestUtils_1.default.assertHost('player2', lobby);
            await ircClient.emulateChangeMapAsync(0);
            assertStateIs('hr', selector);
            TestUtils_1.default.assertHost('player2', lobby);
        });
        it('hr -> s0 -> hr', async () => {
            const { selector, lobby, ircClient } = await prepareSelector();
            await TestUtils_1.default.AddPlayersAsync(['player1'], ircClient);
            assertStateIs('hr', selector);
            TestUtils_1.default.assertHost('player1', lobby);
            await ircClient.emulateChangeMapAsync(0);
            assertStateIs('hr', selector);
            await ircClient.emulateRemovePlayerAsync('player1');
            assertStateIs('s0', selector);
            await TestUtils_1.default.AddPlayersAsync(['player1'], ircClient);
            TestUtils_1.default.assertHost('player1', lobby);
            assertStateIs('hr', selector);
        });
        it('hr -> s0 -> hn -[map change]-> hr', async () => {
            const { selector, lobby, ircClient } = await prepareSelector();
            await TestUtils_1.default.AddPlayersAsync(['player1'], ircClient);
            assertStateIs('hr', selector);
            TestUtils_1.default.assertHost('player1', lobby);
            await ircClient.emulateChangeMapAsync(0);
            assertStateIs('hr', selector);
            await ircClient.emulateRemovePlayerAsync('player1');
            assertStateIs('s0', selector);
            await TestUtils_1.default.AddPlayersAsync(['player2', 'player3'], ircClient);
            TestUtils_1.default.assertHost('player2', lobby);
            assertStateIs('hn', selector);
            await ircClient.emulateMatchAsync(0);
            TestUtils_1.default.assertHost('player2', lobby);
            assertStateIs('hr', selector);
        });
    });
    describe('join and left tests', function () {
        // 試合中にプレイヤーが入ってきた場合、現在のホストの後ろに配置される
        it('newcomer who join during the match should be enqueued after the currnt host.', async () => {
            const { selector, lobby, ircClient } = await prepareSelector(false);
            await TestUtils_1.default.AddPlayersAsync(['player1', 'player2'], ircClient);
            assertStateIs('hr', selector);
            TestUtils_1.default.assertHost('player1', lobby);
            const task = ircClient.emulateMatchAsync(4);
            await TestUtils_1.default.delayAsync(1);
            ircClient.emulateAddPlayerAsync('player3'); // join during the match
            await task;
            assertStateIs('hr', selector);
            TestUtils_1.default.assertHost('player2', lobby);
            await ircClient.emulateMatchAsync();
            assertStateIs('hr', selector);
            TestUtils_1.default.assertHost('player1', lobby); // not player3
        });
        it('player left in the match', async () => {
            const { selector, lobby, ircClient } = await prepareSelector();
            await TestUtils_1.default.AddPlayersAsync(['player1', 'player2', 'player3'], ircClient);
            assertStateIs('hr', selector);
            TestUtils_1.default.assertHost('player1', lobby);
            let task = ircClient.emulateMatchAsync(4);
            await TestUtils_1.default.delayAsync(1);
            await ircClient.emulateRemovePlayerAsync('player3');
            await task;
            assertStateIs('hr', selector);
            TestUtils_1.default.assertHost('player2', lobby);
            task = ircClient.emulateMatchAsync(4);
            await TestUtils_1.default.delayAsync(1);
            await ircClient.emulateRemovePlayerAsync('player2');
            await task;
            assertStateIs('hr', selector);
            TestUtils_1.default.assertHost('player1', lobby);
            await ircClient.emulateAddPlayerAsync('player4');
            await ircClient.emulateAddPlayerAsync('player5');
            await ircClient.emulateAddPlayerAsync('player6');
            task = ircClient.emulateMatchAsync(4);
            await TestUtils_1.default.delayAsync(1);
            await ircClient.emulateRemovePlayerAsync('player1');
            await task;
            assertStateIs('hr', selector);
            TestUtils_1.default.assertHost('player4', lobby);
        });
        it('transfer host manually test', async () => {
            const { selector, lobby, ircClient } = await prepareSelector();
            await TestUtils_1.default.AddPlayersAsync(['player1', 'player2', 'player3'], ircClient);
            assertStateIs('hr', selector);
            TestUtils_1.default.assertHost('player1', lobby);
            await ircClient.emulateChangeHost('player2');
            await TestUtils_1.default.delayAsync(1);
            TestUtils_1.default.assertHost('player2', lobby);
            await ircClient.emulateChangeHost('player1');
            await TestUtils_1.default.delayAsync(1);
            TestUtils_1.default.assertHost('player3', lobby);
            await ircClient.emulateChangeHost('player3');
            await TestUtils_1.default.delayAsync(1);
            TestUtils_1.default.assertHost('player3', lobby);
            await ircClient.emulateChangeHost('player2');
            await TestUtils_1.default.delayAsync(1);
            TestUtils_1.default.assertHost('player1', lobby);
        });
        it('appoint next host when current host leave', async () => {
            const { selector, lobby, ircClient } = await prepareSelector();
            await TestUtils_1.default.AddPlayersAsync(['player1', 'player2', 'player3'], ircClient);
            assertStateIs('hr', selector);
            TestUtils_1.default.assertHost('player1', lobby);
            await ircClient.emulateRemovePlayerAsync('player1');
            await TestUtils_1.default.delayAsync(1);
            TestUtils_1.default.assertHost('player2', lobby);
        });
        it('conflict transfer host manually and plugin rotation test1', async () => {
            const { selector, lobby, ircClient } = await prepareSelector();
            await TestUtils_1.default.AddPlayersAsync(['player1', 'player2', 'player3'], ircClient);
            assertStateIs('hr', selector);
            TestUtils_1.default.assertHost('player1', lobby);
            const t1 = ircClient.emulateMatchAsync(1);
            ircClient.latency = 1;
            await t1;
            ircClient.latency = 0;
            await ircClient.emulateChangeHost('player3');
            await TestUtils_1.default.delayAsync(10);
            TestUtils_1.default.assertHost('player2', lobby);
        });
        it('conflict transfer host manually and plugin rotation test2', async () => {
            const { selector, lobby, ircClient } = await prepareSelector();
            await TestUtils_1.default.AddPlayersAsync(['player1', 'player2', 'player3'], ircClient);
            assertStateIs('hr', selector);
            TestUtils_1.default.assertHost('player1', lobby);
            const t1 = ircClient.emulateMatchAsync(1);
            ircClient.latency = 1;
            await t1;
            ircClient.latency = 0;
            await ircClient.emulateChangeHost('player2');
            await TestUtils_1.default.delayAsync(10);
            TestUtils_1.default.assertHost('player2', lobby);
        });
        it('issue #37 host left and match started at the same time', async () => {
            const { selector, lobby, ircClient } = await prepareSelector();
            await TestUtils_1.default.AddPlayersAsync(['player1', 'player2', 'player3'], ircClient);
            assertStateIs('hr', selector);
            TestUtils_1.default.assertHost('player1', lobby);
            await ircClient.emulateChangeMapAsync(0);
            ircClient.latency = 10; // it makes bot respond to !mp start command before !mp host command
            await ircClient.emulateRemovePlayerAsync('player1');
            ircClient.latency = 0;
            const t1 = ircClient.emulateMatchAsync(20);
            await TestUtils_1.default.delayAsync(10);
            TestUtils_1.default.assertHost('player2', lobby);
            assertStateIs('m', selector);
            await t1;
            TestUtils_1.default.assertHost('player2', lobby);
            assertStateIs('hr', selector);
        });
        it('issue #37 test rotation after the issue', async () => {
            const { selector, lobby, ircClient } = await prepareSelector();
            await TestUtils_1.default.AddPlayersAsync(['player1', 'player2', 'player3'], ircClient);
            assertStateIs('hr', selector);
            TestUtils_1.default.assertHost('player1', lobby);
            await ircClient.emulateChangeMapAsync(0);
            ircClient.latency = 10;
            await ircClient.emulateRemovePlayerAsync('player1');
            ircClient.latency = 0;
            const t1 = ircClient.emulateMatchAsync(20);
            await TestUtils_1.default.delayAsync(10);
            TestUtils_1.default.assertHost('player2', lobby);
            await t1;
            TestUtils_1.default.assertHost('player2', lobby);
            await ircClient.emulateChangeMapAsync(0);
            await ircClient.emulateMatchAsync(0);
            TestUtils_1.default.assertHost('player3', lobby);
        });
        it('issue #37 player2 dosen\'t change map test', async () => {
            const { selector, lobby, ircClient } = await prepareSelector();
            await TestUtils_1.default.AddPlayersAsync(['player1', 'player2', 'player3'], ircClient);
            assertStateIs('hr', selector);
            TestUtils_1.default.assertHost('player1', lobby);
            await ircClient.emulateChangeMapAsync(0);
            ircClient.latency = 10; // it makes bot respond to !mp start command before !mp host command
            await ircClient.emulateRemovePlayerAsync('player1');
            ircClient.latency = 0;
            const t1 = ircClient.emulateMatchAsync(20);
            await TestUtils_1.default.delayAsync(10);
            TestUtils_1.default.assertHost('player2', lobby);
            await t1;
            TestUtils_1.default.assertHost('player2', lobby);
            await ircClient.emulateMatchAsync(0);
            TestUtils_1.default.assertHost('player3', lobby);
        });
    });
    describe('external operation tests', function () {
        it('plugin message skip test', async () => {
            const { selector, lobby, ircClient } = await prepareSelector();
            await TestUtils_1.default.AddPlayersAsync(['player1', 'player2', 'player3'], ircClient);
            assertStateIs('hr', selector);
            TestUtils_1.default.assertHost('player1', lobby);
            selector.SendPluginMessage('skip');
            await TestUtils_1.default.delayAsync(5);
            TestUtils_1.default.assertHost('player2', lobby);
        });
        it('plugin message skipto test', async () => {
            const { selector, lobby, ircClient } = await prepareSelector();
            await TestUtils_1.default.AddPlayersAsync(['player1', 'player2', 'player3'], ircClient);
            assertStateIs('hr', selector);
            TestUtils_1.default.assertHost('player1', lobby);
            selector.SendPluginMessage('skipto', ['player3']);
            await TestUtils_1.default.delayAsync(5);
            TestUtils_1.default.assertHost('player3', lobby);
            chai_1.assert.equal(selector.hostQueue[0].name, 'player3');
            chai_1.assert.equal(selector.hostQueue[1].name, 'player1');
            chai_1.assert.equal(selector.hostQueue[2].name, 'player2');
            selector.SendPluginMessage('skipto', ['player3']);
            await TestUtils_1.default.delayAsync(5);
            TestUtils_1.default.assertHost('player3', lobby);
            chai_1.assert.equal(selector.hostQueue[0].name, 'player3');
            chai_1.assert.equal(selector.hostQueue[1].name, 'player1');
            chai_1.assert.equal(selector.hostQueue[2].name, 'player2');
        });
    });
    describe('skip tests', function () {
        it('should change host when changed map -> changed host -> map change -> match start', async () => {
            const { selector, lobby, ircClient } = await prepareSelector();
            await TestUtils_1.default.AddPlayersAsync(['player1', 'player2', 'player3'], ircClient);
            assertStateIs('hr', selector);
            TestUtils_1.default.assertHost('player1', lobby);
            await ircClient.emulateMatchAsync(0);
            assertStateIs('hr', selector);
            TestUtils_1.default.assertHost('player2', lobby);
            await ircClient.emulateChangeMapAsync(0);
            await ircClient.emulateRemovePlayerAsync('player2');
            assertStateIs('hn', selector);
            TestUtils_1.default.assertHost('player3', lobby);
            await ircClient.emulateChangeMapAsync(0);
            assertStateIs('hr', selector);
            TestUtils_1.default.assertHost('player3', lobby);
            await ircClient.emulateMatchAsync(0);
            assertStateIs('hr', selector);
            TestUtils_1.default.assertHost('player1', lobby);
        });
        it('should not change host when changed map -> changed host -> started match', async () => {
            const { selector, lobby, ircClient } = await prepareSelector();
            await TestUtils_1.default.AddPlayersAsync(['player1', 'player2', 'player3'], ircClient);
            await ircClient.emulateMatchAsync(0);
            await ircClient.emulateChangeMapAsync(0);
            assertStateIs('hr', selector);
            TestUtils_1.default.assertHost('player2', lobby);
            await ircClient.emulateChangeMapAsync(0);
            await ircClient.emulateRemovePlayerAsync('player2');
            assertStateIs('hn', selector);
            TestUtils_1.default.assertHost('player3', lobby);
            await ircClient.emulateMatchAsync(0);
            assertStateIs('hr', selector);
            TestUtils_1.default.assertHost('player3', lobby);
            await ircClient.emulateMatchAsync(0);
            assertStateIs('hr', selector);
            TestUtils_1.default.assertHost('player1', lobby);
        });
    });
    describe('match abort tests', function () {
        it('should not change host if match is aborted before any player finished', async () => {
            const { selector, lobby, ircClient } = await prepareSelector();
            await TestUtils_1.default.AddPlayersAsync(['player1', 'player2', 'player3'], ircClient);
            assertStateIs('hr', selector);
            TestUtils_1.default.assertHost('player1', lobby);
            await ircClient.emulateMatchAndAbortAsync();
            assertStateIs('hn', selector);
            TestUtils_1.default.assertHost('player1', lobby);
            await ircClient.emulateMatchAsync(0);
            assertStateIs('hr', selector);
            TestUtils_1.default.assertHost('player2', lobby);
        });
        it('should change host when match is aborted after some players finished', async () => {
            const { selector, lobby, ircClient } = await prepareSelector();
            await TestUtils_1.default.AddPlayersAsync(['player1', 'player2', 'player3'], ircClient);
            assertStateIs('hr', selector);
            TestUtils_1.default.assertHost('player1', lobby);
            await ircClient.emulateMatchAndAbortAsync(0, 1);
            assertStateIs('hr', selector);
            TestUtils_1.default.assertHost('player2', lobby);
            await ircClient.emulateMatchAsync(0);
            assertStateIs('hr', selector);
            TestUtils_1.default.assertHost('player3', lobby);
        });
        it('should change host when match start -> abort -> map change', async () => {
            const { selector, lobby, ircClient } = await prepareSelector();
            await TestUtils_1.default.AddPlayersAsync(['player1', 'player2', 'player3'], ircClient);
            assertStateIs('hr', selector);
            TestUtils_1.default.assertHost('player1', lobby);
            await ircClient.emulateMatchAndAbortAsync();
            assertStateIs('hn', selector);
            TestUtils_1.default.assertHost('player1', lobby);
            await ircClient.emulateChangeMapAsync();
            assertStateIs('hn', selector);
            TestUtils_1.default.assertHost('player2', lobby);
            await ircClient.emulateMatchAsync(0);
            assertStateIs('hr', selector);
            TestUtils_1.default.assertHost('player2', lobby);
        });
        it('should change host and be remainable when map change -> match start -> host left -> match abort', async () => {
            const { selector, lobby, ircClient } = await prepareSelector();
            const players = await TestUtils_1.default.AddPlayersAsync(5, ircClient);
            await ircClient.emulateMatchAsync(0);
            await ircClient.emulateChangeMapAsync(0);
            assertStateIs('hr', selector);
            TestUtils_1.default.assertHost(players[1], lobby);
            const t = ircClient.emulateMatchAsync(60);
            await TestUtils_1.default.delayAsync(1);
            await ircClient.emulateRemovePlayerAsync(players[1]);
            assertStateIs('m', selector);
            chai_1.assert.isNull(lobby.host);
            lobby.AbortMatch();
            await TestUtils_1.default.delayAsync(1);
            assertStateIs('hn', selector);
            TestUtils_1.default.assertHost(players[2], lobby);
            await ircClient.emulateMatchAsync(0);
            assertStateIs('hr', selector);
            TestUtils_1.default.assertHost(players[2], lobby);
        });
        it('should not change host when -> match start -> host left -> match abort -> map change', async () => {
            const { selector, lobby, ircClient } = await prepareSelector();
            const players = await TestUtils_1.default.AddPlayersAsync(5, ircClient);
            await ircClient.emulateMatchAsync(0);
            await ircClient.emulateChangeMapAsync(0);
            assertStateIs('hr', selector);
            TestUtils_1.default.assertHost(players[1], lobby);
            const t = ircClient.emulateMatchAsync(30);
            await TestUtils_1.default.delayAsync(1);
            await ircClient.emulateRemovePlayerAsync(players[1]);
            assertStateIs('m', selector);
            chai_1.assert.isNull(lobby.host);
            lobby.AbortMatch();
            await TestUtils_1.default.delayAsync(1);
            assertStateIs('hn', selector);
            TestUtils_1.default.assertHost(players[2], lobby);
            await ircClient.emulateChangeMapAsync(0);
            assertStateIs('hr', selector);
            TestUtils_1.default.assertHost(players[2], lobby);
        });
        it('should change host when -> match start -> host left -> player finish -> match abort -> map change', async () => {
            const { selector, lobby, ircClient } = await prepareSelector();
            const players = await TestUtils_1.default.AddPlayersAsync(['a', 'b', 'c', 'd'], ircClient);
            await ircClient.emulateMatchAsync(0);
            await ircClient.emulateChangeMapAsync(0);
            assertStateIs('hr', selector);
            TestUtils_1.default.assertHost('b', lobby);
            const t = ircClient.emulateMatchAndAbortAsync(10, ['a', 'c', 'd']);
            await TestUtils_1.default.delayAsync(1);
            await ircClient.emulateRemovePlayerAsync('b');
            assertStateIs('m', selector);
            chai_1.assert.isNull(lobby.host);
            await t;
            assertStateIs('hr', selector);
            TestUtils_1.default.assertHost('c', lobby);
            await ircClient.emulateChangeMapAsync(0);
            assertStateIs('hr', selector);
            TestUtils_1.default.assertHost('c', lobby);
        });
    });
    describe('mp settings tests', function () {
        it('empty lobby case1_1', async () => {
            const { selector, lobby, ircClient } = await prepareSelector();
            const c = MpSettingsCases_1.MpSettingsCases.case1_1;
            const q = ['p1', 'p2', 'p3', 'p4', 'p5'];
            ircClient.emulateMpSettings(c);
            for (let i = 0; i < selector.hostQueue.length; i++) {
                chai_1.assert.equal(selector.hostQueue[i].name, q[i]);
            }
        });
        it('empty lobby case1_2', async () => {
            const { selector, lobby, ircClient } = await prepareSelector();
            const c = MpSettingsCases_1.MpSettingsCases.case1_2;
            const q = ['p3', 'p4', 'p5', 'p1', 'p2'];
            ircClient.emulateMpSettings(c);
            for (let i = 0; i < selector.hostQueue.length; i++) {
                chai_1.assert.equal(selector.hostQueue[i].name, q[i]);
            }
        });
        it('change host test', async () => {
            const { selector, lobby, ircClient } = await prepareSelector();
            const c = MpSettingsCases_1.MpSettingsCases.case1_1;
            const q1 = ['p1', 'p2', 'p3', 'p4', 'p5'];
            const q2 = ['p3', 'p4', 'p5', 'p1', 'p2'];
            ircClient.emulateMpSettings(c);
            for (let i = 0; i < selector.hostQueue.length; i++) {
                chai_1.assert.equal(selector.hostQueue[i].name, q1[i]);
            }
            selector.SkipTo('p3');
            for (let i = 0; i < selector.hostQueue.length; i++) {
                chai_1.assert.equal(selector.hostQueue[i].name, q2[i]);
            }
            if (lobby.host === null)
                return;
            chai_1.assert.isTrue(lobby.host.isHost);
            chai_1.assert.equal(lobby.host.name, 'p3');
            ircClient.emulateMpSettings(c);
            for (let i = 0; i < selector.hostQueue.length; i++) {
                chai_1.assert.equal(selector.hostQueue[i].name, q1[i]);
            }
            chai_1.assert.equal(lobby.host.name, 'p1');
        });
        it('mod queue test', async () => {
            const { selector, lobby, ircClient } = await prepareSelector();
            const c1 = MpSettingsCases_1.MpSettingsCases.case1_1;
            const c3 = MpSettingsCases_1.MpSettingsCases.case1_3;
            const q1 = ['p1', 'p2', 'p3', 'p4', 'p5'];
            const q2 = ['p4', 'p5', 'p6', 'p7', 'p2'];
            ircClient.emulateMpSettings(c1);
            for (let i = 0; i < selector.hostQueue.length; i++) {
                chai_1.assert.equal(selector.hostQueue[i].name, q1[i]);
            }
            ircClient.emulateMpSettings(c3);
            for (let i = 0; i < selector.hostQueue.length; i++) {
                chai_1.assert.equal(selector.hostQueue[i].name, q2[i], `${i} a-${selector.hostQueue[i].name} e-${q2[i]}`);
            }
            if (lobby.host === null)
                chai_1.assert.fail();
            else
                chai_1.assert.equal(lobby.host.name, 'p4');
        });
        it('reset queue test', async () => {
            const { selector, lobby, ircClient } = await prepareSelector();
            const c1 = MpSettingsCases_1.MpSettingsCases.case1_1;
            const q1 = ['p1', 'p2', 'p3', 'p4', 'p5'];
            const q2 = ['p4', 'p5', 'p6', 'p7', 'p2'];
            ircClient.emulateMpSettings(c1);
            for (let i = 0; i < selector.hostQueue.length; i++) {
                chai_1.assert.equal(selector.hostQueue[i].name, q1[i]);
            }
            ircClient.emulateRemovePlayerAsync('p1');
            selector.SkipTo('p3');
            ircClient.emulateMpSettings(c1);
            for (let i = 0; i < selector.hostQueue.length; i++) {
                chai_1.assert.equal(selector.hostQueue[i].name, q1[i], `${i} a-${selector.hostQueue[i].name} e-${q2[i]}`);
            }
            if (lobby.host === null)
                chai_1.assert.fail();
            else
                chai_1.assert.equal(lobby.host.name, 'p1');
        });
    });
    describe('reoder tests', function () {
        it('reaoder', async () => {
            const { selector, lobby, ircClient } = await prepareSelector();
            const players = await TestUtils_1.default.AddPlayersAsync(5, ircClient);
            const od = ['p3', 'p1', 'p2', 'p4', 'p0'];
            selector.Reorder(od.join(','));
            await TestUtils_1.default.delayAsync(1);
            TestUtils_1.default.assertHost('p3', lobby);
            for (let i = 0; i < od.length; i++) {
                chai_1.assert.equal(selector.hostQueue[i].name, od[i]);
            }
        });
        it('disguised string', async () => {
            const { selector, lobby, ircClient } = await prepareSelector();
            const players = await TestUtils_1.default.AddPlayersAsync(5, ircClient);
            const disguised = 'p​0, p​1, p​2, p​3, p​4';
            const od = ['p0', 'p1', 'p2', 'p3', 'p4'];
            selector.SkipTo('p3');
            await TestUtils_1.default.delayAsync(1);
            selector.Reorder(disguised);
            await TestUtils_1.default.delayAsync(1);
            TestUtils_1.default.assertHost('p0', lobby);
            for (let i = 0; i < od.length; i++) {
                chai_1.assert.equal(selector.hostQueue[i].name, od[i]);
            }
        });
        it('no change', async () => {
            const { selector, lobby, ircClient } = await prepareSelector();
            const players = await TestUtils_1.default.AddPlayersAsync(5, ircClient);
            const odtxt = 'p​0, p​1, p​2, p​3, p​4';
            const od = ['p0', 'p1', 'p2', 'p3', 'p4'];
            selector.Reorder(odtxt);
            await TestUtils_1.default.delayAsync(1);
            TestUtils_1.default.assertHost('p0', lobby);
            for (let i = 0; i < od.length; i++) {
                chai_1.assert.equal(selector.hostQueue[i].name, od[i]);
            }
        });
        it('partially specify', async () => {
            const { selector, lobby, ircClient } = await prepareSelector();
            const players = await TestUtils_1.default.AddPlayersAsync(5, ircClient);
            const odtxt = 'p​3, p​4, p2';
            const od = ['p3', 'p4', 'p2', 'p0', 'p1'];
            selector.Reorder(odtxt);
            await TestUtils_1.default.delayAsync(1);
            TestUtils_1.default.assertHost('p3', lobby);
            for (let i = 0; i < od.length; i++) {
                chai_1.assert.equal(selector.hostQueue[i].name, od[i]);
            }
        });
        it('extra specify', async () => {
            const { selector, lobby, ircClient } = await prepareSelector();
            const players = await TestUtils_1.default.AddPlayersAsync(5, ircClient);
            const odtxt = 'p3, p6, p4, p2, p5, p0, p1';
            const od = ['p3', 'p4', 'p2', 'p0', 'p1'];
            selector.Reorder(odtxt);
            await TestUtils_1.default.delayAsync(1);
            TestUtils_1.default.assertHost('p3', lobby);
            for (let i = 0; i < od.length; i++) {
                chai_1.assert.equal(selector.hostQueue[i].name, od[i]);
            }
        });
        it('from custom command', async () => {
            const { selector, lobby, ircClient } = await prepareSelector();
            lobby.option.authorized_users = ['p0'];
            const players = await TestUtils_1.default.AddPlayersAsync(5, ircClient);
            const odtxt = '*reorder p​0, p​1, p​2, p​3, p​4';
            const od = ['p0', 'p1', 'p2', 'p3', 'p4'];
            selector.SkipTo('p3');
            TestUtils_1.default.assertHost('p3', lobby);
            await TestUtils_1.default.delayAsync(1);
            await ircClient.emulateMessageAsync('p0', ircClient.channel, odtxt);
            for (let i = 0; i < od.length; i++) {
                chai_1.assert.equal(selector.hostQueue[i].name, od[i]);
            }
        });
        it('invalid custom command', async () => {
            const { selector, lobby, ircClient } = await prepareSelector();
            lobby.option.authorized_users = ['p0'];
            const players = await TestUtils_1.default.AddPlayersAsync(5, ircClient);
            let odtxt = '*reorder';
            const od = ['p3', 'p4', 'p0', 'p1', 'p2'];
            selector.SkipTo('p3');
            TestUtils_1.default.assertHost('p3', lobby);
            await TestUtils_1.default.delayAsync(1);
            await ircClient.emulateMessageAsync('p0', ircClient.channel, odtxt);
            for (let i = 0; i < od.length; i++) {
                chai_1.assert.equal(selector.hostQueue[i].name, od[i]);
            }
            odtxt = '*reorder asdfsafasdf';
            await TestUtils_1.default.delayAsync(1);
            await ircClient.emulateMessageAsync('p0', ircClient.channel, odtxt);
            for (let i = 0; i < od.length; i++) {
                chai_1.assert.equal(selector.hostQueue[i].name, od[i]);
            }
        });
    });
    describe('cleared host tests', function () {
        it('clearhost and match', async () => {
            const { selector, lobby, ircClient } = await prepareSelector();
            await TestUtils_1.default.AddPlayersAsync(['player1', 'player2', 'player3'], ircClient);
            assertStateIs('hr', selector);
            TestUtils_1.default.assertHost('player1', lobby);
            lobby.SendMessage('!mp clearhost');
            chai_1.assert.isTrue(lobby.isClearedHost);
            chai_1.assert.isNull(lobby.host);
            await ircClient.emulateMatchAsync();
            TestUtils_1.default.assertHost('player2', lobby);
        });
        it('plugin skip test', async () => {
            const { selector, lobby, ircClient } = await prepareSelector();
            await TestUtils_1.default.AddPlayersAsync(['player1', 'player2', 'player3'], ircClient);
            assertStateIs('hr', selector);
            TestUtils_1.default.assertHost('player1', lobby);
            lobby.SendMessage('!mp clearhost');
            chai_1.assert.isTrue(lobby.isClearedHost);
            chai_1.assert.isNull(lobby.host);
            selector.SendPluginMessage('skip');
            await TestUtils_1.default.delayAsync(5);
            TestUtils_1.default.assertHost('player2', lobby);
        });
    });
    describe('denylist tests', function () {
        it('denied player should ignore test', async () => {
            const { selector, lobby, ircClient } = await prepareSelector();
            AutoHostSelector_1.DENY_LIST.addPlayer(lobby.GetOrMakePlayer('p3'));
            await ircClient.emulateMpSettings(MpSettingsCases_1.MpSettingsCases.case1_1);
            chai_1.assert.equal(selector.hostQueue.length, 4);
            chai_1.assert.equal(selector.hostQueue[0], lobby.GetOrMakePlayer('p1'));
            chai_1.assert.equal(selector.hostQueue[1], lobby.GetOrMakePlayer('p2'));
            chai_1.assert.equal(selector.hostQueue[2], lobby.GetOrMakePlayer('p4'));
            chai_1.assert.equal(selector.hostQueue[3], lobby.GetOrMakePlayer('p5'));
            lobby.destroy();
        });
        it('transfer host to denied player test', async () => {
            const { selector, lobby, ircClient } = await prepareSelector();
            AutoHostSelector_1.DENY_LIST.addPlayer(lobby.GetOrMakePlayer('p4'));
            await ircClient.emulateMpSettings(MpSettingsCases_1.MpSettingsCases.case1_1);
            chai_1.assert.equal(selector.hostQueue.length, 4);
            TestUtils_1.default.assertHost('p1', lobby);
            await ircClient.emulateChangeHost('p4');
            TestUtils_1.default.assertHost('p2', lobby);
            await ircClient.emulateChangeHost('p4');
            TestUtils_1.default.assertHost('p3', lobby);
            await ircClient.emulateChangeHost('p4');
            TestUtils_1.default.assertHost('p5', lobby);
            await ircClient.emulateChangeHost('p1');
            TestUtils_1.default.assertHost('p1', lobby);
            lobby.destroy();
        });
        it('only denied player test', async () => {
            const { selector, lobby, ircClient } = await prepareSelector();
            AutoHostSelector_1.DENY_LIST.addPlayer(lobby.GetOrMakePlayer('p4'));
            AutoHostSelector_1.DENY_LIST.addPlayer(lobby.GetOrMakePlayer('p5'));
            await ircClient.emulateMpSettings(MpSettingsCases_1.MpSettingsCases.case1_1);
            chai_1.assert.equal(selector.hostQueue.length, 3);
            TestUtils_1.default.assertHost('p1', lobby);
            await ircClient.emulateRemovePlayerAsync('p1');
            TestUtils_1.default.assertHost('p2', lobby);
            await ircClient.emulateRemovePlayerAsync('p3');
            TestUtils_1.default.assertHost('p2', lobby);
            await ircClient.emulateRemovePlayerAsync('p2');
            chai_1.assert.equal(selector.hostQueue.length, 0);
            chai_1.assert.isNull(lobby.host);
            await ircClient.emulateRemovePlayerAsync('p4');
            chai_1.assert.equal(selector.hostQueue.length, 0);
            chai_1.assert.isNull(lobby.host);
            lobby.destroy();
        });
        it('only denied player -> join someone test', async () => {
            const { selector, lobby, ircClient } = await prepareSelector();
            AutoHostSelector_1.DENY_LIST.addPlayer(lobby.GetOrMakePlayer('p4'));
            AutoHostSelector_1.DENY_LIST.addPlayer(lobby.GetOrMakePlayer('p5'));
            await ircClient.emulateMpSettings(MpSettingsCases_1.MpSettingsCases.case1_1);
            chai_1.assert.equal(selector.hostQueue.length, 3);
            await ircClient.emulateRemovePlayerAsync('p1');
            await ircClient.emulateRemovePlayerAsync('p2');
            await ircClient.emulateRemovePlayerAsync('p3');
            chai_1.assert.equal(selector.hostQueue.length, 0);
            chai_1.assert.isNull(lobby.host);
            await ircClient.emulateAddPlayerAsync('p6');
            TestUtils_1.default.assertHost('p6', lobby);
            lobby.destroy();
        });
        it('skipto command test', async () => {
            const { selector, lobby, ircClient } = await prepareSelector();
            AutoHostSelector_1.DENY_LIST.addPlayer(lobby.GetOrMakePlayer('p4'));
            await ircClient.emulateMpSettings(MpSettingsCases_1.MpSettingsCases.case1_1);
            selector.SendPluginMessage('skipto', ['p3']);
            TestUtils_1.default.assertHost('p3', lobby);
            selector.SendPluginMessage('skipto', ['p4']);
            TestUtils_1.default.assertHost('p3', lobby);
            lobby.destroy();
        });
        it('add player to denylist test', async () => {
            const { selector, lobby, ircClient } = await prepareSelector();
            await ircClient.emulateMpSettings(MpSettingsCases_1.MpSettingsCases.case1_1);
            TestUtils_1.default.assertHost('p1', lobby);
            chai_1.assert.equal(selector.hostQueue.length, 5);
            AutoHostSelector_1.DENY_LIST.addPlayer(lobby.GetOrMakePlayer('p3'));
            chai_1.assert.equal(selector.hostQueue.length, 4);
            chai_1.assert.equal(selector.hostQueue[0], lobby.GetOrMakePlayer('p1'));
            chai_1.assert.equal(selector.hostQueue[1], lobby.GetOrMakePlayer('p2'));
            chai_1.assert.equal(selector.hostQueue[2], lobby.GetOrMakePlayer('p4'));
            chai_1.assert.equal(selector.hostQueue[3], lobby.GetOrMakePlayer('p5'));
            lobby.destroy();
        });
        it('add host to denylist test', async () => {
            const { selector, lobby, ircClient } = await prepareSelector();
            await ircClient.emulateMpSettings(MpSettingsCases_1.MpSettingsCases.case1_1);
            TestUtils_1.default.assertHost('p1', lobby);
            AutoHostSelector_1.DENY_LIST.addPlayer(lobby.GetOrMakePlayer('p1'));
            TestUtils_1.default.assertHost('p2', lobby);
            chai_1.assert.equal(selector.hostQueue[0], lobby.GetOrMakePlayer('p2'));
            chai_1.assert.equal(selector.hostQueue[1], lobby.GetOrMakePlayer('p3'));
            chai_1.assert.equal(selector.hostQueue[2], lobby.GetOrMakePlayer('p4'));
            chai_1.assert.equal(selector.hostQueue[3], lobby.GetOrMakePlayer('p5'));
            lobby.destroy();
        });
        it('add last player to denylist test', async () => {
            const { selector, lobby, ircClient } = await prepareSelector();
            await ircClient.emulateMpSettings(MpSettingsCases_1.MpSettingsCases.case1_1);
            TestUtils_1.default.assertHost('p1', lobby);
            chai_1.assert.equal(selector.hostQueue.length, 5);
            await ircClient.emulateRemovePlayerAsync('p1');
            await ircClient.emulateRemovePlayerAsync('p2');
            await ircClient.emulateRemovePlayerAsync('p3');
            TestUtils_1.default.assertHost('p4', lobby);
            AutoHostSelector_1.DENY_LIST.addPlayer(lobby.GetOrMakePlayer('p5'));
            TestUtils_1.default.assertHost('p4', lobby);
            AutoHostSelector_1.DENY_LIST.addPlayer(lobby.GetOrMakePlayer('p4'));
            chai_1.assert.equal(selector.hostQueue.length, 0);
            chai_1.assert.isNull(lobby.host);
            lobby.destroy();
        });
        it('remove player from denlylist test', async () => {
            const { selector, lobby, ircClient } = await prepareSelector();
            await ircClient.emulateMpSettings(MpSettingsCases_1.MpSettingsCases.case1_1);
            AutoHostSelector_1.DENY_LIST.addPlayer(lobby.GetOrMakePlayer('p3'));
            TestUtils_1.default.assertHost('p1', lobby);
            chai_1.assert.equal(selector.hostQueue.length, 4);
            AutoHostSelector_1.DENY_LIST.removePlayer(lobby.GetOrMakePlayer('p3'));
            chai_1.assert.equal(selector.hostQueue.length, 5);
            chai_1.assert.equal(selector.hostQueue[0], lobby.GetOrMakePlayer('p1'));
            chai_1.assert.equal(selector.hostQueue[1], lobby.GetOrMakePlayer('p2'));
            chai_1.assert.equal(selector.hostQueue[2], lobby.GetOrMakePlayer('p4'));
            chai_1.assert.equal(selector.hostQueue[3], lobby.GetOrMakePlayer('p5'));
            chai_1.assert.equal(selector.hostQueue[4], lobby.GetOrMakePlayer('p3'));
            lobby.destroy();
        });
        it('remove player from denlylist test - no one in queue', async () => {
            const { selector, lobby, ircClient } = await prepareSelector();
            await ircClient.emulateMpSettings(MpSettingsCases_1.MpSettingsCases.case1_1);
            AutoHostSelector_1.DENY_LIST.addPlayer(lobby.GetOrMakePlayer('p1'));
            AutoHostSelector_1.DENY_LIST.addPlayer(lobby.GetOrMakePlayer('p2'));
            AutoHostSelector_1.DENY_LIST.addPlayer(lobby.GetOrMakePlayer('p3'));
            AutoHostSelector_1.DENY_LIST.addPlayer(lobby.GetOrMakePlayer('p4'));
            AutoHostSelector_1.DENY_LIST.addPlayer(lobby.GetOrMakePlayer('p5'));
            chai_1.assert.equal(selector.hostQueue.length, 0);
            AutoHostSelector_1.DENY_LIST.removePlayer(lobby.GetOrMakePlayer('p3'));
            chai_1.assert.equal(selector.hostQueue.length, 1);
            chai_1.assert.equal(selector.hostQueue[0], lobby.GetOrMakePlayer('p3'));
            TestUtils_1.default.assertHost('p3', lobby);
            lobby.destroy();
        });
        it('slotbase reoder test1', async () => {
            const { selector, lobby, ircClient } = await prepareSelector();
            AutoHostSelector_1.DENY_LIST.addPlayer(lobby.GetOrMakePlayer('p3'));
            await ircClient.emulateMpSettings(MpSettingsCases_1.MpSettingsCases.case1_1);
            chai_1.assert.equal(selector.hostQueue.length, 4);
            chai_1.assert.equal(selector.hostQueue[0], lobby.GetOrMakePlayer('p1'));
            chai_1.assert.equal(selector.hostQueue[1], lobby.GetOrMakePlayer('p2'));
            chai_1.assert.equal(selector.hostQueue[2], lobby.GetOrMakePlayer('p4'));
            chai_1.assert.equal(selector.hostQueue[3], lobby.GetOrMakePlayer('p5'));
            lobby.destroy();
        });
        it('slotbase reoder test2', async () => {
            const { selector, lobby, ircClient } = await prepareSelector();
            AutoHostSelector_1.DENY_LIST.addPlayer(lobby.GetOrMakePlayer('p4'));
            await ircClient.emulateMpSettings(MpSettingsCases_1.MpSettingsCases.case1_2);
            chai_1.assert.equal(selector.hostQueue.length, 4);
            chai_1.assert.equal(selector.hostQueue[0], lobby.GetOrMakePlayer('p3'));
            chai_1.assert.equal(selector.hostQueue[1], lobby.GetOrMakePlayer('p5'));
            chai_1.assert.equal(selector.hostQueue[2], lobby.GetOrMakePlayer('p1'));
            chai_1.assert.equal(selector.hostQueue[3], lobby.GetOrMakePlayer('p2'));
            lobby.destroy();
        });
        it('slotbase reoder test - host is denied', async () => {
            const { selector, lobby, ircClient } = await prepareSelector();
            AutoHostSelector_1.DENY_LIST.addPlayer(lobby.GetOrMakePlayer('p3'));
            await ircClient.emulateMpSettings(MpSettingsCases_1.MpSettingsCases.case1_2);
            chai_1.assert.equal(selector.hostQueue.length, 4);
            chai_1.assert.equal(selector.hostQueue[0], lobby.GetOrMakePlayer('p1'));
            chai_1.assert.equal(selector.hostQueue[1], lobby.GetOrMakePlayer('p2'));
            chai_1.assert.equal(selector.hostQueue[2], lobby.GetOrMakePlayer('p4'));
            chai_1.assert.equal(selector.hostQueue[3], lobby.GetOrMakePlayer('p5'));
            lobby.destroy();
        });
        it('modify order test - stay', async () => {
            const { selector, lobby, ircClient } = await prepareSelector();
            AutoHostSelector_1.DENY_LIST.addPlayer(lobby.GetOrMakePlayer('p5'));
            await ircClient.emulateMpSettings(MpSettingsCases_1.MpSettingsCases.case1_1);
            await ircClient.emulateMpSettings(MpSettingsCases_1.MpSettingsCases.case1_3);
            chai_1.assert.equal(selector.hostQueue.length, 4);
            chai_1.assert.equal(selector.hostQueue[0], lobby.GetOrMakePlayer('p4'));
            chai_1.assert.equal(selector.hostQueue[1], lobby.GetOrMakePlayer('p6'));
            chai_1.assert.equal(selector.hostQueue[2], lobby.GetOrMakePlayer('p7'));
            chai_1.assert.equal(selector.hostQueue[3], lobby.GetOrMakePlayer('p2'));
            lobby.destroy();
        });
        it('modify order test - leave', async () => {
            const { selector, lobby, ircClient } = await prepareSelector();
            AutoHostSelector_1.DENY_LIST.addPlayer(lobby.GetOrMakePlayer('p1'));
            await ircClient.emulateMpSettings(MpSettingsCases_1.MpSettingsCases.case1_1);
            await ircClient.emulateMpSettings(MpSettingsCases_1.MpSettingsCases.case1_3);
            chai_1.assert.equal(selector.hostQueue.length, 5);
            chai_1.assert.equal(selector.hostQueue[0], lobby.GetOrMakePlayer('p4'));
            chai_1.assert.equal(selector.hostQueue[1], lobby.GetOrMakePlayer('p5'));
            chai_1.assert.equal(selector.hostQueue[2], lobby.GetOrMakePlayer('p6'));
            chai_1.assert.equal(selector.hostQueue[3], lobby.GetOrMakePlayer('p7'));
            chai_1.assert.equal(selector.hostQueue[4], lobby.GetOrMakePlayer('p2'));
            lobby.destroy();
        });
        it('modify order test - join', async () => {
            const { selector, lobby, ircClient } = await prepareSelector();
            AutoHostSelector_1.DENY_LIST.addPlayer(lobby.GetOrMakePlayer('p7'));
            await ircClient.emulateMpSettings(MpSettingsCases_1.MpSettingsCases.case1_1);
            await ircClient.emulateMpSettings(MpSettingsCases_1.MpSettingsCases.case1_3);
            chai_1.assert.equal(selector.hostQueue.length, 4);
            chai_1.assert.equal(selector.hostQueue[0], lobby.GetOrMakePlayer('p4'));
            chai_1.assert.equal(selector.hostQueue[1], lobby.GetOrMakePlayer('p5'));
            chai_1.assert.equal(selector.hostQueue[2], lobby.GetOrMakePlayer('p6'));
            chai_1.assert.equal(selector.hostQueue[3], lobby.GetOrMakePlayer('p2'));
            lobby.destroy();
        });
        describe('denylist command tests', () => {
            it('add test', async () => {
                const { selector, lobby, ircClient } = await prepareSelector();
                await ircClient.emulateMpSettings(MpSettingsCases_1.MpSettingsCases.case1_1);
                chai_1.assert.equal(AutoHostSelector_1.DENY_LIST.players.size, 0);
                TestUtils_1.default.sendMessageAsOwner(lobby, '*denylist add p1');
                chai_1.assert.equal(AutoHostSelector_1.DENY_LIST.players.size, 1);
                chai_1.assert.include(AutoHostSelector_1.DENY_LIST.players, 'p1');
                TestUtils_1.default.sendMessageAsOwner(lobby, '*denylist add p2 sfd');
                chai_1.assert.equal(AutoHostSelector_1.DENY_LIST.players.size, 2);
                chai_1.assert.include(AutoHostSelector_1.DENY_LIST.players, (0, Player_1.escapeUserName)('p2 sfd'));
                TestUtils_1.default.sendMessageAsOwner(lobby, '*denylist add');
                chai_1.assert.equal(AutoHostSelector_1.DENY_LIST.players.size, 2);
                const un = 'asdf    hello';
                TestUtils_1.default.sendMessageAsOwner(lobby, `*denylist     add    ${un}`);
                chai_1.assert.equal(AutoHostSelector_1.DENY_LIST.players.size, 3);
                chai_1.assert.include(AutoHostSelector_1.DENY_LIST.players, (0, Player_1.escapeUserName)(un));
                lobby.destroy();
            });
            it('add twice test', async () => {
                const { selector, lobby, ircClient } = await prepareSelector();
                await ircClient.emulateMpSettings(MpSettingsCases_1.MpSettingsCases.case1_1);
                chai_1.assert.equal(AutoHostSelector_1.DENY_LIST.players.size, 0);
                TestUtils_1.default.sendMessageAsOwner(lobby, '*denylist add p1');
                chai_1.assert.equal(AutoHostSelector_1.DENY_LIST.players.size, 1);
                chai_1.assert.include(AutoHostSelector_1.DENY_LIST.players, 'p1');
                TestUtils_1.default.sendMessageAsOwner(lobby, '*denylist add p1');
                chai_1.assert.equal(AutoHostSelector_1.DENY_LIST.players.size, 1);
                chai_1.assert.include(AutoHostSelector_1.DENY_LIST.players, 'p1');
                lobby.destroy();
            });
            it('remove test', async () => {
                const { selector, lobby, ircClient } = await prepareSelector();
                await ircClient.emulateMpSettings(MpSettingsCases_1.MpSettingsCases.case1_1);
                chai_1.assert.equal(AutoHostSelector_1.DENY_LIST.players.size, 0);
                TestUtils_1.default.sendMessageAsOwner(lobby, '*denylist add p1');
                TestUtils_1.default.sendMessageAsOwner(lobby, '*denylist add p2 piyo');
                TestUtils_1.default.sendMessageAsOwner(lobby, '*denylist add p3 HOGE');
                chai_1.assert.equal(AutoHostSelector_1.DENY_LIST.players.size, 3);
                chai_1.assert.include(AutoHostSelector_1.DENY_LIST.players, (0, Player_1.escapeUserName)('p1'));
                chai_1.assert.include(AutoHostSelector_1.DENY_LIST.players, (0, Player_1.escapeUserName)('p2 piyo'));
                chai_1.assert.include(AutoHostSelector_1.DENY_LIST.players, (0, Player_1.escapeUserName)('p3 HOGE'));
                TestUtils_1.default.sendMessageAsOwner(lobby, '*denylist remove p1');
                chai_1.assert.equal(AutoHostSelector_1.DENY_LIST.players.size, 2);
                chai_1.assert.notInclude(AutoHostSelector_1.DENY_LIST.players, (0, Player_1.escapeUserName)('p1'));
                chai_1.assert.include(AutoHostSelector_1.DENY_LIST.players, (0, Player_1.escapeUserName)('p2 piyo'));
                chai_1.assert.include(AutoHostSelector_1.DENY_LIST.players, (0, Player_1.escapeUserName)('p3 HOGE'));
                TestUtils_1.default.sendMessageAsOwner(lobby, '*denylist remove p2 piyo');
                chai_1.assert.equal(AutoHostSelector_1.DENY_LIST.players.size, 1);
                chai_1.assert.notInclude(AutoHostSelector_1.DENY_LIST.players, (0, Player_1.escapeUserName)('p1'));
                chai_1.assert.notInclude(AutoHostSelector_1.DENY_LIST.players, (0, Player_1.escapeUserName)('p2 piyo'));
                chai_1.assert.include(AutoHostSelector_1.DENY_LIST.players, (0, Player_1.escapeUserName)('p3 HOGE'));
                TestUtils_1.default.sendMessageAsOwner(lobby, '*denylist    remove     p3 hoge');
                chai_1.assert.equal(AutoHostSelector_1.DENY_LIST.players.size, 0);
                chai_1.assert.notInclude(AutoHostSelector_1.DENY_LIST.players, (0, Player_1.escapeUserName)('p1'));
                chai_1.assert.notInclude(AutoHostSelector_1.DENY_LIST.players, (0, Player_1.escapeUserName)('p2 piyo'));
                chai_1.assert.notInclude(AutoHostSelector_1.DENY_LIST.players, (0, Player_1.escapeUserName)('p3 HOGE'));
                lobby.destroy();
            });
            it('remove twice test', async () => {
                const { selector, lobby, ircClient } = await prepareSelector();
                await ircClient.emulateMpSettings(MpSettingsCases_1.MpSettingsCases.case1_1);
                chai_1.assert.equal(AutoHostSelector_1.DENY_LIST.players.size, 0);
                TestUtils_1.default.sendMessageAsOwner(lobby, '*denylist add p1');
                TestUtils_1.default.sendMessageAsOwner(lobby, '*denylist add p2');
                TestUtils_1.default.sendMessageAsOwner(lobby, '*denylist add p3');
                chai_1.assert.equal(AutoHostSelector_1.DENY_LIST.players.size, 3);
                chai_1.assert.include(AutoHostSelector_1.DENY_LIST.players, (0, Player_1.escapeUserName)('p1'));
                chai_1.assert.include(AutoHostSelector_1.DENY_LIST.players, (0, Player_1.escapeUserName)('p2'));
                chai_1.assert.include(AutoHostSelector_1.DENY_LIST.players, (0, Player_1.escapeUserName)('p3'));
                TestUtils_1.default.sendMessageAsOwner(lobby, '*denylist remove p1');
                TestUtils_1.default.sendMessageAsOwner(lobby, '*denylist remove p1');
                chai_1.assert.equal(AutoHostSelector_1.DENY_LIST.players.size, 2);
                chai_1.assert.notInclude(AutoHostSelector_1.DENY_LIST.players, (0, Player_1.escapeUserName)('p1'));
                chai_1.assert.include(AutoHostSelector_1.DENY_LIST.players, (0, Player_1.escapeUserName)('p2'));
                chai_1.assert.include(AutoHostSelector_1.DENY_LIST.players, (0, Player_1.escapeUserName)('p3'));
                lobby.destroy();
            });
        });
        it('multi lobby tests', async () => {
            const a = await prepareSelector();
            const b = await prepareSelector();
            await a.ircClient.emulateMpSettings(MpSettingsCases_1.MpSettingsCases.case1_1); // p1 p2 p3 p4 p5
            await b.ircClient.emulateMpSettings(MpSettingsCases_1.MpSettingsCases.case1_3); // p6 p2 p4 p5 p7
            chai_1.assert.equal(AutoHostSelector_1.DENY_LIST.players.size, 0);
            chai_1.assert.equal(a.selector.hostQueue.length, 5);
            chai_1.assert.equal(b.selector.hostQueue.length, 5);
            AutoHostSelector_1.DENY_LIST.addPlayer(a.lobby.GetOrMakePlayer('p1'));
            chai_1.assert.equal(AutoHostSelector_1.DENY_LIST.players.size, 1);
            chai_1.assert.equal(a.selector.hostQueue.length, 4);
            chai_1.assert.equal(b.selector.hostQueue.length, 5);
            AutoHostSelector_1.DENY_LIST.addPlayer(a.lobby.GetOrMakePlayer('p2'));
            chai_1.assert.equal(AutoHostSelector_1.DENY_LIST.players.size, 2);
            chai_1.assert.equal(a.selector.hostQueue.length, 3);
            chai_1.assert.equal(b.selector.hostQueue.length, 4);
            chai_1.assert.equal(a.selector.hostQueue[0], a.lobby.GetOrMakePlayer('p3'));
            chai_1.assert.equal(a.selector.hostQueue[1], a.lobby.GetOrMakePlayer('p4'));
            chai_1.assert.equal(a.selector.hostQueue[2], a.lobby.GetOrMakePlayer('p5'));
            chai_1.assert.equal(b.selector.hostQueue[0], b.lobby.GetOrMakePlayer('p4'));
            chai_1.assert.equal(b.selector.hostQueue[1], b.lobby.GetOrMakePlayer('p5'));
            chai_1.assert.equal(b.selector.hostQueue[2], b.lobby.GetOrMakePlayer('p7'));
            chai_1.assert.equal(b.selector.hostQueue[3], b.lobby.GetOrMakePlayer('p6'));
            a.lobby.destroy();
            b.lobby.destroy();
        });
    });
});
//# sourceMappingURL=AutoHostSelectorTest.js.map