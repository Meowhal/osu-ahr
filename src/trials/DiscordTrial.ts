import { Permissions, Client, CreateRoleOptions, GuildMember, Intents, MessageActionRow, MessageButton, MessageEmbed } from 'discord.js';
import config from 'config';
import { MessageButtonStyles } from 'discord.js/typings/enums';


const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

interface DiscordOption {
  token: string
}

const commands = [
  {
    name: 'ping',
    description: 'ping'
  }
];

const ADMIN_ROLE: CreateRoleOptions = {
  name: 'ahr-admin',
  color: 'ORANGE',
  reason: 'ahr-bot administrator'
};

export async function trial() {

  const client = new Client({ intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_INTEGRATIONS] });
  const cfg = config.get<DiscordOption>('Discord');

  client.once('ready', async cl => {
    console.log(`Ready! ${generateInviteLink()}`);
    for (const g of cl.guilds.cache.values()) {
      await g.commands.set(commands);
    }
  });


  client.on('interactionCreate', async interaction => {
    if (!interaction.inGuild()) return;

    if (interaction.isCommand()) {
      if (interaction.commandName === 'ping') {
        const emb = new MessageEmbed().setColor('AQUA').setTitle('aaa').addField('field', 'aa');
        const btn1 = new MessageButton().setLabel('menu').setStyle(MessageButtonStyles.SUCCESS).setCustomId('menu');
        const row = new MessageActionRow().addComponents(btn1);
        await interaction.reply('Pong!');
        await interaction.channel?.send({ embeds: [emb], components: [row] });
      }
    }

    if (interaction.isButton()) {
      switch (interaction.customId) {
        case 'menu':
          if (checkMemberHasAhrAdminRole(interaction.member as GuildMember)) {
            await interaction.reply({
              content: 'admin menu',
              components: [new MessageActionRow().addComponents(new MessageButton().setLabel('transfer').setStyle(MessageButtonStyles.SUCCESS).setCustomId('transfer'), new MessageButton().setLabel('close').setStyle(MessageButtonStyles.DANGER).setCustomId('close'))],
              ephemeral: true
            });
          } else {
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

  client.on('messageCreate', async message => {
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

  function generateInviteLink(): string {
    return client.generateInvite({
      scopes: ['bot', 'applications.commands'],
      permissions: [
        Permissions.FLAGS.MANAGE_CHANNELS,
        Permissions.FLAGS.MANAGE_ROLES,
        Permissions.FLAGS.MANAGE_MESSAGES,
      ]
    });
  }

  function checkMemberHasAhrAdminRole(member: GuildMember) {
    return member.roles.cache.find(f => f.name === ADMIN_ROLE.name) !== undefined;
  }
}
