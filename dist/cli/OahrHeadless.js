"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OahrHeadless = void 0;
const Loggers_1 = require("../Loggers");
const OahrBase_1 = require("./OahrBase");
const logger = (0, Loggers_1.getLogger)('hl');
class OahrHeadless extends OahrBase_1.OahrBase {
    constructor(client) {
        super(client);
        client.once('part', () => {
            logger.info('Part event detected. Closing...');
            process.exit(0);
        });
    }
    start(command, arg) {
        try {
            switch (command) {
                case 'm':
                    this.makeLobbyAsync(arg);
                    break;
                case 'e':
                    this.enterLobbyAsync(arg);
                    break;
                default:
                    process.exit(1);
            }
        }
        catch (e) {
            logger.error(`@OahrHeadless#start\n${e}`);
            process.exit(1);
        }
    }
}
exports.OahrHeadless = OahrHeadless;
//# sourceMappingURL=OahrHeadless.js.map