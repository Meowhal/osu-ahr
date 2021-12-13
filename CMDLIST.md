# osu-ahr
irc bot for [osu!](https://osu.ppy.sh/home) multi lobby auto host rotation.  
The host rotation is managed by a list. Player is queued at the bottom when joining lobby or when his map pick was played.

# Command List
|for player|desc|
|:--|:--|
|`!queue`| Shows host queue.|
|`!skip `| Triggers vote to skip current host.|
|`!start`| Triggers vote start the match.|
|`!abort`| Triggers vote abort the match. Use when the match is stuck.|
|`!update`| Updates current selected map to the latest version. Use when host pick an outdated map.|
|`!regulation`| Shows current regulation.|
|`!rank`| Show player rank.|
 
|for host|desc|ex|
|:--|:--|:--|
|`!skip`| Transfers host to next player.||
|`!start [secs]`| Begins start timer.|`!start 30`|
|`!stop`| Stops current start timer.||

You can get the bot source code from [here](https://github.com/Meowhal/osu-ahr).
