"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebApiClient = void 0;
const axios_1 = __importDefault(require("axios"));
const config_1 = __importDefault(require("config"));
const http_1 = __importDefault(require("http"));
const open_1 = __importDefault(require("open"));
const path_1 = __importDefault(require("path"));
const url_1 = require("url");
const fs_1 = require("fs");
const UserProfile_1 = require("./UserProfile");
const BeatmapRepository_1 = require("./BeatmapRepository");
const ProfileRepository_1 = require("./ProfileRepository");
const Loggers_1 = require("../Loggers");
function isExpired(token) {
    if (token === undefined)
        return true;
    return Date.now() / 1000 > token.expires_in;
}
class WebApiClientClass {
    constructor(option = {}) {
        const WebApiDefaultOption = config_1.default.get('WebApi');
        this.option = { ...WebApiDefaultOption, ...option };
        this.logger = (0, Loggers_1.getLogger)('webapi');
        this.available = this.option.client_id !== 0 && this.option.client_secret !== '***';
    }
    async updateToken() {
        if (!this.available)
            return false;
        if (!isExpired(this.token))
            return true;
        let token;
        token = await this.loadStoredToken(this.option.asGuest);
        if (token) {
            this.token = token;
            return true;
        }
        token = this.option.asGuest ? await this.getGuestToken() : await this.getAuthorizedToken();
        if (token) {
            this.storeToken(token);
            this.token = token;
            return true;
        }
        this.available = false;
        return false;
    }
    getTokenPath(asGuest) {
        return path_1.default.join(this.option.token_store_dir, asGuest ? 'guest_token.json' : 'token.json');
    }
    async storeToken(token) {
        if (this.option.token_store_dir === '')
            return false;
        try {
            const p = this.getTokenPath(token.isGuest);
            await fs_1.promises.mkdir(path_1.default.dirname(p), { recursive: true });
            await fs_1.promises.writeFile(p, JSON.stringify(token), { encoding: 'utf8', flag: 'w' });
            this.logger.info(`Stored token to: ${p}`);
            return true;
        }
        catch (e) {
            this.logger.error(`@WebApiClient#storeToken\n${e.message}\n${e.stack}`);
            return false;
        }
    }
    async loadStoredToken(asGuest) {
        if (this.option.token_store_dir === '')
            return;
        const p = this.getTokenPath(asGuest);
        try {
            await fs_1.promises.access(p);
        }
        catch (e) {
            return;
        }
        try {
            const j = await fs_1.promises.readFile(p, 'utf8');
            const token = JSON.parse(j);
            if (!isExpired(token)) {
                this.logger.info(`Loaded stored token from: ${p}`);
                return token;
            }
            this.deleteStoredToken(asGuest);
            this.logger.info('Deleted expired stored token.');
        }
        catch (e) {
            this.logger.error(`@WebApiClient#loadStoredToken\n${e.message}\n${e.stack}`);
        }
    }
    async deleteStoredToken(asGuest) {
        const p = this.getTokenPath(asGuest);
        try {
            await fs_1.promises.access(p);
        }
        catch (e) {
            return;
        }
        try {
            fs_1.promises.unlink(p);
        }
        catch (e) {
            this.logger.error(`@WebApiClient#deleteStoredToken\n${e.message}\n${e.stack}`);
        }
    }
    async getAuthorizedToken() {
        try {
            const code = await this.getAuthorizeCode();
            const response = await axios_1.default.post('https://osu.ppy.sh/oauth/token', {
                'client_id': `${this.option.client_id}`,
                'client_secret': this.option.client_secret,
                'code': code,
                'grant_type': 'authorization_code',
                'redirect_uri': this.option.callback
            });
            response.data.isGuest = false;
            response.data.expires_in += Date.now() / 1000;
            this.logger.info('Got authorized token.');
            return response.data;
        }
        catch (e) {
            this.logger.error(`@WebApiClient#getAuthorizedToken\n${e.message}\n${e.stack}`);
        }
    }
    getAuthorizeCode() {
        return new Promise((resoleve, reject) => {
            const server = http_1.default.createServer();
            let code = null;
            server.once('request', (req, res) => {
                res.setHeader('Content-Type', 'text/html');
                res.writeHead(200, { 'Content-Type': 'text/plain' });
                if (!req.url) {
                    res.end('Missing request URL.');
                    return;
                }
                const url = new url_1.URL(req.url, `http://${req.headers.host}`);
                code = url.searchParams.get('code');
                if (code === null) {
                    res.end('Missing code.');
                    return;
                }
                res.end(`Ok: ${code}`);
                this.logger.trace(`Got code! ${code}`);
                server.close(() => {
                    this.logger.trace('Closed callback.');
                });
                if (res.connection) {
                    res.connection.end();
                    res.connection.destroy();
                }
                else {
                    reject('No connection');
                }
            });
            server.once('close', () => {
                this.logger.trace('Detected close event.');
                if (code === null) {
                    reject('No code');
                }
                else {
                    this.logger.info('Got authorized code.');
                    resoleve(code);
                }
            });
            server.listen(this.option.callback_port);
            const nurl = new url_1.URL('https://osu.ppy.sh/oauth/authorize');
            nurl.searchParams.set('client_id', this.option.client_id.toString());
            nurl.searchParams.set('redirect_uri', this.option.callback);
            nurl.searchParams.set('response_type', 'code');
            nurl.searchParams.set('scope', 'public');
            (0, open_1.default)(nurl.toString());
        });
    }
    async getGuestToken() {
        try {
            const response = await axios_1.default.post('https://osu.ppy.sh/oauth/token', {
                'grant_type': 'client_credentials',
                'client_id': `${this.option.client_id}`,
                'client_secret': this.option.client_secret,
                'scope': 'public'
            });
            response.data.isGuest = true;
            response.data.expires_in += Date.now() / 1000;
            return response.data;
        }
        catch (e) {
            this.logger.error(`@WebApiClient#getGuestToken\n${e.message}\n${e.stack}`);
        }
    }
    async accessApi(url, config = {}, tryCount = 2) {
        while (tryCount-- > 0) {
            if (!await this.updateToken() || !this.token) {
                throw new Error('@WebApiClient#accessApi: Failed getting valid token');
            }
            config.headers = {
                'Authorization': `Bearer ${this.token.access_token}`,
                'Accept': 'application/json',
                'Content-Type': 'application/json',
            };
            try {
                const response = await (0, axios_1.default)(url, config);
                if (response.status !== 200) {
                    this.logger.error(`@WebApiClient#accessApi\nURL: ${url}\nStatus: ${response.status}\nMessage: ${response.statusText}`);
                }
                return response.data;
            }
            catch (e) {
                switch (e.response?.status) {
                    case 401:
                        this.logger.info('@WebApiClient#accessApi\nFailed to access API, deleting current token...');
                        this.deleteStoredToken(this.option.asGuest);
                        this.token = undefined;
                        break;
                    default:
                        throw e;
                }
            }
        }
        throw new Error('Failed to access the API');
    }
    async getChatUpdates() {
        const data = await this.accessApi('https://osu.ppy.sh/api/v2/chat/updates', {
            method: 'GET',
            params: {
                'since': '0'
            }
        });
        return data;
    }
    async getChannels() {
        const data = await this.accessApi('https://osu.ppy.sh/api/v2/chat/channels', {
            method: 'GET'
        });
        return data;
    }
    async getMe() {
        const data = await this.accessApi('https://osu.ppy.sh/api/v2/me/osu', {
            method: 'GET'
        });
        return data;
    }
    async getNotifications() {
        const data = await this.accessApi('https://osu.ppy.sh/api/v2/notifications', {
            method: 'GET'
        });
        return data;
    }
    async getUserRecentActivity(id) {
        const data = await this.accessApi(`https://osu.ppy.sh/api/v2/users/${id}/recent_activity`, {
            method: 'GET'
        });
        return data;
    }
    async getUser(id) {
        try {
            const data = await this.accessApi(`https://osu.ppy.sh/api/v2/users/${id}/osu`, {
                method: 'GET'
            });
            data.get_time = Date.now();
            return (0, UserProfile_1.trimProfile)(data);
        }
        catch (e) {
            if (e.response?.status === 404) {
                return null;
            }
            throw e;
        }
    }
    async getPlayer(userID, mode) {
        try {
            const data = await this.accessApi(`https://osu.ppy.sh/api/v2/users/${userID}/${mode}`, {
                method: 'GET'
            });
            data.get_time = Date.now();
            return data;
        }
        catch (e) {
            if (e.response?.status === 404) {
                throw new ProfileRepository_1.FetchProfileError(ProfileRepository_1.FetchProfileErrorReason.NotFound);
            }
            throw new ProfileRepository_1.FetchProfileError(ProfileRepository_1.FetchProfileErrorReason.Unknown, e.message);
        }
    }
    async lookupBeatmap(mapid) {
        const data = await this.accessApi(`https://osu.ppy.sh/api/v2/beatmaps/lookup?id=${mapid}`, {
            method: 'GET'
        });
        data.get_time = Date.now();
        return data;
    }
    async lookupBeatmapset(mapid) {
        const data = await this.accessApi(`https://osu.ppy.sh/api/v2/beatmapsets/lookup?beatmap_id=${mapid}`, {
            method: 'GET'
        });
        data.get_time = Date.now();
        return data;
    }
    async getBeatmapset(mapId) {
        try {
            return await this.lookupBeatmapset(mapId);
        }
        catch (e) {
            if (axios_1.default.isAxiosError(e)) {
                if (e.response?.status === 404) {
                    throw new BeatmapRepository_1.FetchBeatmapError(BeatmapRepository_1.FetchBeatmapErrorReason.NotFound);
                }
            }
            throw new BeatmapRepository_1.FetchBeatmapError(BeatmapRepository_1.FetchBeatmapErrorReason.Unknown, e.message);
        }
    }
}
exports.WebApiClient = new WebApiClientClass();
//# sourceMappingURL=WebApiClient.js.map