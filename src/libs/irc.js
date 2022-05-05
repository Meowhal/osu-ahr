/*
    irc.js - Node JS IRC client library

    (C) Copyright Martyn Smith 2010
    (C) Copyright Edward Jones 2017

    This library is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This library is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with this library.  If not, see <http://www.gnu.org/licenses/>.
*/

exports.Client = Client;
var net = require('net');
var tls = require('tls');
var util = require('util');
var EventEmitter = require('events');

var colors = require('irc-upd/lib/colors.js');
var parseMessage = require('irc-upd/lib/parse_message.js');
exports.colors = colors;
var CyclingPingTimer = require('irc-upd/lib/cycling_ping_timer.js');

var lineDelimiter = new RegExp(/\r\n|\r|\n/);

function Client(server, clientNick, opt) {
    var self = this;
    self.opt = {
        server: server,
        nick: clientNick,
        userName: 'nodebot',
        realName: 'nodeJS IRC client',
        password: null,
        port: 6667,
        localAddress: null,
        debug: false,
        showErrors: false,
        channels: [],
        autoRejoin: false,
        autoRenick: false,
        autoConnect: true,
        retryCount: null,
        retryDelay: 2000,
        renickCount: null,
        renickDelay: 60000,
        secure: false,
        selfSigned: false,
        certExpired: false,
        floodProtection: false,
        floodProtectionDelay: 1000,
        sasl: false,
        webirc: {
            pass: '',
            ip: '',
            host: ''
        },
        stripColors: false,
        channelPrefixes: '&#',
        messageSplit: 512,
        encoding: null,
        millisecondsOfSilenceBeforePingSent: 15 * 1000,
        millisecondsBeforePingTimeout: 8 * 1000,
        enableStrictParse: false
    };

    // Features supported by the server
    // (Initial values are RFC 1459 defaults. Zeros signify no default or unlimited value.)
    self.supported = {
        channel: {
            idlength: {},
            length: 200,
            limit: [],
            modes: { a: '', b: '', c: '', d: '' },
            types: self.opt.channelPrefixes
        },
        kicklength: 0,
        maxlist: [],
        maxtargets: {},
        modes: 3,
        nicklength: 9,
        topiclength: 0,
        usermodes: ''
    };

    if (typeof opt === 'object') {
        var keys = Object.keys(self.opt);
        keys.forEach(function (k) {
            if (typeof opt[k] !== 'undefined') {
                self.opt[k] = opt[k];
            }
        });
    }

    // Instead of wrapping every debug call in a guard, provide debug and error methods for the client.
    self.out = {
        showErrors: self.opt.showErrors,
        showDebug: self.opt.debug
    };
    self.out.error = function () {
        if (!this.showDebug && !this.showErrors) return;
        // '\u001b[01;31mERROR: ' + errorObjs + '\u001b[0m'
        var args = Array.prototype.slice.call(arguments);
        args.unshift('\u001b[01;31mERROR:'); args.push('\u001b[0m');
        util.log.apply(util, args);
    };
    self.out.debug = function () {
        if (!this.showDebug) return;
        util.log.apply(util, arguments);
    };


    if (self.opt.floodProtection) {
        self.activateFloodProtection();
    }

    self.hostMask = '';

    // TODO - fail if nick or server missing
    // TODO - fail if username has a space in it
    if (self.opt.autoConnect === true) {
        self.connect();
    }

    self.addListener('raw', function (message) {
        var channels = [],
            channel,
            nick,
            from,
            text,
            to;

        switch (message.command) {
            case 'rpl_welcome':
                // Set nick to whatever the server decided it really is
                // (normally this is because you chose something too long and the server has shortened it)
                self.nick = message.args[0];
                // Note our hostmask to use it in splitting long messages
                // We don't send our hostmask when issuing PRIVMSGs or NOTICEs, but servers on the other side will include it in messages and will truncate what we send accordingly
                var welcomeStringWords = message.args[1].split(/\s+/);
                self.hostMask = welcomeStringWords[welcomeStringWords.length - 1];
                self._updateMaxLineLength();
                self.emit('registered', message);
                self.whois(self.nick, function (args) {
                    self.nick = args.nick;
                    self.hostMask = args.user + '@' + args.host;
                    self._updateMaxLineLength();
                });
                break;
            case 'rpl_myinfo':
                self.supported.usermodes = message.args[3];
                break;
            case 'rpl_isupport':
                message.args.forEach(function (arg) {
                    var match;
                    match = arg.match(/([A-Z]+)=(.*)/);
                    if (match) {
                        var param = match[1];
                        var value = match[2];
                        switch (param) {
                            case 'CHANLIMIT':
                                value.split(',').forEach(function (val) {
                                    val = val.split(':');
                                    self.supported.channel.limit[val[0]] = parseInt(val[1]);
                                });
                                break;
                            case 'CHANMODES':
                                value = value.split(',');
                                var type = ['a', 'b', 'c', 'd'];
                                for (var i = 0; i < type.length; i++) {
                                    self.supported.channel.modes[type[i]] += value[i];
                                }
                                break;
                            case 'CHANTYPES':
                                self.supported.channel.types = value;
                                break;
                            case 'CHANNELLEN':
                                self.supported.channel.length = parseInt(value);
                                break;
                            case 'IDCHAN':
                                value.split(',').forEach(function (val) {
                                    val = val.split(':');
                                    self.supported.channel.idlength[val[0]] = parseInt(val[1]);
                                });
                                break;
                            case 'KICKLEN':
                                self.supported.kicklength = parseInt(value);
                                break;
                            case 'MAXLIST':
                                value.split(',').forEach(function (val) {
                                    val = val.split(':');
                                    self.supported.maxlist[val[0]] = parseInt(val[1]);
                                });
                                break;
                            case 'NICKLEN':
                                self.supported.nicklength = parseInt(value);
                                break;
                            case 'PREFIX':
                                match = value.match(/\((.*?)\)(.*)/);
                                if (match) {
                                    match[1] = match[1].split('');
                                    match[2] = match[2].split('');
                                    while (match[1].length) {
                                        self.modeForPrefix[match[2][0]] = match[1][0];
                                        self.supported.channel.modes.b += match[1][0];
                                        self.prefixForMode[match[1].shift()] = match[2].shift();
                                    }
                                }
                                break;
                            case 'TARGMAX':
                                value.split(',').forEach(function (val) {
                                    val = val.split(':');
                                    val[1] = (!val[1]) ? 0 : parseInt(val[1]);
                                    self.supported.maxtargets[val[0]] = val[1];
                                });
                                break;
                            case 'TOPICLEN':
                                self.supported.topiclength = parseInt(value);
                                break;
                        }
                    }
                });
                break;
            case 'rpl_yourhost':
            case 'rpl_created':
            case 'rpl_luserclient':
            case 'rpl_luserop':
            case 'rpl_luserchannels':
            case 'rpl_luserme':
            case 'rpl_localusers':
            case 'rpl_globalusers':
            case 'rpl_statsconn':
            case 'rpl_luserunknown':
            case 'rpl_whoishost':
            case '396':
            case '042':
                // Random welcome stuff, ignoring
                break;
            case 'err_nicknameinuse':
                if (typeof self.opt.nickMod === 'undefined')
                    self.opt.nickMod = 0;
                if (message.args[1] === self.opt.nick && (self.conn.renickInterval || self.conn.attemptedLastRenick)) {
                    self.out.debug('Attempted to automatically renick to', message.args[1], 'and found it taken');
                    break;
                }
                self.opt.nickMod++;
                self.send('NICK', self.opt.nick + self.opt.nickMod);
                self.nick = self.opt.nick + self.opt.nickMod;
                self._updateMaxLineLength();
                if (self.opt.autoRenick) {
                    var renickTimes = 0;
                    self.cancelAutoRenick();
                    self.conn.renickInterval = setInterval(function () {
                        if (self.nick === self.opt.nick) {
                            self.out.debug('Attempted to automatically renick to', self.nick, 'and found that was the current nick');
                            self.cancelAutoRenick();
                            return;
                        }
                        self.send('NICK', self.opt.nick);
                        renickTimes++;
                        if (self.opt.renickCount !== null && renickTimes >= self.opt.renickCount) {
                            self.out.debug('Maximum autorenick retry count (' + self.opt.renickCount + ') reached');
                            self.cancelAutoRenick();
                            self.conn.attemptedLastRenick = true;
                        }
                    }, self.opt.renickDelay);
                }
                break;
            case 'PING':
                self.send('PONG', message.args[0]);
                self.emit('ping', message.args[0]);
                break;
            case 'PONG':
                self.emit('pong', message.args[0]);
                break;
            case 'NOTICE':
                from = message.nick;
                to = message.args[0];
                if (!to) {
                    to = null;
                }
                text = message.args[1] || '';
                if (text[0] === '\u0001' && text.lastIndexOf('\u0001') > 0) {
                    self._handleCTCP(from, to, text, 'notice', message);
                    break;
                }
                self.emit('notice', from, to, text, message);

                if (to === self.nick)
                    self.out.debug('GOT NOTICE from ' + (from ? '"' + from + '"' : 'the server') + ': "' + text + '"');
                break;
            case 'MODE':
                self.out.debug('MODE: ' + message.args[0] + ' sets mode: ' + message.args[1]);

                channel = self.chanData(message.args[0]);
                if (!channel) break;
                var modeList = message.args[1].split('');
                var adding = true;
                var modeArgs = message.args.slice(2);
                var chanModes = function (mode, param) {
                    var arr = param && Array.isArray(param);
                    if (adding) {
                        if (channel.mode.indexOf(mode) === -1) {
                            channel.mode += mode;
                        }
                        if (typeof param === 'undefined') {
                            channel.modeParams[mode] = [];
                        } else if (arr) {
                            channel.modeParams[mode] = channel.modeParams[mode] ?
                                channel.modeParams[mode].concat(param) : param;
                        } else {
                            channel.modeParams[mode] = [param];
                        }
                    } else if (mode in channel.modeParams) {
                        if (arr) {
                            channel.modeParams[mode] = channel.modeParams[mode]
                                .filter(function (v) { return v !== param[0]; });
                        }
                        if (!arr || channel.modeParams[mode].length === 0) {
                            channel.mode = channel.mode.replace(mode, '');
                            delete channel.modeParams[mode];
                        }
                    }
                };
                modeList.forEach(function (mode) {
                    if (mode === '+') {
                        adding = true;
                        return;
                    }
                    if (mode === '-') {
                        adding = false;
                        return;
                    }

                    var eventName = (adding ? '+' : '-') + 'mode';
                    var supported = self.supported.channel.modes;
                    var modeArg;
                    if (mode in self.prefixForMode) {
                        modeArg = modeArgs.shift();
                        if (channel.users.hasOwnProperty(modeArg)) {
                            if (adding) {
                                if (channel.users[modeArg].indexOf(self.prefixForMode[mode]) === -1)
                                    channel.users[modeArg] += self.prefixForMode[mode];
                            } else channel.users[modeArg] = channel.users[modeArg].replace(self.prefixForMode[mode], '');
                        }
                        self.emit(eventName, message.args[0], message.nick, mode, modeArg, message);
                    } else if (supported.a.indexOf(mode) !== -1) {
                        modeArg = modeArgs.shift();
                        chanModes(mode, [modeArg]);
                        self.emit(eventName, message.args[0], message.nick, mode, modeArg, message);
                    } else if (supported.b.indexOf(mode) !== -1) {
                        modeArg = modeArgs.shift();
                        chanModes(mode, modeArg);
                        self.emit(eventName, message.args[0], message.nick, mode, modeArg, message);
                    } else if (supported.c.indexOf(mode) !== -1) {
                        if (adding) modeArg = modeArgs.shift();
                        else modeArg = undefined;
                        chanModes(mode, modeArg);
                        self.emit(eventName, message.args[0], message.nick, mode, modeArg, message);
                    } else if (supported.d.indexOf(mode) !== -1) {
                        chanModes(mode);
                        self.emit(eventName, message.args[0], message.nick, mode, undefined, message);
                    }
                });
                break;
            case 'NICK':
                if (message.nick === self.nick) {
                    // client just changed own nick
                    self.nick = message.args[0];
                    self.cancelAutoRenick();
                    self._updateMaxLineLength();
                }

                self.out.debug('NICK: ' + message.nick + ' changes nick to ' + message.args[0]);

                channels = [];

                // Figure out what channels the user is in, update relevant nicks
                Object.keys(self.chans).forEach(function (channame) {
                    var chan = self.chans[channame];
                    if (message.nick in chan.users) {
                        chan.users[message.args[0]] = chan.users[message.nick];
                        delete chan.users[message.nick];
                        channels.push(channame);
                    }
                });

                // old nick, new nick, channels
                self.emit('nick', message.nick, message.args[0], channels, message);
                break;
            case 'rpl_motdstart':
                self.motd = message.args[1] + '\n';
                break;
            case 'rpl_motd':
                self.motd += message.args[1] + '\n';
                break;
            case 'rpl_endofmotd':
            case 'err_nomotd':
                self.motd += message.args[1] + '\n';
                self.emit('motd', self.motd);
                break;
            case 'rpl_namreply':
                channel = self.chanData(message.args[2]);
                var users = message.args[3].trim().split(/ +/);
                if (channel) {
                    users.forEach(function (user) {
                        var match = user.match(/^(.)(.*)$/);
                        if (match) {
                            if (match[1] in self.modeForPrefix) {
                                channel.users[match[2]] = match[1];
                            }
                            else {
                                channel.users[match[1] + match[2]] = '';
                            }
                        }
                    });
                }
                break;
            case 'rpl_endofnames':
                channel = self.chanData(message.args[1]);
                if (channel) {
                    self.emitChannelEvent('names', message.args[1], channel.users);
                    self.send('MODE', message.args[1]);
                }
                break;
            case 'rpl_topic':
                channel = self.chanData(message.args[1]);
                if (channel) {
                    channel.topic = message.args[2];
                }
                break;
            case 'rpl_away':
                self._addWhoisData(message.args[1], 'away', message.args[2], true);
                break;
            case 'rpl_whoisuser':
                self._addWhoisData(message.args[1], 'user', message.args[2]);
                self._addWhoisData(message.args[1], 'host', message.args[3]);
                self._addWhoisData(message.args[1], 'realname', message.args[5]);
                break;
            case 'rpl_whoisidle':
                self._addWhoisData(message.args[1], 'idle', message.args[2]);
                break;
            case 'rpl_whoischannels':
                // TODO - clean this up?
                if (2 < message.args.length) {
                    self._addWhoisData(message.args[1], 'channels', message.args[2].trim().split(/\s+/));
                }
                break;
            case 'rpl_whoisserver':
                self._addWhoisData(message.args[1], 'server', message.args[2]);
                self._addWhoisData(message.args[1], 'serverinfo', message.args[3]);
                break;
            case 'rpl_whoisoperator':
                self._addWhoisData(message.args[1], 'operator', message.args[2]);
                break;
            case '330': // rpl_whoisaccount?
                self._addWhoisData(message.args[1], 'account', message.args[2]);
                self._addWhoisData(message.args[1], 'accountinfo', message.args[3]);
                break;
            case 'rpl_endofwhois':
                self.emit('whois', self._clearWhoisData(message.args[1]));
                break;
            case 'rpl_whoreply':
                self._addWhoisData(message.args[5], 'user', message.args[2]);
                self._addWhoisData(message.args[5], 'host', message.args[3]);
                self._addWhoisData(message.args[5], 'server', message.args[4]);
                self._addWhoisData(message.args[5], 'realname', /[0-9]+\s*(.+)/g.exec(message.args[7])[1]);
                // emit right away because rpl_endofwho doesn't contain nick
                self.emit('whois', self._clearWhoisData(message.args[5]));
                break;
            case 'rpl_liststart':
                self.channellist = [];
                self.emit('channellist_start');
                break;
            case 'rpl_list':
                channel = {
                    name: message.args[1],
                    users: message.args[2],
                    topic: message.args[3]
                };
                self.emit('channellist_item', channel);
                self.channellist.push(channel);
                break;
            case 'rpl_listend':
                self.emit('channellist', self.channellist);
                break;
            case 'rpl_topicwhotime':
                channel = self.chanData(message.args[1]);
                if (channel) {
                    channel.topicBy = message.args[2];
                    // channel, topic, nick
                    self.emit('topic', message.args[1], channel.topic, channel.topicBy, message);
                }
                break;
            case 'TOPIC':
                // channel, topic, nick
                self.emit('topic', message.args[0], message.args[1], message.nick, message);

                channel = self.chanData(message.args[0]);
                if (channel) {
                    channel.topic = message.args[1];
                    channel.topicBy = message.nick;
                }
                break;
            case 'rpl_channelmodeis':
                channel = self.chanData(message.args[1]);
                if (channel) {
                    channel.mode = message.args[2];
                }
                break;
            case 'rpl_creationtime':
                channel = self.chanData(message.args[1]);
                if (channel) {
                    channel.created = message.args[2];
                }
                break;
            case 'JOIN':
                // channel, who
                if (self.nick === message.nick) {
                    self.chanData(message.args[0], true);
                } else {
                    channel = self.chanData(message.args[0]);
                    if (channel && channel.users) {
                        channel.users[message.nick] = '';
                    }
                }
                self.emitChannelEvent('join', message.args[0], message.nick, message);
                break;
            case 'PART':
                // channel, who, reason
                self.emitChannelEvent('part', message.args[0], message.nick, message.args[1], message);
                if (self.nick === message.nick) {
                    channel = self.chanData(message.args[0]);
                    delete self.chans[channel.key];
                } else {
                    channel = self.chanData(message.args[0]);
                    if (channel && channel.users) {
                        delete channel.users[message.nick];
                    }
                }
                break;
            case 'KICK':
                // channel, who, by, reason
                self.emitChannelEvent('kick', message.args[0], message.args[1], message.nick, message.args[2], message);

                if (self.nick === message.args[1]) {
                    channel = self.chanData(message.args[0]);
                    delete self.chans[channel.key];
                } else {
                    channel = self.chanData(message.args[0]);
                    if (channel && channel.users) {
                        delete channel.users[message.args[1]];
                    }
                }
                break;
            case 'KILL':
                nick = message.args[0];
                channels = [];
                Object.keys(self.chans).forEach(function (channame) {
                    var chan = self.chans[channame];
                    if (nick in chan.users) {
                        channels.push(channame);
                        delete chan.users[nick];
                    }
                });
                self.emit('kill', nick, message.args[1], channels, message);
                break;
            case 'PRIVMSG':
                from = message.nick;
                to = message.args[0];
                text = message.args[1] || '';
                if (text[0] === '\u0001' && text.lastIndexOf('\u0001') > 0) {
                    self._handleCTCP(from, to, text, 'privmsg', message);
                    break;
                }
                self.emit('message', from, to, text, message);
                if (self.supported.channel.types.indexOf(to.charAt(0)) !== -1) {
                    self.emit('message#', from, to, text, message);
                    self.emit('message' + to, from, text, message);
                    if (to !== to.toLowerCase()) {
                        self.emit('message' + to.toLowerCase(), from, text, message);
                    }
                }
                if (to.toUpperCase() === self.nick.toUpperCase()) {
                    self.emit('pm', from, text, message);
                    self.out.debug('GOT MESSAGE from "' + from + '": "' + text + '"');
                }
                break;
            case 'INVITE':
                from = message.nick;
                to = message.args[0];
                channel = message.args[1];
                self.emit('invite', channel, from, message);
                break;
            case 'QUIT':
                self.out.debug('QUIT: ' + message.prefix + ' ' + message.args.join(' '));
                if (self.nick === message.nick) {
                    // TODO handle?
                    break;
                }

                // handle other people quitting
                channels = [];

                // Figure out what channels the user was in
                Object.keys(self.chans).forEach(function (channame) {
                    var chan = self.chans[channame];
                    if (message.nick in chan.users) {
                        delete chan.users[message.nick];
                        channels.push(channame);
                    }
                });

                // who, reason, channels
                self.emit('quit', message.nick, message.args[0], channels, message);
                break;

            // for sasl
            case 'CAP':
                // client identifier name, cap subcommand, params
                if (message.args[1] === 'NAK') {
                    // capabilities not handled, error
                    self.out.error(message);
                    self.emit('error', message);
                    break;
                }

                // currently only handle ACK sasl responses
                if (message.args[1] !== 'ACK') break;
                var caps = message.args[2].split(/\s+/);
                if (caps.indexOf('sasl') < 0) break;

                self.send('AUTHENTICATE', 'PLAIN');
                break;
            case 'AUTHENTICATE':
                if (message.args[0] !== '+') break;
                // AUTHENTICATE response (params) must be split into 400-byte chunks
                var authMessage = Buffer.from(
                    self.opt.nick + '\0' +
                    self.opt.userName + '\0' +
                    self.opt.password
                ).toString('base64');
                // must output a "+" after a 400-byte string to make clear it's finished
                for (var i = 0; i < (authMessage.length + 1) / 400; i++) {
                    var chunk = authMessage.slice(i * 400, (i + 1) * 400);
                    if (chunk === '') chunk = '+';
                    self.send('AUTHENTICATE', chunk);
                }
                break;
            case 'rpl_loggedin':
                break;
            case 'rpl_saslsuccess':
                self.send('CAP', 'END');
                break;

            case 'err_umodeunknownflag':
                self.out.error(message);
                self.emit('error', message);
                break;

            case 'err_erroneusnickname':
                self.out.error(message);
                self.emit('error', message);
                break;

            // Commands relating to OPER
            case 'err_nooperhost':
                self.out.error(message);
                self.emit('error', message);
                break;
            case 'rpl_youreoper':
                self.emit('opered');
                break;

            default:
                if (message.commandType === 'error') {
                    self.out.error(message);
                    self.emit('error', message);
                } else {
                    self.out.error('Unhandled message:', message);
                    self.emit('unhandled', message);
                    break;
                }
        }
    });

    self.addListener('kick', function (channel, nick) {
        if (self.opt.autoRejoin && nick.toLowerCase() === self.nick.toLowerCase())
            self.join(channel);
    });
    self.addListener('motd', function () {
        self.opt.channels.forEach(function (channel) {
            self.join(channel);
        });
    });

    EventEmitter.call(this);
}
util.inherits(Client, EventEmitter);

