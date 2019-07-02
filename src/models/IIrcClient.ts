import * as irc from "irc";
import { EventEmitter } from "events";

// テスト用に使用する部分をインターフェースとして定義する
// typescriptのインターフェースはダックタイピング可能なので、
// このインターフェースで宣言しておけばダミーと本物どちらも取り扱える（はず
export interface IIrcClient extends EventEmitter {
  hostMask: string;
  nick: string;
  conn: any;
  join(channel: string, callback?: irc.handlers.IJoinChannel | undefined): void;
  part(channel: string, message: string, callback: irc.handlers.IPartChannel): void;
  say(target: string, message: string): void;
  connect(retryCount?: number | irc.handlers.IRaw | undefined, callback?: irc.handlers.IRaw | undefined): void;
  disconnect(message: string, callback: () => void): void;
}

export function logIrcEvent(client: IIrcClient) {
  client.on('error', function (message) {
    console.error('ERROR: %s: %s', message.command, message.args.join(' '));
  });
  client.on('registered', function (message) {
    console.log('@reg %s', message);
  });
  client.on('message', function (from, to, message) {
    console.log('@msg %s => %s: %s', from, to, message);
  });
  client.on('pm', function (nick, message) {
    console.log('@pm %s: %s', nick, message);
  });
  client.on('join', function (channel, who) {
    console.log('@join %s has joined %s', who, channel);
  });
  client.on('part', function (channel, who, reason) {
    console.log('@part %s has left %s: %s', who, channel, reason);
  });
  client.on('kick', function (channel, who, by, reason) {
    console.log('@kick %s was kicked from %s by %s: %s', who, channel, by, reason);
  });
  client.on('invite', (channel, from) => {
    console.log(`@invite ${from} invite you to ${channel}`);
  });
}