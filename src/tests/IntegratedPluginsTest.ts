import { assert } from 'chai';
import { Lobby } from '../Lobby';
import { Player } from '../Player';
import { DummyIrcClient } from '../dummies/DummyIrcClient';
import { parser } from '../parsers/CommandParser';
import { AutoHostSelector, AutoHostSelectorOption } from '../plugins/AutoHostSelector';
import { HostSkipper, HostSkipperOption } from '../plugins/HostSkipper';

import tu from './TestUtils';

describe('Integrated Plugins Tests', function () {
  before(function () {
    tu.configMochaAsSilent();
  });
  describe('selector and skipper tests', function () {
    async function setup(selectorOption: Partial<AutoHostSelectorOption> = {}, skipperOption: Partial<HostSkipperOption> = { afk_check_interval_ms: 0 }):
      Promise<{ selector: AutoHostSelector, skipper: HostSkipper, lobby: Lobby, ircClient: DummyIrcClient }> {
      const li = await tu.SetupLobbyAsync();
      const selector = new AutoHostSelector(li.lobby, selectorOption);
      const skipper = new HostSkipper(li.lobby, skipperOption);
      return { selector, skipper, ...li };
    }

    it('skip to test', async () => {
      const { selector, skipper, lobby, ircClient } = await setup();
      const ownerId = tu.ownerNickname;
      await tu.AddPlayersAsync([ownerId, 'p2', 'p3', 'p4'], ircClient);
      let owner = lobby.GetPlayer(ownerId);
      assert.isNotNull(owner);
      owner = owner as Player;
      assert.isTrue(owner.isCreator);
      assert.isTrue(owner.isAuthorized);
      assert.isTrue(owner.isHost);

      await ircClient.emulateMatchAsync(0);

      tu.assertHost('p2', lobby);
      let m = '*skipto p4';
      assert.isTrue(parser.IsChatCommand(m));
      lobby.RaiseReceivedChatCommand(owner, m);
      await tu.delayAsync(10);
      tu.assertHost('p4', lobby);

      m = `*skipto ${owner.name}`;
      assert.isTrue(parser.IsChatCommand(m));
      lobby.RaiseReceivedChatCommand(owner, m);
      await tu.delayAsync(10);
      tu.assertHost(ownerId, lobby);
      skipper.StopTimer();
    });
  });
});
