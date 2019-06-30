import * as irc from 'irc';
import ircConfig from "../password";
import { assert } from 'chai';
import { Lobby } from '../Lobby';
import { LobbyStatus } from '../ILobby';
import { DummyIrcClient } from './DummyIrcClient';
import { logIrcEvent } from "../IIrcClient";

const test_on_irc = false;

export function LobbyTest() {
  it("make lobby test on dummy", async () => {
    const ircClient = new DummyIrcClient("osu_irc_server", "creator");
    logIrcEvent(ircClient);
    const lobby = new Lobby(ircClient);
    const name = "test";
    const id = await lobby.MakeLobbyAsync(name);
    assert.equal(lobby.id, id);
    assert.equal(lobby.name, name);
    assert.equal(lobby.status, LobbyStatus.Entered);
    lobby.SendMessage("!mp password");
    lobby.SendMessage("!mp invite gnsksz");
  });

  if (test_on_irc) {
    it("make lobby test on irc", async () => {
      const ircClient = new irc.Client(ircConfig.server, ircConfig.nick, {
        debug: false,
        port: ircConfig.port,
        password: ircConfig.password,
      });
      logIrcEvent(ircClient);
      const lobby = new Lobby(ircClient);
      const name = "test";
      const id = await lobby.MakeLobbyAsync(name);
      assert.equal(lobby.id, id);
      assert.equal(lobby.name, name);
      assert.equal(lobby.status, LobbyStatus.Entered);
      lobby.SendMessage("!mp password");
      lobby.SendMessage("!mp invite gnsksz");
    });
  }

  /*
    it("make lobby network error test", async () => {
      const lobby = new DummyLobby();
      lobby.networkFailureFlag = true;
      try {
        await lobby.MakeLobbyAsync("test");
        assert.fail();
      } catch (e) {
        console.log(e);
      }
    });
  
    it("change host test", (done) => {
      const lobby = new DummyLobby();
      const userid = "testuser";
  
      lobby.on("HostChanged", (uid: string) => {
        assert.equal(uid, userid);
        done();
      });
  
      lobby.MakeLobbyAsync("test").then(() => {
        lobby.SendMpHost(userid);
      });
    });
  
    it("change host serial test", (done) => {
      const lobby = new DummyLobby();
      const len = 10;
      const users: string[] = [];
      const users_check: { [index: string]: boolean } = {};
      for (let i = 0; i < len; i++) {
        users[i] = "user_" + i;
        users_check[users[i]] = false;
      }
  
      let count = 0;
      lobby.on("HostChanged", (uid: string) => {
        assert.isTrue(uid in users_check);
        users_check[uid] = true;
        count++;
        if (count < users.length) {
          lobby.SendMpHost(users[count]);
        } else {
          assert.isTrue(users.every(u => users_check[u]));
          done();
        }
      });
  
      lobby.MakeLobbyAsync("test").then(() => {
        lobby.SendMpHost(users[0]);
      });
    });*/
}; 