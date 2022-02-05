"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.HistoryFecher = void 0;
const axios_1 = __importDefault(require("axios"));
class HistoryFecher {
    async fetchHistory(limit, before, after, matchId) {
        const url = `https://osu.ppy.sh/community/matches/${matchId}`;
        const params = {
            'limit': limit,
        };
        if (before) {
            params.before = before;
        }
        if (after) {
            params.after = after;
        }
        return (await axios_1.default.get(url, { params })).data;
    }
}
exports.HistoryFecher = HistoryFecher;
//# sourceMappingURL=HistoryFetcher.js.map