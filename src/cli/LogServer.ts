import { startLogServer } from '../web/LogServer.js';
import config from 'config';

export interface LogServerOption {
  port: number;
}

const options = config.get<LogServerOption>("LogServer");

startLogServer(options.port);
