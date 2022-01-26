# osu-ahr
irc bot for [osu!](https://osu.ppy.sh/home) multiplayer lobby auto host rotation.  
The host rotation is managed by a list. Player is queued at the bottom when joining lobby or when his map pick was played.

## Player Command
|Command|Description|
|:--|:--|
|`!queue`| Shows host queue.|
|`!skip `| Triggers vote to skip current host.|
|`!start`| Triggers vote start the match.|
|`!abort`| Triggers vote abort the match. Use when the match is stuck.|
|`!update`| Updates current selected map to the latest version. Use when host pick an outdated map.|
|`!regulation`| Shows current regulation.|
|`!rank`| Show player rank.|
|`!mirror`| Get alternative download link on selected map.|
 
## Host Command
|Command|Description|Example|
|:--|:--|:--|
|`!skip`| Transfers host to next player in the queue.||
|`!start [seconds]`| Starts the match after a set time in seconds.|`!start 30`|
|`!stop`| Stops active start timer.||
|`!version` or `!v`| Show bot version.||

You can get the bot source code from [here](https://github.com/Meowhal/osu-ahr).
