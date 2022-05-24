"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchUpdateTrial = exports.getTokenTrial = exports.getGuestTokenTrial = exports.trial = void 0;
const axios_1 = __importDefault(require("axios"));
const config_1 = __importDefault(require("config"));
const WebApiClient_1 = require("../webapi/WebApiClient");
const oAuthConfig = config_1.default.get('WebApi');
async function trial() {
    //getTokenTrial();
    const client = WebApiClient_1.WebApiClient;
    const user = await client.lookupBeatmapset(2647589);
    console.log(JSON.stringify(user));
}
exports.trial = trial;
async function getGuestTokenTrial() {
    try {
        const response = await axios_1.default.post('https://osu.ppy.sh/oauth/token', {
            'grant_type': 'client_credentials',
            'client_id': `${oAuthConfig.client_id}`,
            'client_secret': oAuthConfig.client_secret,
            'scope': 'public'
        });
        const c = response.data;
        console.log(c);
    }
    catch (e) {
        console.error(`\n${e.message}\n${e.stack}`);
    }
}
exports.getGuestTokenTrial = getGuestTokenTrial;
async function getTokenTrial() {
    try {
        const response = await axios_1.default.post('https://osu.ppy.sh/oauth/token', {
            'grant_type': 'authorization_code',
            'client_id': `${oAuthConfig.client_id}`,
            'client_secret': oAuthConfig.client_secret,
            'code': oAuthConfig.code,
            'redirect_uri': oAuthConfig.callback
        });
        const c = response.data;
        console.log(c);
    }
    catch (e) {
        console.error(`\n${e.message}\n${e.stack}`);
    }
}
exports.getTokenTrial = getTokenTrial;
function objectToURLSearchParams(obj) {
    const param = new URLSearchParams();
    for (const key in obj) {
        param.append(key, obj[key]);
    }
    return obj;
}
async function fetchUpdateTrial() {
    try {
        const r = await axios_1.default.get('https://osu.ppy.sh/community/chat/updates?since=2065115911');
        const c = r.data;
        console.log(c);
    }
    catch (e) {
        console.error(`\n${e.message}\n${e.stack}`);
    }
}
exports.fetchUpdateTrial = fetchUpdateTrial;
//# sourceMappingURL=WebApiTrial.js.map