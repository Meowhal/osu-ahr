import log4js from 'log4js';
import { Client, Permissions, Guild, CommandInteraction, ApplicationCommandData, Intents } from 'discord.js';
import config from 'config';
import { setContext } from '../discord/DiscordAppender';

type GuildCommandInteraction = CommandInteraction & { guildId: string; }
export interface DiscordBotConfig {
  token: string; // ボットのトークン https://discord.com/developers/applications
}

const COMMANDS: ApplicationCommandData[] = [
  {
    name: 'test',
    description: 'execute appender test',
  },
];

export async function trial() {

  const client = new Client({ intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_INTEGRATIONS] });
  const cfg = config.get<DiscordBotConfig>('Discord');

  log4js.configure({
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

  client.once('ready', async cl => {
    for (const g of cl.guilds.cache.values()) {
      await registerCommands(g);
    }

    console.log(`invite link => ${generateInviteLink(client)}`);
    setContext(cl, {});
  });

  client.on('interactionCreate', async interaction => {
    if (!interaction.isCommand()) return;
    if (!interaction.inGuild()) return;
    switch (interaction.commandName) {
      case 'test':
        await test(interaction);
        break;
    }
  });

  await client.login(cfg.token);
}

async function test(interaction: GuildCommandInteraction) {
  const chatlogger = log4js.getLogger('chat');
  setDiscordId(interaction, chatlogger);
  chatlogger.trace('user1:hello');
  chatlogger.info('user2:hello');

  const inout = log4js.getLogger('inout');
  setDiscordId(interaction, inout);
  inout.trace('+\x1B[32m Gaevsk1y, Althic_ \x1B[0m, -\x1B[31m Tryeforce(2), Shinkilol(1) \x1B[0m');
  inout.trace('+\x1B[32m Lammahs, Toga_love, m180icheui, Blobby, jjw4074, JohnsonxD \x1B[0m');
  inout.info('-\x1B[31m popth4molly(2), KingBaLK(1), Gaevsk1y(1) \x1B[0m');

  const lobby = log4js.getLogger('lobby');
  setDiscordId(interaction, lobby);
  lobby.info('info log');
  lobby.warn('warn log');
  lobby.error('error log');
  await interaction.reply('end');
}

function generateInviteLink(client: Client): string {
  return client.generateInvite({
    scopes: ['bot', 'applications.commands'],
    permissions: [
      Permissions.FLAGS.MANAGE_CHANNELS,
      Permissions.FLAGS.MANAGE_ROLES
    ]
  });
}

async function registerCommands(guild: Guild) {
  await guild.commands.set(COMMANDS);
}

function setDiscordId(interaction: GuildCommandInteraction, logger: any) {
  logger.addContext('guildId', interaction.guildId);
  logger.addContext('channelId', interaction.channelId);
}
