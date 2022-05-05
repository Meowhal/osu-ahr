"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadEnvConfig = exports.loadEnvConfigWithTypeHint = exports.generateDefaultOptionTypeHint = exports.getConfig = exports.getIrcConfig = exports.CONFIG_OPTION = void 0;
const config_1 = __importDefault(require("config"));
exports.CONFIG_OPTION = {
    USE_ENV: false
};
function getIrcConfig() {
    const d = config_1.default.get("irc");
    const e = loadEnvConfig("irc", d);
    const c = { ...d, ...e };
    return c;
}
exports.getIrcConfig = getIrcConfig;
function getConfig(tag, c) {
    if (exports.CONFIG_OPTION.USE_ENV) {
        const d = config_1.default.get(tag);
        const e = loadEnvConfig(tag, d);
        return { ...d, ...c, ...e };
    }
    else {
        return { ...config_1.default.get(tag), ...c };
    }
}
exports.getConfig = getConfig;
function generateDefaultOptionTypeHint(option) {
    let r = [];
    for (const key in option) {
        if (option[key] === null || option[key] === undefined) {
            r.push({ key, nullable: true, type: "number" });
        }
        else if (Array.isArray(option[key])) {
            r.push({ key, nullable: false, type: "array" });
        }
        else {
            r.push({ key, nullable: false, type: typeof option[key] });
        }
    }
    return r;
}
exports.generateDefaultOptionTypeHint = generateDefaultOptionTypeHint;
function loadEnvConfigWithTypeHint(category, hints, env) {
    let r = {};
    for (const hint of hints) {
        const envKey = `ahr_${category}_${hint.key}`;
        let envVar = env[envKey];
        if (hint.nullable && (envVar === "null")) {
            r[hint.key] = null;
        }
        else if (envVar !== undefined) {
            switch (hint.type) {
                case "boolean":
                    let bool = envVar.toLowerCase();
                    if (bool === "true") {
                        r[hint.key] = true;
                    }
                    else if (bool === "false") {
                        r[hint.key] = false;
                    }
                    else {
                        throw new Error(`env:${envKey} type mismatched. ${hint.key} must be true/false but "${envVar}"`);
                    }
                    break;
                case "number":
                    let num = parseInt(envVar);
                    if (!Number.isNaN(num)) {
                        r[hint.key] = num;
                    }
                    else {
                        throw new Error(`env:${envKey} type mismatched. ${hint.key} must be number but "${envVar}"`);
                    }
                    break;
                case "string":
                    r[hint.key] = envVar;
                    break;
                case "array":
                    let arr = JSON.parse(envVar);
                    if (isStringArray(arr)) {
                        r[hint.key] = arr;
                    }
                    else {
                        throw new Error(`env:${envKey} type mismatched. ${hint.key} must be str array(e.g. ["aaa", "bbb", "ccc"] ) but "${envVar}"`);
                    }
                    break;
                default:
                    throw new Error(`env:${envKey} unsupported type. can't set ${hint.type} via env. ${envVar}`);
            }
        }
    }
    return r;
}
exports.loadEnvConfigWithTypeHint = loadEnvConfigWithTypeHint;
function isStringArray(arr) {
    if (!Array.isArray(arr))
        return false;
    return arr.every(v => typeof v === "string");
}
function loadEnvConfig(category, template) {
    const hints = generateDefaultOptionTypeHint(template);
    return loadEnvConfigWithTypeHint(category, hints, process.env);
}
exports.loadEnvConfig = loadEnvConfig;
//# sourceMappingURL=TypedConfig.js.map