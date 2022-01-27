# osu-ahr Discord Integration
You can control osu-ahr lobbies via a Discord Bot, which allows you to access in-game chat and execute lobby control commands from Discord channels.

## Setup Prerequisite
[discord.js](https://discord.js.org/) requires [Node.js](https://nodejs.org/ja/) 16.6 or higher to use, so make sure you're up to date. To check your Node version, use node -v in your terminal or command prompt, and if it's not high enough, update it.

## Creating your Discord bot

[Setting up a bot application](https://discordjs.guide/preparations/setting-up-a-bot-application.html#creating-your-bot)

Follow the link above to create a bot and obtain the token for the bot.
The obtained token should be written in `./config/local.json` as follows:

```json
{
  "irc": {
    "server": "irc.ppy.sh",
    "nick": "------",
    "opt": {
      "port": 6667,
      "password": "-------",
    }
  },
  "Discord": {
    "token": "THISiSsAMPLEtOKENasdfy.X-hvzA.Ovy4MCQywSkoMRRclStW4xAYK7I"
  }
}
```

## Startup
Start the bot with the following command:
```sh
npm run start:discord
```
After successful activation, a Discord Bot invitation link will appear in the terminal. Click on it to invite it to your guild.
```log
[12:00:00.000][INFO] discord - discord bot is ready.
[12:00:00.100][INFO] discord - invite link => https://discord.com/api/oauth2/authorize?client_id=123&scope=bot+applications.commands&permissions=268435472
```

[**Caution**] For security reasons, please do not make this bot a public bot. Any problems that may arise are entirely your responsibility.

## Role settings
When a bot is invited to a guild, the `ahr-admin` role is created. Only users with this role will be able to manage the lobby. You should assign this role to your own account.

## Make a new lobby
![how to make a lobby](https://raw.githubusercontent.com/Meowhal/osu-ahr/images/screenshot/make.png)

You can make a lobby by executing the `/make (lobby name)` command in your guild. (You need to have the `ahr-admin` role to run this command). If the command succeeds, a tournament lobby will be created in OSU multiplayer, and a `#matches` channel will be created for your guild.

You can make up to four lobbies at the same time, but the bot can only send ten messages every five seconds. 
It is recommended to keep the number of lobbies to one or two, as each additional lobby increases the delay in sending messages for the bot.

## Check match Status
![match status panel](https://raw.githubusercontent.com/Meowhal/osu-ahr/images/screenshot/matches.png)

The status of each match can be check in the information panel on the "matches" channel. The information panel will be automatically updated as needed.
 
## Transfer ingame chat
You can transfer the in-game chat to your guild's channel by pressing the "Start Transfer" button at the bottom of the information panel. When you press that button, a bridge channel will be created starting with "#mp_", where you can see the in-game chat and some logs.

## Join an existing lobby
If the bot has been terminated due to a glitch or some other reason, you can use the `/enter` command after restarting to resume lobby management. The command requires `lobby_id`. It is the numerical part of "#mp_12345".

`/enter lobby_id:123456`

If the guild still has the bridge channel, you can run the `/enter` command without the `lobby_id` in the bridge channel.

## Chat forwarding
The `/say [message]` command is used to forward a message to the in-game chat. This command takes the `message` to be forwarded and the `lobby_id` as options, but you can omit the `lobby_id` if you are in a bridge channel. It can also be used to issue tournament commands such as `!mp start`, and owner commands such as `*regulation`.

```
/say message:hello lobby_id:123456
/say message:!mp start 120
/say message:*regulation max_star=8.99
```

## Slash Commands
|command|desc|ex|
|:--|:--|:--|
|`/make [lobbyName]`| Make a tournament lobby. |`/make 4.00-5.99 auto host rotation`|
|`/enter (lobbyId)`| Enter the lobby. |`/enter` or `/enter 12345`|
|`/say [message] (lobbyId)`| Send a message.|`/say hello!` or `/say !mp start`|
|`/info (lobbyId)`| Shows the status of the lobby.|`/info` or `/info 12345`|
|`/quit (lobbyId)`| Quit managing the lobby. |`/quit` or `/quit 12345`|
|`/close (lobbyId)`| Close the lobby. |`/close` or `/close 12345`|

* Arguments with [] are required, while () are optional.