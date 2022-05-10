import { assert } from 'chai';
import { Lobby } from '../Lobby';
import { DummyIrcClient } from '../dummies/DummyIrcClient';
import { StatResult, StatStatuses } from '../parsers/StatParser';
import { AfkKicker } from '../plugins/AfkKicker';
import tu from './TestUtils';

describe('AfkKicker Tests', function () {
  before(function () {
    tu.configMochaAsSilent();
  });

  async function setupAsync():
        Promise<{ kicker: AfkKicker, lobby: Lobby, ircClient: DummyIrcClient }> {
    const li = await tu.SetupLobbyAsync();
    const kicker = new AfkKicker(li.lobby, { cooltime_ms: 0, threshold: 6, enabled: true });
    return { kicker, ...li };
  }

  it('stat afk test', async () => {
    const { kicker, lobby, ircClient } = await setupAsync();
    const players = (await tu.AddPlayersAsync(['p1', 'p2'], ircClient))
      .map(name => lobby.GetOrMakePlayer(name));

    ircClient.SetStat(new StatResult(players[0].escaped_name, 100, StatStatuses.Afk));

    assert.equal(kicker.playerStats.get(players[0])?.afkPoint, 0);
    assert.equal(kicker.playerStats.get(players[1])?.afkPoint, 0);
    lobby.SendMessage('!stat p1');
    lobby.SendMessage('!stat p2');
    assert.equal(kicker.playerStats.get(players[0])?.afkPoint, 3);
    assert.equal(kicker.playerStats.get(players[1])?.afkPoint, 0);
  });

  it('zero score test', async () => {
    const { kicker, lobby, ircClient } = await setupAsync();
    const players = (await tu.AddPlayersAsync(['p1', 'p2'], ircClient))
      .map(name => lobby.GetOrMakePlayer(name));

    assert.equal(kicker.playerStats.get(players[0])?.afkPoint, 0);
    assert.equal(kicker.playerStats.get(players[1])?.afkPoint, 0);
    await ircClient.emulateMatchAsync(0, [{ name: 'p1', score: 0, passed: false }, { name: 'p2', score: 100, passed: true }]);
    assert.equal(kicker.playerStats.get(players[0])?.afkPoint, 2);
    assert.equal(kicker.playerStats.get(players[1])?.afkPoint, 0);
    await ircClient.emulateMatchAsync(0, [{ name: 'p1', score: 100, passed: true }, { name: 'p2', score: 100, passed: true }]);
    assert.equal(kicker.playerStats.get(players[0])?.afkPoint, 0);
    assert.equal(kicker.playerStats.get(players[1])?.afkPoint, 0);
  });

  it('no map test', async () => {
    const { kicker, lobby, ircClient } = await setupAsync();
    const players = (await tu.AddPlayersAsync(['p1', 'p2'], ircClient))
      .map(name => lobby.GetOrMakePlayer(name));

    assert.equal(kicker.playerStats.get(players[0])?.afkPoint, 0);
    assert.equal(kicker.playerStats.get(players[1])?.afkPoint, 0);
    await ircClient.emulateMatchAsync(0, [{ name: 'p2', score: 100, passed: true }]);
    assert.equal(kicker.playerStats.get(players[0])?.afkPoint, 2);
    assert.equal(kicker.playerStats.get(players[1])?.afkPoint, 0);
    await ircClient.emulateMatchAsync(0, [{ name: 'p1', score: 100, passed: true }, { name: 'p2', score: 100, passed: true }]);
    assert.equal(kicker.playerStats.get(players[0])?.afkPoint, 0);
    assert.equal(kicker.playerStats.get(players[1])?.afkPoint, 0);
  });

  it('chat test', async () => {
    const { kicker, lobby, ircClient } = await setupAsync();
    const players = (await tu.AddPlayersAsync(['p1', 'p2'], ircClient))
      .map(name => lobby.GetOrMakePlayer(name));

    ircClient.SetStat(new StatResult(players[0].escaped_name, 100, StatStatuses.Afk));
    lobby.SendMessage('!stat p1');

    assert.equal(kicker.playerStats.get(players[0])?.afkPoint, 3);
    assert.equal(kicker.playerStats.get(players[1])?.afkPoint, 0);

    ircClient.emulateMessage('p1', ircClient.channel, 'hello');
    assert.equal(kicker.playerStats.get(players[0])?.afkPoint, 2);
    ircClient.emulateMessage('p1', ircClient.channel, 'hello');
    assert.equal(kicker.playerStats.get(players[0])?.afkPoint, 1);
    ircClient.emulateMessage('p1', ircClient.channel, 'hello');
    assert.equal(kicker.playerStats.get(players[0])?.afkPoint, 0);
    ircClient.emulateMessage('p1', ircClient.channel, 'hello');
    assert.equal(kicker.playerStats.get(players[0])?.afkPoint, 0);

    ircClient.emulateMessage('p2', ircClient.channel, 'hello');
    assert.equal(kicker.playerStats.get(players[1])?.afkPoint, 0);
  });

  it('kick test', async () => {
    const { kicker, lobby, ircClient } = await setupAsync();
    const players = (await tu.AddPlayersAsync(['p1', 'p2'], ircClient))
      .map(name => lobby.GetOrMakePlayer(name));

    ircClient.SetStat(new StatResult(players[0].escaped_name, 100, StatStatuses.Afk));
    lobby.SendMessage('!stat p1');
    assert.equal(kicker.playerStats.get(players[0])?.afkPoint, 3);
    lobby.SendMessage('!stat p1');
    assert.notInclude(lobby.players, players[0]);
    assert.include(lobby.players, players[1]);
  });

  it('cooltime test', async () => {
    const { kicker, lobby, ircClient } = await setupAsync();
    const players = (await tu.AddPlayersAsync(['p1', 'p2'], ircClient))
      .map(name => lobby.GetOrMakePlayer(name));

    kicker.option.threshold = 100;
    kicker.option.cooltime_ms = 0;

    ircClient.SetStat(new StatResult(players[0].escaped_name, 100, StatStatuses.Afk));
    lobby.SendMessage('!stat p1');
    lobby.SendMessage('!stat p1');
    assert.equal(kicker.playerStats.get(players[0])?.afkPoint, 6);

    kicker.option.cooltime_ms = 1000;
    lobby.SendMessage('!stat p1');
    assert.equal(kicker.playerStats.get(players[0])?.afkPoint, 6);

    kicker.option.cooltime_ms = 0;
    lobby.SendMessage('!stat p1');
    assert.equal(kicker.playerStats.get(players[0])?.afkPoint, 9);
  });

  it('enabled / disabled test', async () => {
    const { kicker, lobby, ircClient } = await setupAsync();
    const players = (await tu.AddPlayersAsync(['p1', 'p2'], ircClient))
      .map(name => lobby.GetOrMakePlayer(name));

    kicker.option.threshold = 100;
    kicker.option.cooltime_ms = 0;

    ircClient.SetStat(new StatResult(players[0].escaped_name, 100, StatStatuses.Afk));
    lobby.SendMessage('!stat p1');
    assert.equal(kicker.playerStats.get(players[0])?.afkPoint, 3);

    kicker.option.enabled = false;
    lobby.SendMessage('!stat p1');
    assert.equal(kicker.playerStats.get(players[0])?.afkPoint, 3);

    kicker.option.enabled = true;
    lobby.SendMessage('!stat p1');
    assert.equal(kicker.playerStats.get(players[0])?.afkPoint, 6);

    kicker.option.enabled = false;
    lobby.SendMessage('!stat p1');
    assert.equal(kicker.playerStats.get(players[0])?.afkPoint, 6);
  });


  it('command tests', async () => {
    const { kicker, lobby } = await setupAsync();
    kicker.option.enabled = false;
    kicker.option.cooltime_ms = 0;
    kicker.option.threshold = 0;


    await tu.sendMessageAsOwner(lobby, '*afkkick_enable');
    assert.isTrue(kicker.option.enabled);
    assert.equal(kicker.option.cooltime_ms, 0);
    assert.equal(kicker.option.threshold, 0);

    await tu.sendMessageAsOwner(lobby, '*afkkick_disable');
    assert.isFalse(kicker.option.enabled);
    assert.equal(kicker.option.cooltime_ms, 0);
    assert.equal(kicker.option.threshold, 0);

    await tu.sendMessageAsOwner(lobby, '*afkkick_threshold 100');
    assert.isFalse(kicker.option.enabled);
    assert.equal(kicker.option.cooltime_ms, 0);
    assert.equal(kicker.option.threshold, 100);

    await tu.sendMessageAsOwner(lobby, '*afkkick_threshold 0');
    assert.isFalse(kicker.option.enabled);
    assert.equal(kicker.option.cooltime_ms, 0);
    assert.equal(kicker.option.threshold, 1); // min v = 1

    await tu.sendMessageAsOwner(lobby, '*afkkick_cooltime 100000000');
    assert.isFalse(kicker.option.enabled);
    assert.equal(kicker.option.cooltime_ms, 100000000);
    assert.equal(kicker.option.threshold, 1);

    await tu.sendMessageAsOwner(lobby, '*afkkick_cooltime 0');
    assert.isFalse(kicker.option.enabled);
    assert.equal(kicker.option.cooltime_ms, 10000);
    assert.equal(kicker.option.threshold, 1);

  });
});
