"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.trial = void 0;
const axios_1 = __importDefault(require("axios"));
const fs_1 = require("fs");
const HistoryFetcher_1 = require("../webapi/HistoryFetcher");
const HistoryRepository_1 = require("../webapi/HistoryRepository");
async function trial() {
    await GetOrderTrial();
}
exports.trial = trial;
async function GetHistryTrial() {
    // 67261609
    // 67268731
    const matchId = 76714773;
    // https://osu.ppy.sh/community/matches/${matchId}/history?before=1509690736&limit=100
    const url = `https://osu.ppy.sh/community/matches/${matchId}/`;
    const params = {
        'limit': 100,
        'before': 1695874063
    };
    const response = await axios_1.default.get(url, { params })
        .catch(err => {
        return err.response;
    });
    console.log(JSON.stringify(response.data));
    fs_1.promises.writeFile('data/arc/history_76714773_joinleftsametime.json', JSON.stringify(response.data));
}
async function GetOrderTrial() {
    const matchId = 76714773;
    const repo = new HistoryRepository_1.HistoryRepository(matchId);
    const res = await repo.calcCurrentOrderAsName();
    console.log(res);
}
async function GetLobbyNameChanger() {
    const hr = new HistoryRepository_1.HistoryRepository(67719013, new HistoryFetcher_1.HistoryFecher());
    let ln = '';
    hr.changedLobbyName.on(e => {
        console.log(`${e.oldName}->${e.newName} `);
        ln = e.newName;
    });
    while (!ln.startsWith('4-5*')) {
        await hr.fetch(true);
    }
}
async function promiseTrial() {
    let task = delayAsync(100).then(() => 1);
    setImmediate(async () => {
        const n = await task;
        console.log(`i1 ${n}`);
    });
    setImmediate(async () => {
        task = task.then(() => 2);
        const n = await task;
        console.log(`i2 ${n}`);
    });
    setImmediate(async () => {
        task = task.then(() => 3);
        const n = await task;
        console.log(`i3 ${n}`);
    });
    setImmediate(async () => {
        const n = await task;
        console.log(`i4 ${n}`);
    });
}
async function delayAsync(ms) {
    if (ms === 0)
        return Promise.resolve();
    return new Promise(resolve => setTimeout(resolve, ms));
}
//# sourceMappingURL=HistryTrial.js.map