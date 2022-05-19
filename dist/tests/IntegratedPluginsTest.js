"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const chai_1 = require("chai");
const CommandParser_1 = require("../parsers/CommandParser");
const AutoHostSelector_1 = require("../plugins/AutoHostSelector");
const HostSkipper_1 = require("../plugins/HostSkipper");
const TestUtils_1 = __importDefault(require("./TestUtils"));
describe('Integrated Plugins Tests', function () {
    before(function () {
        TestUtils_1.default.configMochaAsSilent();
    });
    describe('selector and skipper tests', function () {
        async function setup(selectorOption = {}, skipperOption = { afk_check_interval_ms: 0 }) {
            const li = await TestUtils_1.default.SetupLobbyAsync();
            const selector = new AutoHostSelector_1.AutoHostSelector(li.lobby, selectorOption);
            const skipper = new HostSkipper_1.HostSkipper(li.lobby, skipperOption);
            return { selector, skipper, ...li };
        }
        it('skip to test', async () => {
            const { selector, skipper, lobby, ircClient } = await setup();
            const ownerId = TestUtils_1.default.ownerNickname;
            await TestUtils_1.default.AddPlayersAsync([ownerId, 'p2', 'p3', 'p4'], ircClient);
            let owner = lobby.GetPlayer(ownerId);
            chai_1.assert.isNotNull(owner);
            owner = owner;
            chai_1.assert.isTrue(owner.isCreator);
            chai_1.assert.isTrue(owner.isAuthorized);
            chai_1.assert.isTrue(owner.isHost);
            await ircClient.emulateMatchAsync(0);
            TestUtils_1.default.assertHost('p2', lobby);
            let m = '*skipto p4';
            chai_1.assert.isTrue(CommandParser_1.parser.IsChatCommand(m));
            lobby.RaiseReceivedChatCommand(owner, m);
            await TestUtils_1.default.delayAsync(10);
            TestUtils_1.default.assertHost('p4', lobby);
            m = `*skipto ${owner.name}`;
            chai_1.assert.isTrue(CommandParser_1.parser.IsChatCommand(m));
            lobby.RaiseReceivedChatCommand(owner, m);
            await TestUtils_1.default.delayAsync(10);
            TestUtils_1.default.assertHost(ownerId, lobby);
            skipper.StopTimer();
        });
    });
});
//# sourceMappingURL=IntegratedPluginsTest.js.map