"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const LobbyTerminator_1 = require("../plugins/LobbyTerminator");
const TestUtils_1 = __importDefault(require("./TestUtils"));
describe.skip('Lobby Terminator Tests', function () {
    before(function () {
        TestUtils_1.default.configMochaVerbosely();
    });
    async function setupAsync(interval = 10) {
        const { lobby, ircClient } = await TestUtils_1.default.SetupLobbyAsync();
        const terminator = new LobbyTerminator_1.LobbyTerminator(lobby);
        terminator.multilimeMessageInterval = interval;
        return { terminator, lobby, ircClient };
    }
    it('CloseLobby time', async () => {
        const { terminator, lobby, ircClient } = await setupAsync();
        terminator.CloseLobby(100);
    });
});
//# sourceMappingURL=LobbyTerminatorTest.js.map