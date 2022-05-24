"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startLogServer = void 0;
const express_1 = __importDefault(require("express"));
const fs_1 = __importDefault(require("fs"));
const readline_1 = __importDefault(require("readline"));
function startLogServer(port) {
    const app = (0, express_1.default)();
    app.use('', express_1.default.static('src/web/statics'));
    app.use('/logs', express_1.default.static('logs/cli'));
    app.get('/api/clilog', (req, res, next) => {
        fs_1.default.readdir('logs/cli', (err, files) => {
            if (err)
                throw err;
            const r = [];
            for (const f of files) {
                const m = f.match(/(\d+)\.log/);
                if (m) {
                    r.push(parseInt(m[1]));
                }
            }
            res.json(r);
        });
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
        stream.on('error', (e) => {
            console.log('cought error');
            next(e);
        });
    });
    app.get('/api/clilog/size/:id', (req, res, next) => {
        const p = `logs/cli/${req.params.id}.log`;
        let frm = 0;
        if (req.query.from) {
            frm = parseInt(`${req.query.from}`);
        }
        fs_1.default.stat(p, (e, stats) => {
            if (e) {
                next(e);
            }
            else {
                res.json(stats.size);
            }
        });
    });
    app.get('/api/close', (req, res, next) => {
        server.close();
    });
    const server = app.listen(port, () => {
        console.log(`Server running at http://${'localhost'}:${port}/`);
    });
    process.on('exit', (code) => {
        server.close();
    });
    return server;
}
exports.startLogServer = startLogServer;
//startLogServer();
//# sourceMappingURL=LogServer.js.map