"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.trial = void 0;
const discord_js_1 = require("discord.js");
const config_1 = __importDefault(require("config"));
const delay = (ms) => new Promise(res => setTimeout(res, ms));
const commands = [
    {
        name: 'ping',
        description: 'ping'
    }
];
const ADMIN_ROLE = {
    name: 'ahr-admin',
    color: 'ORANGE',
    reason: 'ahr-bot administrator'
};
async function trial() {
    const client = new discord_js_1.Client({ intents: [discord_js_1.Intents.FLAGS.GUILDS, discord_js_1.Intents.FLAGS.GUILD_INTEGRATIONS] });
    const cfg = config_1.default.get('Discord');
    client.once('ready', async (cl) => {
        console.log(`Ready! ${generateInviteLink()}`);
        for (const g of cl.guilds.cache.values()) {
            await g.commands.set(commands);
        }
    });
    client.on('interactionCreate', async (interaction) => {
        if (!interaction.inGuild())
            return;
        if (interaction.isCommand()) {
            if (interaction.commandName === 'ping') {
                const emb = new discord_js_1.MessageEmbed().setColor('AQUA').setTitle('aaa').addField('field', 'aa');
                const btn1 = new discord_js_1.MessageButton().setLabel('menu').setStyle(3 /* SUCCESS */).setCustomId('menu');
                const row = new discord_js_1.MessageActionRow().addComponents(btn1);
                await interaction.reply('Pong!');
                await interaction.channel?.send({ embeds: [emb], components: [row] });
            }
        }
        if (interaction.isButton()) {
            switch (interaction.customId) {
                case 'menu':
                    if (checkMemberHasAhrAdminRole(interaction.member)) {
                        await interaction.reply({
                            content: 'admin menu',
                            components: [new discord_js_1.MessageActionRow().addComponents(new discord_js_1.MessageButton().setLabel('transfer').setStyle(3 /* SUCCESS */).setCustomId('transfer'), new discord_js_1.MessageButton().setLabel('close').setStyle(4 /* DANGER */).setCustomId('close'))],
                            ephemeral: true
                        });
                    }
                    else {
                        await interaction.reply({
                            content: 'there is no menu for you.',
                            ephemeral: true
                        });
                    }
                    break;
                case 'transfer':
                    await interaction.reply({ content: 'start transfer', ephemeral: true });
                    break;
                case 'close':
                    await interaction.reply({ content: 'close', ephemeral: true });
                    break;
            }
        }
    });
    client.on('messageCreate', async (message) => {
        console.log(`msg:${message.content}`);
        if (message.author.bot) {
            return;
        }
        if (message.content === 'ai') {
            await message.channel.send('ou');
        }
    });
    console.log(cfg.token);
    await client.login(cfg.token);
    function generateInviteLink() {
        return client.generateInvite({
            scopes: ['bot', 'applications.commands'],
            permissions: [
                discord_js_1.Permissions.FLAGS.MANAGE_CHANNELS,
                discord_js_1.Permissions.FLAGS.MANAGE_ROLES,
                discord_js_1.Permissions.FLAGS.MANAGE_MESSAGES,
            ]
        });
    }
    function checkMemberHasAhrAdminRole(member) {
        return member.roles.cache.find(f => f.name === ADMIN_ROLE.name) !== undefined;
    }
}
exports.trial = trial;
//# sourceMappingURL=DiscordTrial.js.map