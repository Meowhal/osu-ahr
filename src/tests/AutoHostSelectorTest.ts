import { assert } from 'chai';
import { escapeUserName } from '../Player';
import { Lobby } from '../Lobby';
import { DummyIrcClient } from '../dummies/DummyIrcClient';
import { AutoHostSelector, DENY_LIST } from '../plugins/AutoHostSelector';
import { MpSettingsCases } from './cases/MpSettingsCases';
import tu from './TestUtils';

describe('AutoHostSelectorTest', function () {
  before(function () {
    tu.configMochaAsSilent();
  });
  this.afterEach(() => {
    DENY_LIST.players.clear();
  });
  async function prepareSelector(logIrc = false): Promise<{ selector: AutoHostSelector, lobby: Lobby, ircClient: DummyIrcClient }> {
    const { lobby, ircClient } = await tu.SetupLobbyAsync();
    return { selector: new AutoHostSelector(lobby, { deny_list: [] }), lobby, ircClient };
  }

  function assertStateIs(state: string, s: AutoHostSelector): void {
    const l = s.lobby;
    switch (state) {
      case 's0': // no players
        assert.equal(s.hostQueue.length, 0);
        break;
      case 's1': // no host
        assert.isTrue(s.hostQueue.length > 0);
        assert.isTrue(!l.isMatching);
        assert.isTrue(l.host === null);
        break;
      case 'hr': // has host and needs to rotate
        assert.isTrue(s.hostQueue.length > 0, 's.hostQueue.length > 0');
        assert.isTrue(!l.isMatching), '!l.isMatching';
        assert.isTrue(s.needsRotate, 's.needsRotate');
        assert.isTrue(l.host !== null, 'l.host !== null');
        break;
      case 'hn': // has host and no needs to rotate
        assert.isTrue(s.hostQueue.length > 0);
        assert.isTrue(!l.isMatching);
        assert.isFalse(s.needsRotate);
        assert.isTrue(l.host !== null);
        break;
      case 'm': // matching
        assert.isTrue(s.hostQueue.length > 0);
        assert.isTrue(l.isMatching);
        break;
      default:
        assert.fail();
    }
  }

  it('constructor test', async () => {
    const { selector } = await prepareSelector();
    assertStateIs('s0', selector);
  });

  it('dispose event test', (done) => {
    prepareSelector().then(({ selector, ircClient }) => {
      ircClient.part(ircClient.channel, '', () => {
        assert.isEmpty(selector.eventDisposers);
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
        assert.equal(player.name, 'player1');
        assertStateIs('s1', selector);
        s1checked = true;
      });
      assertStateIs('s0', selector);

      await ircClient.emulateAddPlayerAsync('player1');
      tu.assertEventFire(lobby.HostChanged, (a) => {
        assertStateIs('hr', selector);
        assert.isTrue(s1checked);
        return true;
      });
    });

    it('s0 -> hr -> s0 test', async () => {
      const { selector, lobby, ircClient } = await prepareSelector();
      assertStateIs('s0', selector);
      await ircClient.emulateAddPlayerAsync('player1');
      assertStateIs('hr', selector);
      await tu.delayAsync(10);
      await ircClient.emulateRemovePlayerAsync('player1');
      assertStateIs('s0', selector);
    });

    it('hr[1] -> hr[3] -> s0', async () => {
      const { selector, lobby, ircClient } = await prepareSelector();
      assertStateIs('s0', selector);
      const pids = ['player1', 'player2', 'player3'];
      await tu.AddPlayersAsync(pids, ircClient);
      tu.assertHost('player1', lobby);
      assertStateIs('hr', selector);
      await ircClient.emulateRemovePlayerAsync('player2');
      assertStateIs('hr', selector);
      tu.assertHost('player1', lobby);
      await ircClient.emulateRemovePlayerAsync('player1');
      assertStateIs('hr', selector);
      tu.assertHost('player3', lobby);
      await ircClient.emulateRemovePlayerAsync('player3');
      assertStateIs('s0', selector);
    });

    it('hr -> m -> hr', async () => {
      const { selector, lobby, ircClient } = await prepareSelector();
      await tu.AddPlayersAsync(['player1', 'player2', 'player3'], ircClient);
      assertStateIs('hr', selector);
      tu.assertHost('player1', lobby);
      await ircClient.emulateMatchAsync(0);
      assertStateIs('hr', selector);
      tu.assertHost('player2', lobby);
    });

    it('hr -> m -> hr repeat', async () => {
      const { selector, lobby, ircClient } = await prepareSelector();
      await tu.AddPlayersAsync(['player1', 'player2', 'player3'], ircClient);
      assertStateIs('hr', selector);
      tu.assertHost('player1', lobby);
      await ircClient.emulateMatchAsync(0);
      assertStateIs('hr', selector);
      tu.assertHost('player2', lobby);
      await ircClient.emulateMatchAsync(0);
      assertStateIs('hr', selector);
      tu.assertHost('player3', lobby);
      await ircClient.emulateMatchAsync(0);
      assertStateIs('hr', selector);
      tu.assertHost('player1', lobby);
    });
    it('hr -> hn -> m -> hr', async () => {
      const { selector, lobby, ircClient } = await prepareSelector();
      await tu.AddPlayersAsync(['player1', 'player2', 'player3'], ircClient);
      assertStateIs('hr', selector);
      tu.assertHost('player1', lobby);
      await ircClient.emulateChangeMapAsync(0);
      assertStateIs('hr', selector);
      await ircClient.emulateRemovePlayerAsync('player1');
      assertStateIs('hn', selector);
      tu.assertHost('player2', lobby);
      await ircClient.emulateMatchAsync(0);
      assertStateIs('hr', selector);
      tu.assertHost('player2', lobby);
    });
    it('hr -[leave]-> hn -[change map]-> hr -> m -> hr', async () => {
      const { selector, lobby, ircClient } = await prepareSelector();
      await tu.AddPlayersAsync(['player1', 'player2', 'player3'], ircClient);
      assertStateIs('hr', selector);
      tu.assertHost('player1', lobby);
      await ircClient.emulateChangeMapAsync(0);
      await ircClient.emulateRemovePlayerAsync('player1');
      assertStateIs('hn', selector);
      tu.assertHost('player2', lobby);
      await ircClient.emulateChangeMapAsync(0);
      assertStateIs('hr', selector);
      tu.assertHost('player2', lobby);
      await ircClient.emulateMatchAsync(0);
      assertStateIs('hr', selector);
      tu.assertHost('player3', lobby);
    });
    it('hr -[transfer]-> hn -[change map]-> hr -> m -> hr', async () => {
      const { selector, lobby, ircClient } = await prepareSelector();
      await tu.AddPlayersAsync(['player1', 'player2', 'player3'], ircClient);
      assertStateIs('hr', selector);
      tu.assertHost('player1', lobby);
      await ircClient.emulateChangeMapAsync(0);
      await ircClient.emulateChangeHost('player2');
      assertStateIs('hn', selector);
      tu.assertHost('player2', lobby);
      await ircClient.emulateChangeMapAsync(0);
      assertStateIs('hr', selector);
      tu.assertHost('player2', lobby);
      await ircClient.emulateMatchAsync(0);
      assertStateIs('hr', selector);
      tu.assertHost('player3', lobby);
    });
    it('hr -> m -[abort]-> hn', async () => {
      const { selector, lobby, ircClient } = await prepareSelector();
      await tu.AddPlayersAsync(['player1', 'player2', 'player3'], ircClient);
      assertStateIs('hr', selector);
      tu.assertHost('player1', lobby);
      await ircClient.emulateChangeMapAsync(0);
      assertStateIs('hr', selector);

      await ircClient.emulateMatchAndAbortAsync(0, 0);
      assertStateIs('hn', selector);
      tu.assertHost('player1', lobby);
    });
    // アボート後にホストがマップを変更するとhostが切り替わる
    it('hr -> m -[abort]-> hn -[mapchange]-> hn -> hr', async () => {
      const { selector, lobby, ircClient } = await prepareSelector();
      await tu.AddPlayersAsync(['player1', 'player2', 'player3'], ircClient);
      assertStateIs('hr', selector);
      tu.assertHost('player1', lobby);
      await ircClient.emulateChangeMapAsync(0);
      assertStateIs('hr', selector);
      await ircClient.emulateMatchAndAbortAsync(0, 0);
      assertStateIs('hn', selector);
      tu.assertHost('player1', lobby);
      await ircClient.emulateChangeMapAsync(0);
      assertStateIs('hn', selector);
      tu.assertHost('player2', lobby);
      await ircClient.emulateChangeMapAsync(0);
      assertStateIs('hr', selector);
      tu.assertHost('player2', lobby);
    });
    it('hr -> m -[abort]-> hn -[leave]-> hn -> hr', async () => {
      const { selector, lobby, ircClient } = await prepareSelector();
      await tu.AddPlayersAsync(['player1', 'player2', 'player3'], ircClient);
      assertStateIs('hr', selector);
      tu.assertHost('player1', lobby);
      await ircClient.emulateChangeMapAsync(0);
      assertStateIs('hr', selector);
      await ircClient.emulateMatchAndAbortAsync(0, 0);
      assertStateIs('hn', selector);
      tu.assertHost('player1', lobby);
      await ircClient.emulateRemovePlayerAsync('player1');
      assertStateIs('hn', selector);
      tu.assertHost('player2', lobby);
      await ircClient.emulateChangeMapAsync(0);
      assertStateIs('hr', selector);
      tu.assertHost('player2', lobby);
    });
    it('hr -> s0 -> hr', async () => {
      const { selector, lobby, ircClient } = await prepareSelector();
      await tu.AddPlayersAsync(['player1'], ircClient);
      assertStateIs('hr', selector);
      tu.assertHost('player1', lobby);
      await ircClient.emulateChangeMapAsync(0);
      assertStateIs('hr', selector);
      await ircClient.emulateRemovePlayerAsync('player1');
      assertStateIs('s0', selector);
      await tu.AddPlayersAsync(['player1'], ircClient);
      tu.assertHost('player1', lobby);
      assertStateIs('hr', selector);
    });
    it('hr -> s0 -> hn -[map change]-> hr', async () => {
      const { selector, lobby, ircClient } = await prepareSelector();
      await tu.AddPlayersAsync(['player1'], ircClient);
      assertStateIs('hr', selector);
      tu.assertHost('player1', lobby);
      await ircClient.emulateChangeMapAsync(0);
      assertStateIs('hr', selector);
      await ircClient.emulateRemovePlayerAsync('player1');
      assertStateIs('s0', selector);
      await tu.AddPlayersAsync(['player2', 'player3'], ircClient);
      tu.assertHost('player2', lobby);
      assertStateIs('hn', selector);
      await ircClient.emulateMatchAsync(0);
      tu.assertHost('player2', lobby);
      assertStateIs('hr', selector);
    });
  });

  describe('join and left tests', function () {
    // 試合中にプレイヤーが入ってきた場合、現在のホストの後ろに配置される
    it('newcomer who join during the match should be enqueued after the currnt host.', async () => {
      const { selector, lobby, ircClient } = await prepareSelector(false);
      await tu.AddPlayersAsync(['player1', 'player2'], ircClient);
      assertStateIs('hr', selector);
      tu.assertHost('player1', lobby);

      const task = ircClient.emulateMatchAsync(4);
      await tu.delayAsync(1);
      ircClient.emulateAddPlayerAsync('player3'); // join during the match
      await task;

      assertStateIs('hr', selector);
      tu.assertHost('player2', lobby);

      await ircClient.emulateMatchAsync();
      assertStateIs('hr', selector);
      tu.assertHost('player1', lobby); // not player3
    });

    it('player left in the match', async () => {
      const { selector, lobby, ircClient } = await prepareSelector();
      await tu.AddPlayersAsync(['player1', 'player2', 'player3'], ircClient);
      assertStateIs('hr', selector);
      tu.assertHost('player1', lobby);

      let task = ircClient.emulateMatchAsync(4);
      await tu.delayAsync(1);
      await ircClient.emulateRemovePlayerAsync('player3');
      await task;

      assertStateIs('hr', selector);
      tu.assertHost('player2', lobby);

      task = ircClient.emulateMatchAsync(4);
      await tu.delayAsync(1);
      await ircClient.emulateRemovePlayerAsync('player2');
      await task;
      assertStateIs('hr', selector);
      tu.assertHost('player1', lobby);

      await ircClient.emulateAddPlayerAsync('player4');
      await ircClient.emulateAddPlayerAsync('player5');
      await ircClient.emulateAddPlayerAsync('player6');

      task = ircClient.emulateMatchAsync(4);
      await tu.delayAsync(1);
      await ircClient.emulateRemovePlayerAsync('player1');
      await task;
      assertStateIs('hr', selector);
      tu.assertHost('player4', lobby);
    });

    it('transfer host manually test', async () => {
      const { selector, lobby, ircClient } = await prepareSelector();
      await tu.AddPlayersAsync(['player1', 'player2', 'player3'], ircClient);
      assertStateIs('hr', selector);
      tu.assertHost('player1', lobby);

      await ircClient.emulateChangeHost('player2');
      await tu.delayAsync(1);
      tu.assertHost('player2', lobby);

      await ircClient.emulateChangeHost('player1');
      await tu.delayAsync(1);
      tu.assertHost('player3', lobby);

      await ircClient.emulateChangeHost('player3');
      await tu.delayAsync(1);
      tu.assertHost('player3', lobby);

      await ircClient.emulateChangeHost('player2');
      await tu.delayAsync(1);
      tu.assertHost('player1', lobby);
    });

    it('appoint next host when current host leave', async () => {
      const { selector, lobby, ircClient } = await prepareSelector();
      await tu.AddPlayersAsync(['player1', 'player2', 'player3'], ircClient);
      assertStateIs('hr', selector);
      tu.assertHost('player1', lobby);
      await ircClient.emulateRemovePlayerAsync('player1');
      await tu.delayAsync(1);
      tu.assertHost('player2', lobby);
    });

    it('conflict transfer host manually and plugin rotation test1', async () => {
      const { selector, lobby, ircClient } = await prepareSelector();
      await tu.AddPlayersAsync(['player1', 'player2', 'player3'], ircClient);
      assertStateIs('hr', selector);
      tu.assertHost('player1', lobby);
      const t1 = ircClient.emulateMatchAsync(1);
      ircClient.latency = 1;
      await t1;
      ircClient.latency = 0;
      await ircClient.emulateChangeHost('player3');
      await tu.delayAsync(10);
      tu.assertHost('player2', lobby);
    });

    it('conflict transfer host manually and plugin rotation test2', async () => {
      const { selector, lobby, ircClient } = await prepareSelector();
      await tu.AddPlayersAsync(['player1', 'player2', 'player3'], ircClient);
      assertStateIs('hr', selector);
      tu.assertHost('player1', lobby);
      const t1 = ircClient.emulateMatchAsync(1);
      ircClient.latency = 1;
      await t1;
      ircClient.latency = 0;
      await ircClient.emulateChangeHost('player2');
      await tu.delayAsync(10);
      tu.assertHost('player2', lobby);
    });

    it('issue #37 host left and match started at the same time', async () => {
      const { selector, lobby, ircClient } = await prepareSelector();
      await tu.AddPlayersAsync(['player1', 'player2', 'player3'], ircClient);
      assertStateIs('hr', selector);
      tu.assertHost('player1', lobby);
      await ircClient.emulateChangeMapAsync(0);
      ircClient.latency = 10; // it makes bot respond to !mp start command before !mp host command
      await ircClient.emulateRemovePlayerAsync('player1');
      ircClient.latency = 0;
      const t1 = ircClient.emulateMatchAsync(20);
      await tu.delayAsync(10);
      tu.assertHost('player2', lobby);
      assertStateIs('m', selector);
      await t1;
      tu.assertHost('player2', lobby);
      assertStateIs('hr', selector);
    });

    it('issue #37 test rotation after the issue', async () => {
      const { selector, lobby, ircClient } = await prepareSelector();
      await tu.AddPlayersAsync(['player1', 'player2', 'player3'], ircClient);
      assertStateIs('hr', selector);
      tu.assertHost('player1', lobby);
      await ircClient.emulateChangeMapAsync(0);
      ircClient.latency = 10;
      await ircClient.emulateRemovePlayerAsync('player1');
      ircClient.latency = 0;
      const t1 = ircClient.emulateMatchAsync(20);
      await tu.delayAsync(10);
      tu.assertHost('player2', lobby);
      await t1;
      tu.assertHost('player2', lobby);
      await ircClient.emulateChangeMapAsync(0);
      await ircClient.emulateMatchAsync(0);
      tu.assertHost('player3', lobby);
    });

    it('issue #37 player2 dosen\'t change map test', async () => {
      const { selector, lobby, ircClient } = await prepareSelector();
      await tu.AddPlayersAsync(['player1', 'player2', 'player3'], ircClient);
      assertStateIs('hr', selector);
      tu.assertHost('player1', lobby);
      await ircClient.emulateChangeMapAsync(0);
      ircClient.latency = 10; // it makes bot respond to !mp start command before !mp host command
      await ircClient.emulateRemovePlayerAsync('player1');
      ircClient.latency = 0;
      const t1 = ircClient.emulateMatchAsync(20);
      await tu.delayAsync(10);
      tu.assertHost('player2', lobby);
      await t1;
      tu.assertHost('player2', lobby);
      await ircClient.emulateMatchAsync(0);
      tu.assertHost('player3', lobby);
    });
  });

  describe('external operation tests', function () {
    it('plugin message skip test', async () => {
      const { selector, lobby, ircClient } = await prepareSelector();
      await tu.AddPlayersAsync(['player1', 'player2', 'player3'], ircClient);
      assertStateIs('hr', selector);
      tu.assertHost('player1', lobby);
      selector.SendPluginMessage('skip');
      await tu.delayAsync(5);
      tu.assertHost('player2', lobby);
    });

    it('plugin message skipto test', async () => {
      const { selector, lobby, ircClient } = await prepareSelector();
      await tu.AddPlayersAsync(['player1', 'player2', 'player3'], ircClient);
      assertStateIs('hr', selector);
      tu.assertHost('player1', lobby);
      selector.SendPluginMessage('skipto', ['player3']);
      await tu.delayAsync(5);
      tu.assertHost('player3', lobby);
      assert.equal(selector.hostQueue[0].name, 'player3');
      assert.equal(selector.hostQueue[1].name, 'player1');
      assert.equal(selector.hostQueue[2].name, 'player2');

      selector.SendPluginMessage('skipto', ['player3']);
      await tu.delayAsync(5);
      tu.assertHost('player3', lobby);
      assert.equal(selector.hostQueue[0].name, 'player3');
      assert.equal(selector.hostQueue[1].name, 'player1');
      assert.equal(selector.hostQueue[2].name, 'player2');
    });
  });

  describe('skip tests', function () {
    it('should change host when changed map -> changed host -> map change -> match start', async () => {
      const { selector, lobby, ircClient } = await prepareSelector();
      await tu.AddPlayersAsync(['player1', 'player2', 'player3'], ircClient);
      assertStateIs('hr', selector);
      tu.assertHost('player1', lobby);
      await ircClient.emulateMatchAsync(0);
      assertStateIs('hr', selector);
      tu.assertHost('player2', lobby);
      await ircClient.emulateChangeMapAsync(0);
      await ircClient.emulateRemovePlayerAsync('player2');
      assertStateIs('hn', selector);
      tu.assertHost('player3', lobby);
      await ircClient.emulateChangeMapAsync(0);
      assertStateIs('hr', selector);
      tu.assertHost('player3', lobby);
      await ircClient.emulateMatchAsync(0);
      assertStateIs('hr', selector);
      tu.assertHost('player1', lobby);
    });
    it('should not change host when changed map -> changed host -> started match', async () => {
      const { selector, lobby, ircClient } = await prepareSelector();
      await tu.AddPlayersAsync(['player1', 'player2', 'player3'], ircClient);
      await ircClient.emulateMatchAsync(0);
      await ircClient.emulateChangeMapAsync(0);
      assertStateIs('hr', selector);
      tu.assertHost('player2', lobby);
      await ircClient.emulateChangeMapAsync(0);
      await ircClient.emulateRemovePlayerAsync('player2');
      assertStateIs('hn', selector);
      tu.assertHost('player3', lobby);
      await ircClient.emulateMatchAsync(0);
      assertStateIs('hr', selector);
      tu.assertHost('player3', lobby);
      await ircClient.emulateMatchAsync(0);
      assertStateIs('hr', selector);
      tu.assertHost('player1', lobby);
    });
  });

  describe('match abort tests', function () {
    it('should not change host if match is aborted before any player finished', async () => {
      const { selector, lobby, ircClient } = await prepareSelector();
      await tu.AddPlayersAsync(['player1', 'player2', 'player3'], ircClient);
      assertStateIs('hr', selector);
      tu.assertHost('player1', lobby);
      await ircClient.emulateMatchAndAbortAsync();
      assertStateIs('hn', selector);
      tu.assertHost('player1', lobby);

      await ircClient.emulateMatchAsync(0);
      assertStateIs('hr', selector);
      tu.assertHost('player2', lobby);
    });
    it('should change host when match is aborted after some players finished', async () => {
      const { selector, lobby, ircClient } = await prepareSelector();
      await tu.AddPlayersAsync(['player1', 'player2', 'player3'], ircClient);
      assertStateIs('hr', selector);
      tu.assertHost('player1', lobby);
      await ircClient.emulateMatchAndAbortAsync(0, 1);
      assertStateIs('hr', selector);
      tu.assertHost('player2', lobby);

      await ircClient.emulateMatchAsync(0);
      assertStateIs('hr', selector);
      tu.assertHost('player3', lobby);
    });
    it('should change host when match start -> abort -> map change', async () => {
      const { selector, lobby, ircClient } = await prepareSelector();
      await tu.AddPlayersAsync(['player1', 'player2', 'player3'], ircClient);
      assertStateIs('hr', selector);
      tu.assertHost('player1', lobby);

      await ircClient.emulateMatchAndAbortAsync();
      assertStateIs('hn', selector);
      tu.assertHost('player1', lobby);
      await ircClient.emulateChangeMapAsync();
      assertStateIs('hn', selector);
      tu.assertHost('player2', lobby);
      await ircClient.emulateMatchAsync(0);
      assertStateIs('hr', selector);
      tu.assertHost('player2', lobby);
    });
    it('should change host and be remainable when map change -> match start -> host left -> match abort', async () => {
      const { selector, lobby, ircClient } = await prepareSelector();
      const players = await tu.AddPlayersAsync(5, ircClient);
      await ircClient.emulateMatchAsync(0);
      await ircClient.emulateChangeMapAsync(0);
      assertStateIs('hr', selector);
      tu.assertHost(players[1], lobby);
      const t = ircClient.emulateMatchAsync(60);
      await tu.delayAsync(1);
      await ircClient.emulateRemovePlayerAsync(players[1]);
      assertStateIs('m', selector);
      assert.isNull(lobby.host);
      lobby.AbortMatch();
      await tu.delayAsync(1);
      assertStateIs('hn', selector);
      tu.assertHost(players[2], lobby);
      await ircClient.emulateMatchAsync(0);
      assertStateIs('hr', selector);
      tu.assertHost(players[2], lobby);
    });
    it('should not change host when -> match start -> host left -> match abort -> map change', async () => {
      const { selector, lobby, ircClient } = await prepareSelector();
      const players = await tu.AddPlayersAsync(5, ircClient);
      await ircClient.emulateMatchAsync(0);
      await ircClient.emulateChangeMapAsync(0);
      assertStateIs('hr', selector);
      tu.assertHost(players[1], lobby);
      const t = ircClient.emulateMatchAsync(30);
      await tu.delayAsync(1);
      await ircClient.emulateRemovePlayerAsync(players[1]);
      assertStateIs('m', selector);
      assert.isNull(lobby.host);
      lobby.AbortMatch();
      await tu.delayAsync(1);
      assertStateIs('hn', selector);
      tu.assertHost(players[2], lobby);
      await ircClient.emulateChangeMapAsync(0);
      assertStateIs('hr', selector);
      tu.assertHost(players[2], lobby);
    });
    it('should change host when -> match start -> host left -> player finish -> match abort -> map change', async () => {
      const { selector, lobby, ircClient } = await prepareSelector();
      const players = await tu.AddPlayersAsync(['a', 'b', 'c', 'd'], ircClient);
      await ircClient.emulateMatchAsync(0);
      await ircClient.emulateChangeMapAsync(0);
      assertStateIs('hr', selector);
      tu.assertHost('b', lobby);
      const t = ircClient.emulateMatchAndAbortAsync(10, ['a', 'c', 'd']);
      await tu.delayAsync(1);
      await ircClient.emulateRemovePlayerAsync('b');
      assertStateIs('m', selector);
      assert.isNull(lobby.host);
      await t;
      assertStateIs('hr', selector);
      tu.assertHost('c', lobby);
      await ircClient.emulateChangeMapAsync(0);
      assertStateIs('hr', selector);
      tu.assertHost('c', lobby);
    });
  });

  describe('mp settings tests', function () {
    it('empty lobby case1_1', async () => {
      const { selector, lobby, ircClient } = await prepareSelector();
      const c = MpSettingsCases.case1_1;
      const q = ['p1', 'p2', 'p3', 'p4', 'p5'];
      ircClient.emulateMpSettings(c);
      for (let i = 0; i < selector.hostQueue.length; i++) {
        assert.equal(selector.hostQueue[i].name, q[i]);
      }
    });
    it('empty lobby case1_2', async () => {
      const { selector, lobby, ircClient } = await prepareSelector();
      const c = MpSettingsCases.case1_2;
      const q = ['p3', 'p4', 'p5', 'p1', 'p2'];
      ircClient.emulateMpSettings(c);
      for (let i = 0; i < selector.hostQueue.length; i++) {
        assert.equal(selector.hostQueue[i].name, q[i]);
      }
    });
    it('change host test', async () => {
      const { selector, lobby, ircClient } = await prepareSelector();
      const c = MpSettingsCases.case1_1;
      const q1 = ['p1', 'p2', 'p3', 'p4', 'p5'];
      const q2 = ['p3', 'p4', 'p5', 'p1', 'p2'];
      ircClient.emulateMpSettings(c);
      for (let i = 0; i < selector.hostQueue.length; i++) {
        assert.equal(selector.hostQueue[i].name, q1[i]);
      }
      selector.SkipTo('p3');
      for (let i = 0; i < selector.hostQueue.length; i++) {
        assert.equal(selector.hostQueue[i].name, q2[i]);
      }
      if (lobby.host === null) return;
      assert.isTrue(lobby.host.isHost);
      assert.equal(lobby.host.name, 'p3');
      ircClient.emulateMpSettings(c);
      for (let i = 0; i < selector.hostQueue.length; i++) {
        assert.equal(selector.hostQueue[i].name, q1[i]);
      }
      assert.equal(lobby.host.name, 'p1');
    });
    it('mod queue test', async () => {
      const { selector, lobby, ircClient } = await prepareSelector();
      const c1 = MpSettingsCases.case1_1;
      const c3 = MpSettingsCases.case1_3;
      const q1 = ['p1', 'p2', 'p3', 'p4', 'p5'];
      const q2 = ['p4', 'p5', 'p6', 'p7', 'p2'];
      ircClient.emulateMpSettings(c1);
      for (let i = 0; i < selector.hostQueue.length; i++) {
        assert.equal(selector.hostQueue[i].name, q1[i]);
      }
      ircClient.emulateMpSettings(c3);

      for (let i = 0; i < selector.hostQueue.length; i++) {
        assert.equal(selector.hostQueue[i].name, q2[i], `${i} a-${selector.hostQueue[i].name} e-${q2[i]}`);
      }

      if (lobby.host === null) assert.fail();
      else assert.equal(lobby.host.name, 'p4');
    });
    it('reset queue test', async () => {
      const { selector, lobby, ircClient } = await prepareSelector();
      const c1 = MpSettingsCases.case1_1;
      const q1 = ['p1', 'p2', 'p3', 'p4', 'p5'];
      const q2 = ['p4', 'p5', 'p6', 'p7', 'p2'];
      ircClient.emulateMpSettings(c1);
      for (let i = 0; i < selector.hostQueue.length; i++) {
        assert.equal(selector.hostQueue[i].name, q1[i]);
      }
      ircClient.emulateRemovePlayerAsync('p1');
      selector.SkipTo('p3');
      ircClient.emulateMpSettings(c1);

      for (let i = 0; i < selector.hostQueue.length; i++) {
        assert.equal(selector.hostQueue[i].name, q1[i], `${i} a-${selector.hostQueue[i].name} e-${q2[i]}`);
      }

      if (lobby.host === null) assert.fail();
      else assert.equal(lobby.host.name, 'p1');
    });
  });
  describe('reoder tests', function () {
    it('reaoder', async () => {
      const { selector, lobby, ircClient } = await prepareSelector();
      const players = await tu.AddPlayersAsync(5, ircClient);
      const od = ['p3', 'p1', 'p2', 'p4', 'p0'];
      selector.Reorder(od.join(','));
      await tu.delayAsync(1);
      tu.assertHost('p3', lobby);
      for (let i = 0; i < od.length; i++) {
        assert.equal(selector.hostQueue[i].name, od[i]);
      }
    });
    it('disguised string', async () => {
      const { selector, lobby, ircClient } = await prepareSelector();
      const players = await tu.AddPlayersAsync(5, ircClient);
      const disguised = 'p​0, p​1, p​2, p​3, p​4';
      const od = ['p0', 'p1', 'p2', 'p3', 'p4'];
      selector.SkipTo('p3');
      await tu.delayAsync(1);
      selector.Reorder(disguised);
      await tu.delayAsync(1);
      tu.assertHost('p0', lobby);
      for (let i = 0; i < od.length; i++) {
        assert.equal(selector.hostQueue[i].name, od[i]);
      }
    });
    it('no change', async () => {
      const { selector, lobby, ircClient } = await prepareSelector();
      const players = await tu.AddPlayersAsync(5, ircClient);
      const odtxt = 'p​0, p​1, p​2, p​3, p​4';
      const od = ['p0', 'p1', 'p2', 'p3', 'p4'];
      selector.Reorder(odtxt);
      await tu.delayAsync(1);
      tu.assertHost('p0', lobby);
      for (let i = 0; i < od.length; i++) {
        assert.equal(selector.hostQueue[i].name, od[i]);
      }
    });
    it('partially specify', async () => {
      const { selector, lobby, ircClient } = await prepareSelector();
      const players = await tu.AddPlayersAsync(5, ircClient);
      const odtxt = 'p​3, p​4, p2';
      const od = ['p3', 'p4', 'p2', 'p0', 'p1'];
      selector.Reorder(odtxt);
      await tu.delayAsync(1);
      tu.assertHost('p3', lobby);
      for (let i = 0; i < od.length; i++) {
        assert.equal(selector.hostQueue[i].name, od[i]);
      }
    });
    it('extra specify', async () => {
      const { selector, lobby, ircClient } = await prepareSelector();
      const players = await tu.AddPlayersAsync(5, ircClient);
      const odtxt = 'p3, p6, p4, p2, p5, p0, p1';
      const od = ['p3', 'p4', 'p2', 'p0', 'p1'];
      selector.Reorder(odtxt);
      await tu.delayAsync(1);
      tu.assertHost('p3', lobby);
      for (let i = 0; i < od.length; i++) {
        assert.equal(selector.hostQueue[i].name, od[i]);
      }
    });
    it('from custom command', async () => {
      const { selector, lobby, ircClient } = await prepareSelector();
      lobby.option.authorized_users = ['p0'];
      const players = await tu.AddPlayersAsync(5, ircClient);
      const odtxt = '*reorder p​0, p​1, p​2, p​3, p​4';
      const od = ['p0', 'p1', 'p2', 'p3', 'p4'];
      selector.SkipTo('p3');
      tu.assertHost('p3', lobby);
      await tu.delayAsync(1);
      await ircClient.emulateMessageAsync('p0', ircClient.channel, odtxt);

      for (let i = 0; i < od.length; i++) {
        assert.equal(selector.hostQueue[i].name, od[i]);
      }
    });
    it('invalid custom command', async () => {
      const { selector, lobby, ircClient } = await prepareSelector();
      lobby.option.authorized_users = ['p0'];
      const players = await tu.AddPlayersAsync(5, ircClient);
      let odtxt = '*reorder';
      const od = ['p3', 'p4', 'p0', 'p1', 'p2'];
      selector.SkipTo('p3');
      tu.assertHost('p3', lobby);
      await tu.delayAsync(1);
      await ircClient.emulateMessageAsync('p0', ircClient.channel, odtxt);

      for (let i = 0; i < od.length; i++) {
        assert.equal(selector.hostQueue[i].name, od[i]);
      }

      odtxt = '*reorder asdfsafasdf';
      await tu.delayAsync(1);
      await ircClient.emulateMessageAsync('p0', ircClient.channel, odtxt);

      for (let i = 0; i < od.length; i++) {
        assert.equal(selector.hostQueue[i].name, od[i]);
      }
    });
  });

  describe('cleared host tests', function () {
    it('clearhost and match', async () => {
      const { selector, lobby, ircClient } = await prepareSelector();
      await tu.AddPlayersAsync(['player1', 'player2', 'player3'], ircClient);
      assertStateIs('hr', selector);
      tu.assertHost('player1', lobby);
      lobby.SendMessage('!mp clearhost');
      assert.isTrue(lobby.isClearedHost);
      assert.isNull(lobby.host);
      await ircClient.emulateMatchAsync();
      tu.assertHost('player2', lobby);
    });
    it('plugin skip test', async () => {
      const { selector, lobby, ircClient } = await prepareSelector();
      await tu.AddPlayersAsync(['player1', 'player2', 'player3'], ircClient);
      assertStateIs('hr', selector);
      tu.assertHost('player1', lobby);
      lobby.SendMessage('!mp clearhost');
      assert.isTrue(lobby.isClearedHost);
      assert.isNull(lobby.host);
      selector.SendPluginMessage('skip');
      await tu.delayAsync(5);
      tu.assertHost('player2', lobby);
    });
  });

  describe('denylist tests', function () {
    it('denied player should ignore test', async () => {
      const { selector, lobby, ircClient } = await prepareSelector();
      DENY_LIST.addPlayer(lobby.GetOrMakePlayer('p3'));
      await ircClient.emulateMpSettings(MpSettingsCases.case1_1);
      assert.equal(selector.hostQueue.length, 4);
      assert.equal(selector.hostQueue[0], lobby.GetOrMakePlayer('p1'));
      assert.equal(selector.hostQueue[1], lobby.GetOrMakePlayer('p2'));
      assert.equal(selector.hostQueue[2], lobby.GetOrMakePlayer('p4'));
      assert.equal(selector.hostQueue[3], lobby.GetOrMakePlayer('p5'));
      lobby.destroy();
    });

    it('transfer host to denied player test', async () => {
      const { selector, lobby, ircClient } = await prepareSelector();
      DENY_LIST.addPlayer(lobby.GetOrMakePlayer('p4'));
      await ircClient.emulateMpSettings(MpSettingsCases.case1_1);
      assert.equal(selector.hostQueue.length, 4);

      tu.assertHost('p1', lobby);
      await ircClient.emulateChangeHost('p4');
      tu.assertHost('p2', lobby);
      await ircClient.emulateChangeHost('p4');
      tu.assertHost('p3', lobby);
      await ircClient.emulateChangeHost('p4');
      tu.assertHost('p5', lobby);
      await ircClient.emulateChangeHost('p1');
      tu.assertHost('p1', lobby);
      lobby.destroy();
    });

    it('only denied player test', async () => {
      const { selector, lobby, ircClient } = await prepareSelector();
      DENY_LIST.addPlayer(lobby.GetOrMakePlayer('p4'));
      DENY_LIST.addPlayer(lobby.GetOrMakePlayer('p5'));
      await ircClient.emulateMpSettings(MpSettingsCases.case1_1);
      assert.equal(selector.hostQueue.length, 3);

      tu.assertHost('p1', lobby);
      await ircClient.emulateRemovePlayerAsync('p1');
      tu.assertHost('p2', lobby);
      await ircClient.emulateRemovePlayerAsync('p3');
      tu.assertHost('p2', lobby);
      await ircClient.emulateRemovePlayerAsync('p2');
      assert.equal(selector.hostQueue.length, 0);
      assert.isNull(lobby.host);
      await ircClient.emulateRemovePlayerAsync('p4');
      assert.equal(selector.hostQueue.length, 0);
      assert.isNull(lobby.host);
      lobby.destroy();
    });

    it('only denied player -> join someone test', async () => {
      const { selector, lobby, ircClient } = await prepareSelector();
      DENY_LIST.addPlayer(lobby.GetOrMakePlayer('p4'));
      DENY_LIST.addPlayer(lobby.GetOrMakePlayer('p5'));
      await ircClient.emulateMpSettings(MpSettingsCases.case1_1);
      assert.equal(selector.hostQueue.length, 3);

      await ircClient.emulateRemovePlayerAsync('p1');
      await ircClient.emulateRemovePlayerAsync('p2');
      await ircClient.emulateRemovePlayerAsync('p3');

      assert.equal(selector.hostQueue.length, 0);
      assert.isNull(lobby.host);

      await ircClient.emulateAddPlayerAsync('p6');
      tu.assertHost('p6', lobby);
      lobby.destroy();
    });

    it('skipto command test', async () => {
      const { selector, lobby, ircClient } = await prepareSelector();
      DENY_LIST.addPlayer(lobby.GetOrMakePlayer('p4'));
      await ircClient.emulateMpSettings(MpSettingsCases.case1_1);
      selector.SendPluginMessage('skipto', ['p3']);
      tu.assertHost('p3', lobby);
      selector.SendPluginMessage('skipto', ['p4']);
      tu.assertHost('p3', lobby);
      lobby.destroy();
    });

    it('add player to denylist test', async () => {
      const { selector, lobby, ircClient } = await prepareSelector();
      await ircClient.emulateMpSettings(MpSettingsCases.case1_1);
      tu.assertHost('p1', lobby);
      assert.equal(selector.hostQueue.length, 5);

      DENY_LIST.addPlayer(lobby.GetOrMakePlayer('p3'));

      assert.equal(selector.hostQueue.length, 4);
      assert.equal(selector.hostQueue[0], lobby.GetOrMakePlayer('p1'));
      assert.equal(selector.hostQueue[1], lobby.GetOrMakePlayer('p2'));
      assert.equal(selector.hostQueue[2], lobby.GetOrMakePlayer('p4'));
      assert.equal(selector.hostQueue[3], lobby.GetOrMakePlayer('p5'));
      lobby.destroy();
    });

    it('add host to denylist test', async () => {
      const { selector, lobby, ircClient } = await prepareSelector();
      await ircClient.emulateMpSettings(MpSettingsCases.case1_1);
      tu.assertHost('p1', lobby);
      DENY_LIST.addPlayer(lobby.GetOrMakePlayer('p1'));
      tu.assertHost('p2', lobby);
      assert.equal(selector.hostQueue[0], lobby.GetOrMakePlayer('p2'));
      assert.equal(selector.hostQueue[1], lobby.GetOrMakePlayer('p3'));
      assert.equal(selector.hostQueue[2], lobby.GetOrMakePlayer('p4'));
      assert.equal(selector.hostQueue[3], lobby.GetOrMakePlayer('p5'));
      lobby.destroy();
    });

    it('add last player to denylist test', async () => {
      const { selector, lobby, ircClient } = await prepareSelector();
      await ircClient.emulateMpSettings(MpSettingsCases.case1_1);
      tu.assertHost('p1', lobby);
      assert.equal(selector.hostQueue.length, 5);

      await ircClient.emulateRemovePlayerAsync('p1');
      await ircClient.emulateRemovePlayerAsync('p2');
      await ircClient.emulateRemovePlayerAsync('p3');

      tu.assertHost('p4', lobby);
      DENY_LIST.addPlayer(lobby.GetOrMakePlayer('p5'));
      tu.assertHost('p4', lobby);
      DENY_LIST.addPlayer(lobby.GetOrMakePlayer('p4'));
      assert.equal(selector.hostQueue.length, 0);
      assert.isNull(lobby.host);
      lobby.destroy();
    });

    it('remove player from denlylist test', async () => {
      const { selector, lobby, ircClient } = await prepareSelector();
      await ircClient.emulateMpSettings(MpSettingsCases.case1_1);
      DENY_LIST.addPlayer(lobby.GetOrMakePlayer('p3'));

      tu.assertHost('p1', lobby);
      assert.equal(selector.hostQueue.length, 4);

      DENY_LIST.removePlayer(lobby.GetOrMakePlayer('p3'));

      assert.equal(selector.hostQueue.length, 5);
      assert.equal(selector.hostQueue[0], lobby.GetOrMakePlayer('p1'));
      assert.equal(selector.hostQueue[1], lobby.GetOrMakePlayer('p2'));
      assert.equal(selector.hostQueue[2], lobby.GetOrMakePlayer('p4'));
      assert.equal(selector.hostQueue[3], lobby.GetOrMakePlayer('p5'));
      assert.equal(selector.hostQueue[4], lobby.GetOrMakePlayer('p3'));
      lobby.destroy();
    });

    it('remove player from denlylist test - no one in queue', async () => {
      const { selector, lobby, ircClient } = await prepareSelector();
      await ircClient.emulateMpSettings(MpSettingsCases.case1_1);
      DENY_LIST.addPlayer(lobby.GetOrMakePlayer('p1'));
      DENY_LIST.addPlayer(lobby.GetOrMakePlayer('p2'));
      DENY_LIST.addPlayer(lobby.GetOrMakePlayer('p3'));
      DENY_LIST.addPlayer(lobby.GetOrMakePlayer('p4'));
      DENY_LIST.addPlayer(lobby.GetOrMakePlayer('p5'));

      assert.equal(selector.hostQueue.length, 0);

      DENY_LIST.removePlayer(lobby.GetOrMakePlayer('p3'));

      assert.equal(selector.hostQueue.length, 1);
      assert.equal(selector.hostQueue[0], lobby.GetOrMakePlayer('p3'));
      tu.assertHost('p3', lobby);
      lobby.destroy();
    });

    it('slotbase reoder test1', async () => {
      const { selector, lobby, ircClient } = await prepareSelector();
      DENY_LIST.addPlayer(lobby.GetOrMakePlayer('p3'));
      await ircClient.emulateMpSettings(MpSettingsCases.case1_1);
      assert.equal(selector.hostQueue.length, 4);
      assert.equal(selector.hostQueue[0], lobby.GetOrMakePlayer('p1'));
      assert.equal(selector.hostQueue[1], lobby.GetOrMakePlayer('p2'));
      assert.equal(selector.hostQueue[2], lobby.GetOrMakePlayer('p4'));
      assert.equal(selector.hostQueue[3], lobby.GetOrMakePlayer('p5'));
      lobby.destroy();
    });

    it('slotbase reoder test2', async () => {
      const { selector, lobby, ircClient } = await prepareSelector();
      DENY_LIST.addPlayer(lobby.GetOrMakePlayer('p4'));
      await ircClient.emulateMpSettings(MpSettingsCases.case1_2);
      assert.equal(selector.hostQueue.length, 4);
      assert.equal(selector.hostQueue[0], lobby.GetOrMakePlayer('p3'));
      assert.equal(selector.hostQueue[1], lobby.GetOrMakePlayer('p5'));
      assert.equal(selector.hostQueue[2], lobby.GetOrMakePlayer('p1'));
      assert.equal(selector.hostQueue[3], lobby.GetOrMakePlayer('p2'));
      lobby.destroy();
    });

    it('slotbase reoder test - host is denied', async () => {
      const { selector, lobby, ircClient } = await prepareSelector();
      DENY_LIST.addPlayer(lobby.GetOrMakePlayer('p3'));
      await ircClient.emulateMpSettings(MpSettingsCases.case1_2);
      assert.equal(selector.hostQueue.length, 4);
      assert.equal(selector.hostQueue[0], lobby.GetOrMakePlayer('p1'));
      assert.equal(selector.hostQueue[1], lobby.GetOrMakePlayer('p2'));
      assert.equal(selector.hostQueue[2], lobby.GetOrMakePlayer('p4'));
      assert.equal(selector.hostQueue[3], lobby.GetOrMakePlayer('p5'));
      lobby.destroy();
    });

    it('modify order test - stay', async () => {
      const { selector, lobby, ircClient } = await prepareSelector();
      DENY_LIST.addPlayer(lobby.GetOrMakePlayer('p5'));

      await ircClient.emulateMpSettings(MpSettingsCases.case1_1);
      await ircClient.emulateMpSettings(MpSettingsCases.case1_3);

      assert.equal(selector.hostQueue.length, 4);
      assert.equal(selector.hostQueue[0], lobby.GetOrMakePlayer('p4'));
      assert.equal(selector.hostQueue[1], lobby.GetOrMakePlayer('p6'));
      assert.equal(selector.hostQueue[2], lobby.GetOrMakePlayer('p7'));
      assert.equal(selector.hostQueue[3], lobby.GetOrMakePlayer('p2'));
      lobby.destroy();
    });

    it('modify order test - leave', async () => {
      const { selector, lobby, ircClient } = await prepareSelector();
      DENY_LIST.addPlayer(lobby.GetOrMakePlayer('p1'));

      await ircClient.emulateMpSettings(MpSettingsCases.case1_1);
      await ircClient.emulateMpSettings(MpSettingsCases.case1_3);

      assert.equal(selector.hostQueue.length, 5);
      assert.equal(selector.hostQueue[0], lobby.GetOrMakePlayer('p4'));
      assert.equal(selector.hostQueue[1], lobby.GetOrMakePlayer('p5'));
      assert.equal(selector.hostQueue[2], lobby.GetOrMakePlayer('p6'));
      assert.equal(selector.hostQueue[3], lobby.GetOrMakePlayer('p7'));
      assert.equal(selector.hostQueue[4], lobby.GetOrMakePlayer('p2'));
      lobby.destroy();
    });

    it('modify order test - join', async () => {
      const { selector, lobby, ircClient } = await prepareSelector();
      DENY_LIST.addPlayer(lobby.GetOrMakePlayer('p7'));

      await ircClient.emulateMpSettings(MpSettingsCases.case1_1);
      await ircClient.emulateMpSettings(MpSettingsCases.case1_3);

      assert.equal(selector.hostQueue.length, 4);
      assert.equal(selector.hostQueue[0], lobby.GetOrMakePlayer('p4'));
      assert.equal(selector.hostQueue[1], lobby.GetOrMakePlayer('p5'));
      assert.equal(selector.hostQueue[2], lobby.GetOrMakePlayer('p6'));
      assert.equal(selector.hostQueue[3], lobby.GetOrMakePlayer('p2'));
      lobby.destroy();
    });

    describe('denylist command tests', () => {
      it('add test', async () => {
        const { selector, lobby, ircClient } = await prepareSelector();
        await ircClient.emulateMpSettings(MpSettingsCases.case1_1);
        assert.equal(DENY_LIST.players.size, 0);

        tu.sendMessageAsOwner(lobby, '*denylist add p1');

        assert.equal(DENY_LIST.players.size, 1);
        assert.include(DENY_LIST.players, 'p1');

        tu.sendMessageAsOwner(lobby, '*denylist add p2 sfd');

        assert.equal(DENY_LIST.players.size, 2);
        assert.include(DENY_LIST.players, escapeUserName('p2 sfd'));

        tu.sendMessageAsOwner(lobby, '*denylist add');

        assert.equal(DENY_LIST.players.size, 2);

        const un = 'asdf    hello';
        tu.sendMessageAsOwner(lobby, `*denylist     add    ${un}`);

        assert.equal(DENY_LIST.players.size, 3);
        assert.include(DENY_LIST.players, escapeUserName(un));
        lobby.destroy();
      });

      it('add twice test', async () => {
        const { selector, lobby, ircClient } = await prepareSelector();
        await ircClient.emulateMpSettings(MpSettingsCases.case1_1);
        assert.equal(DENY_LIST.players.size, 0);

        tu.sendMessageAsOwner(lobby, '*denylist add p1');

        assert.equal(DENY_LIST.players.size, 1);
        assert.include(DENY_LIST.players, 'p1');

        tu.sendMessageAsOwner(lobby, '*denylist add p1');

        assert.equal(DENY_LIST.players.size, 1);
        assert.include(DENY_LIST.players, 'p1');

        lobby.destroy();
      });

      it('remove test', async () => {
        const { selector, lobby, ircClient } = await prepareSelector();
        await ircClient.emulateMpSettings(MpSettingsCases.case1_1);
        assert.equal(DENY_LIST.players.size, 0);

        tu.sendMessageAsOwner(lobby, '*denylist add p1');
        tu.sendMessageAsOwner(lobby, '*denylist add p2 piyo');
        tu.sendMessageAsOwner(lobby, '*denylist add p3 HOGE');

        assert.equal(DENY_LIST.players.size, 3);
        assert.include(DENY_LIST.players, escapeUserName('p1'));
        assert.include(DENY_LIST.players, escapeUserName('p2 piyo'));
        assert.include(DENY_LIST.players, escapeUserName('p3 HOGE'));

        tu.sendMessageAsOwner(lobby, '*denylist remove p1');
        assert.equal(DENY_LIST.players.size, 2);
        assert.notInclude(DENY_LIST.players, escapeUserName('p1'));
        assert.include(DENY_LIST.players, escapeUserName('p2 piyo'));
        assert.include(DENY_LIST.players, escapeUserName('p3 HOGE'));

        tu.sendMessageAsOwner(lobby, '*denylist remove p2 piyo');
        assert.equal(DENY_LIST.players.size, 1);
        assert.notInclude(DENY_LIST.players, escapeUserName('p1'));
        assert.notInclude(DENY_LIST.players, escapeUserName('p2 piyo'));
        assert.include(DENY_LIST.players, escapeUserName('p3 HOGE'));

        tu.sendMessageAsOwner(lobby, '*denylist    remove     p3 hoge');
        assert.equal(DENY_LIST.players.size, 0);
        assert.notInclude(DENY_LIST.players, escapeUserName('p1'));
        assert.notInclude(DENY_LIST.players, escapeUserName('p2 piyo'));
        assert.notInclude(DENY_LIST.players, escapeUserName('p3 HOGE'));

        lobby.destroy();
      });

      it('remove twice test', async () => {
        const { selector, lobby, ircClient } = await prepareSelector();
        await ircClient.emulateMpSettings(MpSettingsCases.case1_1);
        assert.equal(DENY_LIST.players.size, 0);

        tu.sendMessageAsOwner(lobby, '*denylist add p1');
        tu.sendMessageAsOwner(lobby, '*denylist add p2');
        tu.sendMessageAsOwner(lobby, '*denylist add p3');

        assert.equal(DENY_LIST.players.size, 3);
        assert.include(DENY_LIST.players, escapeUserName('p1'));
        assert.include(DENY_LIST.players, escapeUserName('p2'));
        assert.include(DENY_LIST.players, escapeUserName('p3'));

        tu.sendMessageAsOwner(lobby, '*denylist remove p1');
        tu.sendMessageAsOwner(lobby, '*denylist remove p1');
        assert.equal(DENY_LIST.players.size, 2);
        assert.notInclude(DENY_LIST.players, escapeUserName('p1'));
        assert.include(DENY_LIST.players, escapeUserName('p2'));
        assert.include(DENY_LIST.players, escapeUserName('p3'));

        lobby.destroy();
      });

    });
    it('multi lobby tests', async () => {
      const a = await prepareSelector();
      const b = await prepareSelector();

      await a.ircClient.emulateMpSettings(MpSettingsCases.case1_1); // p1 p2 p3 p4 p5
      await b.ircClient.emulateMpSettings(MpSettingsCases.case1_3); // p6 p2 p4 p5 p7

      assert.equal(DENY_LIST.players.size, 0);
      assert.equal(a.selector.hostQueue.length, 5);
      assert.equal(b.selector.hostQueue.length, 5);

      DENY_LIST.addPlayer(a.lobby.GetOrMakePlayer('p1'));
      assert.equal(DENY_LIST.players.size, 1);

      assert.equal(a.selector.hostQueue.length, 4);
      assert.equal(b.selector.hostQueue.length, 5);

      DENY_LIST.addPlayer(a.lobby.GetOrMakePlayer('p2'));
      assert.equal(DENY_LIST.players.size, 2);

      assert.equal(a.selector.hostQueue.length, 3);
      assert.equal(b.selector.hostQueue.length, 4);

      assert.equal(a.selector.hostQueue[0], a.lobby.GetOrMakePlayer('p3'));
      assert.equal(a.selector.hostQueue[1], a.lobby.GetOrMakePlayer('p4'));
      assert.equal(a.selector.hostQueue[2], a.lobby.GetOrMakePlayer('p5'));

      assert.equal(b.selector.hostQueue[0], b.lobby.GetOrMakePlayer('p4'));
      assert.equal(b.selector.hostQueue[1], b.lobby.GetOrMakePlayer('p5'));
      assert.equal(b.selector.hostQueue[2], b.lobby.GetOrMakePlayer('p7'));
      assert.equal(b.selector.hostQueue[3], b.lobby.GetOrMakePlayer('p6'));

      a.lobby.destroy();
      b.lobby.destroy();
    });
  });
});
