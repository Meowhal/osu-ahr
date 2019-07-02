import * as irc from 'irc';
import { assert } from 'chai';
import { Lobby, LobbyStatus, logIrcEvent, Player } from '../models';
import { DummyIrcClient } from '../models/dummies';
import { getIrcConfig } from "../config";
const test_on_irc = false;

export function LobbyTest() {
  it("make lobby test", async () => {
    const ircClient = new DummyIrcClient("osu_irc_server", "creator");
    logIrcEvent(ircClient);
    const lobby = new Lobby(ircClient);
    const name = "test";
    const id = await lobby.MakeLobbyAsync(name);
    assert.equal(lobby.id, id);
    assert.equal(lobby.channel, ircClient.channel);
    assert.equal(lobby.name, name);
    assert.equal(lobby.status, LobbyStatus.Entered);
    lobby.SendMessage("!mp password");
    lobby.SendMessage("!mp invite gnsksz");
  });

  it("player join test", async () => {
    const ircClient = new DummyIrcClient("osu_irc_server", "creator");
    logIrcEvent(ircClient);
    const lobby = new Lobby(ircClient);
    await lobby.MakeLobbyAsync("test");

    const players = ["user1", "user 2", "user_3"];
    const joiningPlayers: Set<string> = new Set<string>(players);
    const jp = new Promise<void>(resolve => {
      lobby.on("PlayerJoined", (player: Player, slot: number) => {
        assert.isTrue(joiningPlayers.has(player.id));
        joiningPlayers.delete(player.id);
        if (joiningPlayers.size == 0) {
          resolve();
        }
      });
    });

    for(let p of players) {
      await ircClient.emulateAddPlayerAsync(p);
    }

    await jp;
    assert.equal(players.length, lobby.players.size);
    for(let p of lobby.players) {
      assert.isTrue(players.includes(p.id));
    }
  });

  if (test_on_irc) {
    it("make lobby test on irc", async () => {
      const c = getIrcConfig();
      const ircClient = new irc.Client(c.server, c.nick, c.opt);
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