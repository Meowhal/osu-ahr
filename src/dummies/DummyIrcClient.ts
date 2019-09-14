import * as irc from "../libs/irc";
import { EventEmitter } from "events";
import { IIrcClient } from "..";
import log4js from "log4js";
import { parser, MpCommand } from "../parsers";
import { MpSettingsCase } from "../tests/cases/MpSettingsCases";
import { escapeUserId } from "../Player";
const logger = log4js.getLogger("irc");

// テスト用の実際に通信を行わないダミーIRCクライアント
export class DummyIrcClient extends EventEmitter implements IIrcClient {
  nick: string;
  channel: string;
  msg: irc.IMessage;
  connected: boolean;
  players: Set<string>;
  conn: boolean | null;
  isMatching: boolean;
  hostMask: string = "";
  latency: number = 0;

  constructor(
    server: string,
    nick: string,
    opts?: irc.IClientOpts
  ) {
    super();
    this.nick = nick;
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
  public emulateMessage(from: string, to: string, message: string): void {
    if (from == this.nick) return;
    this.emit('message', from, to, message, this.msg);
    if (to == this.channel) {
      this.emit('message#', from, to, message, this.msg);
      this.emit('message' + to, from, message, this.msg);
    }
    if (to == this.nick) {
      this.emit('pm', from, message, this.msg);
    }
  }

  public emulateBanchoResponse(message: string): void {
    this.emulateMessage("BanchoBot", this.channel, message);
  }

  // メッセージイベントを非同期で発生させる
  public emulateMessageAsync(from: string, to: string, message: string): Promise<void> {
    return new Promise(resolve => {
      const body = () => {
        this.emulateMessage(from, to, message);
        resolve();
      }

      if (this.latency != 0) {
        setTimeout(body, this.latency);
      } else {
        body();
      }
    });
  }

  // ロビーにプレイヤーが参加した際の動作をエミュレートする
  public async emulateAddPlayerAsync(name: string): Promise<void> {
    let ename = escapeUserId(name);
    if (!this.players.has(ename)) {
      this.players.add(ename);
    }
    await this.emulateMessageAsync("BanchoBot", this.channel, `${name} joined in slot ${this.players.size}.`);
  }

  // ロビーからプレイヤーが退出した際の動作をエミュレートする
  public async emulateRemovePlayerAsync(name: string): Promise<void> {
    let ename = escapeUserId(name);
    if (this.players.has(ename)) {
      this.players.delete(ename);
    }
    await this.emulateMessageAsync("BanchoBot", this.channel, `${name} left the game.`);
  }

  // async呼び出し用のディレイ関数
  private delay(ms: number): Promise<void> {
    if (ms == 0) return Promise.resolve();
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  mapidSeed: number = 0;
  // ホストがマップを変更する動作をエミュレートする
  public async emulateChangeMapAsync(delay: number = 0): Promise<void> {
    await this.emulateMessageAsync("BanchoBot", this.channel, "Host is changing map...");
    await this.delay(delay);
    await this.emulateMessageAsync("BanchoBot", this.channel, `Beatmap changed to: mapname [version] (https://osu.ppy.sh/b/${this.mapidSeed++})`);
  }

  // 全員が準備完了になった動作をエミュレートする
  public async emulateReadyAsync(): Promise<void> {
    await this.emulateMessageAsync("BanchoBot", this.channel, "All players are ready");
  }

  // 試合をエミュレートする
  public async emulateMatchAsync(delay: number = 0): Promise<void> {
    this.isMatching = true;
    await this.emulateMessageAsync("BanchoBot", this.channel, "The match has started!");
    if (delay) {
      await this.delay(delay);
    }
    const tasks: Promise<void>[] = [];
    for (let u of this.players) {
      if (!this.isMatching) return;
      tasks.push(this.emulateMessageAsync("BanchoBot", this.channel, `${u} finished playing (Score: 100000, PASSED).`));
    }
    await Promise.all(tasks);
    if (!this.isMatching) return;
    this.isMatching = false;
    await this.emulateMessageAsync("BanchoBot", this.channel, "The match has finished!");
  }

  // 試合中断をエミュレートする
  public async emulateMatchAndAbortAsync(delay: number = 0, finishers: (number | string[]) = 0): Promise<void> {
    this.isMatching = true;
    await this.emulateMessageAsync("BanchoBot", this.channel, "The match has started!");
    if (delay) {
      await this.delay(delay);
    }
    const tasks: Promise<void>[] = [];
    if (Array.isArray(finishers)) {
      for (let p of finishers) {
        tasks.push(this.emulatePlayerFinishAsync(p));
      }
    } else {
      const players = Array.from(this.players);
      for (let i = 0; i < finishers && i < players.length; i++) {
        let p = players[i];
        tasks.push(this.emulatePlayerFinishAsync(p));
      }
    }
    await Promise.all(tasks);
    if (!this.isMatching) {
      await this.emulateMessageAsync("BanchoBot", this.channel, "The match is not in progress");
      return;
    }
    this.isMatching = false;
    await this.emulateMessageAsync("BanchoBot", this.channel, "Aborted the match");
  }

  public async emulatePlayerFinishAsync(userid: string): Promise<void> {
    await this.emulateMessageAsync("BanchoBot", this.channel, `${userid} finished playing (Score: 100000, PASSED).`)
  }

  public async emulateMpSettings(testcase: MpSettingsCase): Promise<void> {
    this.players.clear();
    for (let p of testcase.result.players) {
      this.players.add(escapeUserId(p.id));
    }
    for (let t of testcase.texts) {
      this.emulateBanchoResponse(t);
    }
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
    new Promise(() => {
      this.emulateMessageAsync(this.nick, target, message);
      let mp = parser.ParseMPCommand(message);
      if (mp != null) {
        this.processMpCommand(target, message, mp);
      }
    });
  }

  private processMpCommand(target: string, message: string, mp: MpCommand): void {
    const m = (msg: string) => this.emulateMessageAsync("BanchoBot", this.channel, msg);
    if (target == "BanchoBot" && mp.command == "make") {
      const title = mp.arg;
      if (title === "") {
        this.emulateMessage("BanchoBot", this.nick, "No name provided");
        return;
      }
      setImmediate(() => {
        let id = "12345";
        this.raiseJoin("#mp_" + id, this.nick);
        this.emulateMessage("BanchoBot", this.nick, `Created the tournament match https://osu.ppy.sh/mp/${id} ${title}`);
      });
    } else if (target == this.channel) {
      switch (mp.command) {
        case "host":
          if (this.players.has(escapeUserId(mp.arg))) {
            m(`${mp.arg} became the host.`);
          } else {
            m("User not found");
          }
          break;
        case "password":
          if (mp.arg == "") {
            m("Removed the match password");
          } else {
            m("Changed the match password");
          }
          break;
        case "invite":
          m(`Invited ${mp.arg} to the room`);
          break;
        case "close":
          setImmediate(() => {
            this.emulateMessage("BanchoBot", this.channel, "Closed the match");
            this.raisePart(this.channel, this.nick);
          });
          break;
        case "abort":
          if (this.isMatching) {
            this.isMatching = false;
            m("Aborted the match");
          } else {
            m("The match is not in progress");
          }
          break;
        case "settings":
          m('Room name: lobby name, History: https://osu.ppy.sh/mp/123');
          m("Beatmap: https://osu.ppy.sh/b/1562893 Feryquitous feat. Aitsuki Nakuru - Kairikou [Miura's Extra]");
          m("Team mode: HeadToHead, Win condition: Score");
          m("Active mods: Freemod");
          m(`Players: ${this.players.size}`);

          let i = 1;
          for (let p of this.players) {
            m(`Slot ${i}  Not Ready https://osu.ppy.sh/u/123 ${p}       `);
            i++;
          }
          break;
        case "start":
          if (mp.arg == "") {
            m("The match has started!");
            m("Started the match");
          } else {
            // カウントダウンや分表示は面倒なので省略
            m("Match starts in " + mp.arg + " seconds");
          }
          break;
        case "aborttimer":
          m("Countdown aborted")
          break;
        case "map":
          if (mp.arg.match(/\d+/)) {
            m(`Changed beatmap to https://osu.ppy.sh/b/${mp.arg} map name`);
          } else {
            m("Invalid map ID provided");
          }
          break;
        default:
          logger.warn("unhandled command", mp.command, mp.arg);
          break;
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