"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadEnvConfig = exports.loadEnvConfigWithTypeHint = exports.generateDefaultOptionTypeHint = exports.getConfig = exports.getIrcConfig = exports.CONFIG_OPTION = void 0;
require("dotenv/config");
const config_1 = __importDefault(require("config"));
const Loggers_1 = require("./Loggers");
const configLogger = (0, Loggers_1.getLogger)('cfg');
exports.CONFIG_OPTION = {
    USE_ENV: false,
    PRINT_LOADED_ENV_CONFIG: false,
};
function getIrcConfig() {
    const d = config_1.default.get('irc');
    const e = loadEnvConfig('irc', d, [
        { key: 'server', nullable: false, type: 'string' },
        { key: 'nick', nullable: false, type: 'string' },
        { key: 'port', nullable: false, type: 'number' },
        { key: 'password', nullable: false, type: 'string' }
    ]);
    const c = { ...d, ...e };
    c.opt = { ...c.opt };
    if (typeof e.port === 'number') {
        c.opt.port = e.port;
    }
    if (typeof e.password === 'string') {
        c.opt.password = e.password;
    }
    return c;
}
exports.getIrcConfig = getIrcConfig;
/**
 * craete a config from config files, in-code options and environment variables.
 *   files -> Default settings, etc.
 *   in-code options -> For setting directly from code for testing and debugging.
 *   environment variables -> For confidential. Highest priority.
 * @param tag
 * @param option
 * @returns
 */
function getConfig(tag, option, hints) {
    if (exports.CONFIG_OPTION.USE_ENV) {
        const d = config_1.default.get(tag);
        const e = loadEnvConfig(tag, d, hints);
        return { ...d, ...option, ...e };
    }
    else {
        return { ...config_1.default.get(tag), ...option };
    }
}
exports.getConfig = getConfig;
function generateDefaultOptionTypeHint(option) {
    const r = [];
    for (const key in option) {
        if (option[key] === null || option[key] === undefined) {
            r.push({ key, nullable: true, type: 'number' });
        }
        else if (Array.isArray(option[key])) {
            r.push({ key, nullable: false, type: 'array' });
        }
        else {
            r.push({ key, nullable: false, type: typeof option[key] });
        }
    }
    return r;
}
exports.generateDefaultOptionTypeHint = generateDefaultOptionTypeHint;
function genEnvKey(category, key) {
    return `ahr_${category}_${key}`;
}
function loadEnvConfigWithTypeHint(category, hints, env) {
    const r = {};
    for (const hint of hints) {
        const envKey = genEnvKey(category, hint.key);
        const envVar = env[envKey];
        if (hint.nullable && (envVar === 'null')) {
            r[hint.key] = null;
        }
        else if (envVar !== undefined) {
            switch (hint.type) {
                case 'boolean':
                    const bool = envVar.toLowerCase();
                    if (bool === 'true') {
                        r[hint.key] = true;
                    }
                    else if (bool === 'false') {
                        r[hint.key] = false;
                    }
                    else {
                        throw new Error(`Environment key ${envKey}'s type mismatched. ${hint.key} must be a boolean but received "${envVar}"`);
                    }
                    break;
                case 'number':
                    const num = parseFloat(envVar);
                    if (!Number.isNaN(num)) {
                        r[hint.key] = num;
                    }
                    else {
                        throw new Error(`Environment key ${envKey}'s type mismatched. ${hint.key} must be a number but received "${envVar}"`);
                    }
                    break;
                case 'string':
                    r[hint.key] = envVar;
                    break;
                case 'array':
                    const arr = JSON.parse(envVar);
                    if (isStringArray(arr)) {
                        r[hint.key] = arr;
                    }
                    else {
                        throw new Error(`Environment key ${envKey}'s type mismatched. ${hint.key} must be a string array, e.g., ["aaa", "bbb", "ccc"] but received "${envVar}"`);
                    }
                    break;
                default:
                    throw new Error(`Environment key ${envKey} has an unsupported type. Cannot set ${hint.type} via environment. Received ${envVar}`);
            }
        }
    }
    if (exports.CONFIG_OPTION.PRINT_LOADED_ENV_CONFIG) {
        for (const key in r) {
            if (key.toLocaleLowerCase().match(/(password)|(token)/)) {
                configLogger.info(`Loaded environment key: ${genEnvKey(category, key)}=${'*'.repeat(r[key]?.toString().length ?? 3)}`);
            }
            else {
                configLogger.info(`Loaded environment key: ${genEnvKey(category, key)}=${r[key]}`);
            }
        }
    }
    return r;
}
exports.loadEnvConfigWithTypeHint = loadEnvConfigWithTypeHint;
function isStringArray(arr) {
    if (!Array.isArray(arr))
        return false;
    return arr.every(v => typeof v === 'string');
}
function loadEnvConfig(category, template, hints) {
    if (hints === undefined) {
        hints = generateDefaultOptionTypeHint(template);
    }
    return loadEnvConfigWithTypeHint(category, hints, process.env);
}
exports.loadEnvConfig = loadEnvConfig;
//# sourceMappingURL=TypedConfig.js.map