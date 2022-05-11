import * as irc from '../libs/irc';

const IrcTestSettings = {
  server: 'irc.dollyfish.net.nz',
  nick: 'ohr',
  channel: '#test'
};

export function trial() {
  const bot = new irc.Client(IrcTestSettings.server, IrcTestSettings.nick, {
    autoConnect: true,
    debug: true
  });

  //bot.join(IrcTestSettings.channel);

  bot.addListener('error', function (message) {
    console.error(`ERROR: ${message.command}: ${message.args.join(' ')}`);
  });

  bot.addListener('message#blah', function (from, message) {
    console.log(`<${from}> ${message}`);
  });

  bot.addListener('message', function (from, to, message) {
    console.log(`${from} => ${to}: ${message}`);

    if (to.match(/^[#&]/)) {
      // channel message
      if (message.match(/hello/i)) {
        bot.say(to, `Hello there ${from}`);
      }
      if (message.match(/dance/)) {
        setTimeout(function () { bot.say(to, '\u0001ACTION dances: :D\\-<\u0001'); }, 1000);
        setTimeout(function () { bot.say(to, '\u0001ACTION dances: :D|-<\u0001'); }, 2000);
        setTimeout(function () { bot.say(to, '\u0001ACTION dances: :D/-<\u0001'); }, 3000);
        setTimeout(function () { bot.say(to, '\u0001ACTION dances: :D|-<\u0001'); }, 4000);
      }
    }
    else {
      // private message
      console.log('private message');
    }
  });
  bot.addListener('pm', function (nick, message) {
    console.log(`Got private message from ${nick}: ${message}`);
  });
  bot.addListener('join', function (channel, who) {
    console.log(`${who} has joined ${channel}`);
  });
  bot.addListener('part', function (channel, who, reason) {
    console.log(`${who} has left ${channel}: ${reason}`);
  });
  bot.addListener('kick', function (channel, who, by, reason) {
    console.log(`${who} was kicked from ${channel} by ${by}: ${reason}`);
  });

  bot.addListener('registered', function (message) {
    console.log(`registered ${message}`);
    bot.join('#test');
  });
}
