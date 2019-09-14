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
  sendPluginMessage(type: string, args: string[] = []) {
    this.lobby.PluginMessage.emit({ type, args, src: this });
  }

  getPluginStatus(): string {
    return "";
  }

  getInfoMessage(): string[] {
    return [];
  }
}