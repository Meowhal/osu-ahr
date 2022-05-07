"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const LogServer_1 = require("../web/LogServer");
const config_1 = __importDefault(require("config"));
const options = config_1.default.get('LogServer');
(0, LogServer_1.startLogServer)(options.port);
//# sourceMappingURL=LogServer.js.map