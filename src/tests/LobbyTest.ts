
import { assert } from 'chai';
import { Lobby, LobbyStatus, logIrcEvent, Player} from '../models';
import { DummyIrcClient, DummyLobbyPlugin } from '../models/dummies';

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
  
  function delay(ms: number): Promise<void> {
    if (ms == 0) return Promise.resolve();
    return new Promise(resolve => setTimeout(resolve, ms));
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
      lobby.PlayerJoined.on(({ player, slot }) => {
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
      lobby.PlayerLeft.on(player => {
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
    lobby.UnexpectedAction.on(err => {
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
        lobby.HostChanged.once(({ succeeded, player }) => {
          resolve(player);
        });
      });
    }
    let nexthost = players[0];
    let task = getNewHostAsync();
    lobby.TransferHost(nexthost);
    let host = await task;
    assert.equal(host, nexthost);
    assert.equal(lobby.hostPending, null);
    nexthost = players[1];
    task = getNewHostAsync();
    lobby.TransferHost(nexthost);
    host = await task;
    assert.equal(host, nexthost);
    assert.equal(lobby.hostPending, null);
  });

  // ホスト任命後に離脱した場合
  it("host change & left test", async () => {
    const { ircClient, lobby, players } = await PrepareLobbyWith3Players();
    const getNewHostAsync = async () => {
      return new Promise<Player>(resolve => {
        lobby.HostChanged.once(({ succeeded, player }) => {
          assert.isFalse(succeeded);
          resolve(player);
        });
      });
    }
    //logIrcEvent(ircClient);
    let nexthost = players[0];
    let taskHost = getNewHostAsync();
    let taskLeft = ircClient.emulateRemovePlayerAsync(nexthost.id);
    lobby.TransferHost(nexthost);
    let host = await taskHost;
    await taskLeft;
    assert.equal(host, nexthost);
  });

  // 試合テスト
  it("match start test", async () => {
    const { ircClient, lobby, players } = await PrepareLobbyWith3Players();
    //logIrcEvent(ircClient);
    let ms = false;
    let mf = false;
    const finishedplayers = new Set<Player>();

    lobby.MatchStarted.on(() => {
      ms = true;
      assert.isFalse(mf);
    });
    lobby.PlayerFinished.on(({ player, score, isPassed }) => {
      assert.isFalse(finishedplayers.has(player));
      finishedplayers.add(player);
      assert.isTrue(ms);
      assert.isFalse(mf);
    });
    lobby.MatchFinished.on(() => {
      mf = true;
      assert.isTrue(ms);
      assert.equal(finishedplayers.size, players.length);
      for (let p of players) {
        assert.isTrue(finishedplayers.has(p));
      }
    });
    await ircClient.emulateMatchAsync(0);
  });

  // 試合中の退出テスト
  it("match and left test", async () => {
    const { ircClient, lobby, players } = await PrepareLobbyWith3Players();
    //logIrcEvent(ircClient);
    let ms = false;
    let mf = false;
    const finishedplayers = new Set<Player>();
    const leftplayerindex = 1;

    lobby.MatchStarted.on(() => {
      ms = true;
      assert.isFalse(mf);
    });
    lobby.PlayerFinished.on(({ player, score, isPassed }) => {
      assert.isFalse(finishedplayers.has(player));
      finishedplayers.add(player);
      assert.isTrue(ms);
      assert.isFalse(mf);
    });
    lobby.MatchFinished.on(() => {
      mf = true;
      assert.isTrue(ms);
      assert.equal(finishedplayers.size, players.length - 1);
      assert.isFalse(finishedplayers.has(players[leftplayerindex]));
    });
    const p = ircClient.emulateMatchAsync(10);
    await ircClient.emulateRemovePlayerAsync(players[leftplayerindex].id);
    await p;
  });

  // 試合中断テスト
  it("match and abort test", async () => {
    const { ircClient, lobby, players } = await PrepareLobbyWith3Players();
    //logIrcEvent(ircClient);
    let ms = false;
    let ma = false;

    lobby.MatchStarted.on(() => {
      ms = true;
      assert.isFalse(ma);
    });
    lobby.PlayerFinished.on(({ player, score, isPassed }) => {
      assert.fail();
    });
    lobby.MatchFinished.on(() => {
      assert.fail();
    });
    lobby.AbortedMatch.on(() => {
      ma = true;
      assert.isTrue(ms);
    });

    const p = ircClient.emulateMatchAsync(10);
    await lobby.AbortMatch();
    await p;
    assert.isTrue(ms);
    assert.isTrue(ma);
  });

  it("plugin test", async () => {
    const { ircClient, lobby, players } = await PrepareLobbyWith3Players();
    const lp = new DummyLobbyPlugin(lobby);
    lobby.logLobbyStatus();
  });
}; 