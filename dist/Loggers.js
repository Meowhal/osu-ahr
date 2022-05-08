"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getLogger = void 0;
const log4js_1 = __importDefault(require("log4js"));
function selectConfigPath() {
    const exeFile = process.argv[1];
    const hasVerboseFlag = process.argv.some(v => v === '--verbose' || v === '-v');
    if (exeFile.includes('discord')) {
        return './config/log_discord.json';
    }
    else if (exeFile.includes('mocha')) {
        if (hasVerboseFlag) {
            return './config/log_mocha_verbose.json';
        }
        else {
            return './config/log_mocha.json';
        }
    }
    else if (process.env.NODE_ENV !== 'production' || hasVerboseFlag) {
        return './config/log_cli_verbose.json';
    }
    else {
        return './config/log_cli.json';
    }
}
const path = selectConfigPath();
console.log(`load log4js configuration from ${path}`);
const l = log4js_1.default.configure(path);
function getLogger(category) {
    return l.getLogger(category);
}
exports.getLogger = getLogger;
//# sourceMappingURL=Loggers.js.map