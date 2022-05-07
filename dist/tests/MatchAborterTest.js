"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const chai_1 = require("chai");
const Player_1 = require("../Player");
const MatchAborter_1 = require("../plugins/MatchAborter");
const TestUtils_1 = __importDefault(require("./TestUtils"));
describe('Match Aboter Tests', function () {
    before(function () {
        TestUtils_1.default.configMochaAsSilent();
    });
    async function setupAsync(timerDelay = 10) {
        const li = await TestUtils_1.default.SetupLobbyAsync();
        const option = {
            vote_min: 2,
            vote_rate: 0.3,
            vote_msg_defer_ms: 10,
            auto_abort_delay_ms: timerDelay,
            auto_abort_rate: 0.5,
            auto_abort_do_abort: true,
        };
        const ma = new MatchAborter_1.MatchAborter(li.lobby, option);
        return { aborter: ma, ...li };
    }
    it('construction test', async () => {
        const { aborter, lobby, ircClient } = await setupAsync();
    });
    describe('vote tests', function () {
        it('vote required check', async () => {
            const { aborter, lobby, ircClient } = await setupAsync();
            const md = 3;
            let tm = ircClient.emulateMatchAsync(md);
            chai_1.assert.equal(aborter.voteRequired, 2);
            await tm;
            await TestUtils_1.default.AddPlayersAsync(1, ircClient);
            tm = ircClient.emulateMatchAsync(md);
            chai_1.assert.equal(aborter.voteRequired, 2);
            await tm;
            await TestUtils_1.default.AddPlayersAsync(1, ircClient);
            tm = ircClient.emulateMatchAsync(md);
            chai_1.assert.equal(aborter.voteRequired, 2);
            await tm;
            await TestUtils_1.default.AddPlayersAsync(1, ircClient);
            tm = ircClient.emulateMatchAsync(md);
            chai_1.assert.equal(aborter.voteRequired, 2); // player:3
            await tm;
            await TestUtils_1.default.AddPlayersAsync(1, ircClient);
            tm = ircClient.emulateMatchAsync(md);
            chai_1.assert.equal(aborter.voteRequired, 2);
            await tm;
            await TestUtils_1.default.AddPlayersAsync(1, ircClient);
            tm = ircClient.emulateMatchAsync(md);
            chai_1.assert.equal(aborter.voteRequired, 2); // player:5
            await tm;
            await TestUtils_1.default.AddPlayersAsync(1, ircClient);
            tm = ircClient.emulateMatchAsync(md);
            chai_1.assert.equal(aborter.voteRequired, 2);
            await tm;
            await TestUtils_1.default.AddPlayersAsync(1, ircClient);
            tm = ircClient.emulateMatchAsync(md);
            chai_1.assert.equal(aborter.voteRequired, 3); // player:7
            await tm;
            await TestUtils_1.default.AddPlayersAsync(1, ircClient);
            tm = ircClient.emulateMatchAsync(md);
            chai_1.assert.equal(aborter.voteRequired, 3);
        });
        it('host aborts the match', async () => {
            const { aborter, lobby, ircClient } = await setupAsync(50);
            const players = await TestUtils_1.default.AddPlayersAsync(5, ircClient);
            await TestUtils_1.default.changeHostAsync(players[0], lobby);
            ircClient.emulateMatchAsync(50);
            const et = TestUtils_1.default.assertEventFire(lobby.AbortedMatch, null, 10);
            await ircClient.emulateMessageAsync(players[0], ircClient.channel, '!abort');
            await et;
        });
        it('players abort the match', async () => {
            const { aborter, lobby, ircClient } = await setupAsync(1000);
            const players = await TestUtils_1.default.AddPlayersAsync(5, ircClient);
            await TestUtils_1.default.changeHostAsync(players[0], lobby);
            ircClient.emulateMatchAsync(100);
            const et = TestUtils_1.default.assertEventFire(lobby.AbortedMatch, null, 100);
            await ircClient.emulateMessageAsync(players[1], ircClient.channel, '!abort');
            chai_1.assert.equal(aborter.voting.count, 1);
            await ircClient.emulateMessageAsync(players[2], ircClient.channel, '!abort');
            chai_1.assert.equal(aborter.voting.count, 2);
            await et;
        });
        it('the match won\'t be aborted if there are not enough votes', async () => {
            const { aborter, lobby, ircClient } = await setupAsync(50);
            const players = await TestUtils_1.default.AddPlayersAsync(5, ircClient);
            await TestUtils_1.default.changeHostAsync(players[0], lobby);
            ircClient.emulateMatchAsync(10);
            const et = TestUtils_1.default.assertEventNeverFire(lobby.AbortedMatch, null, 10);
            await ircClient.emulateMessageAsync(players[1], ircClient.channel, '!abort');
            chai_1.assert.equal(aborter.voting.count, 1);
            await et;
        });
        it('double vote', async () => {
            const { aborter, lobby, ircClient } = await setupAsync(50);
            const players = await TestUtils_1.default.AddPlayersAsync(5, ircClient);
            await TestUtils_1.default.changeHostAsync(players[0], lobby);
            ircClient.emulateMatchAsync(10);
            const et = TestUtils_1.default.assertEventNeverFire(lobby.AbortedMatch, null, 10);
            await ircClient.emulateMessageAsync(players[1], ircClient.channel, '!abort');
            chai_1.assert.equal(aborter.voting.count, 1);
            await ircClient.emulateMessageAsync(players[1], ircClient.channel, '!abort');
            chai_1.assert.equal(aborter.voting.count, 1);
            await ircClient.emulateMessageAsync(players[1], ircClient.channel, '!abort');
            chai_1.assert.equal(aborter.voting.count, 1);
            await et;
        });
        it('authorized user aborts the match', async () => {
            const { aborter, lobby, ircClient } = await setupAsync(50);
            const players = await TestUtils_1.default.AddPlayersAsync(5, ircClient);
            lobby.GetOrMakePlayer(players[1]).setRole(Player_1.Roles.Authorized);
            await TestUtils_1.default.changeHostAsync(players[0], lobby);
            ircClient.emulateMatchAsync(10);
            const et = TestUtils_1.default.assertEventFire(lobby.AbortedMatch, null, 10);
            await ircClient.emulateMessageAsync(players[1], ircClient.channel, '*abort');
            await et;
        });
        it('player leaving causes abort', async () => {
            const { aborter, lobby, ircClient } = await setupAsync(100);
            const players = await TestUtils_1.default.AddPlayersAsync(7, ircClient);
            await TestUtils_1.default.changeHostAsync(players[0], lobby);
            ircClient.emulateMatchAsync(100);
            const et = TestUtils_1.default.assertEventFire(lobby.AbortedMatch, null, 100);
            chai_1.assert.equal(aborter.voteRequired, 3);
            await ircClient.emulateMessageAsync(players[1], ircClient.channel, '!abort');
            chai_1.assert.equal(aborter.voting.count, 1);
            await ircClient.emulateMessageAsync(players[2], ircClient.channel, '!abort');
            chai_1.assert.equal(aborter.voting.count, 2);
            await ircClient.emulateRemovePlayerAsync(players[3]);
            await et;
        });
        it('player joining during the match has no effect', async () => {
            const { aborter, lobby, ircClient } = await setupAsync(100);
            const players = await TestUtils_1.default.AddPlayersAsync(6, ircClient);
            await TestUtils_1.default.changeHostAsync(players[0], lobby);
            ircClient.emulateMatchAsync(100);
            const et = TestUtils_1.default.assertEventFire(lobby.AbortedMatch, null, 100);
            chai_1.assert.equal(aborter.voteRequired, 2);
            chai_1.assert.equal(lobby.playersInGame, 6);
            await ircClient.emulateMessageAsync(players[1], ircClient.channel, '!abort');
            chai_1.assert.equal(aborter.voting.count, 1);
            await ircClient.emulateAddPlayerAsync('tom');
            chai_1.assert.equal(lobby.playersInGame, 6);
            chai_1.assert.equal(aborter.voteRequired, 2);
            await ircClient.emulateMessageAsync(players[2], ircClient.channel, '!abort');
            chai_1.assert.equal(aborter.voting.count, 2);
            await et;
        });
    });
    describe('auto abort tests', function () {
        it('auto abort test', async () => {
            const { aborter, lobby, ircClient } = await setupAsync(10);
            const players = await TestUtils_1.default.AddPlayersAsync(5, ircClient);
            await TestUtils_1.default.changeHostAsync(players[0], lobby);
            ircClient.emulateMatchAsync(100);
            const et = TestUtils_1.default.assertEventFire(lobby.AbortedMatch, null, 100);
            await ircClient.emulatePlayerFinishAsync(players[0]);
            await ircClient.emulatePlayerFinishAsync(players[1]);
            await ircClient.emulatePlayerFinishAsync(players[2]);
            chai_1.assert.isNotNull(aborter.abortTimer);
            await et;
        });
        it('dosen\'t abort the match if the match finished nomarlly', async () => {
            const { aborter, lobby, ircClient } = await setupAsync(10);
            const players = await TestUtils_1.default.AddPlayersAsync(5, ircClient);
            await TestUtils_1.default.changeHostAsync(players[0], lobby);
            const em1 = ircClient.emulateMatchAsync(10);
            TestUtils_1.default.assertEventNeverFire(lobby.AbortedMatch, null, 10);
            await em1;
            await TestUtils_1.default.changeHostAsync(players[1], lobby);
            await ircClient.emulateChangeMapAsync(0);
            const em2 = ircClient.emulateMatchAsync(10);
            TestUtils_1.default.assertEventNeverFire(lobby.AbortedMatch, null, 10);
            await em2;
        });
        it('player leaving causes abort', async () => {
            const { aborter, lobby, ircClient } = await setupAsync(10);
            const players = await TestUtils_1.default.AddPlayersAsync(5, ircClient);
            await TestUtils_1.default.changeHostAsync(players[0], lobby);
            ircClient.emulateMatchAsync(100);
            chai_1.assert.equal(aborter.autoAbortRequired, 3);
            const et = TestUtils_1.default.assertEventFire(lobby.AbortedMatch, null, 100);
            await ircClient.emulatePlayerFinishAsync(players[0]);
            await ircClient.emulatePlayerFinishAsync(players[1]);
            chai_1.assert.isNull(aborter.abortTimer);
            await ircClient.emulateRemovePlayerAsync(players[2]);
            chai_1.assert.equal(aborter.autoAbortRequired, 2);
            chai_1.assert.isNotNull(aborter.abortTimer);
            await et;
        });
        it('player joining during the match has no effect', async () => {
            const { aborter, lobby, ircClient } = await setupAsync(10);
            const players = await TestUtils_1.default.AddPlayersAsync(6, ircClient);
            await TestUtils_1.default.changeHostAsync(players[0], lobby);
            ircClient.emulateMatchAsync(100);
            chai_1.assert.equal(aborter.autoAbortRequired, 3);
            await ircClient.emulateAddPlayerAsync('tom');
            chai_1.assert.equal(aborter.autoAbortRequired, 3);
            const et = TestUtils_1.default.assertEventFire(lobby.AbortedMatch, null, 100);
            await ircClient.emulatePlayerFinishAsync(players[0]);
            await ircClient.emulatePlayerFinishAsync(players[1]);
            await ircClient.emulatePlayerFinishAsync(players[2]);
            chai_1.assert.isNotNull(aborter.abortTimer);
            await et;
        });
    });
});
//# sourceMappingURL=MatchAborterTest.js.map