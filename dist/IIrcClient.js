"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logPrivateMessage = exports.logIrcEvent = void 0;
const StatParser_1 = require("./parsers/StatParser");
const Loggers_1 = require("./Loggers");
const ircLogger = (0, Loggers_1.getLogger)('irc');
const pmLogger = (0, Loggers_1.getLogger)('pm');
function logIrcEvent(client) {
    client.on('error', function (message) {
        ircLogger.error(`@NodeIRC#error\n${message instanceof Error ? `${message.message}\n${message.stack}\n` : ''}${message instanceof Object && JSON.stringify(message) !== '{}' ? `${JSON.stringify(message, null, 2)}\n` : ''}message =`, message);
    });
    client.on('registered', function (message) {
        const args = message.args;
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
    client.on('selfMessage', (target, toSend) => {
        ircLogger.debug(`@NodeIRC#selfMessage Bot => ${target}: ${toSend}`);
    });
}
exports.logIrcEvent = logIrcEvent;
function logPrivateMessage(client) {
    client.on('message', (from, to, message) => {
        if (to === client.nick) {
            if ((0, StatParser_1.IsStatResponse)(message)) {
                pmLogger.trace(`@NodeIRC#message PM: ${from} -> ${message}`);
            }
            else {
                pmLogger.info(`@NodeIRC#message PM: ${from} -> ${message}`);
            }
        }
    });
}
exports.logPrivateMessage = logPrivateMessage;
//# sourceMappingURL=IIrcClient.js.map