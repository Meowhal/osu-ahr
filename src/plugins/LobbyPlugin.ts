import { Lobby } from "..";
import log4js from "log4js";

/**
 * ロビーのイベントに反応して処理を行うプラグインのベースクラス。
 */
export class LobbyPlugin {
  lobby: Lobby;
  logger: log4js.Logger;
  constructor(lobby: Lobby, loggerTag: string = "default") {
    this.lobby = lobby;
    this.lobby.plugins.push(this);
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

  GetPluginStatus(): string {
    return "";
  }

  GetInfoMessage(): string[] {
    return [];
  }
}