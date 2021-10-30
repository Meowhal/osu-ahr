import { ApplicationCommandData, ApplicationCommandPermissionData, Client, Guild, Intents, MessageActionRow, MessageButton, MessageEmbed } from "discord.js";
import config from "config";
import { MessageButtonStyles } from "discord.js/typings/enums";

interface DiscordOption {
    token: string
}

const commands = [
    {
        name: "ping",
        description: "ping"
    }
]

export async function trial() {

    let client = new Client({ intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_INTEGRATIONS] });
    let cfg = config.get<DiscordOption>("Discord");

    client.once('ready', async cl => {
        console.log('Ready!');
        for (let g of cl.guilds.cache.values()) {
            await g.commands.set(commands);
        }
    });


    client.on('interactionCreate', async interaction => {
        if (interaction.isCommand()) {
            if (interaction.commandName === "ping") {
                const emb = new MessageEmbed().setColor("AQUA").setTitle("aaa").addField("field", "aa");
                const btn1 = new MessageButton().setLabel("show chat").setStyle(MessageButtonStyles.SUCCESS).setCustomId("btn1");
                const btn2 = new MessageButton().setLabel("close").setStyle(MessageButtonStyles.SUCCESS).setCustomId("btn2");
                const row = new MessageActionRow().addComponents(btn1, btn2);
                await interaction.reply("Pong!");
                await interaction.channel?.send({ embeds: [emb], components: [row] });
            }
        }

        if (interaction.isButton()) {
            switch (interaction.customId) {
                case "btn1":
                    await interaction.reply("btn1 pushed");
                    break;

                case "btn2":
                    await interaction.reply({ content: "aaa", ephemeral: true });
                    break;
            }
        }


    });

    client.on("messageCreate", async message => {
        console.log("msg:" + message.content);

        if (message.author.bot) {
            return;
        }

        if (message.content === "ai") {
            await message.channel.send("ou");
        }
    });

    console.log(cfg.token);
    await client.login(cfg.token);
}