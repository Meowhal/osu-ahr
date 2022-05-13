import * as irc from '../libs/irc';
import { logIrcEvent } from '../IIrcClient';
import { parser } from '../parsers/CommandParser';
import { getIrcConfig } from '../TypedConfig';

export function trial() {
  const c = getIrcConfig();
  const bot = new irc.Client(c.server, c.nick, c.opt);

  bot.on('error', function (message) {
    console.error(`ERROR: ${message.command}: ${message.args.join(' ')}`);
  });

  bot.on('message', function (from, to, message) {
    console.log(`${from} => ${to}: ${message}`);
  });

  bot.on('pm', function (nick, message) {
    console.log(`Got private message from ${nick}: ${message}`);
    const v = parser.ParseMpMakeResponse(nick, message);
    if (v !== null) {
      console.log(`--- parsed pm id=${v.id} title=${v.title}`);
    }
  });

  let is_joined = false;
  bot.on('join', function (channel, who) {
    console.log(`${who} has joined ${channel}`);
    if (!is_joined) {
      is_joined = true;
      //bot.say(channel, "!mp password");
      //bot.say(channel, "!mp invite gnsksz");
      setTimeout(() => {
        //bot.say(channel, "!mp close");
      }, 30000);
    }

  });
  bot.on('part', function (channel, who, reason) {
    console.log(`${who} has left ${channel}: ${reason}`);
  });
  bot.on('kick', function (channel, who, by, reason) {
    console.log(`${who} was kicked from ${channel} by ${by}: ${reason}`);
  });
  bot.on('invite', (channel, from) => {
    console.log(`${from} invite you to ${channel}`);
  });

  bot.addListener('registered', function (message) {
    console.log(`registered ${message}`);
    //bot.say("BanchoBot", "!mp make irc test lobby4");
    bot.join('#lobby');
  });
}

export function ConnectionServerTrial() {
  const c = getIrcConfig();
  const bot = new irc.Client(c.server, c.nick, c.opt);

  logIrcEvent(bot);

  console.log(`hostmask => ${bot.hostMask}`);

  bot.connect();

  bot.addListener('registered', function (message) {
    console.log(`hostmask => ${bot.hostMask}`);
    bot.disconnect('goodby', () => { console.log('disconnected'); });
  });
}