Client.prototype.conn = null;
Client.prototype.prefixForMode = {};
Client.prototype.modeForPrefix = {};
Client.prototype.chans = {};
Client.prototype._whoisData = {};

Client.prototype.connectionTimedOut = function (conn) {
    var self = this;
    if (conn !== self.conn) {
        // Only care about a timeout event if it came from the current connection
        return;
    }
    self.end();
};

(function () {
    var pingCounter = 1;
    Client.prototype.connectionWantsPing = function (conn) {
        var self = this;
        if (conn !== self.conn) {
            // Only care about a wantPing event if it came from the current connection
            return;
        }
        self.send('PING', (pingCounter++).toString());
    };
}());

Client.prototype.chanData = function (name, create) {
    var key = name.toLowerCase();
    if (create) {
        this.chans[key] = this.chans[key] || {
            key: key,
            serverName: name,
            users: {},
            modeParams: {},
            mode: ''
        };
    }

    return this.chans[key];
};

Client.prototype._connectionHandler = function () {
    this.out.debug('Socket connection successful');

    // WEBIRC
    if (this.opt.webirc.ip && this.opt.webirc.pass && this.opt.webirc.host) {
        this.send('WEBIRC', this.opt.webirc.pass, this.opt.userName, this.opt.webirc.host, this.opt.webirc.ip);
    }

    // SASL, server password
    if (this.opt.sasl) {
        // see http://ircv3.net/specs/extensions/sasl-3.1.html
        this.send('CAP', 'REQ', 'sasl');
    } else if (this.opt.password) {
        this.send('PASS', this.opt.password);
    }

    // handshake details
    this.out.debug('Sending irc NICK/USER');
    this.send('NICK', this.opt.nick);
    this.nick = this.opt.nick;
    this._updateMaxLineLength();
    this.send('USER', this.opt.userName, 8, '*', this.opt.realName);

    // watch for ping timeout
    this.conn.cyclingPingTimer.start();

    this.emit('connect');
};

