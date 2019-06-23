import IAutoHostRotator from "./IAutoHostRotator";
import {ILobby} from "./ILobby";

export default class AutoHostRotator implements IAutoHostRotator {
  lobby: ILobby;
  hostQueue: Player[];
  currentHost: Player | null;
  nextHost: Player | null;
  isInProgress: boolean;
  mapSelected: boolean;

  constructor(lobby: ILobby) {
    this.lobby = lobby;
    this.hostQueue = [];
    this.currentHost = null;
    this.nextHost = null;
    this.isInProgress = false;
    this.mapSelected = false;

  }

  onLobbyOpend(lobbyid: string): void {
    throw new Error("Method not implemented.");
  }
  onPlayerJoined(userid: string, slot: number): void {
    throw new Error("Method not implemented.");
  }
  onPlayerLeft(userid: string): void {
    throw new Error("Method not implemented.");
  }
  onBeatmapSelected(mapid: string): void {
    throw new Error("Method not implemented.");
  }
  onHostChanged(userid: string): void {
    throw new Error("Method not implemented.");
  }
  makeLobby(lobbyname: string): void {
    throw new Error("Method not implemented.");
  }
  rotateHost(userid: string): void {
    throw new Error("Method not implemented.");
  }
  addQueue(userid: string): void {
    throw new Error("Method not implemented.");
  }
  removeQueue(userid: string): void {
    throw new Error("Method not implemented.");
  }

  
}