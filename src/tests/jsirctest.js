var ircClient = require('irc');

var IRCNetConfig = {
  server: 'irc.ircnet.ne.jp',
  port: 6667,
  nick: 'ggk',
  fullname: 'ggk',
  pass: null,
}

var DollyfishConfig = {
  server: 'irc.dollyfish.net.nz',
  port: 6667,
  nick: 'bot',
  fullname: 'gngk',
  pass: null,
  channels: ['#test']
}

var config = DollyfishConfig;
var chan = '#mp_52448482';

var irc = require('irc');
var bot = new irc.Client(config.server, config.nick, {
  debug: true,
  channels: config.channels,
});
bot.addListener('error', function (message) {
  console.error('ERROR: %s: %s', message.command, message.args.join(' '));
});

bot.addListener('message#blah', function (from, message) {
  console.log('<%s> %s', from, message);
});

bot.addListener('message', function (from, to, message) {
  console.log('%s => %s: %s', from, to, message);

  if (to.match(/^[#&]/)) {
    // channel message
    if (message.match(/hello/i)) {
      bot.say(to, 'Hello there ' + from);
    }
    if (message.match(/dance/)) {
      setTimeout(function () { bot.say(to, '\u0001ACTION dances: :D\\-<\u0001'); }, 1000);
      setTimeout(function () { bot.say(to, '\u0001ACTION dances: :D|-<\u0001'); }, 2000);
      setTimeout(function () { bot.say(to, '\u0001ACTION dances: :D/-<\u0001'); }, 3000);
      setTimeout(function () { bot.say(to, '\u0001ACTION dances: :D|-<\u0001'); }, 4000);
    }
    if (message.match(/qbot/)) {
      setTimeout(() => {
        bot.disconnect();
      }, 100);

      console.log('requested end');
    }
  }
  else {
    // private message
    console.log('private message');
  }
});
bot.addListener('pm', function (nick, message) {
  console.log('Got private message from %s: %s', nick, message);
});
bot.addListener('join', function (channel, who) {
  console.log('%s has joined %s', who, channel);
  bot.say("gnsksz", "private message");
});
bot.addListener('part', function (channel, who, reason) {
  console.log('%s has left %s: %s', who, channel, reason);
});
bot.addListener('kick', function (channel, who, by, reason) {
  console.log('%s was kicked from %s by %s: %s', who, channel, by, reason);
});

