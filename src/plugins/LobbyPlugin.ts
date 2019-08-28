import { ILobby } from "../ILobby";
import { Player } from "../Player";
import { TypedEvent } from "../libs/events";

/**
 * ロビーのイベントに反応して処理を行うプラグインのベースクラス。
 */
export class LobbyPlugin {
  lobby: ILobby;
  constructor(lobby: ILobby) {
    this.lobby = lobby;
    this.lobby.plugins.push(this);
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