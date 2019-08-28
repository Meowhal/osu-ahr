import * as irc from "./libs/irc";
import { EventEmitter } from "events";
import { DummyIrcClient } from "./dummies/DummyIrcClient";
import log4js from "log4js";
const logger = log4js.getLogger("irc");

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
    logger.error('ERROR: %s: %s', message.command, message.args.join(' '));
  });
  client.on('registered', function (message) {
    const args = message.args as string[];
    logger.debug('@reg %s', args.join(", "));
  });
  client.on('message', function (from, to, message) {
    logger.debug('@msg  %s => %s: %s', from, to, message);
  });
  client.on('pm', function (nick, message) {
    logger.debug('@pm   %s: %s', nick, message);
  });
  client.on('join', function (channel, who) {
    logger.debug('@join %s has joined %s', who, channel);
  });
  client.on('part', function (channel, who, reason) {
    logger.debug('@part %s has left %s: %s', who, channel, reason);
  });
  client.on('kick', function (channel, who, by, reason) {
    logger.debug('@kick %s was kicked from %s by %s: %s', who, channel, by, reason);
  });
  client.on('invite', (channel, from) => {
    logger.debug(`@invt ${from} invite you to ${channel}`);
  });
  client.on('notice', function (from, to, message) {
    logger.debug('@notice  %s => %s: %s', from, to, message);
  });
  if (!(client instanceof DummyIrcClient)) {
    client.on('sentMessage', function (to, message) {
      logger.debug(`@sent bot => ${to}: ${message}`);
    });
  }
}