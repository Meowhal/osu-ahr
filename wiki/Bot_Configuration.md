# osu-ahr Bot Configurations

Open your `local.json` file and edit section below to configure the bot's behavior.

## `irc` Section

- `server` : `string` host name of osu irc server.
- `nick` : `string` your osu account name
- `opt.port` : `number` 
- `opt.password` : `string` your irc password. you can get it from [https://osu.ppy.sh/p/irc](https://osu.ppy.sh/p/irc).

**Example**

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

### Lobby Section
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
### AfkKicker Section
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
### AutoHostSelector Section 
- `show_host_order_after_every_match` : `boolean` Sends a message containing the player queue after every match.
- `host_order_chars_limit` : `number` Host-order messages are truncated to this length.
- `host_order_cooltime_ms` : `number` cooldown time between Host-order messages.
- `deny_list` : `string[]` Players contained in this list are not added to the host queue.
### AutoStartTimer Section
The match start timer will automatically activate after the host selects a map.
- `enabled` : `boolean` set true if you want to start the timer automatically.
- `doClearHost`: `boolean` Send '!mp clearhost' after the timer starts.
- `waitingTime`: `number` Number of seconds for the timer.
### HistoryLoader Section
- `fetch_interval_ms`: `number` Time period between fetching the match history
### HostSkipper Section
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
### LobbyKeeper Section
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
### LobbyTerminator Section
- `terminate_time_ms` : `number` period of time to wait before closing the lobby for inactivity.
### MapChecker Section
- `enabled`: `boolean` Enable map checker.
- `star_min`: `number` change lower difficulty cap. 0 means no cap.
- `star_max`: `number` change lower difficulty cap. 0 means no cap.
- `length_min`: `number` change minimum allowed song length (seconds). 0 means no cap.
- `length_max`: `number` change maximum allowed song length (seconds). 0 means no cap.
- `gamemode`: `string` specify game mode in the room (osu, taiko, fruits, mania).
- `num_violations_allowed`: `number` Number of times violations are allowed.  0 means unlimited.
- `allow_convert`: `boolean` Allows conversion of maps for alternate game modes.
### MatchStarter Section
!start vote configs
- `vote_rate` : `number(0.0 - 1.0)` number of votes required to start.
- `vote_min`: `number` minimum required vote count.
- `vote_msg_defer_ms` : `number` cooldown time for vote progress message.
- `start_when_all_player_ready` : `boolean` starts the match when everyone is ready.
### MatchAborter Section
!abort vote and auto abort configs
- `vote_rate` : `number(0.0 - 1.0)` number of votes required to abort.
- `vote_min`: `number` minimum number of votes required to abort.
- `vote_msg_defer_ms` : `number` cooldown time for vote progress message.
- `auto_abort_rate`: `integer` number of players required to have finished before automatic match abortion.
- `auto_abort_delay_ms`: `number` number of milliseconds to wait before executing abort command.
- `auto_abort_do_abort`: `boolean` enable match abortion.
### WordCounter Section
Used to measure the amount of bot messages 
### OahrCli Section 
- `invite_users` : `string[]` players to be invited when the bot makes a new lobby.
- `password` : `string` default lobby password; empty("") if you don't need password.
### WebApi Section
- `client_id`: `number`, webapi client id. you can make client at [https://osu.ppy.sh/home/account/edit](https://osu.ppy.sh/home/account/edit)
  - optional. the bot uses the WebApi instead of webpage to get the beatmap info.
- `client_secret`: `string` webapi client secret
- `token_store_dir`: `string`, don't care
- `asGuest`: `true` set true
- `callback`: `string`,
- `callback_port`: `number`