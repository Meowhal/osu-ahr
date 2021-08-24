import { ApplicationCommandData, Client, Collection, Intents, Message } from "discord.js";
import { SlashCommandBuilder } from "@discordjs/builders";
import config from "config";
import { executionAsyncResource } from "async_hooks";

interface DiscordOption {
    token: string
}

export async function trial() {

    let client = new Client({ intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_INTEGRATIONS] });
    let cfg = config.get<DiscordOption>("Discord");

    const commands: ApplicationCommandData[] = [{
        name: 'ping',
        description: 'Ping!',

    }];

    client.once('ready', () => {
        console.log('Ready!');
    });

    client.on('interactionCreate', async interaction => {
        console.log(interaction);
        if (!interaction.isCommand()) return;

        if (interaction.commandName === "ping") {
            await interaction.reply("Pong!");
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

function createPingCommand(): ApplicationCommandData {
    
    return {
        name: "ping",
        description: "ping"
    }
}