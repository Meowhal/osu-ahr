import { assert } from 'chai';
import { Lobby, Roles } from "..";
import { DummyIrcClient } from '../dummies';
import { AutoStartTimer, AutoStartTimerOption } from "../plugins";
import tu from "./TestUtils";

describe("AutoStartTimerTest", function () {
  before(function () {
    tu.configMochaAsSilent();
  });

  async function prepare(enabled: boolean = true, doClearHost: boolean = true, waitingTime: number = 60):
    Promise<{ astimer: AutoStartTimer, lobby: Lobby, ircClient: DummyIrcClient }> {
    const li = await tu.SetupLobbyAsync();
    const option: Partial<AutoStartTimerOption> = {
      enabled: enabled,
      doClearHost: doClearHost,
      waitingTime: waitingTime
    }
    const astimer = new AutoStartTimer(li.lobby, option)
    return { astimer, ...li };
  }

  describe("auto start tests", function () {
    it("normal operation test", async () => {
      const { astimer, lobby, ircClient } = await prepare(true, true, 60);
      let c = 0;
      lobby.SentMessage.on(a => {
        if (c == 0) {
          assert.equal(a.message, "!mp start 60");
        } else if (c == 1) {
          assert.equal(a.message, "!mp clearhost");
        }
        c++;
      });
      await ircClient.emulateChangeMapAsync();
      assert.equal(c, 2);
    });
    it("no clearhost test", async () => {
      const { astimer, lobby, ircClient } = await prepare(true, false, 60);
      let c = 0;
      lobby.SentMessage.on(a => {
        if (c == 0) {
          assert.equal(a.message, "!mp start 60");
        }
        c++;
      });
      await ircClient.emulateChangeMapAsync();
      assert.equal(c, 1);
    });
    it("disabled test", async () => {
      const { astimer, lobby, ircClient } = await prepare(false, false, 60);
      let c = 0;
      lobby.SentMessage.on(a => {
        c++;
      });
      await ircClient.emulateChangeMapAsync();
      assert.equal(c, 0);
    });
    it("timer cancel test", async () => {
      const { astimer, lobby, ircClient } = await prepare(true, false, 60);
      let c = 0;
      lobby.SentMessage.on(a => {
        if (c == 0) {
          assert.equal(a.message, "!mp start 60");
        }
        if (c == 1) {
          assert.equal(a.message, "!mp aborttimer");
        }
        if (c == 2) {
          assert.equal(a.message, "!mp start 60");
        }
        c++;
      });
      await ircClient.emulateChangeMapAsync();
      await ircClient.emulateChangeMapAsync();
      assert.equal(c, 3);
    });
    it("timer will cancel when host changed", async() => {
      const { astimer, lobby, ircClient } = await prepare(true, true, 60);
      const players = await tu.AddPlayersAsync(5, ircClient);
      let c = 0;
      lobby.SentMessage.on(a => {
        if (c == 0) {
          assert.equal(a.message, "!mp start 60");
        }
        if (c == 1) {
          assert.equal(a.message, "!mp clearhost");
        }
        if (c == 2) {
          assert.equal(a.message, "!mp aborttimer");
        }
        if (c == 3) {
          assert.equal(a.message, "!mp start 60");
        }
        if (c == 4) {
          assert.equal(a.message, "!mp clearhost");
        }
        c++;
      });
      await ircClient.emulateChangeMapAsync();
      lobby.RaiseHostChanged(players[1]);
      await ircClient.emulateChangeMapAsync();
      assert.equal(c, 5);
    });
  });
  describe("option tests", function () {
    function assertOptions(astimer: AutoStartTimer, enabled: boolean, doClearHost: boolean, waitingTime: number): void {
      assert.equal(astimer.option.enabled, enabled);
      assert.equal(astimer.option.doClearHost, doClearHost);
      assert.equal(astimer.option.waitingTime, waitingTime);
    }

    it("option setting test", async () => {
      const { astimer, lobby, ircClient } = await prepare(true, false, 60);
      assertOptions(astimer, true, false, 60);
      const p1 = lobby.GetOrMakePlayer("p1");
      p1.setRole(Roles.Authorized);
      lobby.RaiseReceivedChatCommand(p1, "*autostart_disable");
      assertOptions(astimer, false, false, 60);
      lobby.RaiseReceivedChatCommand(p1, "*autostart_enable");
      assertOptions(astimer, true, false, 60);
      lobby.RaiseReceivedChatCommand(p1, "*autostart_clearhost_enable");
      assertOptions(astimer, true, true, 60);
      lobby.RaiseReceivedChatCommand(p1, "*atuostart_clearhost_disable");
      assertOptions(astimer, true, false, 60);
      lobby.RaiseReceivedChatCommand(p1, "*autostart_time 50");
      assertOptions(astimer, true, false, 50);
      lobby.RaiseReceivedChatCommand(p1, "*autostart_time -50");
      assertOptions(astimer, true, false, 15);
    });
  });

});