import * as irc from './libs/irc';
import { IsStatResponse } from './parsers/StatParser';
import { EventEmitter } from 'events';
import { getLogger } from './Loggers';

const ircLogger = getLogger('irc');
const pmLogger = getLogger('pm');

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
    ircLogger.error(`@NodeIRC#error\n${message instanceof Error ? `${message.message}\n${message.stack}\n` : ''}${message instanceof Object && JSON.stringify(message) !== '{}' ? `${JSON.stringify(message, null, 2)}\n` : ''}message =`, message);
  });
  client.on('registered', function (message) {
    const args = message.args as string[] | undefined;
    ircLogger.debug(`@NodeIRC#registered ${args?.join(', ')}`);
  });
  client.on('message', function (from, to, message) {
    ircLogger.debug(`@NodeIRC#message ${from} => ${to}: ${message}`);
  });
  client.on('pm', function (nick, message) {
    ircLogger.debug(`@NodeIRC#pm ${nick}: ${message}`);
  });
  client.on('join', function (channel, who) {
    ircLogger.debug(`@NodeIRC#join ${who} has joined ${channel}`);
  });
  client.on('part', function (channel, who, reason) {
    ircLogger.debug(`@NodeIRC#part ${who} has left ${channel}: ${reason}`);
  });
  client.on('kick', function (channel, who, by, reason) {
    ircLogger.debug(`@NodeIRC#kick ${who} was kicked from ${channel} by ${by}: ${reason}`);
  });
  client.on('invite', (channel, from) => {
    ircLogger.debug(`@NodeIRC#invite ${from} invited you to ${channel}`);
  });
  client.on('notice', function (from, to, message) {
    ircLogger.debug(`@NodeIRC#notice ${from} => ${to}: ${message}`);
  });
  client.on('action', function (from, to, text, message) {
    ircLogger.debug(`@NodeIRC#action ${from} => ${to}: ${text}`);
  });
  client.on('selfMessage', (target: string, toSend) => {
    ircLogger.debug(`@NodeIRC#selfMessage Bot => ${target}: ${toSend}`);
  });
}

export function logPrivateMessage(client: IIrcClient) {
  client.on('message', (from, to, message) => {
    if (to === client.nick) {
      if (IsStatResponse(message)) {
        pmLogger.trace(`@NodeIRC#message PM: ${from} -> ${message}`);
      } else {
        pmLogger.info(`@NodeIRC#message PM: ${from} -> ${message}`);
      }
    }
  });
}
