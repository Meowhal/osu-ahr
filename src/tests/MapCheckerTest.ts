import { assert } from 'chai';
import { Lobby, Roles } from "..";
import { DummyIrcClient } from '../dummies';
import { DefaultRegulation, DefaultValidator, MapChecker } from '../plugins';
import tu from "./TestUtils";

import beatmap_sample from "./cases/beatmap_848345.json";
import beatmap_sample_fuilts from "./cases/beatmap_fruits_2578171.json";
import { Beatmap } from '../webapi/Beatmapsets';

describe.only("Map Checker Tests", function () {
  before(function () {
    tu.configMochaAsSilent();
  });

  async function setupAsync():
    Promise<{ checker: MapChecker, lobby: Lobby, ircClient: DummyIrcClient }> {
    const li = await tu.SetupLobbyAsync();
    const ma = new MapChecker(li.lobby, null, );
    return { checker: ma, ...li };
  }

  describe("Default Regulation Tests", function () {
    it("default regulation simple test", async () => {
      const reg: DefaultRegulation = {
        star_min: 5.00,
        star_max: 6.00,
        length_min: 0,
        length_max: 300,
      }
      const {checker, ircClient, lobby} = await setupAsync();
      const map_star_5_55_length_93 : Beatmap = Object.assign(beatmap_sample, {});

      const dr = new DefaultValidator(reg);
      const r = dr.RateBeatmap(map_star_5_55_length_93, checker);
      assert.equal(r, 0);
    });
  });

});