Client.prototype.connect = function (retryCount, callback) {
    if (typeof (retryCount) === 'function') {
        callback = retryCount;
        retryCount = undefined;
    }
    retryCount = retryCount || 0;

    if (typeof (callback) === 'function') {
        this.once('registered', callback);
    }

    // skip connect if already connected
    if (this.conn && !this.conn.requestedDisconnect) {
        this.out.error('Connection already active, not reconnecting – please disconnect first');
        return;
    }

    var self = this;
    self.chans = {};

    // socket opts
    var connectionOpts = {
        host: self.opt.server,
        port: self.opt.port
    };

    // local address to bind to
    if (self.opt.localAddress)
        connectionOpts.localAddress = self.opt.localAddress;

    self.out.debug('Attempting socket connection to IRC server');
    // try to connect to the server
    if (self.opt.secure) {
        connectionOpts.rejectUnauthorized = !self.opt.selfSigned;

        if (typeof self.opt.secure === 'object') {
            // copy "secure" opts to options passed to connect()
            for (var f in self.opt.secure) {
                connectionOpts[f] = self.opt.secure[f];
            }
        }

        self.conn = tls.connect(connectionOpts, function () {
            // callback called only after successful socket connection
            self.conn.connected = true;
            if (self.conn.authorized ||
                (self.opt.selfSigned &&
                    (self.conn.authorizationError === 'DEPTH_ZERO_SELF_SIGNED_CERT' ||
                        self.conn.authorizationError === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE' ||
                        self.conn.authorizationError === 'SELF_SIGNED_CERT_IN_CHAIN')) ||
                (self.opt.certExpired &&
                    self.conn.authorizationError === 'CERT_HAS_EXPIRED')) {
                // authorization successful

                if (!self.opt.encoding) {
                    self.conn.setEncoding('utf-8');
                }

                if (self.opt.certExpired &&
                    self.conn.authorizationError === 'CERT_HAS_EXPIRED') {
                    util.log('Connecting to server with expired certificate');
                }

                self._connectionHandler();
            } else {
                // authorization failed
                util.log(self.conn.authorizationError);
            }
        });
    } else {
        self.conn = net.createConnection(connectionOpts, self._connectionHandler.bind(self));
    }
    self.conn.requestedDisconnect = false;
    self.conn.setTimeout(0);

    // Each connection gets its own CyclingPingTimer.
    // The connection forwards the timer's 'timeout' and 'wantPing' events to the client object via calling the connectionTimedOut() and connectionWantsPing() functions.
    // Since the client's "current connection" value changes over time because of retry functionality,
    // the client should ignore timeout/wantPing events that come from old connections.
    self.conn.cyclingPingTimer = new CyclingPingTimer(self);
    (function (conn) {
        conn.cyclingPingTimer.on('pingTimeout', function () {
            self.connectionTimedOut(conn);
        });
        conn.cyclingPingTimer.on('wantPing', function () {
            self.connectionWantsPing(conn);
        });
    }(self.conn));

    if (!self.opt.encoding) {
        self.conn.setEncoding('utf8');
    }

    var buffer = Buffer.from('');

    function handleData(chunk) {
        self.conn.cyclingPingTimer.notifyOfActivity();

        if (typeof (chunk) === 'string') {
            buffer += chunk;
        } else {
            buffer = Buffer.concat([buffer, chunk]);
        }

        var lines = self.convertEncoding(buffer).toString().split(lineDelimiter);

        if (lines.pop()) {
            // if buffer doesn't end \r\n, there are more chunks.
            return;
        }
        // else, re-initialize the buffer.
        buffer = Buffer.from('');

        lines.forEach(function (line) {
            if (line.length) {
                self.out.debug('Received:', line);
                var message = parseMessage(line, self.opt.stripColors);

                try {
                    self.emit('raw', message);
                } catch (err) {
                    if (!self.conn.requestedDisconnect) {
                        self.emit('error', err);
                    }
                }
            }
        });
    }

    self.conn.addListener('data', handleData);
    self.conn.addListener('end', function () {
        self.out.debug('Connection got "end" event');
    });
    self.conn.addListener('close', function () {
        self.out.debug('Connection got "close" event');

        // don't reconnect if this is an old connection closing
        if (self.conn !== this) {
            self.out.debug('Non-latest connection is being discarded');
            return;
        }

        // skip if this connection is supposed to close
        if (self.conn && self.conn.requestedDisconnect)
            return;

        self.out.debug('Disconnected: reconnecting');
        self.conn.cyclingPingTimer.stop();
        self.cancelAutoRenick();
        self.conn = null;

        // limit to retryCount reconnections
        if (self.opt.retryCount !== null && retryCount >= self.opt.retryCount) {
            self.out.debug('Maximum retry count (' + self.opt.retryCount + ') reached. Aborting');
            self.emit('abort', self.opt.retryCount);
            return;
        }

        // actually reconnect
        self.out.debug('Waiting ' + self.opt.retryDelay + 'ms before retrying');
        self.retryTimeout = setTimeout(function () {
            self.connect(retryCount + 1);
        }, self.opt.retryDelay);
    });

    self.conn.addListener('error', function (exception) {
        self.emit('netError', exception);
        self.out.debug('Network error: ' + exception);
    });
};

