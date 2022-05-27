"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const chai_1 = require("chai");
const Lobby_1 = require("../Lobby");
const Player_1 = require("../Player");
const DummyIrcClient_1 = require("../dummies/DummyIrcClient");
const DummyLobbyPlugin_1 = require("../dummies/DummyLobbyPlugin");
const StatParser_1 = require("../parsers/StatParser");
const MpSettingsCases_1 = require("./cases/MpSettingsCases");
const TestUtils_1 = __importDefault(require("./TestUtils"));
describe('LobbyTest', function () {
    before(function () {
        TestUtils_1.default.configMochaAsSilent();
    });
    // テスト用にロビー作成済み、プレイヤー追加済みのロビーを作成する。
    async function PrepareLobbyWith3Players() {
        const ircClient = new DummyIrcClient_1.DummyIrcClient('osu_irc_server', 'creator');
        const lobby = new Lobby_1.Lobby(ircClient);
        await lobby.MakeLobbyAsync('test');
        const pids = ['user1', 'user2', 'user3'];
        const players = [];
        for (const p of pids) {
            await ircClient.emulateAddPlayerAsync(p);
            players.push(lobby.GetOrMakePlayer(p));
        }
        return {
            ircClient: ircClient,
            lobby: lobby,
            players: players
        };
    }
    describe('lobby management tests', function () {
        // ロビー作成、ロビー終了テスト
        it('make&close lobby test', async () => {
            const ircClient = new DummyIrcClient_1.DummyIrcClient('osu_irc_server', 'creator');
            //logIrcEvent(ircClient);
            const lobby = new Lobby_1.Lobby(ircClient);
            const name = 'test';
            const id = await lobby.MakeLobbyAsync(name);
            chai_1.assert.equal(lobby.lobbyId, id);
            chai_1.assert.equal(lobby.channel, ircClient.channel);
            chai_1.assert.equal(lobby.lobbyName, name);
            chai_1.assert.equal(lobby.status, Lobby_1.LobbyStatus.Entered);
            lobby.SendMessage('!mp password');
            lobby.SendMessage('!mp invite gnsksz');
            await lobby.CloseLobbyAsync();
        });
        // 名前無しロビーの作成
        it('try to make no name lobby test', async () => {
            const ircClient = new DummyIrcClient_1.DummyIrcClient('osu_irc_server', 'creator');
            const lobby = new Lobby_1.Lobby(ircClient);
            const name = '';
            try {
                await lobby.MakeLobbyAsync(name);
                chai_1.assert.fail();
            }
            catch (e) {
                chai_1.assert.equal(e.message, 'title is empty');
            }
        });
        // ロビーを二回作成
        it('make lobby twice test', async () => {
            const ircClient = new DummyIrcClient_1.DummyIrcClient('osu_irc_server', 'creator');
            const lobby = new Lobby_1.Lobby(ircClient);
            try {
                lobby.MakeLobbyAsync('1');
                lobby.MakeLobbyAsync('2');
                chai_1.assert.fail();
            }
            catch (e) {
                chai_1.assert.equal(e.message, 'A lobby has already been made.');
            }
        });
        // 無効な状態でロビーを閉じる
        it('close unopened lobby test', async () => {
            const ircClient = new DummyIrcClient_1.DummyIrcClient('osu_irc_server', 'creator');
            const lobby = new Lobby_1.Lobby(ircClient);
            try {
                await lobby.CloseLobbyAsync();
                chai_1.assert.fail();
            }
            catch (e) {
                chai_1.assert.equal(e.message, 'No lobby to close.');
            }
        });
    });
    describe('join left tests', function () {
        // プレイヤーの入室
        it('player join test', async () => {
            const ircClient = new DummyIrcClient_1.DummyIrcClient('osu_irc_server', 'creator');
            //logIrcEvent(ircClient);
            const lobby = new Lobby_1.Lobby(ircClient);
            await lobby.MakeLobbyAsync('test');
            // プレイヤー追加
            const players = ['user1', 'user 2', 'user_3'];
            const joiningPlayers = new Set(players);
            const jp = new Promise(resolve => {
                lobby.PlayerJoined.on(({ player, slot }) => {
                    chai_1.assert.isTrue(joiningPlayers.has(player.name));
                    joiningPlayers.delete(player.name);
                    if (joiningPlayers.size === 0) {
                        resolve();
                    }
                });
            });
            for (const p of players) {
                await ircClient.emulateAddPlayerAsync(p);
            }
            await jp;
            // 参加人数を調べる
            chai_1.assert.equal(players.length, lobby.players.size);
            for (const p of lobby.players) {
                // 参加者が一致しているか調べる
                chai_1.assert.isTrue(players.includes(p.name));
                // プレイヤーの状態をチェック
                chai_1.assert.equal(p.role, Player_1.Roles.Player);
                chai_1.assert.isFalse(p.isAuthorized);
                chai_1.assert.isFalse(p.isCreator);
                chai_1.assert.isFalse(p.isHost);
                chai_1.assert.isFalse(p.isReferee);
                chai_1.assert.equal(p.mpstatus, Player_1.MpStatuses.InLobby);
                chai_1.assert.equal(p.team, Player_1.Teams.None);
            }
        });
        // プレイヤーの退出 一人
        it('player left test', async () => {
            const { ircClient, lobby, players } = await PrepareLobbyWith3Players();
            // 一人だけ退出
            const leftindex = 1;
            const lp = new Promise(resolve => {
                lobby.PlayerLeft.on(a => {
                    chai_1.assert.equal(a.player, players[leftindex]);
                    resolve();
                });
            });
            await ircClient.emulateRemovePlayerAsync(players[leftindex].name);
            await lp;
            // 参加人数を調べる
            chai_1.assert.equal(lobby.players.size, players.length - 1);
            // 退出した人が含まれていないか調べる
            chai_1.assert.isFalse(lobby.players.has(players[leftindex]));
        });
        // 入退出
        it('player join&left test', async () => {
            const ircClient = new DummyIrcClient_1.DummyIrcClient('osu_irc_server', 'creator');
            //logIrcEvent(ircClient);
            const lobby = new Lobby_1.Lobby(ircClient);
            await lobby.MakeLobbyAsync('test');
            const players = ['user1', 'user 2', 'user_3'];
            await ircClient.emulateAddPlayerAsync(players[0]);
            chai_1.assert.isTrue(lobby.Includes(players[0]));
            await ircClient.emulateRemovePlayerAsync(players[0]);
            chai_1.assert.isFalse(lobby.Includes(players[0]));
            await ircClient.emulateAddPlayerAsync(players[0]);
            await ircClient.emulateAddPlayerAsync(players[1]);
            await ircClient.emulateAddPlayerAsync(players[2]);
            await ircClient.emulateRemovePlayerAsync(players[1]);
            chai_1.assert.isTrue(lobby.Includes(players[0]));
            chai_1.assert.isFalse(lobby.Includes(players[1]));
            chai_1.assert.isTrue(lobby.Includes(players[2]));
        });
        // 想定外の入室/退室
        it('unexpected join and left test', async () => {
            const ircClient = new DummyIrcClient_1.DummyIrcClient('osu_irc_server', 'creator');
            const lobby = new Lobby_1.Lobby(ircClient);
            await lobby.MakeLobbyAsync('test');
            let f = 0;
            lobby.UnexpectedAction.on(err => {
                f = f + 1;
            });
            await ircClient.emulateRemovePlayerAsync('unknown player');
            chai_1.assert.equal(f, 1);
            f = 0;
            ircClient.emulateAddPlayerAsync('tom');
            ircClient.emulateAddPlayerAsync('jim');
            ircClient.emulateAddPlayerAsync('tom');
            chai_1.assert.equal(f, 1);
        });
        it('host change test', async () => {
            const { ircClient, lobby, players } = await PrepareLobbyWith3Players();
            const assertHost = async (next) => {
                return new Promise(resolve => {
                    lobby.HostChanged.once(({ player }) => {
                        chai_1.assert.equal(player, next);
                        TestUtils_1.default.assertHost(next.name, lobby);
                        chai_1.assert.equal(lobby.hostPending, null);
                        resolve(player);
                    });
                });
            };
            let nexthost = players[0];
            let task = assertHost(nexthost);
            lobby.TransferHost(nexthost);
            await task;
            nexthost = players[1];
            task = assertHost(nexthost);
            lobby.TransferHost(nexthost);
            await task;
        });
        // ホスト任命後に離脱した場合
        it('host change & left test', async () => {
            const { ircClient, lobby, players } = await PrepareLobbyWith3Players();
            const tr = TestUtils_1.default.assertEventNeverFire(lobby.HostChanged, null, 10);
            //logIrcEvent(ircClient);
            const nexthost = players[0];
            const taskLeft = ircClient.emulateRemovePlayerAsync(nexthost.name);
            lobby.TransferHost(nexthost);
            await taskLeft;
            await tr;
        });
    });
    describe('match tests', function () {
        // 試合テスト
        it('match start test', async () => {
            const { ircClient, lobby, players } = await PrepareLobbyWith3Players();
            //logIrcEvent(ircClient);
            let ms = false;
            let mf = false;
            const finishedplayers = new Set();
            lobby.MatchStarted.on(() => {
                ms = true;
                chai_1.assert.isFalse(mf);
            });
            lobby.PlayerFinished.on(({ player, score, isPassed }) => {
                chai_1.assert.isFalse(finishedplayers.has(player));
                finishedplayers.add(player);
                chai_1.assert.isTrue(ms);
                chai_1.assert.isFalse(mf);
            });
            lobby.MatchFinished.on(() => {
                mf = true;
                chai_1.assert.isTrue(ms);
                chai_1.assert.equal(finishedplayers.size, players.length);
                for (const p of players) {
                    chai_1.assert.isTrue(finishedplayers.has(p));
                }
            });
            await ircClient.emulateMatchAsync(0);
        });
        // 試合中の退出テスト
        it('match and left test', async () => {
            const { ircClient, lobby, players } = await PrepareLobbyWith3Players();
            //logIrcEvent(ircClient);
            let ms = false;
            let mf = false;
            const finishedplayers = new Set();
            const leftplayerindex = 1;
            lobby.MatchStarted.on(() => {
                ms = true;
                chai_1.assert.isFalse(mf);
            });
            lobby.PlayerFinished.on(({ player, score, isPassed }) => {
                chai_1.assert.isFalse(finishedplayers.has(player));
                finishedplayers.add(player);
                chai_1.assert.isTrue(ms);
                chai_1.assert.isFalse(mf);
            });
            lobby.MatchFinished.on(() => {
                mf = true;
                chai_1.assert.isTrue(ms);
                chai_1.assert.equal(finishedplayers.size, players.length - 1);
                chai_1.assert.isFalse(finishedplayers.has(players[leftplayerindex]));
            });
            const p = ircClient.emulateMatchAsync(10);
            await ircClient.emulateRemovePlayerAsync(players[leftplayerindex].name);
            await p;
        });
        // 試合中断テスト
        it('match and abort test', async () => {
            const { ircClient, lobby, players } = await PrepareLobbyWith3Players();
            //logIrcEvent(ircClient);
            let ms = false;
            let ma = false;
            lobby.MatchStarted.on(() => {
                ms = true;
                chai_1.assert.isFalse(ma);
            });
            lobby.PlayerFinished.on(({ player, score, isPassed }) => {
                chai_1.assert.fail();
            });
            lobby.MatchFinished.on(() => {
                chai_1.assert.fail();
            });
            lobby.AbortedMatch.on(() => {
                ma = true;
                chai_1.assert.isTrue(ms);
            });
            const p = ircClient.emulateMatchAsync(10);
            lobby.AbortMatch();
            await p;
            chai_1.assert.isTrue(ms);
            chai_1.assert.isTrue(ma);
        });
        it('match aborted before some players finished', async () => {
            const { ircClient, lobby, players } = await PrepareLobbyWith3Players();
            let ma = false;
            lobby.AbortedMatch.on((a) => {
                ma = true;
                chai_1.assert.equal(a.playersFinished, 0);
                chai_1.assert.equal(a.playersInGame, 3);
            });
            const p = ircClient.emulateMatchAsync(10);
            lobby.AbortMatch();
            await p;
            chai_1.assert.isTrue(ma);
        });
        it('match aborted after some players left', async () => {
            const { ircClient, lobby, players } = await PrepareLobbyWith3Players();
            let ma = false;
            lobby.AbortedMatch.on((a) => {
                ma = true;
                chai_1.assert.equal(a.playersFinished, 0);
                chai_1.assert.equal(a.playersInGame, 2);
            });
            const p = ircClient.emulateMatchAsync(10);
            await ircClient.emulateRemovePlayerAsync('user1');
            lobby.AbortMatch();
            await p;
            chai_1.assert.isTrue(ma);
        });
        it('match aborted after some players finished', async () => {
            const { ircClient, lobby, players } = await PrepareLobbyWith3Players();
            let ma = false;
            lobby.AbortedMatch.on((a) => {
                ma = true;
                chai_1.assert.equal(a.playersFinished, 1);
                chai_1.assert.equal(a.playersInGame, 3);
            });
            const p = ircClient.emulateMatchAsync(10);
            await ircClient.emulatePlayerFinishAsync('user1');
            lobby.AbortMatch();
            await p;
            chai_1.assert.isTrue(ma);
        });
        it('match aborted after some players left and remainders finished', async () => {
            const { ircClient, lobby, players } = await PrepareLobbyWith3Players();
            let ma = false;
            lobby.AbortedMatch.on((a) => {
                ma = true;
                chai_1.assert.equal(a.playersFinished, 2);
                chai_1.assert.equal(a.playersInGame, 2);
            });
            const p = ircClient.emulateMatchAsync(10);
            await ircClient.emulatePlayerFinishAsync('user1');
            await ircClient.emulateRemovePlayerAsync('user2');
            await ircClient.emulatePlayerFinishAsync('user3');
            lobby.AbortMatch();
            await p;
            chai_1.assert.isTrue(ma);
        });
        it('player statuses count test', async () => {
            function assertPc(lobby, total, inLobby, playing) {
                const pc = lobby.CountPlayersStatus();
                chai_1.assert.equal(pc.inlobby, inLobby);
                chai_1.assert.equal(pc.inGame, total - inLobby);
                chai_1.assert.equal(pc.playing, playing);
                chai_1.assert.equal(pc.finished, total - inLobby - playing);
                chai_1.assert.equal(pc.total, total);
                chai_1.assert.equal(lobby.playersFinished, total - inLobby - playing);
                chai_1.assert.equal(lobby.playersInGame, total - inLobby);
            }
            const { lobby, ircClient } = await TestUtils_1.default.SetupLobbyAsync();
            const players = await TestUtils_1.default.AddPlayersAsync(5, ircClient);
            lobby.RaiseHostChanged(players[0]);
            assertPc(lobby, 5, 5, 0);
            await ircClient.emulateRemovePlayerAsync(players[4]);
            assertPc(lobby, 4, 4, 0);
            const mt = ircClient.emulateMatchAsync(10);
            await TestUtils_1.default.AddPlayersAsync(1, ircClient);
            assertPc(lobby, 5, 1, 4);
            await ircClient.emulateRemovePlayerAsync(players[3]);
            assertPc(lobby, 4, 1, 3);
            ircClient.emulatePlayerFinishAsync(players[0]);
            assertPc(lobby, 4, 1, 2);
            await mt;
            assertPc(lobby, 4, 4, 0);
        });
    });
    describe('message handling tests', function () {
        it('send message test', async () => {
            const { ircClient, lobby, players } = await PrepareLobbyWith3Players();
            let ma = false;
            const msg = 'hello world';
            lobby.SentMessage.once(({ message }) => {
                chai_1.assert.equal(message, msg);
                ma = true;
            });
            lobby.SendMessage(msg);
            await TestUtils_1.default.delayAsync(10);
            chai_1.assert.isTrue(ma);
        });
        it('SendMessageWithCoolTime test', async () => {
            const { ircClient, lobby, players } = await PrepareLobbyWith3Players();
            let ma = 0;
            const msg = 'hello world';
            lobby.SentMessage.on(({ message }) => {
                chai_1.assert.equal(message, msg);
                ma = ma + 1;
            });
            chai_1.assert.isTrue(lobby.SendMessageWithCoolTime(msg, 'tag', 10));
            chai_1.assert.equal(ma, 1);
            chai_1.assert.isFalse(lobby.SendMessageWithCoolTime(msg, 'tag', 10));
            chai_1.assert.equal(ma, 1);
            await TestUtils_1.default.delayAsync(15);
            chai_1.assert.isTrue(lobby.SendMessageWithCoolTime(msg, 'tag', 10));
            chai_1.assert.equal(ma, 2);
            chai_1.assert.isTrue(lobby.SendMessageWithCoolTime(msg, 'tag2', 10));
            chai_1.assert.equal(ma, 3);
            chai_1.assert.isFalse(lobby.SendMessageWithCoolTime(msg, 'tag2', 10));
            chai_1.assert.equal(ma, 3);
        });
        it('SendMessageWithCoolTime function type message', async () => {
            const { ircClient, lobby, players } = await PrepareLobbyWith3Players();
            let mf = false;
            const msg = () => {
                return 'abc';
            };
            lobby.SentMessage.on(({ message }) => {
                chai_1.assert.equal(message, msg());
                mf = true;
            });
            chai_1.assert.isTrue(lobby.SendMessageWithCoolTime(msg, 'tag', 10));
            await TestUtils_1.default.delayAsync(10);
            chai_1.assert.isTrue(mf);
        });
        it('PlayerChated event', (done) => {
            PrepareLobbyWith3Players().then(({ ircClient, lobby, players }) => {
                const msg = 'hello world';
                const mf = false;
                lobby.PlayerChated.once(a => {
                    chai_1.assert.equal(a.player, players[0]);
                    chai_1.assert.equal(a.message, msg);
                    done();
                });
                lobby.ReceivedBanchoResponse.once(a => {
                    chai_1.assert.fail();
                });
                lobby.ReceivedChatCommand.once(a => {
                    chai_1.assert.fail();
                });
                ircClient.emulateChatAsync(players[0].name, msg);
            });
        });
        it('BanchoChated event', done => {
            PrepareLobbyWith3Players().then(({ ircClient, lobby, players }) => {
                const msg = 'hello world';
                const mf = false;
                lobby.PlayerChated.once(a => {
                    chai_1.assert.fail();
                });
                lobby.ReceivedBanchoResponse.once(a => {
                    chai_1.assert.equal(a.message, msg);
                    done();
                });
                lobby.ReceivedChatCommand.once(a => {
                    chai_1.assert.fail();
                });
                ircClient.emulateBanchoResponse(msg);
            });
        });
        it('ReceivedChatCommand', async () => {
            const { ircClient, lobby, players } = await PrepareLobbyWith3Players();
            let ma = 0;
            const msg = '!hello world';
            lobby.PlayerChated.once(a => {
                chai_1.assert.equal(a.message, msg);
            });
            lobby.ReceivedBanchoResponse.once(a => {
                chai_1.assert.fail();
            });
            lobby.ReceivedChatCommand.once(a => {
                chai_1.assert.isFalse(a.player.isHost);
                chai_1.assert.equal(a.command, '!hello');
                chai_1.assert.equal(a.param, 'world');
                chai_1.assert.equal(a.player, players[0]);
                ma = 1;
            });
            ircClient.emulateChatAsync(players[0].name, msg);
            await TestUtils_1.default.delayAsync(5);
            chai_1.assert.equal(ma, 1);
        });
        it('ReceivedChatCommand', async () => {
            const { ircClient, lobby, players } = await PrepareLobbyWith3Players();
            let ma = 0;
            lobby.TransferHost(players[0]);
            const msg = '!hoge piyo';
            lobby.PlayerChated.once(a => {
                chai_1.assert.equal(a.message, msg);
            });
            lobby.ReceivedChatCommand.once(a => {
                chai_1.assert.isTrue(a.player.isHost);
                chai_1.assert.equal(a.command, '!hoge');
                chai_1.assert.equal(a.param, 'piyo');
                chai_1.assert.equal(a.player, players[0]);
                ma = 1;
            });
            ircClient.emulateChatAsync(players[0].name, msg);
            await TestUtils_1.default.delayAsync(5);
            chai_1.assert.equal(ma, 1);
        });
    });
    describe('message tests', function () {
        it.skip('showInfoMessage test', async () => {
            const { ircClient, lobby, players } = await PrepareLobbyWith3Players();
            TestUtils_1.default.configMochaVerbosely();
            lobby.RaiseReceivedChatCommand(lobby.GetOrMakePlayer('tester'), '!info');
        });
        it.skip('SendMessageWithDelayAsync test', async () => {
            const { ircClient, lobby, players } = await PrepareLobbyWith3Players();
            TestUtils_1.default.configMochaVerbosely();
            lobby.SendMessage('hello');
            lobby.SendMessageWithDelayAsync('world', 1000);
        });
        it.skip('SendMultilineMessageWithInterval test', async () => {
            const { ircClient, lobby, players } = await PrepareLobbyWith3Players();
            TestUtils_1.default.configMochaVerbosely();
            lobby.SendMultilineMessageWithInterval(['a', 'b', 'c', 'd'], 1000, 'a', 100);
            lobby.SendMultilineMessageWithInterval(['e', 'f', 'g', 'h'], 1000, 'a', 100);
        });
        it.skip('DeferMessage test', async () => {
            const { ircClient, lobby, players } = await PrepareLobbyWith3Players();
            TestUtils_1.default.configMochaVerbosely();
            lobby.DeferMessage('a', 'abc', 10, false);
            await TestUtils_1.default.delayAsync(20);
            lobby.DeferMessage('b', 'abc', 10, false);
            await TestUtils_1.default.delayAsync(5);
            lobby.DeferMessage('c', 'abc', 10, false);
            await TestUtils_1.default.delayAsync(5);
            lobby.DeferMessage('d', 'abc', 10, false);
            await TestUtils_1.default.delayAsync(5);
            lobby.DeferMessage('e', 'abc', 10, false);
            await TestUtils_1.default.delayAsync(20);
            lobby.DeferMessage('xa', 'abc', 10, true);
            await TestUtils_1.default.delayAsync(20);
            lobby.DeferMessage('xb', 'abc', 10, true);
            await TestUtils_1.default.delayAsync(5);
            lobby.DeferMessage('xc', 'abc', 10, true);
            await TestUtils_1.default.delayAsync(5);
            lobby.DeferMessage('xd', 'abc', 10, true);
            await TestUtils_1.default.delayAsync(5);
            lobby.DeferMessage('xe', 'abc', 10, true);
            await TestUtils_1.default.delayAsync(20);
        });
    });
    describe('mp settings load tests', function () {
        it('empty lobby', async () => {
            const { lobby, ircClient } = await TestUtils_1.default.SetupLobbyAsync();
            const c1 = MpSettingsCases_1.MpSettingsCases.case1_1;
            await ircClient.emulateChatAsync(ircClient.nick, '!mp settings');
            c1.texts.forEach(t => ircClient.emulateBanchoResponse(t));
            TestUtils_1.default.assertMpSettingsResult(lobby, c1.result);
        });
        it('change host', async () => {
            const { lobby, ircClient } = await TestUtils_1.default.SetupLobbyAsync();
            const c1_1 = MpSettingsCases_1.MpSettingsCases.case1_1;
            const c1_2 = MpSettingsCases_1.MpSettingsCases.case1_2;
            await ircClient.emulateChatAsync(ircClient.nick, '!mp settings');
            c1_1.texts.forEach(t => ircClient.emulateBanchoResponse(t));
            TestUtils_1.default.assertMpSettingsResult(lobby, c1_1.result);
            c1_2.texts.forEach(t => ircClient.emulateBanchoResponse(t));
            TestUtils_1.default.assertMpSettingsResult(lobby, c1_2.result);
        });
        it('resore', async () => {
            const { lobby, ircClient } = await TestUtils_1.default.SetupLobbyAsync();
            const c1_1 = MpSettingsCases_1.MpSettingsCases.case1_1;
            const c1_2 = MpSettingsCases_1.MpSettingsCases.case1_2;
            await ircClient.emulateChatAsync(ircClient.nick, '!mp settings');
            c1_1.texts.forEach(t => ircClient.emulateBanchoResponse(t));
            TestUtils_1.default.assertMpSettingsResult(lobby, c1_1.result);
            await ircClient.emulateRemovePlayerAsync('p1');
            await ircClient.emulateRemovePlayerAsync('p2');
            await ircClient.emulateRemovePlayerAsync('p3');
            await ircClient.emulateAddPlayerAsync('p6');
            await ircClient.emulateAddPlayerAsync('p7');
            await ircClient.emulateAddPlayerAsync('p8');
            c1_2.texts.forEach(t => ircClient.emulateBanchoResponse(t));
            TestUtils_1.default.assertMpSettingsResult(lobby, c1_2.result);
        });
    });
    describe('stat tests', function () {
        it('send stat', async () => {
            const { lobby, ircClient } = await TestUtils_1.default.SetupLobbyAsync();
            await TestUtils_1.default.AddPlayersAsync([ircClient.nick], ircClient);
            const players = await TestUtils_1.default.AddPlayersAsync(5, ircClient);
            const t = TestUtils_1.default.assertEventFire(lobby.ParsedStat, null, 10);
            ircClient.SetStat(new StatParser_1.StatResult('p1', 0, StatParser_1.StatStatuses.Multiplayer));
            ircClient.emulateChatAsync('p1', '!stats p1');
            await t;
        });
        it('send stat invalid user', async () => {
            const { lobby, ircClient } = await TestUtils_1.default.SetupLobbyAsync();
            await TestUtils_1.default.AddPlayersAsync([ircClient.nick], ircClient);
            const players = await TestUtils_1.default.AddPlayersAsync(5, ircClient);
            const t = TestUtils_1.default.assertEventNeverFire(lobby.ParsedStat, null, 10);
            ircClient.SetStat(new StatParser_1.StatResult('p1', 0, StatParser_1.StatStatuses.Multiplayer));
            ircClient.emulateChatAsync('p1', '!stats p100');
            await t;
        });
        it('send stat pm', async () => {
            const { lobby, ircClient } = await TestUtils_1.default.SetupLobbyAsync();
            await TestUtils_1.default.AddPlayersAsync([ircClient.nick], ircClient);
            const players = await TestUtils_1.default.AddPlayersAsync(5, ircClient);
            const t = TestUtils_1.default.assertEventFire(lobby.ParsedStat, null, 10);
            ircClient.SetStat(new StatParser_1.StatResult('p1', 0, StatParser_1.StatStatuses.Multiplayer));
            ircClient.emulateChatAsync(ircClient.nick, '!stats p1');
            await t;
        });
    });
    it.skip('plugin test', async () => {
        const { ircClient, lobby, players } = await PrepareLobbyWith3Players();
        const lp = new DummyLobbyPlugin_1.DummyLobbyPlugin(lobby);
        console.log(lobby.GetLobbyStatus());
    });
    // mpコマンドの実行状況に応じて変更される状態に関するテスト
    describe('lobby commandflag tests', function () {
        it('clear host test', async () => {
            const { ircClient, lobby, players } = await PrepareLobbyWith3Players();
            chai_1.assert.isFalse(lobby.isClearedHost);
            lobby.SendMessage('!mp clearhost');
            await TestUtils_1.default.delayAsync(1);
            chai_1.assert.isTrue(lobby.isClearedHost);
            lobby.TransferHost(players[1]);
            chai_1.assert.isFalse(lobby.isClearedHost);
        });
        it('start timer test', async () => {
            const { ircClient, lobby, players } = await PrepareLobbyWith3Players();
            chai_1.assert.isFalse(lobby.isStartTimerActive);
            lobby.SendMessage('!mp start 20');
            await TestUtils_1.default.delayAsync(1);
            chai_1.assert.isTrue(lobby.isStartTimerActive);
            await ircClient.emulateMatchAsync(1);
            chai_1.assert.isFalse(lobby.isStartTimerActive);
        });
    });
    describe('remove invalid chars from lobby title', function () {
        // この正規表現は OahrBase#makeLobbyAsync で利用されている
        // OahrBaseのテストがないのでここに記す
        it('reg', function () {
            const cases = ['a', 'asdflkj', ' $% BN |~=', '4-5 | alt | test @join', 'あいうおaaa', 'aa\n\raa'];
            const actual = cases.map(v => v.replace(/[^ -~]/g, ''));
            const expected = ['a', 'asdflkj', ' $% BN |~=', '4-5 | alt | test @join', 'aaa', 'aaaa'];
            chai_1.assert.deepEqual(actual, expected);
        });
    });
    // 実際に発生したバグを再現するテスト
    describe('Bug reproduction tests', function () {
        it('some chat cant handle as chat', async () => {
            const { lobby, ircClient } = await TestUtils_1.default.SetupLobbyAsync();
            await TestUtils_1.default.AddPlayersAsync(5, ircClient);
            ircClient.emulateBanchoResponse('Omen de cobra joined in slot 2.');
            await TestUtils_1.default.delayAsync(10);
            chai_1.assert.isTrue(lobby.Includes('Omen de cobra'));
            chai_1.assert.isTrue(lobby.Includes('Omen_de_cobra'));
            ircClient.emulateChatAsync('Omen_de_cobra', ' is this winnner rotation?');
        });
        it('creator role check', async () => {
            const { lobby, ircClient } = await TestUtils_1.default.SetupLobbyAsync();
            await TestUtils_1.default.AddPlayersAsync([TestUtils_1.default.ownerNickname], ircClient);
            let p = lobby.GetPlayer(TestUtils_1.default.ownerNickname);
            chai_1.assert.isNotNull(p);
            p = p;
            chai_1.assert.isTrue(p.isCreator);
            chai_1.assert.isTrue(p.isAuthorized);
            chai_1.assert.isFalse(p.isHost);
        });
    });
});
//# sourceMappingURL=LobbyTest.js.map