import { assert } from 'chai';
import { Lobby } from '../Lobby';
import { Roles } from '../Player';
import { DummyIrcClient } from '../dummies/DummyIrcClient';
import { MatchAborter, MatchAborterOption } from '../plugins/MatchAborter';
import tu from './TestUtils';

describe('Match Aboter Tests', function () {
  before(function () {
    tu.configMochaAsSilent();
  });

  async function setupAsync(timerDelay: number = 10):
    Promise<{ aborter: MatchAborter, lobby: Lobby, ircClient: DummyIrcClient }> {
    const li = await tu.SetupLobbyAsync();
    const option: MatchAborterOption = {
      vote_min: 2,
      vote_rate: 0.3,
      vote_msg_defer_ms: 10,
      auto_abort_delay_ms: timerDelay,
      auto_abort_rate: 0.5,
      auto_abort_do_abort: true,
    };
    const ma = new MatchAborter(li.lobby, option);
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
      assert.equal(aborter.voteRequired, 2);
      await tm;
      await tu.AddPlayersAsync(1, ircClient);
      tm = ircClient.emulateMatchAsync(md);
      assert.equal(aborter.voteRequired, 2);
      await tm;
      await tu.AddPlayersAsync(1, ircClient);
      tm = ircClient.emulateMatchAsync(md);
      assert.equal(aborter.voteRequired, 2);
      await tm;
      await tu.AddPlayersAsync(1, ircClient);
      tm = ircClient.emulateMatchAsync(md);
      assert.equal(aborter.voteRequired, 2); // player:3
      await tm;
      await tu.AddPlayersAsync(1, ircClient);
      tm = ircClient.emulateMatchAsync(md);
      assert.equal(aborter.voteRequired, 2);
      await tm;
      await tu.AddPlayersAsync(1, ircClient);
      tm = ircClient.emulateMatchAsync(md);
      assert.equal(aborter.voteRequired, 2); // player:5
      await tm;
      await tu.AddPlayersAsync(1, ircClient);
      tm = ircClient.emulateMatchAsync(md);
      assert.equal(aborter.voteRequired, 2);
      await tm;
      await tu.AddPlayersAsync(1, ircClient);
      tm = ircClient.emulateMatchAsync(md);
      assert.equal(aborter.voteRequired, 3); // player:7
      await tm;
      await tu.AddPlayersAsync(1, ircClient);
      tm = ircClient.emulateMatchAsync(md);
      assert.equal(aborter.voteRequired, 3);
    });
    it('host aborts the match', async () => {
      const { aborter, lobby, ircClient } = await setupAsync(50);
      const players = await tu.AddPlayersAsync(5, ircClient);
      await tu.changeHostAsync(players[0], lobby);
      ircClient.emulateMatchAsync(50);
      const et = tu.assertEventFire(lobby.AbortedMatch, null, 10);
      await ircClient.emulateMessageAsync(players[0], ircClient.channel, '!abort');
      await et;
    });
    it('players abort the match', async () => {
      const { aborter, lobby, ircClient } = await setupAsync(1000);
      const players = await tu.AddPlayersAsync(5, ircClient);
      await tu.changeHostAsync(players[0], lobby);
      ircClient.emulateMatchAsync(100);
      const et = tu.assertEventFire(lobby.AbortedMatch, null, 100);
      await ircClient.emulateMessageAsync(players[1], ircClient.channel, '!abort');
      assert.equal(aborter.voting.count, 1);
      await ircClient.emulateMessageAsync(players[2], ircClient.channel, '!abort');
      assert.equal(aborter.voting.count, 2);
      await et;
    });
    it('the match won\'t be aborted if there are not enough votes', async () => {
      const { aborter, lobby, ircClient } = await setupAsync(50);
      const players = await tu.AddPlayersAsync(5, ircClient);
      await tu.changeHostAsync(players[0], lobby);
      ircClient.emulateMatchAsync(10);
      const et = tu.assertEventNeverFire(lobby.AbortedMatch, null, 10);
      await ircClient.emulateMessageAsync(players[1], ircClient.channel, '!abort');
      assert.equal(aborter.voting.count, 1);
      await et;
    });
    it('double vote', async () => {
      const { aborter, lobby, ircClient } = await setupAsync(50);
      const players = await tu.AddPlayersAsync(5, ircClient);
      await tu.changeHostAsync(players[0], lobby);
      ircClient.emulateMatchAsync(10);
      const et = tu.assertEventNeverFire(lobby.AbortedMatch, null, 10);
      await ircClient.emulateMessageAsync(players[1], ircClient.channel, '!abort');
      assert.equal(aborter.voting.count, 1);
      await ircClient.emulateMessageAsync(players[1], ircClient.channel, '!abort');
      assert.equal(aborter.voting.count, 1);
      await ircClient.emulateMessageAsync(players[1], ircClient.channel, '!abort');
      assert.equal(aborter.voting.count, 1);
      await et;
    });
    it('authorized user aborts the match', async () => {
      const { aborter, lobby, ircClient } = await setupAsync(50);
      const players = await tu.AddPlayersAsync(5, ircClient);
      lobby.GetOrMakePlayer(players[1]).setRole(Roles.Authorized);
      await tu.changeHostAsync(players[0], lobby);
      ircClient.emulateMatchAsync(10);
      const et = tu.assertEventFire(lobby.AbortedMatch, null, 10);
      await ircClient.emulateMessageAsync(players[1], ircClient.channel, '*abort');
      await et;
    });
    it('player leaving causes abort', async () => {
      const { aborter, lobby, ircClient } = await setupAsync(100);
      const players = await tu.AddPlayersAsync(7, ircClient);
      await tu.changeHostAsync(players[0], lobby);
      ircClient.emulateMatchAsync(100);
      const et = tu.assertEventFire(lobby.AbortedMatch, null, 100);
      assert.equal(aborter.voteRequired, 3);
      await ircClient.emulateMessageAsync(players[1], ircClient.channel, '!abort');
      assert.equal(aborter.voting.count, 1);
      await ircClient.emulateMessageAsync(players[2], ircClient.channel, '!abort');
      assert.equal(aborter.voting.count, 2);
      await ircClient.emulateRemovePlayerAsync(players[3]);
      await et;
    });
    it('player joining during the match has no effect', async () => {
      const { aborter, lobby, ircClient } = await setupAsync(100);
      const players = await tu.AddPlayersAsync(6, ircClient);
      await tu.changeHostAsync(players[0], lobby);
      ircClient.emulateMatchAsync(100);
      const et = tu.assertEventFire(lobby.AbortedMatch, null, 100);
      assert.equal(aborter.voteRequired, 2);
      assert.equal(lobby.playersInGame, 6);
      await ircClient.emulateMessageAsync(players[1], ircClient.channel, '!abort');
      assert.equal(aborter.voting.count, 1);

      await ircClient.emulateAddPlayerAsync('tom');
      assert.equal(lobby.playersInGame, 6);
      assert.equal(aborter.voteRequired, 2);

      await ircClient.emulateMessageAsync(players[2], ircClient.channel, '!abort');
      assert.equal(aborter.voting.count, 2);
      await et;
    });
  });

  describe('auto abort tests', function () {
    it('auto abort test', async () => {
      const { aborter, lobby, ircClient } = await setupAsync(10);
      const players = await tu.AddPlayersAsync(5, ircClient);
      await tu.changeHostAsync(players[0], lobby);
      ircClient.emulateMatchAsync(100);
      const et = tu.assertEventFire(lobby.AbortedMatch, null, 100);
      await ircClient.emulatePlayerFinishAsync(players[0]);
      await ircClient.emulatePlayerFinishAsync(players[1]);
      await ircClient.emulatePlayerFinishAsync(players[2]);
      assert.isNotNull(aborter.abortTimer);
      await et;
    });
    it('dosen\'t abort the match if the match finished nomarlly', async () => {
      const { aborter, lobby, ircClient } = await setupAsync(10);
      const players = await tu.AddPlayersAsync(5, ircClient);
      await tu.changeHostAsync(players[0], lobby);
      const em1 = ircClient.emulateMatchAsync(10);
      tu.assertEventNeverFire(lobby.AbortedMatch, null, 10);
      await em1;

      await tu.changeHostAsync(players[1], lobby);
      await ircClient.emulateChangeMapAsync(0);
      const em2 = ircClient.emulateMatchAsync(10);
      tu.assertEventNeverFire(lobby.AbortedMatch, null, 10);
      await em2;
    });
    it('player leaving causes abort', async () => {
      const { aborter, lobby, ircClient } = await setupAsync(10);
      const players = await tu.AddPlayersAsync(5, ircClient);
      await tu.changeHostAsync(players[0], lobby);
      ircClient.emulateMatchAsync(100);
      assert.equal(aborter.autoAbortRequired, 3);
      const et = tu.assertEventFire(lobby.AbortedMatch, null, 100);
      await ircClient.emulatePlayerFinishAsync(players[0]);
      await ircClient.emulatePlayerFinishAsync(players[1]);
      assert.isNull(aborter.abortTimer);

      await ircClient.emulateRemovePlayerAsync(players[2]);
      assert.equal(aborter.autoAbortRequired, 2);
      assert.isNotNull(aborter.abortTimer);
      await et;
    });
    it('player joining during the match has no effect', async () => {
      const { aborter, lobby, ircClient } = await setupAsync(10);
      const players = await tu.AddPlayersAsync(6, ircClient);
      await tu.changeHostAsync(players[0], lobby);
      ircClient.emulateMatchAsync(100);
      assert.equal(aborter.autoAbortRequired, 3);
      await ircClient.emulateAddPlayerAsync('tom');
      assert.equal(aborter.autoAbortRequired, 3);
      const et = tu.assertEventFire(lobby.AbortedMatch, null, 100);
      await ircClient.emulatePlayerFinishAsync(players[0]);
      await ircClient.emulatePlayerFinishAsync(players[1]);
      await ircClient.emulatePlayerFinishAsync(players[2]);
      assert.isNotNull(aborter.abortTimer);
      await et;
    });
  });
});