Client.prototype.end = function () {
    if (this.conn) {
        this.conn.cyclingPingTimer.stop();
        this.cancelAutoRenick();
        this.conn.destroy();
    }
};

Client.prototype.disconnect = function (message, callback) {
    if (typeof (message) === 'function') {
        callback = message;
        message = undefined;
    }
    message = message || 'node-irc says goodbye';
    var self = this;

    self.out.debug('Disconnecting from IRC server');

    // Skip if already disconnected
    if (!self.conn || self.conn.destroyed) {
        if (self.retryTimeout) {
            clearTimeout(self.retryTimeout);
            self.retryTimeout = null;
            self.out.error('Connection already broken, skipping disconnect (and clearing up automatic retry)');
        } else {
            self.out.error('Connection already broken, skipping disconnect');
        }
        return;
    }

    if (self.conn.requestedDisconnect) {
        self.out.error('Connection already disconnecting, skipping disconnect');
        return;
    }

    // send quit message
    if (self.conn.readyState === 'open') {
        var sendFunction;
        if (self.floodProtectionEnabled) {
            sendFunction = self._sendImmediate;
            self._clearCmdQueue();
        } else {
            sendFunction = self.send;
        }
        sendFunction.call(self, 'QUIT', message);
    }

    // flag connection as disconnecting
    self.conn.requestedDisconnect = true;

    // disconnect
    if (typeof (callback) === 'function') {
        self.conn.once('end', callback);
    }
    self.conn.end();
    self.conn.cyclingPingTimer.stop();
    self.cancelAutoRenick();
};

