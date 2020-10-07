import { assert } from 'chai';
import log4js from "log4js";
import tu from "./TestUtils";
import config from "config";
import { fetchBeatmapsets } from "../webapi/Beatmapsets";
import { WebApiClient } from '../webapi/WebApiClient';

const client = new WebApiClient();

describe("Beatmapsets Tests", () => {
  before(() => {
    tu.configMochaAsSilent();
  });

  describe.skip("access server tests", () => {
    it("fetch ranked map from webpage test", async () => {
      const a = await fetchBeatmapsets(1795177);
      if (!a) {
        assert.fail();
      }
      assert.equal(a.artist, "Owl City");
      assert.equal(a.id, 859047);
      assert.equal(a.title, "Fireflies (Said The Sky Remix)");
    });
    it("fetch ranked map from api test", async () => {
      const a = await client.lookupBeatmap(1795177);
      if (!a) {
        assert.fail();
      }
      if (!a.beatmapset) {
        assert.fail();
      }
      assert.equal(a.beatmapset.artist, "Owl City");
      assert.equal(a.beatmapset_id, 859047);
      assert.equal(a.beatmapset.title, "Fireflies (Said The Sky Remix)");

      assert.equal(a.accuracy, 9);
      assert.equal(a.ar, 9.2);
    });
  });
});