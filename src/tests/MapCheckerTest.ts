import { assert } from 'chai';
import { Lobby } from '../Lobby';
import { Roles } from '../Player';
import { DummyIrcClient } from '../dummies/DummyIrcClient';
import { FakeBeatmapFetcher } from '../dummies/FakeBeatmapFetcher';
import { PlayMode } from '../Modes';
import { MapCheckerUncheckedOption, MapChecker } from '../plugins/MapChecker';
import { BeatmapRepository } from '../webapi/BeatmapRepository';
import tu from './TestUtils';

describe('Map Checker Tests', function () {
  before(function () {
    tu.configMochaAsSilent();
  });

  afterEach(function () {
    BeatmapRepository.maps.clear();
  });

  async function setup(option?: MapCheckerUncheckedOption):
    Promise<{ checker: MapChecker, lobby: Lobby, ircClient: DummyIrcClient }> {
    const defaultOption = {
      enabled: false,
      star_min: 0,
      star_max: 7.00,
      length_min: 0,
      length_max: 600,
      gamemode: 'osu',
      num_violations_allowed: 3,
      allow_convert: true
    };

    option = { ...defaultOption, ...option };

    const li = await tu.SetupLobbyAsync();
    const checker = new MapChecker(li.lobby, option);
    await tu.AddPlayersAsync(['p1', 'p2', 'p3'], li.ircClient);
    return { checker, ...li };
  }
  describe('mapchecker option tests', () => {
    it('default option test', async () => {
      const { checker, lobby, ircClient } = await setup();

      assert.equal(checker.option.allow_convert, true);
      assert.equal(checker.option.enabled, false);
      assert.equal(checker.option.gamemode, PlayMode.Osu);
      assert.equal(checker.option.length_max, 600);
      assert.equal(checker.option.length_min, 0);
      assert.equal(checker.option.num_violations_allowed, 3);
      assert.equal(checker.option.star_max, 7);
      assert.equal(checker.option.star_min, 0);

    });

    it('type matched option test', async () => {
      const { checker, lobby, ircClient } = await setup({
        allow_convert: false,
        enabled: true,
        gamemode: PlayMode.OsuMania,
        length_max: 0,
        length_min: 100,
        num_violations_allowed: 1,
        star_max: 0,
        star_min: 3
      });

      assert.equal(checker.option.allow_convert, false);
      assert.equal(checker.option.enabled, true);
      assert.equal(checker.option.gamemode, PlayMode.OsuMania);
      assert.equal(checker.option.length_max, 0);
      assert.equal(checker.option.length_min, 100);
      assert.equal(checker.option.num_violations_allowed, 1);
      assert.equal(checker.option.star_max, 0);
      assert.equal(checker.option.star_min, 3);

    });

    it('type mismatched option test', async () => {
      const { checker, lobby, ircClient } = await setup({
        allow_convert: 'false',
        enabled: 1,
        gamemode: 'fruits',
        length_max: '0',
        length_min: '100',
        num_violations_allowed: '1',
        star_max: '0',
        star_min: '3'
      });

      assert.equal(checker.option.allow_convert, false);
      assert.equal(checker.option.enabled, true);
      assert.equal(checker.option.gamemode, PlayMode.CatchTheBeat);
      assert.equal(checker.option.length_max, 0);
      assert.equal(checker.option.length_min, 100);
      assert.equal(checker.option.num_violations_allowed, 1);
      assert.equal(checker.option.star_max, 0);
      assert.equal(checker.option.star_min, 3);

    });

    it('conflicted option test', async () => {
      const { checker, lobby, ircClient } = await setup({
        length_max: '20',
        length_min: '50',
        star_max: '3',
        star_min: '5'
      });

      assert.equal(checker.option.length_max, 20);
      assert.equal(checker.option.length_min, 0);
      assert.equal(checker.option.star_max, 3);
      assert.equal(checker.option.star_min, 0);
    });

    it('no max cap option test (not conflicted)', async () => {
      const { checker, lobby, ircClient } = await setup({
        length_max: '0',
        length_min: '50',
        star_max: '0',
        star_min: '5'
      });

      assert.equal(checker.option.length_max, 0);
      assert.equal(checker.option.length_min, 50);
      assert.equal(checker.option.star_max, 0);
      assert.equal(checker.option.star_min, 5);
    });

    it('no min cap option test (not conflicted)', async () => {
      const { checker, lobby, ircClient } = await setup({
        length_max: '50',
        length_min: '0',
        star_max: '5',
        star_min: '0'
      });

      assert.equal(checker.option.length_max, 50);
      assert.equal(checker.option.length_min, 0);
      assert.equal(checker.option.star_max, 5);
      assert.equal(checker.option.star_min, 0);
    });


    it('abolished option test', async () => {
      const { checker, lobby, ircClient } = await setup({
        allowConvert: false,
        num_violations_to_skip: 10,
      });

      assert.equal(checker.option.allow_convert, false);
      assert.equal(checker.option.num_violations_allowed, 10);
    });

    it('invalid option test : allow_convert', async () => {
      let threw = false;
      try {
        const { checker, lobby, ircClient } = await setup({
          allow_convert: 'aaaa'
        });
      } catch (e) {
        threw = true;
      }
      assert.isTrue(threw);
    });

    it('invalid option test : enabled', async () => {
      let threw = false;
      try {
        const { checker, lobby, ircClient } = await setup({
          enabled: 'aaaa'
        });
      } catch (e) {
        threw = true;
      }
      assert.isTrue(threw);
    });

    it('invalid option test : gamemode aaaa', async () => {
      let threw = false;
      try {
        const { checker, lobby, ircClient } = await setup({
          gamemode: 'aaaa'
        });
      } catch (e) {
        threw = true;
      }
      assert.isTrue(threw);
    });

    it('invalid option test : gamemode dsflkjsd', async () => {
      let threw = false;
      try {
        const { checker, lobby, ircClient } = await setup({
          gamemode: 'dsflkjsd'
        });
      } catch (e) {
        threw = true;
      }
      assert.isTrue(threw);
    });

    it('invalid option test : gamemode 123456', async () => {
      let threw = false;
      try {
        const { checker, lobby, ircClient } = await setup({
          gamemode: 123456
        });
      } catch (e) {
        threw = true;
      }
      assert.isTrue(threw);
    });

    it('invalid option test : length_max', async () => {
      let threw = false;
      try {
        const { checker, lobby, ircClient } = await setup({
          length_max: -1
        });
      } catch (e) {
        threw = true;
      }
      assert.isTrue(threw);
    });

    it('invalid option test : length_min', async () => {
      let threw = false;
      try {
        const { checker, lobby, ircClient } = await setup({
          length_min: -1
        });
      } catch (e) {
        threw = true;
      }
      assert.isTrue(threw);
    });

    it('invalid option test : num_violations_allowed', async () => {
      let threw = false;
      try {
        const { checker, lobby, ircClient } = await setup({
          num_violations_allowed: -1
        });
      } catch (e) {
        threw = true;
      }
      assert.isTrue(threw);
    });

    it('invalid option test : star_max', async () => {
      let threw = false;
      try {
        const { checker, lobby, ircClient } = await setup({
          star_max: -1
        });
      } catch (e) {
        threw = true;
      }
      assert.isTrue(threw);
    });

    it('invalid option test : star_min', async () => {
      let threw = false;
      try {
        const { checker, lobby, ircClient } = await setup({
          star_min: -1
        });
      } catch (e) {
        threw = true;
      }
      assert.isTrue(threw);
    });

    it('invalid option test : number NaN', async () => {
      let threw = false;
      try {
        const { checker, lobby, ircClient } = await setup({
          star_min: NaN
        });
      } catch (e) {
        threw = true;
      }
      assert.isTrue(threw);
    });

    it('invalid option test : number string', async () => {
      let threw = false;
      try {
        const { checker, lobby, ircClient } = await setup({
          star_min: 'aaaa'
        });
      } catch (e) {
        threw = true;
      }
      assert.isTrue(threw);
    });
  });

  describe('owner command tests', () => {
    it('command: enabled ', async () => {
      const { checker, lobby, ircClient } = await setup();

      lobby.GetOrMakePlayer('p1').setRole(Roles.Authorized);

      checker.option.enabled = true;
      ircClient.emulateMessage('p1', ircClient.channel, '*regulation enabled');
      assert.equal(checker.option.enabled, true);

      ircClient.emulateMessage('p1', ircClient.channel, '*regulation disabled');
      assert.equal(checker.option.enabled, false);

      ircClient.emulateMessage('p1', ircClient.channel, '*regulation enable');
      assert.equal(checker.option.enabled, true);

      ircClient.emulateMessage('p1', ircClient.channel, '*regulation disable');
      assert.equal(checker.option.enabled, false);
    });

    it('command: num_violations_allowed ', async () => {
      const { checker, lobby, ircClient } = await setup();

      lobby.GetOrMakePlayer('p1').setRole(Roles.Authorized);

      checker.option.num_violations_allowed = 1;
      ircClient.emulateMessage('p1', ircClient.channel, '*regulation num_violations_allowed 3');
      assert.equal(checker.option.num_violations_allowed, 3);

      ircClient.emulateMessage('p1', ircClient.channel, '*regulation num_violations_allowed 10');
      assert.equal(checker.option.num_violations_allowed, 10);

      ircClient.emulateMessage('p1', ircClient.channel, '*regulation num_violations_to_skip 5');
      assert.equal(checker.option.num_violations_allowed, 5);

      ircClient.emulateMessage('p1', ircClient.channel, '*regulation num_violations_allowed 0');
      assert.equal(checker.option.num_violations_allowed, 0);

      checker.option.num_violations_allowed = 10;
      ircClient.emulateMessage('p1', ircClient.channel, '*regulation num_violations_allowed');
      assert.equal(checker.option.num_violations_allowed, 10);

      ircClient.emulateMessage('p1', ircClient.channel, '*regulation num_violations_allowed asf');
      assert.equal(checker.option.num_violations_allowed, 10);

      ircClient.emulateMessage('p1', ircClient.channel, '*regulation num_violations_allowed NaN');
      assert.equal(checker.option.num_violations_allowed, 10);

      ircClient.emulateMessage('p1', ircClient.channel, '*regulation num_violations_to_skip');
      assert.equal(checker.option.num_violations_allowed, 10);
    });

    it('command: star_min ', async () => {
      const { checker, lobby, ircClient } = await setup();

      lobby.GetOrMakePlayer('p1').setRole(Roles.Authorized);

      checker.option.star_min = 1;
      checker.option.star_max = 5;
      ircClient.emulateMessage('p1', ircClient.channel, '*regulation star_min 3');
      assert.equal(checker.option.star_min, 3);
      assert.equal(checker.option.star_max, 5);

      ircClient.emulateMessage('p1', ircClient.channel, '*regulation star_min 0');
      assert.equal(checker.option.star_min, 0);
      assert.equal(checker.option.star_max, 5);

      ircClient.emulateMessage('p1', ircClient.channel, '*regulation star_min 10');
      assert.equal(checker.option.star_min, 10);
      assert.equal(checker.option.star_max, 0);

      checker.option.star_min = 1;
      checker.option.star_max = 5;
      ircClient.emulateMessage('p1', ircClient.channel, '*regulation    starmin  5   ');
      assert.equal(checker.option.star_min, 5);
      assert.equal(checker.option.star_max, 0);

      checker.option.star_min = 1;
      checker.option.star_max = 5;
      ircClient.emulateMessage('p1', ircClient.channel, '*regulation difflow 3');
      assert.equal(checker.option.star_min, 3);
      assert.equal(checker.option.star_max, 5);

      checker.option.star_min = 1;
      ircClient.emulateMessage('p1', ircClient.channel, '*regulation star_min -3');
      assert.equal(checker.option.star_min, 1);
      assert.equal(checker.option.star_max, 5);

      ircClient.emulateMessage('p1', ircClient.channel, '*regulation star_min');
      assert.equal(checker.option.star_min, 1);
      assert.equal(checker.option.star_max, 5);

      ircClient.emulateMessage('p1', ircClient.channel, '*regulation star_min   ');
      assert.equal(checker.option.star_min, 1);
      assert.equal(checker.option.star_max, 5);

      ircClient.emulateMessage('p1', ircClient.channel, '*regulation star_min a');
      assert.equal(checker.option.star_min, 1);
      assert.equal(checker.option.star_max, 5);
    });

    it('command: star_max ', async () => {
      const { checker, lobby, ircClient } = await setup();

      lobby.GetOrMakePlayer('p1').setRole(Roles.Authorized);

      checker.option.star_min = 3;
      checker.option.star_max = 5;
      ircClient.emulateMessage('p1', ircClient.channel, '*regulation star_max 4');
      assert.equal(checker.option.star_min, 3);
      assert.equal(checker.option.star_max, 4);

      ircClient.emulateMessage('p1', ircClient.channel, '*regulation star_max 0');
      assert.equal(checker.option.star_min, 3);
      assert.equal(checker.option.star_max, 0);

      ircClient.emulateMessage('p1', ircClient.channel, '*regulation star_max 10');
      assert.equal(checker.option.star_min, 3);
      assert.equal(checker.option.star_max, 10);

      ircClient.emulateMessage('p1', ircClient.channel, '*regulation star_max 2');
      assert.equal(checker.option.star_min, 0);
      assert.equal(checker.option.star_max, 2);

      checker.option.star_min = 3;
      checker.option.star_max = 5;
      ircClient.emulateMessage('p1', ircClient.channel, '*regulation    starmax  5   ');
      assert.equal(checker.option.star_min, 3);
      assert.equal(checker.option.star_max, 5);

      ircClient.emulateMessage('p1', ircClient.channel, '*regulation diffupperlimit 3');
      assert.equal(checker.option.star_min, 0);
      assert.equal(checker.option.star_max, 3);

      checker.option.star_min = 3;
      checker.option.star_max = 5;
      ircClient.emulateMessage('p1', ircClient.channel, '*regulation star_max -3');
      assert.equal(checker.option.star_min, 3);
      assert.equal(checker.option.star_max, 5);

      ircClient.emulateMessage('p1', ircClient.channel, '*regulation star_max');
      assert.equal(checker.option.star_min, 3);
      assert.equal(checker.option.star_max, 5);

      ircClient.emulateMessage('p1', ircClient.channel, '*regulation star_max   ');
      assert.equal(checker.option.star_min, 3);
      assert.equal(checker.option.star_max, 5);

      ircClient.emulateMessage('p1', ircClient.channel, '*regulation star_max a');
      assert.equal(checker.option.star_min, 3);
      assert.equal(checker.option.star_max, 5);
    });


    it('command: length_min ', async () => {
      const { checker, lobby, ircClient } = await setup();

      lobby.GetOrMakePlayer('p1').setRole(Roles.Authorized);

      checker.option.length_min = 1;
      checker.option.length_max = 5;
      ircClient.emulateMessage('p1', ircClient.channel, '*regulation length_min 3');
      assert.equal(checker.option.length_min, 3);
      assert.equal(checker.option.length_max, 5);

      ircClient.emulateMessage('p1', ircClient.channel, '*regulation length_min 0');
      assert.equal(checker.option.length_min, 0);
      assert.equal(checker.option.length_max, 5);

      ircClient.emulateMessage('p1', ircClient.channel, '*regulation length_min 10');
      assert.equal(checker.option.length_min, 10);
      assert.equal(checker.option.length_max, 0);

      checker.option.length_min = 1;
      checker.option.length_max = 5;
      ircClient.emulateMessage('p1', ircClient.channel, '*regulation    lenmin  5   ');
      assert.equal(checker.option.length_min, 5);
      assert.equal(checker.option.length_max, 0);

      checker.option.length_min = 1;
      checker.option.length_max = 5;
      ircClient.emulateMessage('p1', ircClient.channel, '*regulation lenlower 3');
      assert.equal(checker.option.length_min, 3);
      assert.equal(checker.option.length_max, 5);

      checker.option.length_min = 1;
      ircClient.emulateMessage('p1', ircClient.channel, '*regulation length_min -3');
      assert.equal(checker.option.length_min, 1);
      assert.equal(checker.option.length_max, 5);

      ircClient.emulateMessage('p1', ircClient.channel, '*regulation length_min');
      assert.equal(checker.option.length_min, 1);
      assert.equal(checker.option.length_max, 5);

      ircClient.emulateMessage('p1', ircClient.channel, '*regulation length_min   ');
      assert.equal(checker.option.length_min, 1);
      assert.equal(checker.option.length_max, 5);

      ircClient.emulateMessage('p1', ircClient.channel, '*regulation length_min a');
      assert.equal(checker.option.length_min, 1);
      assert.equal(checker.option.length_max, 5);
    });

    it('command: length_max ', async () => {
      const { checker, lobby, ircClient } = await setup();

      lobby.GetOrMakePlayer('p1').setRole(Roles.Authorized);

      checker.option.length_min = 3;
      checker.option.length_max = 5;
      ircClient.emulateMessage('p1', ircClient.channel, '*regulation length_max 4');
      assert.equal(checker.option.length_min, 3);
      assert.equal(checker.option.length_max, 4);

      ircClient.emulateMessage('p1', ircClient.channel, '*regulation length_max 0');
      assert.equal(checker.option.length_min, 3);
      assert.equal(checker.option.length_max, 0);

      ircClient.emulateMessage('p1', ircClient.channel, '*regulation length_max 10');
      assert.equal(checker.option.length_min, 3);
      assert.equal(checker.option.length_max, 10);

      ircClient.emulateMessage('p1', ircClient.channel, '*regulation length_max 2');
      assert.equal(checker.option.length_min, 0);
      assert.equal(checker.option.length_max, 2);

      checker.option.length_min = 3;
      checker.option.length_max = 5;
      ircClient.emulateMessage('p1', ircClient.channel, '*regulation    lenmax  5   ');
      assert.equal(checker.option.length_min, 3);
      assert.equal(checker.option.length_max, 5);

      ircClient.emulateMessage('p1', ircClient.channel, '*regulation lenupperlimit 3');
      assert.equal(checker.option.length_min, 0);
      assert.equal(checker.option.length_max, 3);

      checker.option.length_min = 3;
      checker.option.length_max = 5;
      ircClient.emulateMessage('p1', ircClient.channel, '*regulation length_max -3');
      assert.equal(checker.option.length_min, 3);
      assert.equal(checker.option.length_max, 5);

      ircClient.emulateMessage('p1', ircClient.channel, '*regulation length_max');
      assert.equal(checker.option.length_min, 3);
      assert.equal(checker.option.length_max, 5);

      ircClient.emulateMessage('p1', ircClient.channel, '*regulation length_max   ');
      assert.equal(checker.option.length_min, 3);
      assert.equal(checker.option.length_max, 5);

      ircClient.emulateMessage('p1', ircClient.channel, '*regulation length_max a');
      assert.equal(checker.option.length_min, 3);
      assert.equal(checker.option.length_max, 5);
    });

    it('command: gamemode ', async () => {
      const { checker, lobby, ircClient } = await setup();

      lobby.GetOrMakePlayer('p1').setRole(Roles.Authorized);

      let initialValue = PlayMode.OsuMania;
      checker.option.gamemode = initialValue;
      ircClient.emulateMessage('p1', ircClient.channel, '*regulation gamemode osu');
      assert.equal(checker.option.gamemode, PlayMode.Osu);

      checker.option.gamemode = initialValue;
      ircClient.emulateMessage('p1', ircClient.channel, '*regulation gamemode Osu');
      assert.equal(checker.option.gamemode, PlayMode.Osu);

      checker.option.gamemode = initialValue;
      ircClient.emulateMessage('p1', ircClient.channel, '*regulation gamemode 0');
      assert.equal(checker.option.gamemode, PlayMode.Osu);

      checker.option.gamemode = initialValue;
      ircClient.emulateMessage('p1', ircClient.channel, '*regulation gamemode taiko');
      assert.equal(checker.option.gamemode, PlayMode.Taiko);

      checker.option.gamemode = initialValue;
      ircClient.emulateMessage('p1', ircClient.channel, '*regulation gamemode TAIKO');
      assert.equal(checker.option.gamemode, PlayMode.Taiko);

      checker.option.gamemode = initialValue;
      ircClient.emulateMessage('p1', ircClient.channel, '*regulation gamemode 1');
      assert.equal(checker.option.gamemode, PlayMode.Taiko);

      checker.option.gamemode = initialValue;
      ircClient.emulateMessage('p1', ircClient.channel, '*regulation gamemode CatchTheBeat');
      assert.equal(checker.option.gamemode, PlayMode.CatchTheBeat);

      checker.option.gamemode = initialValue;
      ircClient.emulateMessage('p1', ircClient.channel, '*regulation gamemode fruits');
      assert.equal(checker.option.gamemode, PlayMode.CatchTheBeat);

      checker.option.gamemode = initialValue;
      ircClient.emulateMessage('p1', ircClient.channel, '*regulation gamemode catch');
      assert.equal(checker.option.gamemode, PlayMode.CatchTheBeat);

      checker.option.gamemode = initialValue;
      ircClient.emulateMessage('p1', ircClient.channel, '*regulation gamemode 2');
      assert.equal(checker.option.gamemode, PlayMode.CatchTheBeat);

      initialValue = PlayMode.Osu;
      checker.option.gamemode = initialValue;
      ircClient.emulateMessage('p1', ircClient.channel, '*regulation gamemode OsuMania');
      assert.equal(checker.option.gamemode, PlayMode.OsuMania);

      checker.option.gamemode = initialValue;
      ircClient.emulateMessage('p1', ircClient.channel, '*regulation gamemode mania');
      assert.equal(checker.option.gamemode, PlayMode.OsuMania);

      checker.option.gamemode = initialValue;
      ircClient.emulateMessage('p1', ircClient.channel, '*regulation gamemode 3');
      assert.equal(checker.option.gamemode, PlayMode.OsuMania);

      checker.option.gamemode = initialValue;
      ircClient.emulateMessage('p1', ircClient.channel, '*regulation gamemode');
      assert.equal(checker.option.gamemode, initialValue);

      checker.option.gamemode = initialValue;
      ircClient.emulateMessage('p1', ircClient.channel, '*regulation gamemode boss');
      assert.equal(checker.option.gamemode, initialValue);

      checker.option.gamemode = initialValue;
      ircClient.emulateMessage('p1', ircClient.channel, '*regulation gamemode  asfsdf ');
      assert.equal(checker.option.gamemode, initialValue);

      checker.option.gamemode = initialValue;
      ircClient.emulateMessage('p1', ircClient.channel, '*regulation gamemode  * fdssdflk lsdf lksdfl3342r ');
      assert.equal(checker.option.gamemode, initialValue);
    });

    it('command: allow_convert ', async () => {
      const { checker, lobby, ircClient } = await setup();

      lobby.GetOrMakePlayer('p1').setRole(Roles.Authorized);

      checker.option.allow_convert = false;
      ircClient.emulateMessage('p1', ircClient.channel, '*regulation allow_convert');
      assert.equal(checker.option.allow_convert, true);

      ircClient.emulateMessage('p1', ircClient.channel, '*regulation disallow_convert');
      assert.equal(checker.option.allow_convert, false);

      ircClient.emulateMessage('p1', ircClient.channel, '*regulation allow_convert true');
      assert.equal(checker.option.allow_convert, true);

      ircClient.emulateMessage('p1', ircClient.channel, '*regulation allow_convert false');
      assert.equal(checker.option.allow_convert, false);
    });

    it('command  statement ', async () => {
      const { checker, lobby, ircClient } = await setup();

      lobby.GetOrMakePlayer('p1').setRole(Roles.Authorized);

      checker.option.allow_convert = false;
      ircClient.emulateMessage('p1', ircClient.channel, '*regulation starmax=10 starmin=1 maxlen=100 lenmin = 20 gamemode= osu');

      assert.equal(checker.option.gamemode, PlayMode.Osu);
      assert.equal(checker.option.star_max, 10);
      assert.equal(checker.option.star_min, 1);
      assert.equal(checker.option.length_max, 100);
      assert.equal(checker.option.length_min, 20);
    });
  });

  describe('description tests', () => {
    it('default config', async () => {
      const { checker, lobby, ircClient } = await setup({
        enabled: false,
        star_min: 0,
        star_max: 7.00,
        length_min: 0,
        length_max: 600,
        gamemode: 'osu',
        num_violations_allowed: 3,
        allow_convert: true
      });

      assert.equal(checker.getRegulationDescription(), 'Disabled (Star rating <= 7.00, Length <= 10:00, Mode: osu!)');
    });

    it('config', async () => {
      const { checker, lobby, ircClient } = await setup({
        enabled: true,
        star_min: 0,
        star_max: 0,
        length_min: 0,
        length_max: 0,
        gamemode: 'osu',
        allow_convert: true
      });
      assert.equal(checker.getRegulationDescription(), 'Mode: osu!');

      checker.option.gamemode = PlayMode.Taiko;
      checker.option.allow_convert = true;
      assert.equal(checker.getRegulationDescription(), 'Mode: osu!taiko (Converts allowed)');
      checker.option.allow_convert = false;
      assert.equal(checker.getRegulationDescription(), 'Mode: osu!taiko (Converts disallowed)');

      checker.option.gamemode = PlayMode.CatchTheBeat;
      checker.option.allow_convert = true;
      assert.equal(checker.getRegulationDescription(), 'Mode: osu!catch (Converts allowed)');
      checker.option.allow_convert = false;
      assert.equal(checker.getRegulationDescription(), 'Mode: osu!catch (Converts disallowed)');

      checker.option.gamemode = PlayMode.OsuMania;
      checker.option.allow_convert = true;
      assert.equal(checker.getRegulationDescription(), 'Mode: osu!mania (Converts allowed)');
      checker.option.allow_convert = false;
      assert.equal(checker.getRegulationDescription(), 'Mode: osu!mania (Converts disallowed)');

      checker.option.gamemode = PlayMode.Osu;
      checker.option.star_max = 1;
      assert.equal(checker.getRegulationDescription(), 'Star rating <= 1.00, Mode: osu!');
      checker.option.star_max = 0;
      checker.option.star_min = 1;
      assert.equal(checker.getRegulationDescription(), '1.00 <= Star rating, Mode: osu!');
      checker.option.star_max = 2;
      checker.option.star_min = 1;
      assert.equal(checker.getRegulationDescription(), '1.00 <= Star rating <= 2.00, Mode: osu!');

      checker.option.star_max = 0;
      checker.option.star_min = 0;
      checker.option.length_max = 60;
      assert.equal(checker.getRegulationDescription(), 'Length <= 1:00, Mode: osu!');
      checker.option.length_max = 0;
      checker.option.length_min = 90;
      assert.equal(checker.getRegulationDescription(), '1:30 <= Length, Mode: osu!');
      checker.option.length_max = 120;
      checker.option.length_min = 30;
      assert.equal(checker.getRegulationDescription(), '0:30 <= Length <= 2:00, Mode: osu!');

      checker.option.star_max = 2;
      checker.option.star_min = 1;
      checker.option.length_max = 120;
      checker.option.length_min = 30;
      assert.equal(checker.getRegulationDescription(), '1.00 <= Star rating <= 2.00, 0:30 <= Length <= 2:00, Mode: osu!');

      checker.option.enabled = false;
      assert.equal(checker.getRegulationDescription(), 'Disabled (1.00 <= Star rating <= 2.00, 0:30 <= Length <= 2:00, Mode: osu!)');
    });
  });

  describe('regulation check tests', () => {
    const originalFetcher = BeatmapRepository.fetcher;
    const fakeFetcher = new FakeBeatmapFetcher();
    before(function () {
      BeatmapRepository.fetcher = fakeFetcher;
    });
    after(function () {
      BeatmapRepository.fetcher = originalFetcher;
    });

    it('default settings test', async () => {
      const { checker, lobby, ircClient } = await setup({
        enabled: true
      });
      const mapid = 100;
      fakeFetcher.setBeatmapProperties(mapid, 'test', PlayMode.Osu, 100, 5);
      await ircClient.emulateChangeMapAsync(0, mapid);
      assert.equal(checker.lastMapId, mapid);
    });

    it('star accept test', async () => {
      const { checker, lobby, ircClient } = await setup({
        star_max: 5,
        star_min: 2,
        length_max: 0,
        length_min: 0,
        enabled: true
      });
      fakeFetcher.setBeatmapProperties(100, 'test', PlayMode.Osu, 100, 5);
      await ircClient.emulateChangeMapAsync(0, 100);
      assert.equal(checker.lastMapId, 100);

      fakeFetcher.setBeatmapProperties(101, 'test', PlayMode.Osu, 100, 2);
      await ircClient.emulateChangeMapAsync(0, 101);
      assert.equal(checker.lastMapId, 101);
    });

    it('star no limit accept test', async () => {
      const { checker, lobby, ircClient } = await setup({
        star_max: 0,
        star_min: 2,
        length_max: 0,
        length_min: 0,
        enabled: true
      });
      fakeFetcher.setBeatmapProperties(100, 'test', PlayMode.Osu, 100, 5);
      await ircClient.emulateChangeMapAsync(0, 100);
      assert.equal(checker.lastMapId, 100);

      fakeFetcher.setBeatmapProperties(101, 'test', PlayMode.Osu, 100, 10);
      await ircClient.emulateChangeMapAsync(0, 101);
      assert.equal(checker.lastMapId, 101);
    });

    it('star reject test', async () => {
      const { checker, lobby, ircClient } = await setup({
        star_max: 5,
        star_min: 2,
        length_max: 0,
        length_min: 0,
        enabled: true
      });
      fakeFetcher.setBeatmapProperties(100, 'test', PlayMode.Osu, 100, 5.01);
      await ircClient.emulateChangeMapAsync(0, 100);
      assert.equal(checker.lastMapId, 0);

      fakeFetcher.setBeatmapProperties(101, 'test', PlayMode.Osu, 100, 1.99);
      await ircClient.emulateChangeMapAsync(0, 101);
      assert.equal(checker.lastMapId, 0);
    });

    it('length accept test', async () => {
      const { checker, lobby, ircClient } = await setup({
        star_max: 0,
        star_min: 0,
        length_max: 100,
        length_min: 10,
        enabled: true
      });
      fakeFetcher.setBeatmapProperties(100, 'test', PlayMode.Osu, 100, 5);
      await ircClient.emulateChangeMapAsync(0, 100);
      assert.equal(checker.lastMapId, 100);

      fakeFetcher.setBeatmapProperties(101, 'test', PlayMode.Osu, 10, 2);
      await ircClient.emulateChangeMapAsync(0, 101);
      assert.equal(checker.lastMapId, 101);
    });

    it('length no limit accept test', async () => {
      const { checker, lobby, ircClient } = await setup({
        star_max: 0,
        star_min: 0,
        length_max: 0,
        length_min: 10,
        enabled: true
      });
      fakeFetcher.setBeatmapProperties(100, 'test', PlayMode.Osu, 100, 5);
      await ircClient.emulateChangeMapAsync(0, 100);
      assert.equal(checker.lastMapId, 100);

      fakeFetcher.setBeatmapProperties(101, 'test', PlayMode.Osu, 10, 10);
      await ircClient.emulateChangeMapAsync(0, 101);
      assert.equal(checker.lastMapId, 101);
    });

    it('length reject test', async () => {
      const { checker, lobby, ircClient } = await setup({
        star_max: 5,
        star_min: 2,
        length_max: 100,
        length_min: 10,
        enabled: true
      });
      fakeFetcher.setBeatmapProperties(100, 'test', PlayMode.Osu, 101, 5.);
      await ircClient.emulateChangeMapAsync(0, 100);
      assert.equal(checker.lastMapId, 0);

      fakeFetcher.setBeatmapProperties(101, 'test', PlayMode.Osu, 9, 2);
      await ircClient.emulateChangeMapAsync(0, 101);
      assert.equal(checker.lastMapId, 0);
    });

    it('gamemode accept test', async () => {
      const { checker, lobby, ircClient } = await setup({
        star_max: 0,
        star_min: 0,
        length_max: 0,
        length_min: 0,
        gamemode: PlayMode.Osu,
        allow_convert: false,
        enabled: true
      });
      fakeFetcher.setBeatmapProperties(100, 'test', PlayMode.Osu, 100, 5);
      await ircClient.emulateChangeMapAsync(0, 100);
      assert.equal(checker.lastMapId, 100);

      checker.option.gamemode = PlayMode.Taiko;
      fakeFetcher.setBeatmapProperties(101, 'test', PlayMode.Taiko, 100, 2);
      await ircClient.emulateChangeMapAsync(0, 101);
      assert.equal(checker.lastMapId, 101);

      checker.option.gamemode = PlayMode.CatchTheBeat;
      fakeFetcher.setBeatmapProperties(102, 'test', PlayMode.CatchTheBeat, 100, 2);
      await ircClient.emulateChangeMapAsync(0, 102);
      assert.equal(checker.lastMapId, 102);

      checker.option.gamemode = PlayMode.OsuMania;
      fakeFetcher.setBeatmapProperties(103, 'test', PlayMode.OsuMania, 100, 2);
      await ircClient.emulateChangeMapAsync(0, 103);
      assert.equal(checker.lastMapId, 103);
    });

    it('gamemode allow convert accept test', async () => {
      const { checker, lobby, ircClient } = await setup({
        star_max: 0,
        star_min: 0,
        length_max: 0,
        length_min: 0,
        gamemode: PlayMode.Osu,
        allow_convert: true,
        enabled: true
      });
      fakeFetcher.setBeatmapProperties(100, 'test', PlayMode.Osu, 100, 5);
      await ircClient.emulateChangeMapAsync(0, 100);
      assert.equal(checker.lastMapId, 100);

      checker.option.gamemode = PlayMode.Taiko;
      fakeFetcher.setBeatmapProperties(101, 'test', PlayMode.Osu, 100, 2);
      await ircClient.emulateChangeMapAsync(0, 101);
      assert.equal(checker.lastMapId, 101);

      checker.option.gamemode = PlayMode.CatchTheBeat;
      fakeFetcher.setBeatmapProperties(102, 'test', PlayMode.Osu, 100, 2);
      await ircClient.emulateChangeMapAsync(0, 102);
      assert.equal(checker.lastMapId, 102);

      checker.option.gamemode = PlayMode.OsuMania;
      fakeFetcher.setBeatmapProperties(103, 'test', PlayMode.Osu, 100, 2);
      await ircClient.emulateChangeMapAsync(0, 103);
      assert.equal(checker.lastMapId, 103);
    });

    it('gamemode disallow convert reject test', async () => {
      const { checker, lobby, ircClient } = await setup({
        star_max: 0,
        star_min: 0,
        length_max: 0,
        length_min: 0,
        gamemode: PlayMode.Osu,
        allow_convert: false,
        enabled: true
      });
      fakeFetcher.setBeatmapProperties(100, 'test', PlayMode.Osu, 100, 5);
      await ircClient.emulateChangeMapAsync(0, 100);
      assert.equal(checker.lastMapId, 100);

      checker.option.gamemode = PlayMode.Taiko;
      fakeFetcher.setBeatmapProperties(101, 'test', PlayMode.Osu, 100, 2);
      await ircClient.emulateChangeMapAsync(0, 101);
      assert.equal(checker.lastMapId, 100);

      checker.option.gamemode = PlayMode.CatchTheBeat;
      fakeFetcher.setBeatmapProperties(102, 'test', PlayMode.Osu, 100, 2);
      await ircClient.emulateChangeMapAsync(0, 102);
      assert.equal(checker.lastMapId, 100);

      checker.option.gamemode = PlayMode.OsuMania;
      fakeFetcher.setBeatmapProperties(103, 'test', PlayMode.Osu, 100, 2);
      await ircClient.emulateChangeMapAsync(0, 103);
      assert.equal(checker.lastMapId, 100);
    });

    it('gamemode ous reject test', async () => {
      const { checker, lobby, ircClient } = await setup({
        star_max: 0,
        star_min: 0,
        length_max: 0,
        length_min: 0,
        gamemode: PlayMode.Osu,
        allow_convert: false,
        enabled: true
      });
      fakeFetcher.setBeatmapProperties(100, 'test', PlayMode.Taiko, 100, 5);
      await ircClient.emulateChangeMapAsync(0, 100);
      assert.equal(checker.lastMapId, 0);

      fakeFetcher.setBeatmapProperties(101, 'test', PlayMode.CatchTheBeat, 100, 2);
      await ircClient.emulateChangeMapAsync(0, 101);
      assert.equal(checker.lastMapId, 0);

      fakeFetcher.setBeatmapProperties(102, 'test', PlayMode.OsuMania, 100, 2);
      await ircClient.emulateChangeMapAsync(0, 102);
      assert.equal(checker.lastMapId, 0);
    });

    it('gamemode ous reject test', async () => {
      const { checker, lobby, ircClient } = await setup({
        star_max: 0,
        star_min: 0,
        length_max: 0,
        length_min: 0,
        gamemode: PlayMode.Osu,
        allow_convert: false,
        enabled: true
      });
      fakeFetcher.setBeatmapProperties(100, 'test', PlayMode.Taiko, 100, 5);
      await ircClient.emulateChangeMapAsync(0, 100);
      assert.equal(checker.lastMapId, 0);

      fakeFetcher.setBeatmapProperties(101, 'test', PlayMode.CatchTheBeat, 100, 2);
      await ircClient.emulateChangeMapAsync(0, 101);
      assert.equal(checker.lastMapId, 0);

      fakeFetcher.setBeatmapProperties(102, 'test', PlayMode.OsuMania, 100, 2);
      await ircClient.emulateChangeMapAsync(0, 102);
      assert.equal(checker.lastMapId, 0);
    });

    it('disalbed test', async () => {
      const { checker, lobby, ircClient } = await setup({
        star_max: 3,
        star_min: 2,
        length_max: 100,
        length_min: 20,
        gamemode: PlayMode.Osu,
        allow_convert: false,
        enabled: false
      });
      fakeFetcher.setBeatmapProperties(100, 'test', PlayMode.Taiko, 100, 15);
      await ircClient.emulateChangeMapAsync(0, 100);
      assert.equal(checker.lastMapId, 0);
      assert.equal(checker.numViolations, 0);

      fakeFetcher.setBeatmapProperties(101, 'test', PlayMode.CatchTheBeat, 1000, 1);
      await ircClient.emulateChangeMapAsync(0, 101);
      assert.equal(checker.lastMapId, 0);
      assert.equal(checker.numViolations, 0);

      fakeFetcher.setBeatmapProperties(102, 'test', PlayMode.OsuMania, 100, 5);
      await ircClient.emulateChangeMapAsync(0, 102);
      assert.equal(checker.lastMapId, 0);
      assert.equal(checker.numViolations, 0);
    });
  });

  describe('skip host tests', () => {
    const originalFetcher = BeatmapRepository.fetcher;
    const fakeFetcher = new FakeBeatmapFetcher();
    before(function () {
      BeatmapRepository.fetcher = fakeFetcher;
    });
    after(function () {
      BeatmapRepository.fetcher = originalFetcher;
    });
    it('num violation test', async () => {
      const { checker, lobby, ircClient } = await setup({
        star_max: 5,
        star_min: 0,
        length_max: 0,
        length_min: 0,
        gamemode: PlayMode.Osu,
        allow_convert: false,
        enabled: true
      });
      await ircClient.emulateChangeHost('p1');
      assert.equal(checker.numViolations, 0);
      fakeFetcher.setBeatmapProperties(100, 'test', PlayMode.Osu, 100, 6.55);
      await ircClient.emulateChangeMapAsync(0, 100);
      assert.equal(checker.lastMapId, 0);
      assert.equal(checker.numViolations, 1);

      await ircClient.emulateChangeMapAsync(0, 100);
      assert.equal(checker.lastMapId, 0);
      assert.equal(checker.numViolations, 2);

      await ircClient.emulateChangeMapAsync(0, 100);
      assert.equal(checker.lastMapId, 0);
      assert.equal(checker.numViolations, 3);

      await ircClient.emulateChangeHost('p2');
      assert.equal(checker.numViolations, 0);
    });
  });
});