Client.prototype.send = function () {
    var args = Array.prototype.slice.call(arguments);
    // e.g. NICK, nickname

    // if the last arg contains a space, starts with a colon, or is empty, prepend a colon
    if (args[args.length - 1].match(/\s/) || args[args.length - 1].match(/^:/) || args[args.length - 1] === '') {
        args[args.length - 1] = ':' + args[args.length - 1];
    }

    if (this.conn && !this.conn.requestedDisconnect) {
        this.out.debug('SEND:', args.join(' '));
        this.conn.write(args.join(' ') + '\r\n');
    } else {
        this.out.debug('(Disconnected) SEND:', args.join(' '));
    }
};

Client.prototype.activateFloodProtection = function (interval) {
    var safeInterval = interval || this.opt.floodProtectionDelay,
        self = this;

    self.floodProtectionEnabled = true;
    self.cmdQueue = [];
    self._origSend = self.send;

    // Wrapper for the original send function. Queue the messages.
    self.send = function () {
        self.cmdQueue.push(arguments);
    };

    self._sendImmediate = function () {
        self._origSend.apply(self, arguments);
    };

    self._clearCmdQueue = function () {
        self.cmdQueue = [];
    };

    self.dequeue = function () {
        var args = self.cmdQueue.shift();
        if (args) {
            self._origSend.apply(self, args);
        }
    };

    // Slowly unpack the queue without flooding.
    self.floodProtectionInterval = setInterval(self.dequeue, safeInterval);
    self.dequeue();
};

