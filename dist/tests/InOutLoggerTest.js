"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const InOutLogger_1 = require("../plugins/InOutLogger");
const TestUtils_1 = __importDefault(require("./TestUtils"));
describe.skip('In Out Logger Tests', function () {
    before(function () {
        TestUtils_1.default.configMochaVerbosely();
    });
    it('test', async () => {
        const { lobby, ircClient } = await TestUtils_1.default.SetupLobbyAsync();
        const logger = new InOutLogger_1.InOutLogger(lobby);
        const players = await TestUtils_1.default.AddPlayersAsync(5, ircClient);
        await ircClient.emulateMatchAsync();
        await ircClient.emulateMatchAsync();
        await ircClient.emulateRemovePlayerAsync(players[0]);
        await ircClient.emulateRemovePlayerAsync(players[1]);
        await ircClient.emulateRemovePlayerAsync(players[2]);
        await ircClient.emulateAddPlayerAsync('a');
        await ircClient.emulateAddPlayerAsync('b');
        await ircClient.emulateAddPlayerAsync('c');
        const t = ircClient.emulateMatchAsync(10);
        await TestUtils_1.default.delayAsync(1);
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
//# sourceMappingURL=InOutLoggerTest.js.map