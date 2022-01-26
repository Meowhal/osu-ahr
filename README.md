# osu-ahr

**osu-ahr** is auto host rotation bot for [osu!](https://osu.ppy.sh/home) multiplayer. The host rotation is managed with a queue. Players are added to the queue when joining a multiplayer room and sent to the back of the queue once their beatmap has been played.

## Table of Contents

- [osu-ahr](#osu-ahr)
  - [Table of Contents](#table-of-contents)
  - [Bot Feature](#bot-feature)
  - [Command List](#command-list)
  - [Recent Changes](#recent-changes)
    - [1.5.11](#1511)
  - [Bot Installation](#bot-installation)
  - [Bot Configuration](#bot-configuration)
  - [Special Thanks](#special-thanks)

## Bot Feature

*Main page: [Bot Usage Guides](/wiki/Bot_Usage_Guides.md)*

These are what osu-ahr bot can do osu! bancho server:

<!--TODO: Add link to specific guides-->

- Creating new multiplayer room
- Managing existing multiplayer room
- IRC chat support in managed multiplayer room
- Managing host rotation queue
- Add map selection regulation
- Skipping current host
- Starting the match
- Aborting the match
- Preventing AFK players from squatting the room
- Closing the multiplayer room

## Command List

*Main page: [Bot Command](/wiki/Command_List.md)*

## Recent Changes

*Main page: [Changelog](/wiki/Changelog.md)*

### 1.5.11
+ Improved Discord Integration.
  + The "matches" channel now displays an information panel that allows you to check the status of each match.
  + The permissions have been changed, so if you are already using the bot, please re-invite the bot again.
  + To start forwarding in-game chat, you need to press the "Start Forwarding" button.
+ Added chat speed limiter.
  + The risk of your bot being silenced is reduced.

## Bot Installation

*For bot configuration, see [Bot Configuration](/wiki/Bot_Configuration.md) article.*

1. Install Node.js and Git
   - [Node.js](https://nodejs.org/) (Version 16.11.1 or Higher)
   - [Git](https://git-scm.com/)
2. Clone this repository and install libraries
```bash
> git clone https://github.com/Meowhal/osu-ahr.git
> cd osu-ahr
> npm install
```
3. Create a file `./config/local.json`, use `./config/default.json` as template.
4. Get IRC password from [osu! IRC Authentication](https://osu.ppy.sh/p/irc)
5. Enter your account ID and IRC password to `./config/local.json` as in the following example.

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

6. Configure the bot (Optional). See the [Configuration](#configuration) article for details.
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

*Note: You can also run your bot on discord. See the [Discord Integration](#discord-integration) article for details.*

## Bot Configuration

*Main page: [Bot Configuration](/wiki/Bot_Configuration.md)*

## Special Thanks

+ [Meowhalfannumber1](https://github.com/Meowhalfannumber1)
  + He made great suggestions.
+ [Metacinnabar](https://github.com/Metacinnabar)
  + He helped me with the Japanese translation.
+ [ZeroPyrozen](https://github.com/ZeroPyrozen)
  + He helped me improve the map checker.
+ [qqzzy](https://osu.ppy.sh/users/10911588) 
  + He gives me various insights.
  + https://github.com/jramseygreen/osu_bot_framework-v3