# osu-ahr Changelog

This section is dedicated to osu-ahr bot changelog, sorted by most recent changes.

<!--Template
## Version x.x.x

![](/wiki/img/you-can-add-multiple-image-for-update-preview-mainly-ui )

### New Feature

+ Use this section for new feature in bot
  + You can add more description to each point

### Code Quality

+ Use this section for general enhancement of code or bug fixes

### UI

+ Use this section for general improvement on User Interface such as bot message

-->

## Version 1.5.14

### Code Quality

+ Add maximum length for keeping room title up to 50 characters
+ Bug fix `!mirror` command that break on non-osu! game mode room
+ Deprecate ProfileRepository because osu! web profile JSON isn't available anymore in web
  + Redirect `!rank` command to fetch from osu! api with current game mode in room

### UI

+ Add [Kitsu.moe](https://kitsu.moe/) as another mirror download

## Version 1.5.13

### New Feature

+ Add `!v` and `!version` command to view running bot version
+ Add `!rank` command to view player rank

### Code Quality

+ Add official game mode name for each game mode in osu!
+ Bug fix AfkKicker that keep looping the point counter when room is empty

## Version 1.5.12

### New Feature

+ Add `!v` and `!version` command to view running bot version
+ Add `!rank` command to view player rank

### Code Quality

+ Clean up MapChecker plugin
  + Reformat map rejection message to user
  + Recalculate flag for map check
  + Add `NotAvailable` exception if selected beatmap isn't available due to deleted or copyrighted
  + Reformat map acception message to user
+ Add MIT License for repository
+ Reword `README.md`
+ Fix Discord bot permission to make admin-only channel view

### UI

+ Improve UI for MapChecker if the selected map is rejected by bot
+ Change match start countdown timer format to minute and seconds (e.g. 66 seconds is formatted as 1 minute 6 seconds)
+ Fix typo in administrator logs and config names

## Version 1.5.11

### Code Quality

+ Improve Discord Integration
  + The "matches" channel now displays an information panel that allows you to check the status of each match
  + The permissions have been changed, so if you are already using the bot, please re-invite the bot again
  + To start forwarding in-game chat, you need to press the "Start Forwarding" button
+ Add chat speed limiter
  + The risk of your bot being silenced is reduced

### UI

+ Show limit-exceeded message to player if bot command still on cooldown
+ Add extra warning that explain selected mod doesn't affect checked map star rating if map get rejected by bot
  + Example: if managed room use Half Time or Double Time mod which affect star rating for all player, it won't be counted by bot

## Version 1.5.10

### Code Quality

+ Bug fix LobbyChecker loop check
+ Improve CommandParser regex pattern
+ Bug fix on abort match failed event
+ Update MapChecker test case
+ Handle error on administrator osu! IRC credential
+ Update `README.md`
+ Fix typo on config template

## Version 1.5.9

### Code Quality

+ Rewrite MapChecker plugin
+ Add room type checker for LobbyKeeper plugin
+ Add game mode checker for MapChecker plugin
+ Rewrite BeatmapRepository helper
+ Update used node library versions

### UI

+ Reformat log on map change by player or bot

## Version 1.5.8

### Code Quality

+ Update AutoHostSelector test case for host left the match and match start at the same time
+ Remove unused logger in MapChecker plugin
+ Bug fix LobbyKeeper plugin for timer reset in each player slot
+ Update MapChecker test case with up to date config name
+ Remove "any" game mode option for MapChecker plugin

## Version 1.5.7

### New Feature

+ Add `!mirror` command to get mirror download link for current selected map

### Code Quality

+ Rewrite LobbyKeeper plugin
+ Update LobbyKeeper test case
+ Bug fix game mode check in MapChecker plugin
+ Update `README.md`