Client.prototype.deactivateFloodProtection = function () {
    if (!this.floodProtectionEnabled) return;

    clearInterval(this.floodProtectionInterval);
    this.floodProtectionInterval = null;

    var count = this.cmdQueue.length;
    for (var i = 0; i < count; i++) {
        this.dequeue();
    }

    this.send = this._origSend;
    this._origSend = null;
    this._sendImmediate = null;
    this._clearCmdQueue = null;
    this.dequeue = null;

    this.floodProtectionEnabled = false;
};

Client.prototype.cancelAutoRenick = function () {
    if (!this.conn) return;
    var oldInterval = this.conn.renickInterval;
    clearInterval(this.conn.renickInterval);
    this.conn.renickInterval = null;
    return oldInterval;
};

Client.prototype.join = function (channelList, callback) {
    var self = this;
    var parts = channelList.split(' ');
    var channels = parts[0];
    var keys;
    if (parts[1]) keys = parts[1].split(',');
    channels = channels.split(',');
    channels.forEach(function (channelName, index) {
        self.once('join' + channelName.toLowerCase(), function () {
            // Append to opts.channel on successful join, so it rejoins on reconnect.
            var chanString = channelName;
            if (keys && keys[index]) chanString += ' ' + keys[index];
            var channelIndex = self._findChannelFromStrings(channelName);
            if (channelIndex === -1) {
                self.opt.channels.push(chanString);
            }

            if (typeof callback === 'function') {
                return callback.apply(this, arguments);
            }
        });
    });
    self.send.apply(this, ['JOIN'].concat(channelList.split(' ')));
};

