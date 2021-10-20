import { assert } from 'chai';
import { Lobby, Roles } from "..";
import { DummyIrcClient } from '../dummies';
import { DefaultRegulation, DefaultValidator, MapChecker, MapCheckerOption } from '../plugins';
import tu from "./TestUtils";

import beatmap_sample from "./cases/beatmap_848345.json";
import beatmap_sample_convert from "./cases/beatmap_1323207.json";
import beatmap_sample_fuilts from "./cases/beatmap_fruits_2578171.json";
import { Beatmap } from '../webapi/Beatmapsets';
import { getLogger } from "log4js";

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

      const dr = new DefaultValidator(reg, getLogger("checker"));
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

      const dr = new DefaultValidator(reg, getLogger("checker"));
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

      const dr = new DefaultValidator(reg, getLogger("checker"));
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

      const dr = new DefaultValidator(reg, getLogger("checker"));
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

      const dr = new DefaultValidator(reg, getLogger("checker"));
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

      const dr = new DefaultValidator(reg, getLogger("checker"));
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

      const dr = new DefaultValidator(reg, getLogger("checker"));
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

      const dr = new DefaultValidator(reg, getLogger("checker"));
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

      const dr = new DefaultValidator(reg, getLogger("checker"));
      const r = dr.RateBeatmap(map);
      assert.equal(r.rate, 0);

    });
  });
  describe("plugin tests", () => {

    it("accept map test", async () => {
      const { checker, lobby, ircClient } = await setupAsync({
        num_violations_to_skip: 2,
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
        num_violations_to_skip: 2,
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
      /*let skipCalled = false;

      lobby.PluginMessage.once(({ type }) => {
        if (type == "skip") {
          skipCalled = true;
        }
      });
*/
    });

    it("reject and skip test", async () => {
      const { checker, lobby, ircClient } = await setupAsync({
        num_violations_to_skip: 2,
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
        num_violations_to_skip: 0,
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
});