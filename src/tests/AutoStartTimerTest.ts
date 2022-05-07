import { assert } from 'chai';
import { Lobby } from '../Lobby';
import { Roles } from '../Player';
import { DummyIrcClient } from '../dummies/DummyIrcClient';
import { AutoStartTimer, AutoStartTimerOption } from '../plugins/AutoStartTimer';
import tu from './TestUtils';

describe('AutoStartTimerTest', function () {
  before(function () {
    tu.configMochaAsSilent();
  });

  async function prepare(enabled: boolean = true, doClearHost: boolean = true, waitingTime: number = 60):
    Promise<{ astimer: AutoStartTimer, players: string[], lobby: Lobby, ircClient: DummyIrcClient }> {
    const li = await tu.SetupLobbyAsync();
    const option: Partial<AutoStartTimerOption> = {
      enabled: enabled,
      doClearHost: doClearHost,
      waitingTime: waitingTime
    };
    const players = await tu.AddPlayersAsync(3, li.ircClient);
    const astimer = new AutoStartTimer(li.lobby, option);
    return { astimer, players, ...li };
  }

  describe('auto start tests', function () {
    it('normal operation test', async () => {
      const { lobby, ircClient } = await prepare(true, true, 60);
      let c = 0, d = 0;
      lobby.SentMessage.on(a => {
        assert.equal(a.message, '!mp clearhost');
        c++;
      });
      lobby.PluginMessage.on(a => {
        if (d === 0) {
          assert.equal(a.type, 'mp_abort_start');
        } else if (d === 1) {
          assert.equal(a.type, 'mp_start');
          assert.equal(a.args[0], '60');
        }
        d++;
      });
      await ircClient.emulateChangeMapAsync();
      assert.equal(c, 1);
      assert.equal(d, 2);
    });
    it('no clearhost test', async () => {
      const { lobby, ircClient } = await prepare(true, false, 60);
      let c = 0, d = 0;
      lobby.SentMessage.on(a => {
        assert.equal(a.message, '!mp clearhost');
        c++;
      });
      lobby.PluginMessage.on(a => {
        if (d === 0) {
          assert.equal(a.type, 'mp_abort_start');
        } else if (d === 1) {
          assert.equal(a.type, 'mp_start');
          assert.equal(a.args[0], '60');
        }
        d++;
      });
      await ircClient.emulateChangeMapAsync();
      assert.equal(c, 0);
      assert.equal(d, 2);
    });
    it('disabled test', async () => {
      const { lobby, ircClient } = await prepare(false, false, 60);
      let c = 0;
      lobby.SentMessage.on(a => {
        c++;
      });
      await ircClient.emulateChangeMapAsync();
      assert.equal(c, 0);
    });
    it('timer cancel test', async () => {
      const { lobby, ircClient } = await prepare(true, false, 60);
      let d = 0;
      lobby.PluginMessage.on(a => {
        if (d === 0 || d === 2) {
          assert.equal(a.type, 'mp_abort_start');
        } else if (d === 1 || d === 3) {
          assert.equal(a.type, 'mp_start');
          assert.equal(a.args[0], '60');
        }
        d++;
      });
      await ircClient.emulateChangeMapAsync();
      await ircClient.emulateChangeMapAsync();
      assert.equal(d, 4);
    });
    it('timer will cancel when host changed', async () => {
      const { players, lobby, ircClient } = await prepare(true, true, 60);
      let c = 0;
      lobby.SentMessage.on(a => {
        if (c === 2 || c === 5) {
          assert.equal(a.message, '!mp clearhost');
        }
        c++;
      });
      lobby.PluginMessage.on(a => {
        if (c === 0 || c === 3) {
          assert.equal(a.type, 'mp_abort_start');
        } else if (c === 1 || c === 4) {
          assert.equal(a.type, 'mp_start');
          assert.equal(a.args[0], '60');
        }
        c++;
      });
      await ircClient.emulateChangeMapAsync();
      lobby.RaiseHostChanged(players[1]);
      await ircClient.emulateChangeMapAsync();
      assert.equal(c, 6);
    });
  });
  describe('option tests', function () {
    function assertOptions(astimer: AutoStartTimer, enabled: boolean, doClearHost: boolean, waitingTime: number): void {
      assert.equal(astimer.option.enabled, enabled);
      assert.equal(astimer.option.doClearHost, doClearHost);
      assert.equal(astimer.option.waitingTime, waitingTime);
    }

    it('option setting test', async () => {
      const { astimer, lobby, ircClient } = await prepare(true, false, 60);
      assertOptions(astimer, true, false, 60);
      const p1 = lobby.GetOrMakePlayer('p1');
      p1.setRole(Roles.Authorized);
      lobby.RaiseReceivedChatCommand(p1, '*autostart_disable');
      assertOptions(astimer, false, false, 60);
      lobby.RaiseReceivedChatCommand(p1, '*autostart_enable');
      assertOptions(astimer, true, false, 60);
      lobby.RaiseReceivedChatCommand(p1, '*autostart_clearhost_enable');
      assertOptions(astimer, true, true, 60);
      lobby.RaiseReceivedChatCommand(p1, '*atuostart_clearhost_disable');
      assertOptions(astimer, true, false, 60);
      lobby.RaiseReceivedChatCommand(p1, '*autostart_time 50');
      assertOptions(astimer, true, false, 50);
      lobby.RaiseReceivedChatCommand(p1, '*autostart_time -50');
      assertOptions(astimer, true, false, 15);
    });
  });

});
