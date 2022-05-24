"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logPrivateMessage = exports.logIrcEvent = void 0;
const StatParser_1 = require("./parsers/StatParser");
const Loggers_1 = require("./Loggers");
const ircLogger = (0, Loggers_1.getLogger)('irc');
const pmLogger = (0, Loggers_1.getLogger)('PMLogger');
function logIrcEvent(client) {
    client.on('error', function (message) {
        ircLogger.error(`ERROR:\n${JSON.stringify(message)}\n${JSON.stringify(message.stack)}\n${message}\n${message.stack}`);
    });
    client.on('registered', function (message) {
        const args = message.args;
        ircLogger.debug(`@reg ${args?.join(', ')}`);
    });
    client.on('message', function (from, to, message) {
        ircLogger.debug(`@msg  ${from} => ${to}: ${message}`);
    });
    client.on('pm', function (nick, message) {
        ircLogger.debug(`@pm   ${nick}: ${message}`);
    });
    client.on('join', function (channel, who) {
        ircLogger.debug(`@join ${who} has joined ${channel}`);
    });
    client.on('part', function (channel, who, reason) {
        ircLogger.debug(`@part ${who} has left ${channel}: ${reason}`);
    });
    client.on('kick', function (channel, who, by, reason) {
        ircLogger.debug(`@kick ${who} was kicked from ${channel} by ${by}: ${reason}`);
    });
    client.on('invite', (channel, from) => {
        ircLogger.debug(`@invt ${from} invite you to ${channel}`);
    });
    client.on('notice', function (from, to, message) {
        ircLogger.debug(`@notice  ${from} => ${to}: ${message}`);
    });
    client.on('action', function (from, to, text, message) {
        ircLogger.debug(`@action  ${from} => ${to}: ${text}`);
    });
    client.on('selfMessage', (target, toSend) => {
        ircLogger.debug(`@sent bot => ${target}: ${toSend}`);
    });
}
exports.logIrcEvent = logIrcEvent;
function logPrivateMessage(client) {
    client.on('message', (from, to, message) => {
        if (to === client.nick) {
            if ((0, StatParser_1.IsStatResponse)(message)) {
                pmLogger.trace(`pm ${from} -> ${message}`);
            }
            else {
                pmLogger.info(`pm ${from} -> ${message}`);
            }
        }
    });
}
exports.logPrivateMessage = logPrivateMessage;
//# sourceMappingURL=IIrcClient.js.map