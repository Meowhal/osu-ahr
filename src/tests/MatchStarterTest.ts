import { assert } from 'chai';
import { Lobby } from '../Lobby';
import { Roles } from '../Player';
import { DummyIrcClient } from '../dummies/DummyIrcClient';
import { BanchoResponseType } from '../parsers/CommandParser';
import { MatchStarter, MatchStarterOption } from '../plugins/MatchStarter';
import tu from './TestUtils';
describe('MatchStarterTest', function () {
  before(function () {
    tu.configMochaAsSilent();
  });

  async function setupAsync(rate: number = 0.75, min: number = 2):
    Promise<{ starter: MatchStarter, lobby: Lobby, ircClient: DummyIrcClient }> {
    const li = await tu.SetupLobbyAsync(false);
    const option: MatchStarterOption = {
      vote_min: min,
      vote_rate: rate,
      vote_msg_defer_ms: 0,
      start_when_all_player_ready: true
    };
    const starter = new MatchStarter(li.lobby, option);
    return { starter, ...li };
  }

  async function assertSendMpStart(lobby: Lobby): Promise<number> {
    return tu.assertEventFire(lobby.SentMessage, ({ message }) => {
      return message.startsWith('!mp start');
    });
  }

  function assertBeginTimer(lobby: Lobby, time: number) {
    return tu.assertEventFire(lobby.ReceivedBanchoResponse, a => {
      if (a.response.type === BanchoResponseType.CounteddownTimer) {
        assert.equal(a.response.params[0], time);
        return true;
      }
      return false;
    });
  }

  function assertNeverBeginTimer(lobby: Lobby, timeout: number) {
    return tu.assertEventNeverFire(lobby.ReceivedBanchoResponse, a => {
      if (a.response.type === BanchoResponseType.CounteddownTimer) {
        return true;
      }
      return false;
    }, timeout);
  }

  it('all player ready test', async () => {
    const { starter, lobby, ircClient } = await setupAsync();
    await tu.AddPlayersAsync(5, ircClient);
    assert.isFalse(lobby.isMatching);
    const t = assertSendMpStart(lobby);
    await ircClient.emulateReadyAsync();
    await t;
  });

  describe('vote tests', function () {
    it('required votes test', async () => {
      const { starter, lobby, ircClient } = await setupAsync();
      for (let i = 1; i <= 16; i++) {
        const ex = Math.max(Math.ceil(i * starter.option.vote_rate), starter.option.vote_min);
        await tu.AddPlayersAsync(1, ircClient);
        assert.equal(starter.voting.required, ex, `players:${i}`);
      }
    });
    it('vote test', async () => {
      const { starter, lobby, ircClient } = await setupAsync();
      const players = await tu.AddPlayersAsync(5, ircClient);
      await tu.changeHostAsync(players[0], lobby);
      assert.equal(starter.voting.required, 4);
      assert.isFalse(lobby.isMatching);
      assert.isFalse(starter.voting.passed);
      assert.equal(starter.voting.count, 0);
      await ircClient.emulateMessageAsync(players[1], ircClient.channel, '!start');
      assert.isFalse(lobby.isMatching);
      assert.isFalse(starter.voting.passed);
      assert.equal(starter.voting.count, 1);
      await ircClient.emulateMessageAsync(players[2], ircClient.channel, '!start');
      assert.isFalse(lobby.isMatching);
      assert.isFalse(starter.voting.passed);
      assert.equal(starter.voting.count, 2);
      await ircClient.emulateMessageAsync(players[3], ircClient.channel, '!start');
      assert.isFalse(lobby.isMatching);
      assert.isFalse(starter.voting.passed);
      assert.equal(starter.voting.count, 3);
      await ircClient.emulateMessageAsync(players[4], ircClient.channel, '!start');
      assert.isTrue(lobby.isMatching);
      assert.equal(starter.voting.count, 0);
    });
    it('sould ignore when player vote twice', async () => {
      const { starter, lobby, ircClient } = await setupAsync();
      const players = await tu.AddPlayersAsync(5, ircClient);
      await tu.changeHostAsync(players[0], lobby);
      assert.equal(starter.voting.required, 4);
      assert.isFalse(lobby.isMatching);
      assert.isFalse(starter.voting.passed);
      assert.equal(starter.voting.count, 0);
      await ircClient.emulateMessageAsync(players[1], ircClient.channel, '!start');
      assert.isFalse(lobby.isMatching);
      assert.isFalse(starter.voting.passed);
      assert.equal(starter.voting.count, 1);
      await ircClient.emulateMessageAsync(players[1], ircClient.channel, '!start');
      assert.isFalse(lobby.isMatching);
      assert.isFalse(starter.voting.passed);
      assert.equal(starter.voting.count, 1);
    });
    it('shold reset when host changed', async () => {
      const { starter, lobby, ircClient } = await setupAsync();
      const players = await tu.AddPlayersAsync(5, ircClient);
      await tu.changeHostAsync(players[0], lobby);
      await ircClient.emulateMessageAsync(players[1], ircClient.channel, '!start');
      await ircClient.emulateMessageAsync(players[2], ircClient.channel, '!start');
      await ircClient.emulateMessageAsync(players[3], ircClient.channel, '!start');
      assert.isFalse(lobby.isMatching);
      assert.isFalse(starter.voting.passed);
      assert.equal(starter.voting.count, 3);
      await tu.changeHostAsync(players[1], lobby);
      assert.isFalse(lobby.isMatching);
      assert.isFalse(starter.voting.passed);
      assert.equal(starter.voting.count, 0);
      await ircClient.emulateMessageAsync(players[0], ircClient.channel, '!start');
      assert.isFalse(lobby.isMatching);
      assert.isFalse(starter.voting.passed);
      assert.equal(starter.voting.count, 1);

      // host vote
      await ircClient.emulateMessageAsync(players[1], ircClient.channel, '!start');
      assert.isTrue(lobby.isMatching);
    });
    it('shold ignore vote when matching', async () => {
      const { starter, lobby, ircClient } = await setupAsync();
      const players = await tu.AddPlayersAsync(5, ircClient);
      await tu.changeHostAsync(players[0], lobby);
      const t = ircClient.emulateMatchAsync(10);
      await tu.delayAsync(1);

      assert.isTrue(lobby.isMatching);
      assert.isFalse(starter.voting.passed);
      assert.equal(starter.voting.count, 0);
      for (const p of players) {
        await ircClient.emulateMessageAsync(p, ircClient.channel, '!start');
        assert.isTrue(lobby.isMatching);
        assert.isFalse(starter.voting.passed);
        assert.equal(starter.voting.count, 0);
      }
      return t;
    });
  });
  describe('host and auth command tests', function () {
    it('host !start test', async () => {
      const { starter, lobby, ircClient } = await setupAsync();
      const players = await tu.AddPlayersAsync(5, ircClient);
      await tu.changeHostAsync(players[0], lobby);
      assert.isFalse(lobby.isMatching);
      await ircClient.emulateMessageAsync(players[0], ircClient.channel, '!start');
      assert.isTrue(lobby.isMatching);
    });
    it('host !mp start test', async () => {
      const { starter, lobby, ircClient } = await setupAsync();
      const players = await tu.AddPlayersAsync(5, ircClient);
      await tu.changeHostAsync(players[0], lobby);
      assert.isFalse(lobby.isMatching);
      await ircClient.emulateMessageAsync(players[0], ircClient.channel, '!mp start');
      assert.isTrue(lobby.isMatching);
    });
    it('auth *start test', async () => {
      const { starter, lobby, ircClient } = await setupAsync();
      const players = await tu.AddPlayersAsync(5, ircClient);
      lobby.GetOrMakePlayer(players[0]).setRole(Roles.Authorized);
      await tu.changeHostAsync(players[1], lobby);
      assert.isFalse(lobby.isMatching);
      await ircClient.emulateMessageAsync(players[0], ircClient.channel, '*start');
      assert.isTrue(lobby.isMatching);
    });
    it('player *start test', async () => {
      const { starter, lobby, ircClient } = await setupAsync();
      const players = await tu.AddPlayersAsync(5, ircClient);
      await tu.changeHostAsync(players[1], lobby);
      assert.isFalse(lobby.isMatching);
      await ircClient.emulateMessageAsync(players[0], ircClient.channel, '*start');
      assert.isFalse(lobby.isMatching);
    });
  });
  describe('start timer tests', function () {
    it('!start timer test', async () => {
      const { starter, lobby, ircClient } = await setupAsync();
      const players = await tu.AddPlayersAsync(5, ircClient);
      await tu.changeHostAsync(players[0], lobby);
      assert.isFalse(lobby.isMatching);
      assert.isFalse(lobby.isStartTimerActive);
      assert.isFalse(starter.IsSelfStartTimerActive);
      await ircClient.emulateMessageAsync(players[0], ircClient.channel, '!start 30');
      assert.isFalse(lobby.isMatching);
      assert.isFalse(lobby.isStartTimerActive);
      assert.isTrue(starter.IsSelfStartTimerActive);
    });
    it('!start timer 0 test', async () => {
      const { starter, lobby, ircClient } = await setupAsync();
      const players = await tu.AddPlayersAsync(5, ircClient);
      await tu.changeHostAsync(players[0], lobby);
      assert.isFalse(lobby.isMatching);
      assert.isFalse(lobby.isStartTimerActive);
      assert.isFalse(starter.IsSelfStartTimerActive);
      await ircClient.emulateMessageAsync(players[0], ircClient.channel, '!start 0');
      assert.isTrue(lobby.isMatching);
      assert.isFalse(lobby.isStartTimerActive);
      assert.isFalse(starter.IsSelfStartTimerActive);
    });
    it('!start timer with negative | NaN test', async () => {
      const { starter, lobby, ircClient } = await setupAsync();
      const players = await tu.AddPlayersAsync(5, ircClient);
      await tu.changeHostAsync(players[0], lobby);
      assert.isFalse(lobby.isMatching);
      const t = assertNeverBeginTimer(lobby, 10);
      await ircClient.emulateMessageAsync(players[0], ircClient.channel, '!start -100');
      assert.isFalse(lobby.isMatching);
      await ircClient.emulateMessageAsync(players[0], ircClient.channel, '!start -454212');
      assert.isFalse(lobby.isMatching);
      await ircClient.emulateMessageAsync(players[0], ircClient.channel, '!start -');
      assert.isFalse(lobby.isMatching);
      await ircClient.emulateMessageAsync(players[0], ircClient.channel, '!start -0');
      assert.isFalse(lobby.isMatching);
      await ircClient.emulateMessageAsync(players[0], ircClient.channel, '!start aaa');
      assert.isFalse(lobby.isMatching);
      await ircClient.emulateMessageAsync(players[0], ircClient.channel, '!start 10 aaa');
      assert.isFalse(lobby.isMatching);
      await ircClient.emulateMessageAsync(players[0], ircClient.channel, '!start aaa sdfa');
      assert.isFalse(lobby.isMatching);
      await ircClient.emulateMessageAsync(players[0], ircClient.channel, '!start *231sd');
      assert.isFalse(lobby.isMatching);
      assert.isFalse(lobby.isStartTimerActive);
      assert.isFalse(starter.IsSelfStartTimerActive);
    });
    it('!start timer from player test', async () => {
      const { starter, lobby, ircClient } = await setupAsync();
      const players = await tu.AddPlayersAsync(5, ircClient);
      await tu.changeHostAsync(players[0], lobby);
      assert.isFalse(lobby.isMatching);
      await ircClient.emulateMessageAsync(players[1], ircClient.channel, '!start 100');
      assert.isFalse(lobby.isMatching);
      assert.isFalse(lobby.isStartTimerActive);
      assert.isFalse(starter.IsSelfStartTimerActive);
    });
    it('!start timer from auth player test', async () => {
      const { starter, lobby, ircClient } = await setupAsync();
      const players = await tu.AddPlayersAsync(5, ircClient);
      lobby.GetOrMakePlayer(players[0]).setRole(Roles.Authorized);
      await tu.changeHostAsync(players[1], lobby);
      assert.isFalse(lobby.isMatching);
      assert.isFalse(lobby.isStartTimerActive);
      assert.isFalse(starter.IsSelfStartTimerActive);
      await ircClient.emulateMessageAsync(players[0], ircClient.channel, '!start 30');
      assert.isFalse(lobby.isMatching);
      assert.isFalse(lobby.isStartTimerActive);
      assert.isTrue(starter.IsSelfStartTimerActive);
    });
    it('!stop test', async () => {
      const { starter, lobby, ircClient } = await setupAsync();
      const players = await tu.AddPlayersAsync(5, ircClient);
      await tu.changeHostAsync(players[0], lobby);
      assert.isFalse(lobby.isMatching);
      assert.isFalse(lobby.isStartTimerActive);
      assert.isFalse(starter.IsSelfStartTimerActive);
      await ircClient.emulateMessageAsync(players[0], ircClient.channel, '!start 30');
      assert.isFalse(lobby.isMatching);
      assert.isFalse(lobby.isStartTimerActive);
      assert.isTrue(starter.IsSelfStartTimerActive);
      await ircClient.emulateMessageAsync(players[0], ircClient.channel, '!stop');
      assert.isFalse(lobby.isMatching);
      assert.isFalse(lobby.isStartTimerActive);
      assert.isFalse(starter.IsSelfStartTimerActive);
    });
    it('!stop from player test', async () => {
      const { starter, lobby, ircClient } = await setupAsync();
      const players = await tu.AddPlayersAsync(5, ircClient);
      await tu.changeHostAsync(players[0], lobby);
      assert.isFalse(lobby.isMatching);
      assert.isFalse(lobby.isStartTimerActive);
      assert.isFalse(starter.IsSelfStartTimerActive);
      await ircClient.emulateMessageAsync(players[0], ircClient.channel, '!start 30');
      assert.isFalse(lobby.isMatching);
      assert.isFalse(lobby.isStartTimerActive);
      assert.isTrue(starter.IsSelfStartTimerActive);
      await ircClient.emulateMessageAsync(players[1], ircClient.channel, '!stop');
      assert.isFalse(lobby.isMatching);
      assert.isFalse(lobby.isStartTimerActive);
      assert.isTrue(starter.IsSelfStartTimerActive);
    });
  });

  it('with help test', async () => {
    const { starter, lobby, ircClient } = await setupAsync();
    const players = await tu.AddPlayersAsync(5, ircClient);
    await tu.changeHostAsync(players[0], lobby);
    starter.SendPluginMessage('mp_start', ['30', 'withhelp']);
  });
});
