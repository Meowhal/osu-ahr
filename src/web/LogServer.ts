import express from "express";
import historyData from "../../data/arc/history_67261609.json";
import fs from 'fs';
import readline from 'readline';
import { Server } from "http";

export function startLogServer(port:number): Server {
  const app = express();
  app.use("", express.static("src/web/statics"));
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
    stream.on("error", (e) => {
      console.log("cought error");
      next(e);
    });
  });

  app.get("/api/clilog/size/:id", (req, res, next) => {
    let p = `logs/cli/${req.params.id}.log`;
    let frm = 0;
    if (req.query.from) {
      frm = parseInt(req.query.from + "");
    }
    fs.stat(p, (e, stats) => {
      if (e) {
        next(e);
      } else {
        res.json(stats.size);
      }
    });
  });

  const server = app.listen(port, () => {
    console.log(`Server running at http://${"localhost"}:${port}/`);
  });

  process.on("exit", (code) => {
    server.close();
  });

  return server;
}

//startLogServer();