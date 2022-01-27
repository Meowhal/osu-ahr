# osu-ahr Bot Usage Guides

This section is dedicated to osu-ahr bot changelog, sorted by recent changes.

### Making Lobby
Issue the `!mp make` command to create a new lobby. BOT manages lobbies via IRC, but only lobbies where you are a referee can be communicated with via IRC.

### Entering Lobby
When you restart the bot, it will be able to re-enter the lobby it has already created. The bot will analyze the lobby history and try to restore the order of hosts.

### IRC chat
You can send a chat message to the lobby from the console. Type `say` followed by the message you want to send.
```bash
#mp_10000 > say hello guys!
```

### Auto host rotation
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

### Voting for skipping current host
Typing !skip when you aren't host results in a vote. When half of the lobby has voted, the host will be forcibly skipped. The required percentage of votes can be changed in the config file.
If a host skips, it will immediately move to the next person.
Hosts that have been AFK can be skipped with this feature.

### Starting the match
The game will start automatically when everyone is in the ready state.
Please note that the game will not start automatically when everyone is ready as a result of a user leaving the game.
A player can vote for the start of the game with `!start`.
The host can start the start timer with `!start <time>`.

### Voting for abort the match
If the game starts and the message "waiting for players" is displayed and the game cannot proceed, the game may be aborted by voting with `!abort`.
If the abort is approved but the map has not been played, the host will not be changed. If the map is changed through the console, the host will be rotated.
If a player has finished the map, the game will behave as if it had ended normally.

### Closing the lobby
Lobbies created with `!mp make` will continue to exist until a certain amount of time has passed, even if there are no more players.
Since this is a long time, and may cause problems for other users, the lobby will be automatically be closed if no one is in it for a certain period of time.
If `close now` is issued in the console, the `!mp close` command will be sent and the lobby will be closed immediately.  
If a number of seconds is specified as an argument, such as `close 30`, the lobby will wait until a password is set and for everyone to leave, then the lobby will close after the specified number of seconds has passed.
If `close` is issued, the lobby will be closed after the password is set and everyone has left.