import { ILobby } from "./ILobby";
import { Player } from "./Player";
export { ILobby, Player }

export interface IAutoHostRotator {
  lobby: ILobby,
  hostQueue: Player[],
  currentHost: Player | null,
  nextHost: Player | null,
  isInProgress: boolean,
  mapSelected: boolean,

  onLobbyOpend(lobbyid: string): void,
  onPlayerJoined(userid: string, slot: number): void,
  onPlayerLeft(userid: string): void,
  onBeatmapSelected(mapid: string): void,
  onHostChanged(userid: string): void,

  makeLobby(lobbyname: string): void,
  rotateHost(userid: string): void,
  addQueue(userid: string): void,
  removeQueue(userid: string): void
}