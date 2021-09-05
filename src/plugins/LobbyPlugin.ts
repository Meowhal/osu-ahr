import { Lobby } from "..";
import log4js from "log4js";

/**
 * ロビーのイベントに反応して処理を行うプラグインのベースクラス。
 */
export class LobbyPlugin {
  lobby: Lobby;
  logger: log4js.Logger;
  pluginName: string;

  constructor(lobby: Lobby, pluginName: string, loggerTag: string = "default") {
    this.lobby = lobby;
    this.lobby.plugins.push(this);
    this.pluginName = pluginName;
    this.logger = log4js.getLogger(loggerTag);
    this.logger.addContext("channel", "lobby");
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
    return "";
  }

  /**
   * すべてのプラグインが読み込まれたあとに実行される
   */
  OnLoaded(): void {
  }

  OnConfig(target: string, name: string, value: string): void {
  }
}