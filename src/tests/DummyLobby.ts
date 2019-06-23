import {ILobby, LobbyStatus} from "../ILobby"
import {EventEmitter} from "events";

export default class DummyLobby extends EventEmitter implements ILobby {
  name: string | undefined;
  id: string | undefined;
  channel: string | undefined;
  status: LobbyStatus;
  networkFailureFlag : boolean;

  constructor() {
    super();
    this.status = LobbyStatus.Standby;
    this.networkFailureFlag = false;
  }

  SendMpHost(userid: string): void {
    if (this.status != LobbyStatus.Entered) {
      throw new Error("Invalid Operation. @SendMpHost");
    }
    console.log(`(gnsksz) !mp host ${userid}`);
    setImmediate(() => this.RaiseHostChanged(userid));
  }

  
  SendMpAbort(): void {
    if (this.status != LobbyStatus.Entered) {
      throw new Error("Invalid Operation. @SendMpAbort");
    }

    throw new Error("Method not implemented.");
  }

  SendMpClose(): void {
    if (this.status != LobbyStatus.Entered) {
      throw new Error("Invalid Operation. @SendMpClose");
    }
    console.log(`(gnsksz) !mp close`);
    this.status = LobbyStatus.Leaving;
    setImmediate(()=> this.RaiseLobbyClosed(null));
  }

  SendMessage(message: string): void {
    if (this.status != LobbyStatus.Entered) {
      throw new Error("Invalid Operation. @SendMessage");
    }
    console.log(`(gnsksz) ${message}`);
  }

  MakeLobbyAsync(title: string): Promise<string> {
    if (this.status != LobbyStatus.Standby) {
      return Promise.reject(new Error("Invalid Operation. @MakeLobbyAsync"));
    }
    console.log(`(gnsksz) !mp make ${title}`);
    this.status = LobbyStatus.Making;
    
    return new Promise<string>((resolve, reject) => {
      setImmediate(() => {
        if (this.networkFailureFlag) {
          reject(new Error("Network Error. @MakeLobbyAsync"));
        } else {
          this.RaiseLobbyMade("123", title);
          const channel = "mp_" + this.id as string;
          this.EnterLobbyAsync(channel).then(() => resolve(this.id));          
        }
      });
    });
  }

  EnterLobbyAsync(channel: string) : Promise<void> {
    if (this.status != LobbyStatus.Standby && this.status != LobbyStatus.Made) {
      return Promise.reject(new Error("Invalid Operation. @EnterLobbyAsync"));
    }
    console.log("entering " + channel);
    this.status = LobbyStatus.Entering;
    return new Promise((resolve, reject) => {
      setImmediate(() => {
        if (this.networkFailureFlag) {
          reject(new Error("Network Error. @EnterLobbyAsync"));
        } else {
          this.RaiseLobbyEntered();
          resolve();
        }
      });
    });
  }
  
  LeaveLobbyAsync() : Promise<void> {
    if (this.status != LobbyStatus.Entered) {
      throw new Error("Invalid Operation. @LeaveLobbyAsync");
    }
    console.log("leaving " + this.channel);
    return new Promise(resolve =>{
      this.status = LobbyStatus.Left;
      this.channel = undefined;
      resolve();
    });    
  }

  RaiseLobbyMade(lobbyid : string, title: string) : void {
    this.name = title;
    this.id = lobbyid;
    this.status = LobbyStatus.Made;
    console.log(`(BanchoBot) Created the tournament match https://osu.ppy.sh/mp/${this.id} ${this.name}`)
    this.emit("LobbyMade", this.id);    
  }

  RaiseLobbyEntered() {
    this.status = LobbyStatus.Entered;
    console.log(`Entered lobby`);
    this.emit("LobbyEntered");
  }

  RaisePlayerJoined(userid: string, slotid: string) {
    console.log(`(BanchoBot) ${userid} joined in slot ${slotid}.`);
    this.emit("PlayerJoined", userid, slotid);
  }

  RaisePlayerLeft(userid: string){
    console.log(`(BanchoBot) ${userid} left the game.`);
    this.emit("PlayerLeft", userid);
  }

  RaiseBeatmapSelected(mapid: string) {
    console.log(`(BanchoBot) Beatmap changed to: maptitle (https://osu.ppy.sh/b/${mapid})`);
    this.emit("BeatmapSelected", mapid);
  }

  RaiseHostChanged(userid: string) {
    console.log(`(BanchoBot) ${userid} became the host.`);
    this.emit("HostChanged", userid);
  }

  RaiseMatchStarted() {
    console.log(`(BanchoBot) The match has started!`);
    this.emit("MatchStarted");
  }

  RaisePlayerFinished(userid: string, score: string) {
    console.log(`(BanchoBot) ${userid} finished playing (Score: ${score}, PASSED).`);
    this.emit("PlayerFinished", userid, score);
  }

  RaiseMatchFinished() {
    console.log(`(BanchoBot) The match has finished!`);
    this.emit("MatchFinished");
  }
  
  RaiseLobbyClosed(err : Error | null) {
    console.log("(BanchoBot) Closed the match");
    this.emit("LobbyClosed", err);
  }
}
