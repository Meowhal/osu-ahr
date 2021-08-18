import { assert } from 'chai';
import { Lobby, Roles } from "..";
import { DummyIrcClient } from '../dummies';
import { DefaultRegulation, DefaultValidator, MapChecker } from '../plugins';
import tu from "./TestUtils";

import beatmap_sample from "./cases/beatmap_848345.json";
import beatmap_sample_fuilts from "./cases/beatmap_fruits_2578171.json";
import { Beatmap } from '../webapi/Beatmapsets';
import { getLogger } from "log4js";

describe("Map Checker Tests", function () {
  before(function () {
    tu.configMochaAsSilent();
  });

  async function setupAsync():
    Promise<{ checker: MapChecker, lobby: Lobby, ircClient: DummyIrcClient }> {
    const li = await tu.SetupLobbyAsync();
    const ma = new MapChecker(li.lobby, null,);
    return { checker: ma, ...li };
  }

  describe("Default Regulation Tests", function () {
    it("default regulation simple test", async () => {
      const reg: DefaultRegulation = {
        star_min: 5.00,
        star_max: 6.00,
        length_min: 0,
        length_max: 300,
        gamemode: "any"
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
        gamemode: "any"
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
        gamemode: "any"
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
        gamemode: "any"
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
        gamemode: "any"
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
        gamemode: "osu"
      }
      const map: Beatmap = Object.assign({}, beatmap_sample);

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
        gamemode: "mania"
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
        gamemode: ""
      }
      const map: Beatmap = Object.assign({}, beatmap_sample);

      const dr = new DefaultValidator(reg, getLogger("checker"));
      const r = dr.RateBeatmap(map);
      assert.equal(r.rate, 0);

    });
  });
});