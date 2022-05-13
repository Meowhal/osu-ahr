import express from 'express';
import fs from 'fs';
import readline from 'readline';
import { Server } from 'http';

export function startLogServer(port: number): Server {
  const app = express();
  app.use('', express.static('src/web/statics'));
  app.use('/logs', express.static('logs/cli'));
  app.get('/api/clilog', (req, res, next) => {
    fs.readdir('logs/cli', (err, files) => {
      if (err) throw err;
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
    const stream = fs.createReadStream(p, { start: frm });
    const reader = readline.createInterface({ input: stream });
    const result: { lines: string[], end: number } = {
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
    fs.stat(p, (e, stats) => {
      if (e) {
        next(e);
      } else {
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

//startLogServer();
