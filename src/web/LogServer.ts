import express from "express";
import fs from 'fs';
import readline from 'readline';
import { Server } from "http";
import { Lobby } from "..";

export function startLogServer(port: number, lobby: Lobby): Server {
  const app = express();
  app.use("", express.static("src/web/statics"));
  app.use("/logs", express.static("logs/cli"));

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

  app.get("/api/close/:id", (req, res, next) => {
    lobby.logger.info("called close");
    if (lobby.lobbyId == req.params.id) {
      lobby.CloseLobbyAsync();
      res.json({ result: "done" });
    } else {
      res.json({ result: "invalid id" });
    }
  });

  app.get("/api/quit/:id", (req, res, next) => {
    if (lobby.lobbyId == req.params.id) {
      if (lobby.ircClient.conn != null && !lobby.ircClient.conn.requestedDisconnect) {
        lobby.ircClient.disconnect("goodby", () => {
          lobby.logger.info("ircClient disconnected");
          process.exit(0);
        });
      } else {
        lobby.logger.info("quit");
        process.exit(0);
      }
      res.json({ result: "done" });
    } else {
      res.json({ result: "invalid id" });
    }
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