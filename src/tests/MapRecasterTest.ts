import { Lobby } from '../Lobby';
import { DummyIrcClient } from '../dummies/DummyIrcClient';
import { MapRecaster } from '../plugins/MapRecaster';
import tu from './TestUtils';
import { BanchoResponseType } from '../parsers/CommandParser';

describe('Map Recaster Tests', function () {
  before(function () {
    tu.configMochaAsSilent();
  });

  async function setupAsync():
    Promise<{ recaster: MapRecaster, lobby: Lobby, ircClient: DummyIrcClient }> {
    const li = await tu.SetupLobbyAsync();
    const ma = new MapRecaster(li.lobby);
    return { recaster: ma, ...li };
  }
  it('recast test', async () => {
    const { recaster, lobby, ircClient } = await setupAsync();
    const players = await tu.AddPlayersAsync(3, ircClient);
    await ircClient.emulateChangeMapAsync(0);
    const mapid = lobby.mapId;
    const t1 = tu.assertBanchoRespond(lobby, BanchoResponseType.MpBeatmapChanged, (b => b.params[0] === mapid), 10);
    ircClient.emulateMessage(players[0], ircClient.channel, '!update');
    await t1;
  });

  it('request twice test', async () => {
    const { recaster, lobby, ircClient } = await setupAsync();
    const players = await tu.AddPlayersAsync(3, ircClient);
    await ircClient.emulateChangeMapAsync(0);
    const mapid = lobby.mapId;
    const t1 = tu.assertBanchoRespond(lobby, BanchoResponseType.MpBeatmapChanged, (b => b.params[0] === mapid), 10);
    ircClient.emulateMessage(players[0], ircClient.channel, '!update');
    await t1;

    const t2 = tu.assertBanchoNotRespond(lobby, BanchoResponseType.MpBeatmapChanged, (b => b.params[0] === mapid), 10);
    ircClient.emulateMessage(players[1], ircClient.channel, '!update');
    await t2;
  });

  it('can update every time player changes map', async () => {
    const { recaster, lobby, ircClient } = await setupAsync();
    const players = await tu.AddPlayersAsync(3, ircClient);
    await ircClient.emulateChangeMapAsync(0);
    let mapid = lobby.mapId;
    const t1 = tu.assertBanchoRespond(lobby, BanchoResponseType.MpBeatmapChanged, (b => b.params[0] === mapid), 10);
    ircClient.emulateMessage(players[0], ircClient.channel, '!update');
    await t1;
    await ircClient.emulateChangeMapAsync(0);
    mapid = lobby.mapId;
    const t2 = tu.assertBanchoRespond(lobby, BanchoResponseType.MpBeatmapChanged, (b => b.params[0] === mapid), 10);
    ircClient.emulateMessage(players[1], ircClient.channel, '!update');
    await t2;
    await ircClient.emulateChangeMapAsync(0);
    mapid = lobby.mapId;
    const t3 = tu.assertBanchoRespond(lobby, BanchoResponseType.MpBeatmapChanged, (b => b.params[0] === mapid), 10);
    ircClient.emulateMessage(players[1], ircClient.channel, '!update');
    await t3;
  });
});
