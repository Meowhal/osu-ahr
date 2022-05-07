import { InOutLogger } from '../plugins/InOutLogger';
import tu from './TestUtils';

describe.skip('In Out Logger Tests', function () {
  before(function () {
    tu.configMochaVerbosely();
  });

  it('test', async () => {
    const { lobby, ircClient } = await tu.SetupLobbyAsync();
    const logger = new InOutLogger(lobby);
    const players = await tu.AddPlayersAsync(5, ircClient);
    await ircClient.emulateMatchAsync();
    await ircClient.emulateMatchAsync();
    await ircClient.emulateRemovePlayerAsync(players[0]);
    await ircClient.emulateRemovePlayerAsync(players[1]);
    await ircClient.emulateRemovePlayerAsync(players[2]);
    await ircClient.emulateAddPlayerAsync('a');
    await ircClient.emulateAddPlayerAsync('b');
    await ircClient.emulateAddPlayerAsync('c');
    const t = ircClient.emulateMatchAsync(10);
    await tu.delayAsync(1);
    await ircClient.emulateRemovePlayerAsync('a');
    await ircClient.emulateAddPlayerAsync('d');
    await t;
    await ircClient.emulateAddPlayerAsync('e');
    await ircClient.emulateMatchAsync();
    await ircClient.emulateRemovePlayerAsync('e');
    await ircClient.emulateMatchAsync();
    logger.logger.info(logger.GetPluginStatus());
  });
});
