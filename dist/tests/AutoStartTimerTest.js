"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const chai_1 = require("chai");
const Player_1 = require("../Player");
const AutoStartTimer_1 = require("../plugins/AutoStartTimer");
const TestUtils_1 = __importDefault(require("./TestUtils"));
describe('AutoStartTimerTest', function () {
    before(function () {
        TestUtils_1.default.configMochaAsSilent();
    });
    async function prepare(enabled = true, doClearHost = true, waitingTime = 60) {
        const li = await TestUtils_1.default.SetupLobbyAsync();
        const option = {
            enabled: enabled,
            doClearHost: doClearHost,
            waitingTime: waitingTime
        };
        const players = await TestUtils_1.default.AddPlayersAsync(3, li.ircClient);
        const astimer = new AutoStartTimer_1.AutoStartTimer(li.lobby, option);
        return { astimer, players, ...li };
    }
    describe('auto start tests', function () {
        it('normal operation test', async () => {
            const { lobby, ircClient } = await prepare(true, true, 60);
            let c = 0, d = 0;
            lobby.SentMessage.on(a => {
                chai_1.assert.equal(a.message, '!mp clearhost');
                c++;
            });
            lobby.PluginMessage.on(a => {
                if (d === 0) {
                    chai_1.assert.equal(a.type, 'mp_abort_start');
                }
                else if (d === 1) {
                    chai_1.assert.equal(a.type, 'mp_start');
                    chai_1.assert.equal(a.args[0], '60');
                }
                d++;
            });
            await ircClient.emulateChangeMapAsync();
            chai_1.assert.equal(c, 1);
            chai_1.assert.equal(d, 2);
        });
        it('no clearhost test', async () => {
            const { lobby, ircClient } = await prepare(true, false, 60);
            let c = 0, d = 0;
            lobby.SentMessage.on(a => {
                chai_1.assert.equal(a.message, '!mp clearhost');
                c++;
            });
            lobby.PluginMessage.on(a => {
                if (d === 0) {
                    chai_1.assert.equal(a.type, 'mp_abort_start');
                }
                else if (d === 1) {
                    chai_1.assert.equal(a.type, 'mp_start');
                    chai_1.assert.equal(a.args[0], '60');
                }
                d++;
            });
            await ircClient.emulateChangeMapAsync();
            chai_1.assert.equal(c, 0);
            chai_1.assert.equal(d, 2);
        });
        it('disabled test', async () => {
            const { lobby, ircClient } = await prepare(false, false, 60);
            let c = 0;
            lobby.SentMessage.on(a => {
                c++;
            });
            await ircClient.emulateChangeMapAsync();
            chai_1.assert.equal(c, 0);
        });
        it('timer cancel test', async () => {
            const { lobby, ircClient } = await prepare(true, false, 60);
            let d = 0;
            lobby.PluginMessage.on(a => {
                if (d === 0 || d === 2) {
                    chai_1.assert.equal(a.type, 'mp_abort_start');
                }
                else if (d === 1 || d === 3) {
                    chai_1.assert.equal(a.type, 'mp_start');
                    chai_1.assert.equal(a.args[0], '60');
                }
                d++;
            });
            await ircClient.emulateChangeMapAsync();
            await ircClient.emulateChangeMapAsync();
            chai_1.assert.equal(d, 4);
        });
        it('timer will cancel when host changed', async () => {
            const { players, lobby, ircClient } = await prepare(true, true, 60);
            let c = 0;
            lobby.SentMessage.on(a => {
                if (c === 2 || c === 5) {
                    chai_1.assert.equal(a.message, '!mp clearhost');
                }
                c++;
            });
            lobby.PluginMessage.on(a => {
                if (c === 0 || c === 3) {
                    chai_1.assert.equal(a.type, 'mp_abort_start');
                }
                else if (c === 1 || c === 4) {
                    chai_1.assert.equal(a.type, 'mp_start');
                    chai_1.assert.equal(a.args[0], '60');
                }
                c++;
            });
            await ircClient.emulateChangeMapAsync();
            lobby.RaiseHostChanged(players[1]);
            await ircClient.emulateChangeMapAsync();
            chai_1.assert.equal(c, 6);
        });
    });
    describe('option tests', function () {
        function assertOptions(astimer, enabled, doClearHost, waitingTime) {
            chai_1.assert.equal(astimer.option.enabled, enabled);
            chai_1.assert.equal(astimer.option.doClearHost, doClearHost);
            chai_1.assert.equal(astimer.option.waitingTime, waitingTime);
        }
        it('option setting test', async () => {
            const { astimer, lobby, ircClient } = await prepare(true, false, 60);
            assertOptions(astimer, true, false, 60);
            const p1 = lobby.GetOrMakePlayer('p1');
            p1.setRole(Player_1.Roles.Authorized);
            lobby.RaiseReceivedChatCommand(p1, '*autostart_disable');
            assertOptions(astimer, false, false, 60);
            lobby.RaiseReceivedChatCommand(p1, '*autostart_enable');
            assertOptions(astimer, true, false, 60);
            lobby.RaiseReceivedChatCommand(p1, '*autostart_clearhost_enable');
            assertOptions(astimer, true, true, 60);
            lobby.RaiseReceivedChatCommand(p1, '*atuostart_clearhost_disable');
            assertOptions(astimer, true, false, 60);
            lobby.RaiseReceivedChatCommand(p1, '*autostart_time 50');
            assertOptions(astimer, true, false, 50);
            lobby.RaiseReceivedChatCommand(p1, '*autostart_time -50');
            assertOptions(astimer, true, false, 15);
        });
    });
});
//# sourceMappingURL=AutoStartTimerTest.js.map