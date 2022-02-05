"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const plugins_1 = require("../plugins");
const TestUtils_1 = __importDefault(require("./TestUtils"));
const parsers_1 = require("../parsers");
describe("Map Recaster Tests", function () {
    before(function () {
        TestUtils_1.default.configMochaAsSilent();
    });
    async function setupAsync() {
        const li = await TestUtils_1.default.SetupLobbyAsync();
        const ma = new plugins_1.MapRecaster(li.lobby);
        return { recaster: ma, ...li };
    }
    it("recast test", async () => {
        const { recaster, lobby, ircClient } = await setupAsync();
        const players = await TestUtils_1.default.AddPlayersAsync(3, ircClient);
        await ircClient.emulateChangeMapAsync(0);
        const mapid = lobby.mapId;
        const t1 = TestUtils_1.default.assertBanchoRespond(lobby, parsers_1.BanchoResponseType.MpBeatmapChanged, (b => b.params[0] == mapid), 10);
        ircClient.emulateMessage(players[0], ircClient.channel, "!update");
        await t1;
    });
    it("request twice test", async () => {
        const { recaster, lobby, ircClient } = await setupAsync();
        const players = await TestUtils_1.default.AddPlayersAsync(3, ircClient);
        await ircClient.emulateChangeMapAsync(0);
        const mapid = lobby.mapId;
        const t1 = TestUtils_1.default.assertBanchoRespond(lobby, parsers_1.BanchoResponseType.MpBeatmapChanged, (b => b.params[0] == mapid), 10);
        ircClient.emulateMessage(players[0], ircClient.channel, "!update");
        await t1;
        const t2 = TestUtils_1.default.assertBanchoNotRespond(lobby, parsers_1.BanchoResponseType.MpBeatmapChanged, (b => b.params[0] == mapid), 10);
        ircClient.emulateMessage(players[1], ircClient.channel, "!update");
        await t2;
    });
    it("can update every time player changes map", async () => {
        const { recaster, lobby, ircClient } = await setupAsync();
        const players = await TestUtils_1.default.AddPlayersAsync(3, ircClient);
        await ircClient.emulateChangeMapAsync(0);
        let mapid = lobby.mapId;
        const t1 = TestUtils_1.default.assertBanchoRespond(lobby, parsers_1.BanchoResponseType.MpBeatmapChanged, (b => b.params[0] == mapid), 10);
        ircClient.emulateMessage(players[0], ircClient.channel, "!update");
        await t1;
        await ircClient.emulateChangeMapAsync(0);
        mapid = lobby.mapId;
        const t2 = TestUtils_1.default.assertBanchoRespond(lobby, parsers_1.BanchoResponseType.MpBeatmapChanged, (b => b.params[0] == mapid), 10);
        ircClient.emulateMessage(players[1], ircClient.channel, "!update");
        await t2;
        await ircClient.emulateChangeMapAsync(0);
        mapid = lobby.mapId;
        const t3 = TestUtils_1.default.assertBanchoRespond(lobby, parsers_1.BanchoResponseType.MpBeatmapChanged, (b => b.params[0] == mapid), 10);
        ircClient.emulateMessage(players[1], ircClient.channel, "!update");
        await t3;
    });
});
//# sourceMappingURL=MapRecasterTest.js.map