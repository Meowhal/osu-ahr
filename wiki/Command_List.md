# osu-ahr Available Command List

The following chat commands are provided for using osu-ahr bot in the multiplayer room:

## Player Command

This commands are available for all player in the multiplayer room.

| Command | Description |
| :-- | :-- |
| `!queue` or `!q` | Shows host queue |
| `!skip ` | Triggers vote to skip current host |
| `!start` | Triggers vote start the match |
| `!abort` | Triggers vote abort the match. Use when the match is stuck |
| `!update` | Updates current selected map to the latest version. Use when host pick an outdated map |
| `!regulation` or `!r` | Shows current regulation |
| `!rank` | Show player rank |
| `!mirror` | Get alternative download link on selected map |
| `!version` or `!v` | Show bot version |
 
## Host Command

This commands are only available for current elected host in the multiplayer room.

| Command | Description | Example |
| :-- | :-- | :-- |
| `!skip` | Transfers host to next player in the queue.| |
| `!start [seconds]` | Starts the match after a set time in seconds.| `!start 30` |
| `!stop` | Stops active start timer.| |


### Administrator Commands

This commands are only available for the owner or referee(s) of the multiplayer room.

| Command | Description | Example |
| :-- | :-- | :-- |
| `*start` | Forces the match to start | |
| `*skip`| Forces current host to skip | |
| `*order [players list]`| Reorders the queue in specified order |`*order player_1, player_2, player_3`|
| `*keep size [1-16]` | Keeps the size of the lobby at specified number. **Note: It will kick players if players are in to-be locked slots!** | `*keep size 8` | 
| `*keep password [password]` | Keeps the lobby password | `*keep password foobar` | 
| `*keep mode [0-3] [0-3]` | Keeps the lobby team and score mode | `*keep 0 0`, `*keep HeadToHead Combo` | 
| `*keep mods [mod] ([mod]) ([mod]) ...` | Keeps the lobby allowed mods | `*keep mods HR DT`| 
| `*keep title [title]` | Keeps the lobby title | `*keep title 0-2.99* Auto Host Rotate`| 
| `*no keep size` | Stops keeping the size of the lobby at specified number | |
| `*no keep password` | Stops keeping the lobby password | |
| `*no keep mode` | Stops keeping the team and score mode | |
| `*no keep mod` | Stops keeping the lobby allowed mods and set mod to FreeMod | |
| `*no keep title` | Stops keeping the lobby title | |
| `*regulation enable` | Enable Map Checker | |
| `*regulation disable` | Disable Map Checker | |
| `*no regulation` | Disable Map Checker | |
| `*regulation min_star [number]` | Changes the minimum allowed star rating for picking map. If set to 0, there won't be any minimum star rating regulation | ` *regulation min_star 2` |
| `*regulation max_star [number]` | Changes the maximum allowed star rating for picking map. If set to 0, there won't be any maximum star rating regulation | `*regulation max_star 6`|
| `*regulation min_length [seconds]` | Changes the minimum allowed map length | `*regulation min_length 60` |
| `*regulation max_length [seconds]` | Changes the maximum allowed map length | `*regulation max_length 600` |
| `*regulation gamemode [osu\|taiko\|fruits\|mania]` | Changes the allowed game mode | `*regulation gamemode osu` |
| `*regulation [name]=[value] [name]=[value]...` | Changes multiple settings | `*regulation min_star=6.00 max_star=6.99 gamemode=taiko` |
| `*regulation allow_convert` | Allows conversion of maps for alternate game modes, e.g. picking osu! map as osu!mania mode | `*regulation allow_convert` |
| `*regulation disallow_convert` | Disallows conversion of maps for alternate game modes | `*regulation disallow_convert` |
| `*denylist add [username]` | Blacklists a player | `*denylist add bad_guy` |
| `*denylist remove [username]` | Removes a player from blacklist | `*denylist remove repented_guy` |

*Note: Administrator commands are also available via the command line and Discord bot. Here are examples of administrator commands using command line and Discord:*

**Command Line**
```
#mp_123456 > *keep size 16
```

**Discord Chat**
```
/say *keep size 16
```

You can get the bot source code from [here](https://github.com/Meowhal/osu-ahr).
