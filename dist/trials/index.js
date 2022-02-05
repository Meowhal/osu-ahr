"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const log4js_1 = __importDefault(require("log4js"));
log4js_1.default.configure("config/log_mocha.json");
//import * as trial from './WebServerTrial';
//trial.webServerTrial();
const DiscordTrial_1 = require("./DiscordTrial");
(0, DiscordTrial_1.trial)();
//# sourceMappingURL=index.js.map