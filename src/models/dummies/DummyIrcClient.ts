import * as irc from "irc";
import { EventEmitter } from "events";
import { CommandParser, MpCommand, IIrcClient } from "..";

// テスト用の実際に通信を行わないダミーIRCクライアント
export class DummyIrcClient extends EventEmitter implements IIrcClient {
  nick: string;
  parser: CommandParser;
  channel: string;
  msg: irc.IMessage;
  connected: boolean;
  players: Set<string>;
  conn: boolean | null;
  isMatching: boolean;
  public hostMask: string = "";

  constructor(
    server: string,
    nick: string,
    opts?: irc.IClientOpts
  ) {
    super();
    this.nick = nick;
    this.parser = new CommandParser();
    this.channel = "";
    this.connected = false;
    this.players = new Set<string>();
    this.conn = null;
    this.isMatching = false;
    this.msg = {
      command: "dummy command",
      rawCommand: "dummy command",
      commandType: 0 as irc.CommandType,
      args: []
    };

    if (opts == null || !opts.autoConnect) {
      this.connect();
    }
  }

  // サーバーとの接続イベントを発行する
  public raiseRegistered(): void {
    this.connected = true;
    this.hostMask = "osu!Bancho.";
    this.emit('registered', this.msg);
  }

  // チャンネル参加イベントを発行する
  public raiseJoin(channel: string, who: string): void {
    if (who == this.nick) {
      this.channel = channel;
    }
    this.emit("join", channel, who, this.msg);
    this.emit("join" + channel, who, this.msg);
  }

  // チャンネル退出イベントを発行する
  public raisePart(channel: string, who: string): void {
    if (who == this.nick) {
      this.channel = "";
    }
    this.emit("part", channel, who, this.msg);
    this.emit("part" + channel, who, this.msg);
  }

  // メッセージイベントを発行する
  public raiseMessage(from: string, to: string, message: string): void {
    this.emit('message', from, to, message, this.msg);
    if (to == this.channel) {
      this.emit('message#', from, to, message, this.msg);
      this.emit('message' + to, from, message, this.msg);
    }
    if (to == this.nick) {
      this.emit('pm', from, message, this.msg);
    }
  }

  // メッセージイベントを非同期で発生させる
  public raiseMessageAsync(from: string, to: string, message: string): Promise<void> {
    return new Promise(resolve => {
      this.raiseMessage(from, to, message);
      resolve();
    });
  }

  // ロビーにプレイヤーが参加した際の動作をエミュレートする
  public async emulateAddPlayerAsync(name: string): Promise<void> {
    if (!this.players.has(name)) {
      this.players.add(name);
    }
    await this.raiseMessageAsync("BanchoBot", this.channel, `${name} joined in slot ${this.players.size}.`);
  }

  // ロビーからプレイヤーが退出した際の動作をエミュレートする
  public async emulateRemovePlayerAsync(name: string): Promise<void> {
    if (this.players.has(name)) {
      this.players.delete(name);
    }
    await this.raiseMessageAsync("BanchoBot", this.channel, `${name} left the game.`);
  }

  // async呼び出し用のディレイ関数
  private delay(ms: number): Promise<void> {
    if (ms == 0) return Promise.resolve();
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ホストがマップを変更する動作をエミュレートする
  public async emulateChangeMapAsync(delay: number): Promise<void> {
    await this.raiseMessageAsync("BanchoBot", this.channel, "Host is changing map...");
    await this.delay(delay);
    await this.raiseMessageAsync("BanchoBot", this.channel, `Beatmap changed to: mapname [version] (https://osu.ppy.sh/b/123456)`);
  }

  // 全員が準備完了になった動作をエミュレートする
  public async emulateReadyAsync(): Promise<void> {
    await this.raiseMessageAsync("BanchoBot", this.channel, "All players are ready");
  }

  // 試合をエミュレートする
  public async emulateMatchAsync(delay: number): Promise<void> {
    this.isMatching = true;
    await this.raiseMessageAsync("BanchoBot", this.channel, "The match has started!");
    await this.delay(delay);
    const tasks: Promise<void>[] = [];
    for (let u of this.players) {
      if (!this.isMatching) return;
      tasks.push(this.raiseMessageAsync("BanchoBot", this.channel, `${u} finished playing (Score: 100000, PASSED).`));
    }
    await Promise.all(tasks);
    if (!this.isMatching) return;
    this.isMatching = false;
    await this.raiseMessageAsync("BanchoBot", this.channel, "The match has finished!");
  }

  // IRCClientのjoin
  public join(channel: string, callback?: irc.handlers.IJoinChannel | undefined): void {
    setImmediate(this.raiseJoin, channel);
  }

  // IRCClientのpart
  public part(channel: string, message: string, callback: irc.handlers.IPartChannel): void {
    setImmediate(this.raisePart, this.channel, this.nick);
  }

  // IRCClientのsay
  public say(target: string, message: string): void {
    let mp = this.parser.ParseMPCommand(message);
    if (mp != null) {
      this.processMpCommand(target, message, mp);
    }
  }

  private processMpCommand(target: string, message: string, mp: MpCommand): void {
    if (target == "BanchoBot" && mp.command == "make") {
      const title = mp.args.join(' ').trim();
      if (title === "") {
        this.raiseMessage("BanchoBot", this.nick, "No name provided");
        return;
      }
      setImmediate(() => {
        let id = "12345";
        this.raiseJoin("#mp_" + id, this.nick);
        this.raiseMessage("BanchoBot", this.nick, `Created the tournament match https://osu.ppy.sh/mp/${id} ${title}`);
      });
    } else if (target == this.channel) {
      switch (mp.command) {
        case "host":
          if (this.players.has(mp.args[0])) {
            this.raiseMessageAsync("BanchoBot", this.channel, `${mp.args[0]} became the host.`);
          } else {
            this.raiseMessageAsync("BanchoBot", this.channel, "User not found");
          }          
          break;
        case "password":
          if (mp.args.length == 0) {
            this.raiseMessageAsync("BanchoBot", this.channel, "Removed the match password");
          } else {
            this.raiseMessageAsync("BanchoBot", this.channel, "Changed the match password");
          }
          break;
        case "invite":
          this.raiseMessageAsync("BanchoBot", this.channel, `Invited ${mp.args[0]} to the room`);
          break;
        case "close":
          setImmediate(() => {
            this.raiseMessage("BanchoBot", this.channel, "Closed the match");
            this.raisePart(this.channel, this.nick);
          });
          break;
        case "abort":
          if (this.isMatching) {
            this.isMatching = false;
            this.raiseMessageAsync("BanchoBot", this.channel, "Aborted the match");
          } else {
            this.raiseMessageAsync("BanchoBot", this.channel, "The match is not in progress");
          }
      }
    }
  }

  public connect(retryCount?: number | irc.handlers.IRaw | undefined, callback?: irc.handlers.IRaw | undefined): void {
    this.conn = true;
    setImmediate(() => this.raiseRegistered());
  }

  public disconnect(message: string, callback: () => void): void {
    setImmediate(() => callback());
  }
}