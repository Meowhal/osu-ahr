import { Lobby } from '../Lobby';
import { getLogger, Logger } from '../Loggers';
import { loadEnvConfig } from '../TypedConfig';

/**
 * ロビーのイベントに反応して処理を行うプラグインのベースクラス。
 */
export class LobbyPlugin {
  lobby: Lobby;
  logger: Logger;
  pluginName: string;

  constructor(lobby: Lobby, pluginName: string, loggerTag: string = 'default') {
    this.lobby = lobby;
    this.lobby.plugins.push(this);
    this.pluginName = pluginName;
    this.logger = getLogger(loggerTag);
  }

  /**
   * 他のプラグインにメッセージを送信する。
   * @param type
   * @param args
   */
  SendPluginMessage(type: string, args: string[] = []): void {
    this.lobby.PluginMessage.emit({ type, args, src: this });
  }

  /**
   * コンソール上で[i]nfo コマンドを実行した際に表示される、
   * プラグインごとのステータスメッセージを取得する
   */
  GetPluginStatus(): string {
    return '';
  }

  /**
   * すべてのプラグインが読み込まれたあとに実行される
   */
  OnLoaded(): void {
    /* do nothing. */
  }

  OnConfig(target: string, name: string, value: string): void {
    /* do nothing. */
  }

  loadEnvSettings(option: any) {
    try {
      loadEnvConfig(this.pluginName, option);
    } catch (e: any) {
      this.logger.error(`\n${e.message}\n${e.stack}`);
      process.exit(1);
    }
  }
}

export function regSwitch(val: string, cases: { case: RegExp, action: (m: RegExpExecArray) => void }[]) {
  for (const c of cases) {
    const ea = c.case.exec(val);
    if (ea) {
      c.action(ea);
      return;
    }
  }
}
