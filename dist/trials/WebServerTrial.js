"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.trial = void 0;
const express_1 = __importDefault(require("express"));
const history_84468237_json_1 = __importDefault(require("./cases/history_84468237.json"));
const fs_1 = __importDefault(require("fs"));
const readline_1 = __importDefault(require("readline"));
function trial() {
    startTestServer();
}
exports.trial = trial;
function wrap(fn) {
    return (req, res, next) => fn(req, res, next).catch(next);
}
function startTestServer() {
    const app = (0, express_1.default)();
    const port = 3112;
    const hostname = '127.0.0.1';
    app.use('', express_1.default.static('src/trials/'));
    app.use('/logs', express_1.default.static('logs/cli'));
    app.get('/api/user/:id', (req, res, next) => {
        const tid = parseInt(req.params.id);
        if (isNaN(tid))
            return res.json({});
        const usr = history_84468237_json_1.default.users.find((v) => v.id.toString() === req.params.id);
        return res.json(usr);
    });
    app.get('/api/clilog/:id', (req, res, next) => {
        const p = `logs/cli/${req.params.id}.log`;
        let frm = 0;
        if (req.query.from) {
            frm = parseInt(`${req.query.from}`);
        }
        const stream = fs_1.default.createReadStream(p, { start: frm });
        const reader = readline_1.default.createInterface({ input: stream });
        const result = {
            lines: [],
            end: 0
        };
        reader.on('line', (data) => {
            result.lines.push(data);
        });
        reader.on('close', () => {
            result.end = stream.bytesRead + frm;
            res.json(result);
        });
    });
    const server = app.listen(port, hostname, () => {
        console.log(`Server running at http://${hostname}:${port}/`);
    });
}
function parseLogLine(line) {
    const m = line.match(/^\[(.+?)\] \[(\w+)\] (\w+) - (.*)/);
    if (m) {
        return {
            date: m[1],
            level: m[2],
            tag: m[3],
            message: m[4]
        };
    }
}
async function parseLogTest() {
    const p = 'logs/cli/#mp_67681871.log';
    const stream = fs_1.default.createReadStream(p, {
        start: 64000
    });
    const reader = readline_1.default.createInterface({ input: stream });
    const result = {
        lines: [],
        end: 0
    };
    reader.on('line', (data) => {
        result.lines.push(parseLogLine(data));
    });
    reader.on('pause', () => {
        console.log('pause');
    });
    reader.on('close', () => {
        result.end = stream.bytesRead;
        console.log(result);
    });
}
async function readlineTrial() {
    const d = 'data/test/readline.txt';
    const p = 'logs/cli/#mp_67681871.log';
    const ws = fs_1.default.createWriteStream(d, {
        encoding: 'utf8',
    });
    const stream = fs_1.default.createReadStream(d, {
        encoding: 'utf8',
        highWaterMark: 1024 // 一度に取得するbyte数
    });
    const reader = readline_1.default.createInterface({ input: stream });
    let i = 1;
    reader.on('line', (data) => {
        // 行番号を作成
        const num = i.toString().padStart(5, '0'); // 5文字未満は"0"で埋める
        i++;
        console.log(`${num}: ${data}`);
    });
    reader.on('pause', () => {
        console.log('pause');
    });
    reader.on('close', () => {
        console.log('close');
    });
    ws.write('test1\r\n');
    ws.write('test2\r\n');
    ws.write('test3x\r\n');
    await new Promise(resolve => {
        setTimeout(() => {
            ws.write('test4\r\n');
            resolve();
        }, 100);
    });
    console.log('after await');
}
//# sourceMappingURL=WebServerTrial.js.map