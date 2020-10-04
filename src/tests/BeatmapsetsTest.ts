import { assert } from 'chai';
import log4js from "log4js";
import { fetchBeatmapsets } from "../webapi/Beatmapsets";
import tu from "./TestUtils";
describe("Beatmapsets Tests", () => {
  before(() => {
    tu.configMochaAsSilent();
  });

  describe.only("access server tests", () => {
    it("fetch ranked map test", async () => {
      const a = await fetchBeatmapsets(1795177);
      if (!a) {
        assert.fail();
      }
      assert.equal(a.artist, "Owl City");
      assert.equal(a.id, 859047);
      assert.equal(a.title, "Fireflies (Said The Sky Remix)");
    });
  });
});