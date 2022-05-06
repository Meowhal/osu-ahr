import config from 'config';
import log4js from 'log4js';
import express, { Express } from 'express';
import { Server } from 'http';

const logger = log4js.getLogger('server');

export interface OahrWebOption {
  port: number;
  staticDir:string;
  hostname: string;
}

const OahrWebDefaultOption = config.get<OahrWebOption>('OahrWeb');

export class OahrWeb {
  config: OahrWebOption;
  app: Express;
  server: Server;

  constructor() {
    this.config = OahrWebDefaultOption;
    this.app = express();
    this.app.use(express.static(this.config.staticDir));
    this.server = this.app.listen(this.config.port, this.config.hostname, () => {
      console.log(`Server running at http://${this.config.hostname}:${this.config.port}/`);
    });

    this.app.get('/api/test/:id', (req, res, next) => {
      const re = {
        test:'hello',
        id: req.params.id
      };
      res.json(re);
    });
    
  }




}
