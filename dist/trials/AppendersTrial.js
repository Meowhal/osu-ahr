"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.trial = void 0;
const log4js_1 = __importDefault(require("log4js"));
const discord_js_1 = require("discord.js");
const config_1 = __importDefault(require("config"));
const DiscordAppender_1 = require("../discord/DiscordAppender");
const COMMANDS = [
    {
        name: 'test',
        description: 'execute appender test',
    },
];
async function trial() {
    const client = new discord_js_1.Client({ intents: [discord_js_1.Intents.FLAGS.GUILDS, discord_js_1.Intents.FLAGS.GUILD_INTEGRATIONS] });
    const cfg = config_1.default.get('Discord');
    log4js_1.default.configure({
        appenders: {
            discord: {
                type: 'src/discord/DiscordAppender',
                layout: {
                    type: 'pattern',
                    pattern: '%m'
                }
            },
        },
        categories: { default: { appenders: ['discord'], level: 'all' } }
    });
    client.once('ready', async (cl) => {
        for (const g of cl.guilds.cache.values()) {
            await registerCommands(g);
        }
        console.log(`invite link => ${generateInviteLink(client)}`);
        (0, DiscordAppender_1.setContext)(cl, {});
    });
    client.on('interactionCreate', async (interaction) => {
        if (!interaction.isCommand())
            return;
        if (!interaction.inGuild())
            return;
        switch (interaction.commandName) {
            case 'test':
                await test(interaction);
                break;
        }
    });
    await client.login(cfg.token);
}
exports.trial = trial;
async function test(interaction) {
    const chatlogger = log4js_1.default.getLogger('chat');
    setDiscordId(interaction, chatlogger);
    chatlogger.trace('user1:hello');
    chatlogger.info('user2:hello');
    const inout = log4js_1.default.getLogger('inout');
    setDiscordId(interaction, inout);
    inout.trace('+\x1B[32m Gaevsk1y, Althic_ \x1B[0m, -\x1B[31m Tryeforce(2), Shinkilol(1) \x1B[0m');
    inout.trace('+\x1B[32m Lammahs, Toga_love, m180icheui, Blobby, jjw4074, JohnsonxD \x1B[0m');
    inout.info('-\x1B[31m popth4molly(2), KingBaLK(1), Gaevsk1y(1) \x1B[0m');
    const lobby = log4js_1.default.getLogger('lobby');
    setDiscordId(interaction, lobby);
    lobby.info('info log');
    lobby.warn('warn log');
    lobby.error('error log');
    await interaction.reply('end');
}
function generateInviteLink(client) {
    return client.generateInvite({
        scopes: ['bot', 'applications.commands'],
        permissions: [
            discord_js_1.Permissions.FLAGS.MANAGE_CHANNELS,
            discord_js_1.Permissions.FLAGS.MANAGE_ROLES
        ]
    });
}
async function registerCommands(guild) {
    await guild.commands.set(COMMANDS);
}
function setDiscordId(interaction, logger) {
    logger.addContext('guildId', interaction.guildId);
    logger.addContext('channelId', interaction.channelId);
}
//# sourceMappingURL=AppendersTrial.js.map