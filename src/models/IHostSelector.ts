import { ILobby } from "./ILobby";
import { Player } from "./Player";

export interface IHostSelector {
  currentHost: Player | null;
  isMatching: boolean;
  lobby: ILobby;
}