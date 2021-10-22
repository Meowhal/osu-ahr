import { assert } from 'chai';
import { Lobby, Roles } from "..";
import { DummyIrcClient } from '../dummies';
import { MapValidator, MapChecker, MapCheckerOption, MapCheckerUncheckedOption } from '../plugins';
import tu from "./TestUtils";

import beatmap_sample from "./cases/beatmap_848345.json";
import beatmap_sample_convert from "./cases/beatmap_1323207.json";
import beatmap_sample_fuilts from "./cases/beatmap_fruits_2578171.json";
import { Beatmap, FetchBeatmapError, FetchBeatmapErrorReason } from '../webapi/Beatmapsets';
import { getLogger } from "log4js";
import { BeatmapRepository } from '../webapi/BeatmapRepository';
import { PlayMode, TeamMode } from '../Modes';
import { Team } from 'discord.js';

describe.only("Map Checker Tests", function () {
  before(function () {
    tu.configMochaVerbosely();
  });

  async function setupAsync(option?: MapCheckerUncheckedOption):
    Promise<{ checker: MapChecker, lobby: Lobby, ircClient: DummyIrcClient }> {
    const defaultOption = {
      enabled: false,
      star_min: 0,
      star_max: 7.00,
      length_min: 0,
      length_max: 600,
      gamemode: "osu",
      num_violations_allowed: 3,
      allow_convert: true
    };

    option = { ...defaultOption, ...option };

    const li = await tu.SetupLobbyAsync();
    const checker = new MapChecker(li.lobby, null, option);
    await tu.AddPlayersAsync(["p1", "p2", "p3"], li.ircClient);
    return { checker, ...li };
  }

  describe.skip("fetch beatmap form osu.ppy.sh tests", () => {
    it("fetch osu map", async () => {
      const mapid = 3182198;
      const b = await BeatmapRepository.getBeatmap(mapid);
      assert.equal(b.mode, "osu");
      assert.equal(b.id, mapid);
      assert.equal(b.title, "aquamarine");
      assert.isUndefined(b.beatmapset);
    });

    it("fetch invalid map id", async () => {
      const mapid = 737157;
      try {
        const b = await BeatmapRepository.getBeatmap(mapid, PlayMode.Taiko);
        assert.fail();
      } catch (e: any) {
        if (e instanceof FetchBeatmapError) {
          assert.equal(e.reason, FetchBeatmapErrorReason.NotFound);
        } else {
          assert.fail();
        }
      }
    });

    it("fetch taiko map", async () => {
      const mapid = 2938202;
      const b = await BeatmapRepository.getBeatmap(mapid, PlayMode.Taiko);
      assert.equal(b.mode, "taiko");
      assert.equal(b.id, mapid);
      assert.equal(b.title, "The Old Blood");
    });

    it("fetch fruits map", async () => {
      const mapid = 3175483;
      const b = await BeatmapRepository.getBeatmap(mapid, PlayMode.CatchTheBeat);
      assert.equal(b.mode, "fruits");
      assert.equal(b.id, mapid);
      assert.equal(b.title, "Otter Pop (feat. Hollis)");
    });

    it("fetch mania map", async () => {
      const mapid = 3259543;
      const b = await BeatmapRepository.getBeatmap(mapid, PlayMode.OsuMania);
      assert.equal(b.mode, "mania");
      assert.equal(b.id, mapid);
      assert.equal(b.title, "Hanshoku-ki (Cut Ver.)");
    });

    it("fetch taiko map from osu only mapset as allowconvert", async () => {
      const mapid = 3182198;
      const b = await BeatmapRepository.getBeatmap(mapid, PlayMode.Taiko, true);
      assert.equal(b.mode, "taiko");
      assert.equal(b.id, mapid);
      assert.equal(b.title, "aquamarine");
    });

    it("fetch taiko map from osu only mapset as disallowconvert", async () => {
      const mapid = 3182198;
      try {
        const b = await BeatmapRepository.getBeatmap(mapid, PlayMode.Taiko, false);
        assert.fail();
      } catch (e: any) {
        if (e instanceof FetchBeatmapError) {
          assert.equal(e.reason, FetchBeatmapErrorReason.PlayModeMismatched);
        } else {
          assert.fail();
        }
      }
    });

    it("fetch osu map from taiko only mapset", async () => {
      const mapid = 2938202;
      try {
        const b = await BeatmapRepository.getBeatmap(mapid, PlayMode.Osu);
        assert.fail();
      } catch (e: any) {
        if (e instanceof FetchBeatmapError) {
          assert.equal(e.reason, FetchBeatmapErrorReason.PlayModeMismatched);
        } else {
          assert.fail();
        }
      }
    });

    it("cache test", async () => {
      const mapid = 3182198;
      BeatmapRepository.maps.clear();
      const b1 = await BeatmapRepository.getBeatmap(mapid);
      assert.equal(BeatmapRepository.maps.get(`${PlayMode.Osu.name}-${mapid}`), b1)
      const b2 = await BeatmapRepository.getBeatmap(mapid);
      assert.equal(b1, b2);
    })

  });

  describe("mapchecker option tests", () => {
    it("default option test", async () => {
      const { checker, lobby, ircClient } = await setupAsync();

      assert.equal(checker.option.allow_convert, true);
      assert.equal(checker.option.enabled, false);
      assert.equal(checker.option.gamemode, PlayMode.Osu);
      assert.equal(checker.option.length_max, 600);
      assert.equal(checker.option.length_min, 0);
      assert.equal(checker.option.num_violations_allowed, 3);
      assert.equal(checker.option.star_max, 7);
      assert.equal(checker.option.star_min, 0);

    });

    it("type matching option test", async () => {
      const { checker, lobby, ircClient } = await setupAsync({
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

    it("type mismatchinhg option test", async () => {
      const { checker, lobby, ircClient } = await setupAsync({
        allow_convert: "false",
        enabled: 1,
        gamemode: "fruits",
        length_max: "0",
        length_min: "100",
        num_violations_allowed: "1",
        star_max: "0",
        star_min: "3"
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

    it("type mismatchinhg option test", async () => {
      const { checker, lobby, ircClient } = await setupAsync({
        allow_convert: "false",
        enabled: 1,
        gamemode: "fruits",
        length_max: "0",
        length_min: "100",
        num_violations_allowed: "1",
        star_max: "0",
        star_min: "3"
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

    it("conflicted option test", async () => {
      const { checker, lobby, ircClient } = await setupAsync({
        length_max: "20",
        length_min: "50",
        star_max: "3",
        star_min: "5"
      });

      assert.equal(checker.option.length_max, 20);
      assert.equal(checker.option.length_min, 0);
      assert.equal(checker.option.star_max, 3);
      assert.equal(checker.option.star_min, 0);
    });

    it("0 max option test (not conflicted)", async () => {
      const { checker, lobby, ircClient } = await setupAsync({
        length_max: "0",
        length_min: "50",
        star_max: "0",
        star_min: "5"
      });

      assert.equal(checker.option.length_max, 0);
      assert.equal(checker.option.length_min, 50);
      assert.equal(checker.option.star_max, 0);
      assert.equal(checker.option.star_min, 5);
    });

    it("0 min option test (not conflicted)", async () => {
      const { checker, lobby, ircClient } = await setupAsync({
        length_max: "50",
        length_min: "0",
        star_max: "5",
        star_min: "0"
      });

      assert.equal(checker.option.length_max, 50);
      assert.equal(checker.option.length_min, 0);
      assert.equal(checker.option.star_max, 5);
      assert.equal(checker.option.star_min, 0);
    });


    it("abolished option test", async () => {
      const { checker, lobby, ircClient } = await setupAsync({
        allowConvert: false,
        num_violations_to_skip: 10,
      });

      assert.equal(checker.option.allow_convert, false);
      assert.equal(checker.option.num_violations_allowed, 10);
    });

    it("invalid option test : allow_convert", async () => {
      let threw = false;
      try {
        const { checker, lobby, ircClient } = await setupAsync({
          allow_convert: "aaaa"
        });
      } catch (e) {
        threw = true;
      }
      assert.isTrue(threw);
    });

    it("invalid option test : enabled", async () => {
      let threw = false;
      try {
        const { checker, lobby, ircClient } = await setupAsync({
          enabled: "aaaa"
        });
      } catch (e) {
        threw = true;
      }
      assert.isTrue(threw);
    });

    it("invalid option test : gamemode aaaa", async () => {
      let threw = false;
      try {
        const { checker, lobby, ircClient } = await setupAsync({
          gamemode: "aaaa"
        });
      } catch (e) {
        threw = true;
      }
      assert.isTrue(threw);
    });

    it("invalid option test : gamemode dsflkjsd", async () => {
      let threw = false;
      try {
        const { checker, lobby, ircClient } = await setupAsync({
          gamemode: "dsflkjsd"
        });
      } catch (e) {
        threw = true;
      }
      assert.isTrue(threw);
    });

    it("invalid option test : gamemode 123456", async () => {
      let threw = false;
      try {
        const { checker, lobby, ircClient } = await setupAsync({
          gamemode: 123456
        });
      } catch (e) {
        threw = true;
      }
      assert.isTrue(threw);
    });

    it("invalid option test : length_max", async () => {
      let threw = false;
      try {
        const { checker, lobby, ircClient } = await setupAsync({
          length_max: -1
        });
      } catch (e) {
        threw = true;
      }
      assert.isTrue(threw);
    });

    it("invalid option test : length_min", async () => {
      let threw = false;
      try {
        const { checker, lobby, ircClient } = await setupAsync({
          length_min: -1
        });
      } catch (e) {
        threw = true;
      }
      assert.isTrue(threw);
    });

    it("invalid option test : num_violations_allowed", async () => {
      let threw = false;
      try {
        const { checker, lobby, ircClient } = await setupAsync({
          num_violations_allowed: -1
        });
      } catch (e) {
        threw = true;
      }
      assert.isTrue(threw);
    });

    it("invalid option test : star_max", async () => {
      let threw = false;
      try {
        const { checker, lobby, ircClient } = await setupAsync({
          star_max: -1
        });
      } catch (e) {
        threw = true;
      }
      assert.isTrue(threw);
    });

    it("invalid option test : star_min", async () => {
      let threw = false;
      try {
        const { checker, lobby, ircClient } = await setupAsync({
          star_min: -1
        });
      } catch (e) {
        threw = true;
      }
      assert.isTrue(threw);
    });

    it("invalid option test : number NaN", async () => {
      let threw = false;
      try {
        const { checker, lobby, ircClient } = await setupAsync({
          star_min: NaN
        });
      } catch (e) {
        threw = true;
      }
      assert.isTrue(threw);
    });

    it("invalid option test : number string", async () => {
      let threw = false;
      try {
        const { checker, lobby, ircClient } = await setupAsync({
          star_min: "aaaa"
        });
      } catch (e) {
        threw = true;
      }
      assert.isTrue(threw);
    });
  });

  describe("owner command tests", () => {
    it("command: enabled ", async () => {
      const { checker, lobby, ircClient } = await setupAsync();

      lobby.GetOrMakePlayer("p1").setRole(Roles.Authorized);

      checker.option.enabled = true;
      ircClient.emulateMessage("p1", ircClient.channel, "*regulation enabled");
      assert.equal(checker.option.enabled, true);

      ircClient.emulateMessage("p1", ircClient.channel, "*regulation disabled");
      assert.equal(checker.option.enabled, false);

      ircClient.emulateMessage("p1", ircClient.channel, "*regulation enable");
      assert.equal(checker.option.enabled, true);

      ircClient.emulateMessage("p1", ircClient.channel, "*regulation disable");
      assert.equal(checker.option.enabled, false);
    });

    it("command: num_violations_allowed ", async () => {
      const { checker, lobby, ircClient } = await setupAsync();

      lobby.GetOrMakePlayer("p1").setRole(Roles.Authorized);

      checker.option.num_violations_allowed = 1;
      ircClient.emulateMessage("p1", ircClient.channel, "*regulation num_violations_allowed 3");
      assert.equal(checker.option.num_violations_allowed, 3);

      ircClient.emulateMessage("p1", ircClient.channel, "*regulation num_violations_allowed 10");
      assert.equal(checker.option.num_violations_allowed, 10);

      ircClient.emulateMessage("p1", ircClient.channel, "*regulation num_violations_to_skip 5");
      assert.equal(checker.option.num_violations_allowed, 5);

      ircClient.emulateMessage("p1", ircClient.channel, "*regulation num_violations_allowed 0");
      assert.equal(checker.option.num_violations_allowed, 0);

      checker.option.num_violations_allowed = 10
      ircClient.emulateMessage("p1", ircClient.channel, "*regulation num_violations_allowed");
      assert.equal(checker.option.num_violations_allowed, 10);

      ircClient.emulateMessage("p1", ircClient.channel, "*regulation num_violations_allowed asf");
      assert.equal(checker.option.num_violations_allowed, 10);

      ircClient.emulateMessage("p1", ircClient.channel, "*regulation num_violations_allowed NaN");
      assert.equal(checker.option.num_violations_allowed, 10);

      ircClient.emulateMessage("p1", ircClient.channel, "*regulation num_violations_to_skip");
      assert.equal(checker.option.num_violations_allowed, 10);
    });

    it("command: star_min ", async () => {
      const { checker, lobby, ircClient } = await setupAsync();

      lobby.GetOrMakePlayer("p1").setRole(Roles.Authorized);

      checker.option.star_min = 1;
      checker.option.star_max = 5;
      ircClient.emulateMessage("p1", ircClient.channel, "*regulation star_min 3");
      assert.equal(checker.option.star_min, 3);
      assert.equal(checker.option.star_max, 5);

      ircClient.emulateMessage("p1", ircClient.channel, "*regulation star_min 0");
      assert.equal(checker.option.star_min, 0);
      assert.equal(checker.option.star_max, 5);

      ircClient.emulateMessage("p1", ircClient.channel, "*regulation star_min 10");
      assert.equal(checker.option.star_min, 10);
      assert.equal(checker.option.star_max, 0);

      checker.option.star_min = 1;
      checker.option.star_max = 5;
      ircClient.emulateMessage("p1", ircClient.channel, "*regulation    starmin  5   ");
      assert.equal(checker.option.star_min, 5);
      assert.equal(checker.option.star_max, 0);

      checker.option.star_min = 1;
      checker.option.star_max = 5;
      ircClient.emulateMessage("p1", ircClient.channel, "*regulation difflow 3");
      assert.equal(checker.option.star_min, 3);
      assert.equal(checker.option.star_max, 5);

      checker.option.star_min = 1;
      ircClient.emulateMessage("p1", ircClient.channel, "*regulation star_min -3");
      assert.equal(checker.option.star_min, 1);
      assert.equal(checker.option.star_max, 5);

      ircClient.emulateMessage("p1", ircClient.channel, "*regulation star_min");
      assert.equal(checker.option.star_min, 1);
      assert.equal(checker.option.star_max, 5);

      ircClient.emulateMessage("p1", ircClient.channel, "*regulation star_min   ");
      assert.equal(checker.option.star_min, 1);
      assert.equal(checker.option.star_max, 5);

      ircClient.emulateMessage("p1", ircClient.channel, "*regulation star_min a");
      assert.equal(checker.option.star_min, 1);
      assert.equal(checker.option.star_max, 5);
    });

    it("command: star_max ", async () => {
      const { checker, lobby, ircClient } = await setupAsync();

      lobby.GetOrMakePlayer("p1").setRole(Roles.Authorized);

      checker.option.star_min = 3;
      checker.option.star_max = 5;
      ircClient.emulateMessage("p1", ircClient.channel, "*regulation star_max 4");
      assert.equal(checker.option.star_min, 3);
      assert.equal(checker.option.star_max, 4);

      ircClient.emulateMessage("p1", ircClient.channel, "*regulation star_max 0");
      assert.equal(checker.option.star_min, 3);
      assert.equal(checker.option.star_max, 0);

      ircClient.emulateMessage("p1", ircClient.channel, "*regulation star_max 10");
      assert.equal(checker.option.star_min, 3);
      assert.equal(checker.option.star_max, 10);

      ircClient.emulateMessage("p1", ircClient.channel, "*regulation star_max 2");
      assert.equal(checker.option.star_min, 0);
      assert.equal(checker.option.star_max, 2);

      checker.option.star_min = 3;
      checker.option.star_max = 5;
      ircClient.emulateMessage("p1", ircClient.channel, "*regulation    starmax  5   ");
      assert.equal(checker.option.star_min, 3);
      assert.equal(checker.option.star_max, 5);

      ircClient.emulateMessage("p1", ircClient.channel, "*regulation diffupperlimit 3");
      assert.equal(checker.option.star_min, 0);
      assert.equal(checker.option.star_max, 3);

      checker.option.star_min = 3;
      checker.option.star_max = 5;
      ircClient.emulateMessage("p1", ircClient.channel, "*regulation star_max -3");
      assert.equal(checker.option.star_min, 3);
      assert.equal(checker.option.star_max, 5);

      ircClient.emulateMessage("p1", ircClient.channel, "*regulation star_max");
      assert.equal(checker.option.star_min, 3);
      assert.equal(checker.option.star_max, 5);

      ircClient.emulateMessage("p1", ircClient.channel, "*regulation star_max   ");
      assert.equal(checker.option.star_min, 3);
      assert.equal(checker.option.star_max, 5);

      ircClient.emulateMessage("p1", ircClient.channel, "*regulation star_max a");
      assert.equal(checker.option.star_min, 3);
      assert.equal(checker.option.star_max, 5);
    });


    it("command: length_min ", async () => {
      const { checker, lobby, ircClient } = await setupAsync();

      lobby.GetOrMakePlayer("p1").setRole(Roles.Authorized);

      checker.option.length_min = 1;
      checker.option.length_max = 5;
      ircClient.emulateMessage("p1", ircClient.channel, "*regulation length_min 3");
      assert.equal(checker.option.length_min, 3);
      assert.equal(checker.option.length_max, 5);

      ircClient.emulateMessage("p1", ircClient.channel, "*regulation length_min 0");
      assert.equal(checker.option.length_min, 0);
      assert.equal(checker.option.length_max, 5);

      ircClient.emulateMessage("p1", ircClient.channel, "*regulation length_min 10");
      assert.equal(checker.option.length_min, 10);
      assert.equal(checker.option.length_max, 0);

      checker.option.length_min = 1;
      checker.option.length_max = 5;
      ircClient.emulateMessage("p1", ircClient.channel, "*regulation    lenmin  5   ");
      assert.equal(checker.option.length_min, 5);
      assert.equal(checker.option.length_max, 0);

      checker.option.length_min = 1;
      checker.option.length_max = 5;
      ircClient.emulateMessage("p1", ircClient.channel, "*regulation lenlower 3");
      assert.equal(checker.option.length_min, 3);
      assert.equal(checker.option.length_max, 5);

      checker.option.length_min = 1;
      ircClient.emulateMessage("p1", ircClient.channel, "*regulation length_min -3");
      assert.equal(checker.option.length_min, 1);
      assert.equal(checker.option.length_max, 5);

      ircClient.emulateMessage("p1", ircClient.channel, "*regulation length_min");
      assert.equal(checker.option.length_min, 1);
      assert.equal(checker.option.length_max, 5);

      ircClient.emulateMessage("p1", ircClient.channel, "*regulation length_min   ");
      assert.equal(checker.option.length_min, 1);
      assert.equal(checker.option.length_max, 5);

      ircClient.emulateMessage("p1", ircClient.channel, "*regulation length_min a");
      assert.equal(checker.option.length_min, 1);
      assert.equal(checker.option.length_max, 5);
    });

    it("command: length_max ", async () => {
      const { checker, lobby, ircClient } = await setupAsync();

      lobby.GetOrMakePlayer("p1").setRole(Roles.Authorized);

      checker.option.length_min = 3;
      checker.option.length_max = 5;
      ircClient.emulateMessage("p1", ircClient.channel, "*regulation length_max 4");
      assert.equal(checker.option.length_min, 3);
      assert.equal(checker.option.length_max, 4);

      ircClient.emulateMessage("p1", ircClient.channel, "*regulation length_max 0");
      assert.equal(checker.option.length_min, 3);
      assert.equal(checker.option.length_max, 0);

      ircClient.emulateMessage("p1", ircClient.channel, "*regulation length_max 10");
      assert.equal(checker.option.length_min, 3);
      assert.equal(checker.option.length_max, 10);

      ircClient.emulateMessage("p1", ircClient.channel, "*regulation length_max 2");
      assert.equal(checker.option.length_min, 0);
      assert.equal(checker.option.length_max, 2);

      checker.option.length_min = 3;
      checker.option.length_max = 5;
      ircClient.emulateMessage("p1", ircClient.channel, "*regulation    lenmax  5   ");
      assert.equal(checker.option.length_min, 3);
      assert.equal(checker.option.length_max, 5);

      ircClient.emulateMessage("p1", ircClient.channel, "*regulation lenupperlimit 3");
      assert.equal(checker.option.length_min, 0);
      assert.equal(checker.option.length_max, 3);

      checker.option.length_min = 3;
      checker.option.length_max = 5;
      ircClient.emulateMessage("p1", ircClient.channel, "*regulation length_max -3");
      assert.equal(checker.option.length_min, 3);
      assert.equal(checker.option.length_max, 5);

      ircClient.emulateMessage("p1", ircClient.channel, "*regulation length_max");
      assert.equal(checker.option.length_min, 3);
      assert.equal(checker.option.length_max, 5);

      ircClient.emulateMessage("p1", ircClient.channel, "*regulation length_max   ");
      assert.equal(checker.option.length_min, 3);
      assert.equal(checker.option.length_max, 5);

      ircClient.emulateMessage("p1", ircClient.channel, "*regulation length_max a");
      assert.equal(checker.option.length_min, 3);
      assert.equal(checker.option.length_max, 5);
    });

    it.only("command: gamemode ", async () => {
      const { checker, lobby, ircClient } = await setupAsync();

      lobby.GetOrMakePlayer("p1").setRole(Roles.Authorized);

      const initialValue = TeamMode.HeadToHead; // invalid mode
      checker.option.gamemode = initialValue;
      ircClient.emulateMessage("p1", ircClient.channel, "*regulation gamemode osu");
      assert.equal(checker.option.gamemode, PlayMode.Osu);

      checker.option.gamemode = initialValue;
      ircClient.emulateMessage("p1", ircClient.channel, "*regulation gamemode Osu");
      assert.equal(checker.option.gamemode, PlayMode.Osu);

      checker.option.gamemode = initialValue;
      ircClient.emulateMessage("p1", ircClient.channel, "*regulation gamemode 0");
      assert.equal(checker.option.gamemode, PlayMode.Osu);

      checker.option.gamemode = initialValue;
      ircClient.emulateMessage("p1", ircClient.channel, "*regulation gamemode taiko");
      assert.equal(checker.option.gamemode, PlayMode.Taiko);

      checker.option.gamemode = initialValue;
      ircClient.emulateMessage("p1", ircClient.channel, "*regulation gamemode TAIKO");
      assert.equal(checker.option.gamemode, PlayMode.Taiko);

      checker.option.gamemode = initialValue;
      ircClient.emulateMessage("p1", ircClient.channel, "*regulation gamemode 1");
      assert.equal(checker.option.gamemode, PlayMode.Taiko);

      checker.option.gamemode = initialValue;
      ircClient.emulateMessage("p1", ircClient.channel, "*regulation gamemode CatchTheBeat");
      assert.equal(checker.option.gamemode, PlayMode.CatchTheBeat);

      checker.option.gamemode = initialValue;
      ircClient.emulateMessage("p1", ircClient.channel, "*regulation gamemode fruits");
      assert.equal(checker.option.gamemode, PlayMode.CatchTheBeat);

      checker.option.gamemode = initialValue;
      ircClient.emulateMessage("p1", ircClient.channel, "*regulation gamemode catch");
      assert.equal(checker.option.gamemode, PlayMode.CatchTheBeat);

      checker.option.gamemode = initialValue;
      ircClient.emulateMessage("p1", ircClient.channel, "*regulation gamemode 2");
      assert.equal(checker.option.gamemode, PlayMode.CatchTheBeat);

      checker.option.gamemode = initialValue;
      ircClient.emulateMessage("p1", ircClient.channel, "*regulation gamemode OsuMania");
      assert.equal(checker.option.gamemode, PlayMode.OsuMania);

      checker.option.gamemode = initialValue;
      ircClient.emulateMessage("p1", ircClient.channel, "*regulation gamemode mania");
      assert.equal(checker.option.gamemode, PlayMode.OsuMania);

      checker.option.gamemode = initialValue;
      ircClient.emulateMessage("p1", ircClient.channel, "*regulation gamemode 3");
      assert.equal(checker.option.gamemode, PlayMode.OsuMania);

      checker.option.gamemode = initialValue;
      ircClient.emulateMessage("p1", ircClient.channel, "*regulation gamemode");
      assert.equal(checker.option.gamemode, initialValue);

      checker.option.gamemode = initialValue;
      ircClient.emulateMessage("p1", ircClient.channel, "*regulation gamemode boss");
      assert.equal(checker.option.gamemode, initialValue);

      checker.option.gamemode = initialValue;
      ircClient.emulateMessage("p1", ircClient.channel, "*regulation gamemode  asfsdf ");
      assert.equal(checker.option.gamemode, initialValue);

      checker.option.gamemode = initialValue;
      ircClient.emulateMessage("p1", ircClient.channel, "*regulation gamemode  * fdssdflk lsdf lksdfl3342r ");
      assert.equal(checker.option.gamemode, initialValue);
    });

    it.only("command: allow_convert ", async () => {
      const { checker, lobby, ircClient } = await setupAsync();

      lobby.GetOrMakePlayer("p1").setRole(Roles.Authorized);
    });
  });




});
/*
describe("Map Checker Tests", function () {
  before(function () {
    tu.configMochaAsSilent();
  });

  async function setupAsync(option?: Partial<MapCheckerOption>):
    Promise<{ checker: MapChecker, lobby: Lobby, ircClient: DummyIrcClient }> {
    const li = await tu.SetupLobbyAsync();
    const checker = new MapChecker(li.lobby, null, option);
    checker.osuMaps[beatmap_sample.id] = { ...beatmap_sample, fetchedAt: Date.now() };
    await tu.AddPlayersAsync(["p1", "p2", "p3"], li.ircClient);
    return { checker, ...li };
  }

  describe("Default Regulation Tests", function () {
    it("default regulation simple test", async () => {
      const reg: DefaultRegulation = {
        star_min: 5.00,
        star_max: 6.00,
        length_min: 0,
        length_max: 300,
        gamemode: "osu",
        allow_convert: 0
      }
      const map: Beatmap = Object.assign({}, beatmap_sample);

      const dr = new MapValidator(reg, getLogger("checker"));
      const r = dr.RateBeatmap(map);
      assert.equal(r.rate, 0);
    });

    it("default regulation out of regulation diff test", async () => {
      const reg: DefaultRegulation = {
        star_min: 5.00,
        star_max: 6.00,
        length_min: 0,
        length_max: 300,
        gamemode: "osu",
        allow_convert: 0
      }
      const map: Beatmap = Object.assign({}, beatmap_sample);

      const dr = new MapValidator(reg, getLogger("checker"));
      map.difficulty_rating = 10;
      let r = dr.RateBeatmap(map);
      assert.notEqual(r.rate, 0);

      map.difficulty_rating = 1;
      r = dr.RateBeatmap(map);
      assert.notEqual(r.rate, 0);

    });

    it("default regulation out of regulation length test", async () => {
      const reg: DefaultRegulation = {
        star_min: 5.00,
        star_max: 6.00,
        length_min: 0,
        length_max: 300,
        gamemode: "osu",
        allow_convert: 0
      }
      const map: Beatmap = Object.assign({}, beatmap_sample);

      const dr = new MapValidator(reg, getLogger("checker"));
      map.total_length = 500;
      let r = dr.RateBeatmap(map);
      assert.notEqual(r.rate, 0);
    });

    it("star no cap", async () => {
      const reg: DefaultRegulation = {
        star_min: 3.00,
        star_max: 0,
        length_min: 0,
        length_max: 300,
        gamemode: "osu",
        allow_convert: 0
      }
      const map: Beatmap = Object.assign({}, beatmap_sample);

      const dr = new MapValidator(reg, getLogger("checker"));
      let r = dr.RateBeatmap(map);
      assert.equal(r.rate, 0);
    });

    it("length no cap", async () => {
      const reg: DefaultRegulation = {
        star_min: 3.00,
        star_max: 0,
        length_min: 0,
        length_max: 0,
        gamemode: "osu",
        allow_convert: 0
      }
      const map: Beatmap = Object.assign({}, beatmap_sample);

      const dr = new MapValidator(reg, getLogger("checker"));
      let r = dr.RateBeatmap(map);
      assert.equal(r.rate, 0);
    });

    it("gamemode accept test", async () => {
      const reg: DefaultRegulation = {
        star_min: 5.00,
        star_max: 6.00,
        length_min: 0,
        length_max: 300,
        gamemode: "osu",
        allow_convert: 0
      }
      const map: Beatmap = Object.assign({}, beatmap_sample);

      const dr = new MapValidator(reg, getLogger("checker"));
      const r = dr.RateBeatmap(map);
      assert.equal(r.rate, 0);

    });

    it("gamemode accept convert test", async () => {
      const reg: DefaultRegulation = {
        star_min: 1.00,
        star_max: 6.00,
        length_min: 0,
        length_max: 300,
        gamemode: "mania",
        allow_convert: 1
      }
      const map: Beatmap = Object.assign({}, beatmap_sample_convert);

      const dr = new MapValidator(reg, getLogger("checker"));
      const r = dr.RateBeatmap(map);
      assert.equal(r.rate, 0);

    });

    it("gamemode reject test2", async () => {
      const reg: DefaultRegulation = {
        star_min: 5.00,
        star_max: 6.00,
        length_min: 0,
        length_max: 300,
        gamemode: "mania",
        allow_convert: 0
      }
      const map: Beatmap = Object.assign({}, beatmap_sample);

      const dr = new MapValidator(reg, getLogger("checker"));
      const r = dr.RateBeatmap(map);
      assert.notEqual(r.rate, 0);

    });

    it("gamemode empty", async () => {
      const reg: DefaultRegulation = {
        star_min: 5.00,
        star_max: 6.00,
        length_min: 0,
        length_max: 300,
        gamemode: "",
        allow_convert: 0
      }
      const map: Beatmap = Object.assign({}, beatmap_sample);

      const dr = new MapValidator(reg, getLogger("checker"));
      const r = dr.RateBeatmap(map);
      assert.equal(r.rate, 0);

    });
  });
  describe("plugin tests", () => {

    it("accept map test", async () => {
      const { checker, lobby, ircClient } = await setupAsync({
        enabled: true,
        num_violations_allowed: 2,
        cache_expired_day: 10,
        star_min: 5.00,
        star_max: 6.00,
        length_min: 0,
        length_max: 300,
        gamemode: "osu",
      });

      await ircClient.emulateChangeMapAsync(0, beatmap_sample.id);
      assert.equal(lobby.mapId, beatmap_sample.id);
    });

    it("reject map test", async () => {
      const { checker, lobby, ircClient } = await setupAsync({
        enabled: true,
        num_violations_allowed: 2,
        cache_expired_day: 10,
        star_min: 1.00,
        star_max: 3.00,
        length_min: 0,
        length_max: 300,
        gamemode: "osu",
      });

      await ircClient.emulateChangeMapAsync(0, beatmap_sample.id);
      await tu.delayAsync(10);
      assert.notEqual(lobby.mapId, beatmap_sample.id);
      // let skipCalled = false;

      // lobby.PluginMessage.once(({ type }) => {
      //   if (type == "skip") {
      //     skipCalled = true;
      //   }
      // });

    });

    it("reject and skip test", async () => {
      const { checker, lobby, ircClient } = await setupAsync({
        enabled: true,
        num_violations_allowed: 2,
        cache_expired_day: 10,
        star_min: 1.00,
        star_max: 3.00,
        length_min: 0,
        length_max: 300,
        gamemode: "osu",
      });

      let skipCalled = false;
      lobby.PluginMessage.once(({ type }) => {
        if (type == "skip") {
          skipCalled = true;
        }
      });

      ircClient.emulateChangeHost("p1");

      await ircClient.emulateChangeMapAsync(0, beatmap_sample.id);
      await tu.delayAsync(10);
      assert.notEqual(lobby.mapId, beatmap_sample.id);
      assert.isFalse(skipCalled);

      await ircClient.emulateChangeMapAsync(0, beatmap_sample.id);
      await tu.delayAsync(10);
      assert.notEqual(lobby.mapId, beatmap_sample.id);
      assert.isTrue(skipCalled);

    });

    it("reject and not skip test", async () => {
      const { checker, lobby, ircClient } = await setupAsync({
        enabled: true,
        num_violations_allowed: 0,
        cache_expired_day: 10,
        star_min: 1.00,
        star_max: 3.00,
        length_min: 0,
        length_max: 300,
        gamemode: "osu",
      });

      let skipCalled = false;
      lobby.PluginMessage.once(({ type }) => {
        if (type == "skip") {
          skipCalled = true;
        }
      });

      ircClient.emulateChangeHost("p1");

      await ircClient.emulateChangeMapAsync(0, beatmap_sample.id);
      await tu.delayAsync(10);
      assert.notEqual(lobby.mapId, beatmap_sample.id);
      assert.isFalse(skipCalled);

      await ircClient.emulateChangeMapAsync(0, beatmap_sample.id);
      await tu.delayAsync(10);
      assert.notEqual(lobby.mapId, beatmap_sample.id);
      assert.isFalse(skipCalled);

    });
  });
});*/