Client.prototype.part = function (channelList, message, callback) {
    if (typeof (message) === 'function') {
        callback = message;
        message = undefined;
    }
    var self = this;
    var channels = channelList.split(',');
    channels.forEach(function (channelName) {
        if (typeof callback === 'function') {
            self.once('part' + channelName.toLowerCase(), callback);
        }

        // remove this channel from this.opt.channels so we won't rejoin upon reconnect
        var channelIndex = self._findChannelFromStrings(channelName);
        if (channelIndex !== -1) {
            self.opt.channels.splice(channelIndex, 1);
        }
    });

    if (message) {
        this.send('PART', channelList, message);
    } else {
        this.send('PART', channelList);
    }
};

Client.prototype.action = function (target, text) {
    var self = this;
    var maxLength = Math.min(this.maxLineLength - target.length, this.opt.messageSplit) - '\u0001ACTION \u0001'.length;
    if (typeof text !== 'undefined') {
        text.toString().split(/\r?\n/).filter(function (line) {
            return line.length > 0;
        }).forEach(function (line) {
            var linesToSend = self._splitLongLines(line, maxLength, []);
            linesToSend.forEach(function (split) {
                var toSend = '\u0001ACTION ' + split + '\u0001';
                self.send('PRIVMSG', target, toSend);
                self.emit('selfMessage', target, toSend);
            });
        });
    }
};

// finds the string in opt.channels representing channelName (if present)
Client.prototype._findChannelFromStrings = function (channelName) {
    channelName = channelName.toLowerCase();
    var index = this.opt.channels.findIndex(function (listString) {
        var name = listString.split(' ')[0]; // ignore the key in the string
        name = name.toLowerCase(); // check case-insensitively
        return channelName === name;
    });
    return index;
};

Client.prototype._splitLongLines = function (words, maxLength, destination) {
    maxLength = maxLength || 450; // If maxLength hasn't been initialized yet, prefer an arbitrarily low line length over crashing.
    // If no words left, return the accumulated array of splits
    if (words.length === 0) {
        return destination;
    }
    // If the remaining words fit under the byte limit (by utf-8, for Unicode support), push to the accumulator and return
    if (Buffer.byteLength(words, 'utf8') <= maxLength) {
        destination.push(words);
        return destination;
    }

    // else, attempt to write maxLength bytes of message, truncate accordingly
    var truncatingBuffer = Buffer.alloc(maxLength + 1);
    var writtenLength = truncatingBuffer.write(words, 'utf8');
    var truncatedStr = truncatingBuffer.toString('utf8', 0, writtenLength);
    // and then check for a word boundary to try to keep words together
    var len = truncatedStr.length - 1;
    var c = truncatedStr[len];
    var cutPos;
    var wsLength = 1;
    if (c.match(/\s/)) {
        cutPos = len;
    } else {
        var offset = 1;
        while ((len - offset) > 0) {
            c = truncatedStr[len - offset];
            if (c.match(/\s/)) {
                cutPos = len - offset;
                break;
            }
            offset++;
        }
        if (len - offset <= 0) {
            cutPos = len;
            wsLength = 0;
        }
    }
    // and push the found region to the accumulator, remove from words, split rest of message
    var part = truncatedStr.substring(0, cutPos);
    destination.push(part);
    return this._splitLongLines(words.substring(cutPos + wsLength, words.length), maxLength, destination);
};

