# osu-ahr
Auto Host Rotation bot for [osu!](https://osu.ppy.sh/home) multiplayer.  
The host rotation is managed with a queue. Players are added to the queue when joining a multiplayer lobby and are sent to the back of the queue once their beatmap has been played.

# Command List

## Player Commands
|Command|Description|
|:--|:--|
|`!queue`| Shows host queue.|
|`!skip `| Triggers vote to skip current host.|
|`!start`| Triggers vote start the match.|
|`!abort`| Triggers vote abort the match. Use when the match is stuck.|
|`!update`| Updates current selected map to the latest version. Use when a host picks an outdated map.|
|`!regulations`| Shows any current regulations.|
|`!rank`| Show player rank.|
 
## Host Commands
|Command|Description|Example|
|:--|:--|:--|
|`!skip`| Transfers host to next player in the queue.||
|`!start [seconds]`| Starts the match after a set time in seconds.|`!start 30`|
|`!stop`| Stops active start timer.||
|`!version` or `!v`| Show bot version.||

## Administrator Commands
|Command|Description|Example|
|:--|:--|:--|
|`*start`|Forces the match to start.||
|`*skip`|Forces current host to skip.||
|`*order [players list]`| Reorders the queue in specified order. |`*order p1, p2, p3`|
|`*keep size [1-16]` | Keeps the size of the lobby at specified number. | `*keep size 8`| 
|`*keep password [password]` | Keeps the lobby password. | `*keep password foobar`| 
|`*keep mode [0-3] [0-3]` | Keeps the lobby team and score mode. | `*keep 0 0`, `*keep HeadToHead Combo` | 
|`*keep mods [mod] ([mod]) ([mod]) ...` | Keeps the lobby allowed mods. | `*keep mods HR DT`| 
|`*keep title [title]` | Keeps the lobby title. | `*keep title 0-2.99* Auto Host Rotate`| 
|`*no keep size` | Stops keeping the size of the lobby at specified number. ||
|`*no keep password` | Stops keeping the lobby password. ||
|`*no keep mode` | Stops keeping the team and score mode. ||
|`*no keep mod` | Stops keeping the lobby allowed mods and set mod to FreeMod. ||
|`*no keep title` | Stops keeping the lobby title. ||
|`*regulation enable` | Enable Map Checker ||
|`*regulation disable` | Disable Map Checker. ||
|`*no regulation` | Disable Map Checker. ||
|`*regulation min_star [number]` | Changes the lower star cap. If set to 0, the cap will be removed. | `*regulation min_star 2`|
|`*regulation max_star [number]` | Changes the upper star cap. | `*regulation max_star 6`|
|`*regulation min_length [sec]` | Changes the minimum allowed map length. | `*regulation min_length 60`|
|`*regulation max_length [sec]` | Changes the maximum allowed map length. | `*regulation max_length 600`|
|`*regulation gamemode [osu\|taiko\|fruits\|mania]` | Changes the gamemode. | `*regulation gamemode osu`|
|`*regulation [name]=[value] [name]=[value]...` | Changes multiple settings. | `*regulation min_star=6.00 max_star=6.99 gameode=taiko`|
|`*regulation allow_convert` | Allows conversion of maps for alternate game modes. | `*regulation allow_convert`|
|`*regulation disallow_convert` | Disallows conversion of maps for alternate game modes. | `*regulation disallow_convert`|
|`*denylist add [username]` | Blacklists a player. | `*denylist add bad_guy` |
|`*denylist remove [username]` | Removes a player from blacklist. | `*denylist remove bad_guy` |

Note: Administrator commands are also available on the cli and discord bot. Here are examples of Administrator commands using cli and discord:

cli
```
#mp_123456 > *keep size 16
```
discord
```
/say *keep size 16
```
# Recent Changes
## 1.5.11
+ Improved Discord Integration.
  + The "matches" channel now displays an information panel that allows you to check the status of each match.
  + The permissions have been changed, so if you are already using the bot, please re-invite the bot again.
  + To start forwarding in-game chat, you need to press the "Start Forwarding" button.
+ Added chat speed limiter.
  + The risk of your bot being silenced is reduced.

# Setup

1. Install Node.js and Git
  + [Node.js](https://nodejs.org/) (Version 16.11.1 or Higher)
  + [Git](https://git-scm.com/)
2. Clone this repo and install libraries
```bash
> git clone https://github.com/Meowhal/osu-ahr.git
> cd osu-ahr
> npm install
```
3. Create a file `./config/local.json`, use `./config/default.json` as template.
4. Get irc password from [osu! IRC Authentication](https://osu.ppy.sh/p/irc)
5. Enter your account ID and irc password to `./config/local.json` as in the following example.
```json
{
  "irc": {
    "server": "irc.ppy.sh",
    "nick": "[your account id]",
    "opt": {
      "port": 6667,
      "password": "[your account password]"
    }
  }
}
```
6. Configure the bot (Optional). See the [Configuration section](#configuration) for details.
7. Launch the bot
```bash 
> npm run start
starting up...
Connecting to Osu Bancho ...
Connected :D

=== Welcome to osu-ahr ===

MainMenu Commands
  [make <Lobby_name>] Make a lobby.  e.g. 'make 5* auto host rotation'
  [enter <LobbyID>]   Enter the lobby. e.g. 'enter 123456' (It only works if you are a referee in the lobby).
  [help] Show this message.
  [quit] Quit the application.

> make 5-6* | auto host rotation
```
Note: You can also run your bot on discord. See the [Discord Integration section](#discord-integration) for details.

# Configuration
You can edit local.json to configure the bot's behavior.
## IRC Section
- `server` : `string` host name of osu irc server.
- `nick` : `string` your osu account name
- `opt.port` : `number` 
- `opt.password` : `string` your irc password. you can get it from [https://osu.ppy.sh/p/irc](https://osu.ppy.sh/p/irc).
```json
{
  "irc": {
    "server": "irc.ppy.sh",
    "nick": "meowhal",
    "opt": {
      "port": 6667,
      "password": "123456"
    }
  },
...
```
## Lobby Section
- `authorized_users` : `string[]`
  - Specify any Authorized users. Authorized users can use *commands(*skip, *start, *order).
- `listref_duration_ms` : `number`
  - Sets the time in milliseconds to wait for a response from BanchoBot when typing "!mp listref".
- `info_message` : `string[]` The response message for !info or !help.
- `info_message_cooltime_ms` : `number` Cool down period for !info command (milliseconds).
- `stat_timeout_ms` : `number` Sets the time in milliseconds to wait for a response from BanchoBot when typing "!stats".
- `info_message_announcement_interval_ms` : `number` Set above 180000 if you want to send info messages periodically.
```json
"Lobby": {
  "authorized_users": ["peppy", "abcedf"], 
  "listref_duration_ms": 1000,
  "info_message": [
    "welcome to ahr lobby!",
    "The second item is displayed on the second line.",
    "Too many lines will result in a silent penalty"
  ],
  "info_message_cooltime_ms": 60000,
  "stat_timeout_ms": 5000,
  "info_message_announcement_interval_ms": 0
}
```
## AfkKicker Section
Points are added to players who seem AFK. Any player with points totaling above the threshold will be kicked.
1. Finishes the match with no score -> add 2 points
2. Match starts when the player is missing the map -> add 2 points
3. !stat command shows the player as AFK -> add 3 points

- `enabled` : `boolean` 
- `threshold` : `number` 
- `cooltime_ms` : `number`
```json
{
  ...
  "AfkKicker": {
    "enabled": true,
    "threshold": 6,
    "cooltime_ms": 30000
  },
  ...
}
```
## AutoHostSelector Section 
- `show_host_order_after_every_match` : `boolean` Sends a message containing the player queue after every match.
- `host_order_chars_limit` : `number` Host-order messages are truncated to this length.
- `host_order_cooltime_ms` : `number` cooldown time between Host-order messages.
- `deny_list` : `string[]` Players contained in this list are not added to the host queue.
## AutoStartTimer Section
The match start timer will automatically activate after the host selects a map.
- `enabled` : `boolean` set true if you want to start the timer automatically.
- `doClearHost`: `boolean` Send '!mp clearhost' after the timer starts.
- `waitingTime`: `number` Number of seconds for the timer.
## HistoryLoader Section
- `fetch_interval_ms`: `number` Time period between fetching the match history
## HostSkipper Section
configs related to host-skip vote and automatic afk host skip.
- `vote_rate` : `number(0.0 - 1.0)` number of votes required to skip.
  - if there are 16 players and the rate is 0.5, 8 players need to vote.
- `vote_min`: `number` minimum required vote count .
- `vote_cooltime_ms` : `number` cooldown time for the next vote (avoids involving the next host).
- `vote_msg_defer_ms` : `number` cooldown time for vote progress message.
- `afk_check_timeout_ms"` : `number` waiting time for !stat command result.
- `afk_check_interval_first_ms` : `number` period before first afk host check.
- `afk_check_interval_ms` : `number` interval period to check if the host is afk.
- `afk_check_do_skip` : `boolean` Automatically skips afk hosts.
## LobbyKeeper Section
- `mode` : `null | { "team": number, "score": number }` keep lobby mode.
  - team  => 0: Head To Head, 1: Tag Coop, 2: Team Vs, 3: Tag Team Vs
  - score => 0: Score, 1: Accuracy, 2: Combo, 3: Score V2
- `size` : `number` keep lobby size.
- `password`: `null | string` keep password.
- `mods` : `null | string` keep mods.
- `hostkick_tolerance`:`integer` Number of players kicked by the host before host is kicked for abuse.
- `title` : `null | string` keep the lobby title.
```json
{
 ...
 "LobbyKeeper": {
    "mode": {"team": 2, "score": 1 },
    "size": 16,
    "title": "4-5 auto host rotation"
  }
  ...
}
```
"LobbyKeeper": {
        "mode": {"team": 2, "score": 1 },
        "size": 13
    }
## LobbyTerminator Section
- `terminate_time_ms` : `number` period of time to wait before closing the lobby for inactivity.
## MapChecker Section
- `enabled`: `boolean` Enable map checker.
- `star_min`: `number` change lower difficulty cap. 0 means no cap.
- `star_max`: `number` change lower difficulty cap. 0 means no cap.
- `length_min`: `number` change minimum allowed song length (seconds). 0 means no cap.
- `length_max`: `number` change maximum allowed song length (seconds). 0 means no cap.
- `gamemode`: `string` specify game mode in the room (osu, taiko, fruits, mania).
- `num_violations_allowed`: `number` Number of times violations are allowed.  0 means unlimited.
- `allow_convert`: `boolean` Allows conversion of maps for alternate game modes.
## MatchStarter Section
!start vote configs
- `vote_rate` : `number(0.0 - 1.0)` number of votes required to start.
- `vote_min`: `number` minimum required vote count.
- `vote_msg_defer_ms` : `number` cooldown time for vote progress message.
- `start_when_all_player_ready` : `boolean` starts the match when everyone is ready.
## MatchAborter Section
!abort vote and auto abort configs
- `vote_rate` : `number(0.0 - 1.0)` number of votes required to abort.
- `vote_min`: `number` minimum number of votes required to abort.
- `vote_msg_defer_ms` : `number` cooldown time for vote progress message.
- `auto_abort_rate`: `integer` number of players required to have finished before automatic match abortion.
- `auto_abort_delay_ms`: `number` number of milliseconds to wait before executing abort command.
- `auto_abort_do_abort`: `boolean` enable match abortion.
## WordCounter Section
Used to measure the amount of bot messages 
## OahrCli Section 
- `invite_users` : `string[]` players to be invited when the bot makes a new lobby.
- `password` : `string` default lobby password; empty("") if you don't need password.
## WebApi Section
- `client_id`: `number`, webapi client id. you can make client at [https://osu.ppy.sh/home/account/edit](https://osu.ppy.sh/home/account/edit)
  - optional. the bot uses the WebApi instead of webpage to get the beatmap info.
- `client_secret`: `string` webapi client secret
- `token_store_dir`: `string`, don't care
- `asGuest`: `true` set true
- `callback`: `string`,
- `callback_port`: `number` ,

# Features
- Making Lobby
- Entering Lobby
- IRC chat
- Auto host rotation
- Voting for skipping current host
- Starting the match
- Voting for abort the match
- Closing the lobby

## Making Lobby
Issue the `!mp make` command to create a new lobby. BOT manages lobbies via IRC, but only lobbies where you are a referee can be communicated with via IRC.

## Entering Lobby
When you restart the bot, it will be able to re-enter the lobby it has already created. The bot will analyze the lobby history and try to restore the order of hosts.

## IRC chat
You can send a chat message to the lobby from the console. Type `say` followed by the message you want to send.
```bash
#mp_10000 > say hello guys!
```

## Auto host rotation
When a player enters a room, they are added to the end of the host queue.
The player at the front of the queue is the host. 
If a player who has left the room re-enters, they will be added to the end of the queue.
The host queue is rotated immediately after the game starts, so players who join during the game will be added behind the current host.
If a host leaves the lobby after selecting a map, the next host can choose to start the game or re-select a map. If the new host starts the game, they will continue to be the host after the game.
To check the current queue, type `info` on the console screen.
```bash
#mp_10000 > info
=== lobby status ===
  lobby id : 10000
  status : Entered
  players : 3, inGame : 0 (playing : 0)
  refs : xxxx
  host : player1, pending : null
-- AutoHostSelector --
  current host queue
    palyer1, player2, player3
...
```

## Voting for skipping current host
Typing !skip when you aren't host results in a vote. When half of the lobby has voted, the host will be forcibly skipped. The required percentage of votes can be changed in the config file.
If a host skips, it will immediately move to the next person.
Hosts that have been AFK can be skipped with this feature.

## Starting the match
The game will start automatically when everyone is in the ready state.
Please note that the game will not start automatically when everyone is ready as a result of a user leaving the game.
A player can vote for the start of the game with `!start`.
The host can start the start timer with `!start <time>`.

## Voting for abort the match
If the game starts and the message "waiting for players" is displayed and the game cannot proceed, the game may be aborted by voting with `!abort`.
If the abort is approved but the map has not been played, the host will not be changed. If the map is changed through the console, the host will be rotated.
If a player has finished the map, the game will behave as if it had ended normally.

## Closing the lobby
Lobbies created with `!mp make` will continue to exist until a certain amount of time has passed, even if there are no more players.
Since this is a long time, and may cause problems for other users, the lobby will be automatically be closed if no one is in it for a certain period of time.
If `close now` is issued in the console, the `!mp close` command will be sent and the lobby will be closed immediately.  
If a number of seconds is specified as an argument, such as `close 30`, the lobby will wait until a password is set and for everyone to leave, then the lobby will close after the specified number of seconds has passed.
If `close` is issued, the lobby will be closed after the password is set and everyone has left.

# Discord Integration
You can control AHR lobbies via a Discord Bot, which allows you to access in-game chat and execute lobby control commands from Discord channels.

## Setup
[discord.js](https://discord.js.org/) requires [Node.js](https://nodejs.org/ja/) 16.6 or higher to use, so make sure you're up to date. To check your Node version, use node -v in your terminal or command prompt, and if it's not high enough, update it.

## Creating your bot

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

# Special thanks
+ [Meowhalfannumber1](https://github.com/Meowhalfannumber1)
  + He made great suggestions.
+ [Metacinnabar](https://github.com/Metacinnabar)
  + He helped me with the Japanese translation.
+ [ZeroPyrozen](https://github.com/ZeroPyrozen)
  + He helped me improve the map checker.
+ [qqzzy](https://osu.ppy.sh/users/10911588) 
  + He gives me various insights.
  + https://github.com/jramseygreen/osu_bot_framework-v3