# osu-ahr
irc bot for [osu!](https://osu.ppy.sh/home) multi lobby auto host rotation.  
The host rotation is managed by a list. Player is queued at the bottom when joining lobby or when his map pick was played.

## Command List
|for player|desc|
|:--|:--|
|`!queue`| Shows host queue.|
|`!skip `| Triggers vote to skip current host.|
|`!start`| Triggers vote start the match.|
|`!abort`| Triggers vote abort the match. Use when the match is stuck.|
|`!update`| Updates current selected map to the latest version. Use when host pick an outdated map.|
|`!regulation`| Shows current regulation.|
 
|for host|desc|ex|
|:--|:--|:--|
|`!skip`| Transfers host to next player.||
|`!start [secs]`| Begins start timer.|`!start 30`|
|`!stop`| Stops current start timer.||

|for owner|desc|ex|
|:--|:--|:--|
|`*start`|Forces the match to start.||
|`*skip`|Forces current host to skip.||
|`*order [players list]`| Reorders the queue in specified order. |`*order p1, p2, p3`|
|`*keep size [1-16]` | Keeps the size of the lobby at specified number. | `*keep size 8`| 
|`*no keep size` | Stops Keeping the size of the lobby at specified number. | `*no keep size`|
|`*regulation ["min_star", "max_star", "min_length" or "max_length"] = [value]` | Changes the regulation. | `*regulation max_length = 600`|
|`*denylist add [username]` | Adds players to deny list | `*denylist add bad_guy` |
|`*denylist remove [username]` | Removes players from deny list | `*denylist remove bad_guy` |


Owner commands are also available on the cli.
When using from discordbot, enter the owner command after /say.

cli
```
#mp_123456 > *keep size 16
```
discord
```
/say *keep size 16
```


## Setup

+ Install Node.js and Git
  + [Node.js](https://nodejs.org/)
  + [Git](https://git-scm.com/)
+ clone repo and install libs
```bash
> git clone https://github.com/Meowhal/osu-ahr.git
> cd osu-ahr
> npm install
```
+ get irc password from [osu! IRC Authentication](https://osu.ppy.sh/p/irc)
+ create a file `./config/local.json`
+ enter your account id and irc password to `./config/local.json` as in the following example.
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
+ launch the bot
```bash 
> npm run start
starting up...
Connecting to Osu Bancho ...
Connected :D

=== Welcome to osu-ahr ===

MainMenu Commands
  [make <Lobby_name>] Make a lobby.  ex: 'make 5* auto host rotation'
  [enter <LobbyID>]   Enter the lobby. ex: 'enter 123456' (It only works in a Tournament lobby ID.)
  [help] Show this message.
  [quit] Quit this application.

> make 5-6* | auto host rotation
```
You can also run your bot on discord. See the later section for details.

## configuration
You can edit local.json to configure the bot's behavior.
### irc section
- `server` : `string` domain name of osu irc server.
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
### Lobby section
- `authorized_users` : `string[]`
  - Specify to Authorized user. They can use *commands(*skip, *start, *order).
- `listref_duration_ms` : `number`
  - waiting time for !mp listrefs results. you have to expand if you added lots of referees.
- `info_message` : `string[]` the response message for !info or !help.
- `info_message_cooltime_ms` : `number` cool time for !info (milli secs).
- `stat_timeout_ms` : `number` waiting time for !stat command result.
- `info_message_announcement_interval_ms` : `number` set above 180000 if you want to send info message periodically.
```json
"Lobby": {
  "authorized_users": ["peppy", "abcedf"], 
  "listref_duration_ms": 1000,
  "info_message": [
    "welcom to ahr lobby!",
    "The second item is displayed on the second line.",
    "Too many lines will result in a silent penalty"
  ],
  "info_message_cooltime_ms": 60000,
  "stat_timeout_ms": 5000,
  "info_message_announcement_interval_ms": 0
}
```
### AfkKicker section
Points will be added to the player who seems to be AFK, and the player who gets points above the threshold will be kicked.
1. Finish the match with no score -> 2 points
1. Do not participate in the match without a map -> 2 points
1. !stat command turns out that player is AFK -> added 3 points

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
### AutoHostSelector section 
- `show_host_order_every_after_match` : `boolean` set true if you want to show them.
- `host_order_chars_limit` : `number` Host-order messages are truncated to this length.
- `host_order_cooltime_ms` : `number` cool time for Host-order messages.
- `deny_list` : `string[]` Players on this list are not added to the host's queue.
### AutoStartTimer section
the match start timer will automatically activate after the host selects a map.
- `enabled` : `boolean` set true if you want to start the timer automatically.
- `doClearHost`: `boolean` do !mp clearhost after timer starts.
- `waitingTime`: `number` seconds until start the match.
### HistoryLoader section
- `fetch_interval_ms`: `number` how often fetch the lobby history
### HostSkipper section
configs related to host-skip vote and automatic afk host skip.
- `vote_rate` : `number(0.0 - 1.0)` rate of votes required to skip.
  - if there are 16 players and the rate is 0.5, 8 players need to vote.
- `vote_min`: `number` minimum required vote count .
- `vote_cooltime_ms` : `number` cool time for the next vote to avoid involving the next host.
- `vote_msg_defer_ms` : `number` cooltime for voteprogress message for not responding to every votes.
- `afk_check_timeout_ms"` : `number` waiting time for !stat command result.
- `afk_check_interval_first_ms` : `number` time to first check if the host is afk.
- `afk_check_interval_ms` : `number` interval to check if the host is afk.
- `afk_check_do_skip` : `boolean` skip afk host automatically or not.
### LobbyKeeper section
- `mode`: `null | { team: number, score: number }` keep lobby mode.
- `size`: `number` keep lobby size.
- `password`: `null | string` keep password.
- `mods`: `null | string` keep mods.
- `hostkick_tolerance`:`number` when counter kick activated.
### LobbyTerminator section
- `terminate_time_ms` : `number` time to close the lobby after everyone has left the lobby.
### MapChecker section
- `enabled`: `boolean` use map checker or not.
- `star_min`: `number` lower cap of dificullty. 0 means no cap.
- `star_max`: `number` higher cap of dificullty. 0 means no cap.
- `length_min`: `number` lower cap of length. specify in seconds. 0 means no cap.
- `length_max`: `number` higher cap of length. 0 means no cap.
- `gamemode`: `string` specify game mode in the room. "any" means no specific gamemode restriction.
### MatchStarter section
!start vote configs
- `vote_rate` : `number(0.0 - 1.0)` rate of votes required to start.
- `vote_min`: `number` minimum required vote count.
- `vote_msg_defer_ms` : `number` cooltime for voteprogress message for not responding to every votes.
- `start_when_all_player_ready` : `boolean` start the match when everyoen is ready.
### MatchAborter section
!abort vote and auto abort configs
- `vote_rate` : `number(0.0 - 1.0)` rate of votes required to abort.
- `vote_min`: `number` minimum required vote count.
- `vote_msg_defer_ms` : `number` cooltime for voteprogress message for not responding to every votes.
- `auto_abort_rate`: `number` the rate of finished players to automatically abort the stuck game.
- `auto_abort_delay_ms`: `number` the delay time of actually abort the stuck game.
- `auto_abort_do_abort`: `boolean` do !mp abort or not.
### WordCounter section
Used to measure the amount of bot messages 
### OahrCli section 
- `invite_users` : `string[]` players are invited to the lobby when the bot make a new lobby.
- `password` : `string` default lobby password. stay empty("") if you don't need password.
### WebApi section
- `client_id`: `number`, webapi client id. you can make client at [https://osu.ppy.sh/home/account/edit](https://osu.ppy.sh/home/account/edit)
  - optional. the bot uses the WebApi instead of webpage to get the beatmap infos.
- `client_secret`: `string` webapi client secret
- `token_store_dir`: `string`, don't care
- `asGuest`: `true` set true
- `callback`: `string`,
- `callback_port`: `number` ,

## Functions
- Making Lobby
- Entering Lobby
- IRC chat
- Auto host rotation
- Voting for skipping current host
- Starting the match
- Voting for abort the match
- Closing the lobby

### Making Lobby
Issue the `!mp make` command to create a new lobby. BOT manages lobbies via IRC, but only lobbies created with the `!mp make` command can be communicated with via IRC. Lobbies created using the normal method (creating a new lobby in the multi-menu of osu!) cannot be managed. Lobbies that you have created by yourself in the chat field can be managed by ID.

### Entering Lobby
Enter the lobby you have already created, check the current settings and players who have joined, and then manage the lobby.
The queue starts with the current host and moves down in slot order.
You will not be able to enter a lobby created in the normal way.

### IRC chat
You can send a chat message to the lobby from the console screen. Type `say` followed by the message you want to send.
```bash
#mp_10000 > say hello guys!
```

### Auto host rotation
When a player enters a room, they are added to the end of the host queue, and the player at the beginning of the host queue becomes the host.
The player at the head of the host queue becomes the host. Even if a player who has left the room re-enters, they will be added to the end of the queue.
The host queue is rotated immediately after the game starts, so players who join during the game will be added behind the current host.
If a host leaves the lobby after selecting a map, the next host can choose to start the game or re-select a map. If the host starts the game, they will continue to be the host after the game.
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

### Voting for skipping current host
If `!skip` typed in the chat field, a vote will be held to skip the host. When half of the lobby has voted, the host will move on. The required percentage of votes can be changed in the config file.
If a host skips, it will immediately move to the next person.
Hosts that have been AFK can be skipped with this feature.

### Starting the match
The game will start automatically when everyone is in the ready state.
Please note that the game will not start automatically when everyone is ready as a result of a user leaving the game.
A player can vote for the start of the game with `!start`.
The host can start the start timer with `!start <time>`.

### Voting for abort the match
If the game starts and the message "waiting for players" is displayed and the game cannot proceed, the game may be aborted by voting with `!abort`.
If the abort is approved when no one has cleared the map, the host will not be changed. Please resume the game as is. If the map is changed through the console, the host will be rotated.
If someone has cleared the map, the game will behave as if it had ended normally.

### Closing the lobby
Lobbies created with `!mp make` will continue to exist until a certain amount of time has passed, even if there are no more players.
Since this is a long time, and may cause problems for other users, the lobby will be automatically be closed if no one is in it for a certain period of time.
If `close now` is issued in the console, the `!mp close` command will be issued and the lobby will be closed immediately.  
If a number of seconds is specified as an argument, such as `close 30`, the lobby will wait until a password is set and for everyone to leave, then the lobby will close after the specified number of seconds has passed.
If `close` is issued, the lobby will be closed after the password is set and everyone has left.

# Discord Integration
You can control AHR lobbies via a Discord Bot, which allows you to access in-game chat and execute lobby control commands from Discord channels.

## Setup
### Creating your bot

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

### Startup
Start the bot with the following command:
```sh
npm run start:discord
```
After successful activation, a Discord Bot invitation link will appear in the terminal. Click on it to invite it to your guild.
```log
[12:00:00.000][INFO] discord - discord bot is ready.
[12:00:00.100][INFO] discord - invite link => https://discord.com/api/oauth2/authorize?client_id=123&scope=bot+applications.commands&permissions=268435472
```

[**Caution**] For security reasons please do not make bot invitation links or guilds with bots available to the public. Any problems that may arise are entirely under your responsibility.

### Role settings
When a bot is invited to a guild, the `ahr-admin` role is created. Only users with this role will be able to manage the lobby. You should assign this role to your own account.

## Lobby creation
![how to make a lobby](https://raw.githubusercontent.com/Meowhal/osu-ahr/images/screenshot/make.png)

You can create a lobby by executing the `/make (lobby name)` command in the appropriate channel of the guild you have invited your bot to. (You need to have the `ahr-admin` role to run this command). If the command succeeds, a tournament lobby will be created in osu, and a bridge channel with a name similar to `mp_123456` will be created in the guild.

You can run the `/make` command as many times as you want and manage multiple lobbies at the same time, however, osu bots have a limit on the number of chats that can be created. If you create a large number of lobbies, your account may be flagged as spam. It is recommended that you limit the number of lobbies to two.

## Join an existing lobby
If the ahr bot has been terminated due to a glitch or some other reason, you can use the `/enter` command after restarting to resume lobby management.
If there is still a bridge channel in the guild you can run `/enter` within that channel. (The channel name must be in the form of a lobby ID, for example `#mp_123456`). You can join any lobby by passing the lobbyId as an option with `/enter (lobby id)`.

## Chat forwarding
The `/say [message]` Discord command can be used to forward messages to the in-game chat. This command takes the message to be forwarded and the lobbyId as options, but you can omit the lobbyId if you are within an existing bridge channel. The `/say` command can also be used for tournament commands such as `!mp start` and owner commands such as `*regulation`.

## Discord Commands
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
+ [GoodPro712](https://github.com/GoodPro712)