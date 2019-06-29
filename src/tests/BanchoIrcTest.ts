import * as irc from 'irc';
import ircConfig from "../password";
import { CommandParser } from "../CommandParser";
import {logIrcEvent} from "../IIrcClient";

export function MakeLobbyExperiment() {
  const parser = new CommandParser();

  const bot = new irc.Client(ircConfig.server, ircConfig.nick, {
    debug: false,
    port: ircConfig.port,
    password: ircConfig.password,
  });

  bot.on('error', function (message) {
    console.error('ERROR: %s: %s', message.command, message.args.join(' '));
  });

  bot.on('message', function (from, to, message) {
    console.log('%s => %s: %s', from, to, message);
  });

  bot.on('pm', function (nick, message) {
    console.log('Got private message from %s: %s', nick, message);
    const v = parser.ParseMpMakeResponse(nick, message);
    if (v != null) {
      console.log(`--- parsed pm id=${v.id} title=${v.title}`)
    }
  });

  let is_joined = false;
  bot.on('join', function (channel, who) {
    console.log('%s has joined %s', who, channel);
    if (!is_joined) {
      is_joined = true;
      bot.say(channel, "!mp password");
      bot.say(channel, "!mp invite gnsksz");
      setTimeout(() => {
        bot.say(channel, "!mp close");
      }, 30000);
    }

  });
  bot.on('part', function (channel, who, reason) {
    console.log('%s has left %s: %s', who, channel, reason);
  });
  bot.on('kick', function (channel, who, by, reason) {
    console.log('%s was kicked from %s by %s: %s', who, channel, by, reason);
  });
  bot.on('invite', (channel, from) => {
    console.log(`${from} invite you to ${channel}`);
  });

  bot.addListener('registered', function (message) {
    console.log('registered %s', message);
    bot.say("BanchoBot", "!mp make irc test lobby4");
  });
}

export function ConnectionServerExperiment() {
  const parser = new CommandParser();

  const bot = new irc.Client(ircConfig.server, ircConfig.nick, {
    debug: false,
    port: ircConfig.port,
    password: ircConfig.password,
    autoConnect: false
  });

  logIrcEvent(bot);

  console.log("hostmask => " + bot.hostMask);

  bot.connect();

  bot.addListener('registered', function (message) {
    console.log("hostmask => " + bot.hostMask);
    bot.disconnect("goodby", () => { console.log("disconnected"); });
  });
}