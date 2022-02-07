"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getConfig = exports.getIrcConfig = void 0;
const config_1 = __importDefault(require("config"));
function getIrcConfig() {
    return config_1.default.get("irc");
}
exports.getIrcConfig = getIrcConfig;
function getConfig(ctor) {
    let tag = "";
    let c = config_1.default.get(tag);
    return new ctor(c);
}
exports.getConfig = getConfig;
//# sourceMappingURL=TypedConfig.js.map