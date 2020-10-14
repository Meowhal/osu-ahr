import express, { Express, RequestHandler, Request, Response, NextFunction } from "express";
import historyData from "../../data/arc/history_67261609.json";
import Nedb from 'nedb';
import fs from 'fs';
import readline from 'readline';

export function trial() {
  startTestServer();
}

interface PromiseRequestHandler {
  (req: Request, res: Response, next: NextFunction): Promise<any>
}

function wrap(fn: PromiseRequestHandler): RequestHandler {
  return (req, res, next) => fn(req, res, next).catch(next)
}

function startTestServer() {
  const app = express();
  const port = 3112;
  const hostname = "127.0.0.1";

  app.use("", express.static("src/trials/"));
  app.use("/logs", express.static("logs/cli"));

  app.get("/api/user/:id", (req, res, next) => {
    let tid = parseInt(req.params.id);
    if (isNaN(tid)) return res.json({});
    let usr = historyData.users.find(v => v.id.toString() == req.params.id);
    return res.json(usr);
  });

  app.get("/api/clilog/:id", (req, res, next) => {
    let p = `logs/cli/${req.params.id}.log`;
    let frm = 0;
    if (req.query.from) {
      frm = parseInt(req.query.from + "");
    }
    const stream = fs.createReadStream(p, { start: frm });
    const reader = readline.createInterface({ input: stream });
    const result: { lines: string[], end: number } = {
      lines: [],
      end: 0
    };
    reader.on("line", (data) => {
      result.lines.push(data);
    });
    reader.on("close", () => {
      result.end = stream.bytesRead + frm;
      res.json(result);
    });
  });

  const server = app.listen(port, hostname, () => {
    console.log(`Server running at http://${hostname}:${port}/`);
  });

}

function parseLogLine(line: string): { date: string, level: string, tag: string, message: string } | undefined {
  var m = line.match(/^\[(.+?)\] \[(\w+)\] (\w+) - (.*)/);
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
  let p = `logs/cli/#mp_67681871.log`;
  const stream = fs.createReadStream(p, {
    start: 64000
  });
  const reader = readline.createInterface({ input: stream });
  const result: { lines: any[], end: number } = {
    lines: [],
    end: 0
  };
  reader.on("line", (data) => {
    result.lines.push(parseLogLine(data));
  });
  reader.on("pause", () => {
    console.log("pause");
  });
  reader.on("close", () => {
    result.end = stream.bytesRead;
    console.log(result);
  });

}

async function readlineTrial() {
  let d = "data/test/readline.txt";
  let p = `logs/cli/#mp_67681871.log`;
  const ws = fs.createWriteStream(d, {
    encoding: "utf8",
  });
  const stream = fs.createReadStream(d, {
    encoding: "utf8",         // 文字コード
    highWaterMark: 1024       // 一度に取得するbyte数
  });
  const reader = readline.createInterface({ input: stream });
  let i = 1;
  reader.on("line", (data) => {
    // 行番号を作成
    let num = i.toString().padStart(5, "0");  // 5文字未満は"0"で埋める
    i++;

    console.log(`${num}: ${data}`);
  });
  reader.on("pause", () => {
    console.log("pause");
  });
  reader.on("close", () => {
    console.log("close");
  });
  ws.write("test1\r\n");
  ws.write("test2\r\n");
  ws.write("test3x\r\n");

  await new Promise(resolve => {
    setTimeout(() => {
      ws.write("test4\r\n");
      resolve();
    }, 100);
  });
  console.log("after await");


}
