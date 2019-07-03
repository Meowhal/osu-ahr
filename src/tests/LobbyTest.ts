import * as irc from 'irc';
import { assert } from 'chai';
import { Lobby, LobbyStatus, logIrcEvent, Player, ILobby } from '../models';
import { DummyIrcClient } from '../models/dummies';
import { getIrcConfig } from "../config";
const test_on_irc = false;

export function LobbyTest() {

  interface LobbyTestBasicSet {
    ircClient: DummyIrcClient;
    lobby: Lobby;
    players: Player[];
  }

  // テスト用にロビー作成済み、プレイヤー追加済みのロビーを作成する。
  async function PrepareLobbyWith3Players(): Promise<LobbyTestBasicSet> {
    const ircClient = new DummyIrcClient("osu_irc_server", "creator");
    const lobby = new Lobby(ircClient);
    await lobby.MakeLobbyAsync("test");
    const pids = ["user1", "user2", "user3"];
    const players: Player[] = [];
    for (let p of pids) {
      await ircClient.emulateAddPlayerAsync(p);
      players.push(lobby.GetOrMakePlayer(p));
    }
    return {
      ircClient: ircClient,
      lobby: lobby,
      players: players
    };
  }

  // ロビー作成、ロビー終了テスト
  it("make&close lobby test", async () => {
    const ircClient = new DummyIrcClient("osu_irc_server", "creator");
    //logIrcEvent(ircClient);
    const lobby = new Lobby(ircClient);
    const name = "test";
    const id = await lobby.MakeLobbyAsync(name);
    assert.equal(lobby.id, id);
    assert.equal(lobby.channel, ircClient.channel);
    assert.equal(lobby.name, name);
    assert.equal(lobby.status, LobbyStatus.Entered);
    lobby.SendMessage("!mp password");
    lobby.SendMessage("!mp invite gnsksz");

    await lobby.CloseLobbyAsync();
  });

  // 名前無しロビーの作成
  it("try to make no name lobby test", async () => {
    const ircClient = new DummyIrcClient("osu_irc_server", "creator");
    const lobby = new Lobby(ircClient);
    const name = "";
    try {
      await lobby.MakeLobbyAsync(name);
      assert.fail();
    } catch (e) { }
  });

  // ロビーを二回作成
  it("make lobby twice test", async () => {
    const ircClient = new DummyIrcClient("osu_irc_server", "creator");
    const lobby = new Lobby(ircClient);
    try {
      lobby.MakeLobbyAsync("1");
      lobby.MakeLobbyAsync("2");
      assert.fail();
    } catch { }
  });

  // 無効な状態でロビーを閉じる
  it("close unopened lobby test", async () => {
    const ircClient = new DummyIrcClient("osu_irc_server", "creator");
    const lobby = new Lobby(ircClient);
    try {
      await lobby.CloseLobbyAsync();
      assert.fail();
    } catch { }
  });

  // プレイヤーの入室
  it("player join test", async () => {
    const ircClient = new DummyIrcClient("osu_irc_server", "creator");
    //logIrcEvent(ircClient);
    const lobby = new Lobby(ircClient);
    await lobby.MakeLobbyAsync("test");

    // プレイヤー追加
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
    for (let p of players) {
      await ircClient.emulateAddPlayerAsync(p);
    }
    await jp;

    // 参加人数を調べる
    assert.equal(players.length, lobby.players.size);

    // 参加者が一致しているか調べる
    for (let p of lobby.players) {
      assert.isTrue(players.includes(p.id));
    }
  });

  // プレイヤーの退出　一人
  it("player left test", async () => {
    const { ircClient, lobby, players } = await PrepareLobbyWith3Players();

    // 一人だけ退出
    const leftindex = 1;
    const lp = new Promise<void>(resolve => {
      lobby.on("PlayerLeft", player => {
        assert.equal(player, players[leftindex]);
        resolve();
      });
    });
    await ircClient.emulateRemovePlayerAsync(players[leftindex].id);
    await lp;

    // 参加人数を調べる
    assert.equal(lobby.players.size, players.length - 1);
    // 退出した人が含まれていないか調べる
    assert.isFalse(lobby.players.has(players[leftindex]));
  });

  // 入退出
  it("player join&left test", async () => {
    const ircClient = new DummyIrcClient("osu_irc_server", "creator");
    //logIrcEvent(ircClient);
    const lobby = new Lobby(ircClient);
    await lobby.MakeLobbyAsync("test");
    const players = ["user1", "user 2", "user_3"];

    await ircClient.emulateAddPlayerAsync(players[0]);
    assert.isTrue(lobby.Includes(players[0]));
    await ircClient.emulateRemovePlayerAsync(players[0]);
    assert.isFalse(lobby.Includes(players[0]));

    await ircClient.emulateAddPlayerAsync(players[0]);
    await ircClient.emulateAddPlayerAsync(players[1]);
    await ircClient.emulateAddPlayerAsync(players[2]);
    await ircClient.emulateRemovePlayerAsync(players[1]);
    assert.isTrue(lobby.Includes(players[0]));
    assert.isFalse(lobby.Includes(players[1]));
    assert.isTrue(lobby.Includes(players[2]));
  });

  // 想定外の入室/退室
  it("unexpected join and left test", async () => {
    const ircClient = new DummyIrcClient("osu_irc_server", "creator");
    const lobby = new Lobby(ircClient);
    await lobby.MakeLobbyAsync("test");

    let f = 0;
    lobby.on("UnexpectedAction", (err) => {
      f = f + 1;
    });
    await ircClient.emulateRemovePlayerAsync("unknown player");
    assert.equal(f, 1);

    f = 0;
    ircClient.emulateAddPlayerAsync("tom");
    ircClient.emulateAddPlayerAsync("jim");
    ircClient.emulateAddPlayerAsync("tom");
    assert.equal(f, 1);
  });

  it("host change test", async () => {
    const { ircClient, lobby, players } = await PrepareLobbyWith3Players();
    const getNewHostAsync = async () => {
      return new Promise<Player>(resolve => {
        lobby.once("HostChanged", player => {
          resolve(player);
        });
      });
    }
    let nexthost = players[0];
    let task = getNewHostAsync();
    lobby.TransferHost(nexthost);
    let host = await task;
    assert.equal(host, nexthost);
    nexthost = players[1];
    task = getNewHostAsync();
    lobby.TransferHost(nexthost);
    host = await task;
    assert.equal(host, nexthost);
  });

  it("match start test", async () => {
    const { ircClient, lobby, players } = await PrepareLobbyWith3Players();
    //logIrcEvent(ircClient);
    let ms = false;
    let mf = false;
    const finishedplayers = new Set<Player>();

    lobby.on("MatchStarted", () => {
      ms = true;
      assert.isFalse(mf);
    });
    lobby.on("PlayerFinished", (player: Player, score: number, isPassed: boolean) => {
      assert.isFalse(finishedplayers.has(player));
      finishedplayers.add(player);
      assert.isTrue(ms);
      assert.isFalse(mf);
    });
    lobby.on("MatchFinished", () => {
      mf = true;
      assert.isTrue(ms);
      assert.equal(finishedplayers.size, players.length);
      for(let p of players) {
        assert.isTrue(finishedplayers.has(p));
      }
    });
    await ircClient.emulateMatchAsync(0);
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