Client.prototype.say = function (target, text) {
    this._speak('PRIVMSG', target, text);
};

Client.prototype.notice = function (target, text) {
    this._speak('NOTICE', target, text);
};

Client.prototype.emitChannelEvent = function (eventName, channel) {
    var args = Array.prototype.slice.call(arguments, 2);
    this.emit.apply(this, [eventName, channel].concat(args));
    this.emit.apply(this, [eventName + channel].concat(args));
    if (channel !== channel.toLowerCase()) {
        this.emit.apply(this, [eventName + channel.toLowerCase()].concat(args));
    }
};

Client.prototype._speak = function (kind, target, text) {
    var self = this;
    var maxLength = Math.min(this.maxLineLength - target.length, this.opt.messageSplit);
    if (typeof text !== 'undefined') {
        text.toString().split(/\r?\n/).filter(function (line) {
            return line.length > 0;
        }).forEach(function (line) {
            var linesToSend = self._splitLongLines(line, maxLength, []);
            linesToSend.forEach(function (toSend) {
                self.send(kind, target, toSend);
                if (kind === 'PRIVMSG') {
                    self.emit('selfMessage', target, toSend);
                }
            });
        });
    }
};

Client.prototype.whois = function (nick, callback) {
    if (typeof callback === 'function') {
        var callbackWrapper = function (info) {
            if (info.nick.toLowerCase() === nick.toLowerCase()) {
                this.removeListener('whois', callbackWrapper);
                return callback.apply(this, arguments);
            }
        };
        this.addListener('whois', callbackWrapper);
    }
    this.send('WHOIS', nick);
};

Client.prototype.list = function () {
    var args = Array.prototype.slice.call(arguments, 0);
    args.unshift('LIST');
    this.send.apply(this, args);
};

Client.prototype._addWhoisData = function (nick, key, value, onlyIfExists) {
    if (onlyIfExists && !this._whoisData[nick]) return;
    this._whoisData[nick] = this._whoisData[nick] || { nick: nick };
    this._whoisData[nick][key] = value;
};

Client.prototype._clearWhoisData = function (nick) {
    // Ensure that at least the nick exists before trying to return
    this._addWhoisData(nick, 'nick', nick);
    var data = this._whoisData[nick];
    delete this._whoisData[nick];
    return data;
};

Client.prototype._handleCTCP = function (from, to, text, type, message) {
    text = text.slice(1);
    text = text.slice(0, text.indexOf('\u0001'));
    var parts = text.split(' ');
    this.emit('ctcp', from, to, text, type, message);
    this.emit('ctcp-' + type, from, to, text, message);
    if (type === 'privmsg' && text === 'VERSION')
        this.emit('ctcp-version', from, to, message);
    if (parts[0] === 'ACTION' && parts.length > 1)
        this.emit('action', from, to, parts.slice(1).join(' '), message);
    if (parts[0] === 'PING' && type === 'privmsg' && parts.length > 1)
        this.ctcp(from, 'notice', text);
};

Client.prototype.ctcp = function (to, type, text) {
    return this[type === 'privmsg' ? 'say' : 'notice'](to, '\u0001' + text + '\u0001');
};

function convertEncodingHelper(str, encoding, errorHandler) {
    var out = str;
    var charset;
    try {
        var iconv = require('iconv-lite');
        var charsetDetector = require('chardet');

        charset = charsetDetector.detect(str);
        var decoded = iconv.decode(str, charset);
        out = Buffer.from(iconv.encode(decoded, encoding));
    } catch (err) {
        if (!errorHandler) throw err;
        errorHandler(err, charset);
    }
    return out;
}

Client.prototype.convertEncoding = function (str) {
    var self = this, out = str;

    if (self.opt.encoding) {
        out = convertEncodingHelper(str, self.opt.encoding, function (err, charset) {
            if (self.out) self.out.error(err, { str: str, charset: charset });
        });
    }

    return out;
};

function canConvertEncoding() {
    // hardcoded "schön" in ISO-8859-1 and UTF-8
    var sampleText = Buffer.from([0x73, 0x63, 0x68, 0xf6, 0x6e]);
    var expectedText = Buffer.from([0x73, 0x63, 0x68, 0xc3, 0xb6, 0x6e]);
    var error;
    var text = convertEncodingHelper(sampleText, 'utf-8', function (e) { error = e; });
    if (error || text.toString() !== expectedText.toString()) {
        return false;
    }
    return true;
}
exports.canConvertEncoding = canConvertEncoding;
Client.prototype.canConvertEncoding = canConvertEncoding;

// blatantly stolen from irssi's splitlong.pl. Thanks, Bjoern Krombholz!
Client.prototype._updateMaxLineLength = function () {
    // 497 = 510 - (":" + "!" + " PRIVMSG " + " :").length;
    // target is determined in _speak() and subtracted there
    this.maxLineLength = 497 - this.nick.length - this.hostMask.length;
};
