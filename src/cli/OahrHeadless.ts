import { IIrcClient } from '../IIrcClient';
import { getLogger } from '../Loggers';
import { OahrBase } from './OahrBase';

const logger = getLogger('hl');

export class OahrHeadless extends OahrBase {

  constructor(client: IIrcClient) {
    super(client);
    client.once('part', () => {
      logger.info('Part event detected. Closing...');
      process.exit(0);
    });
  }

  start(command: string, arg: string): void {
    try {
      switch (command) {
        case 'm':
          this.makeLobbyAsync(arg);
          break;
        case 'e':
          this.enterLobbyAsync(arg);
          break;
        default:
          process.exit(1);
      }
    } catch (e: any) {
      logger.error(`@OahrHeadless#start\n${e}`);
      process.exit(1);
    }

  }
}
