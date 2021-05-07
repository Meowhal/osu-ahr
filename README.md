# osu-ahr
irc bot for [osu!](https://osu.ppy.sh/home) multi lobby auto host rotation.  
The host rotation is managed by a list. Player is queued at the bottom when joining lobby or when his map pick was played.

# attention
Many config items have renamed in version 1.4.
please recreate local.json file.

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

(proofread by [Meowhalfannumber1](https://github.com/Meowhalfannumber1) ❤) 


## Setup

[Setup Guide Video](https://youtu.be/8kYbBWgMfIQ) (Special Thanks : [weebskinosu](https://github.com/weebskinosu))
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
+ copy `./config/default.json` to `./config/local.json`
+ enter your account id and irc password to `./config/local.json`
+ launch the bot
```bash 
> npm run start
starting up...
Connecting to Osu Bancho ...
Server running at http://localhost:3116/
Connected :D

=== Welcome to osu-ahr ===

MainMenu Commands
  [make <Lobby_name>] Make a lobby.  ex: 'make 5* auto host rotation'
  [enter <LobbyID>]   Enter the lobby. ex: 'enter 123456' (It only works in a Tournament lobby ID.)
  [help] Show this message.
  [quit] Quit this application.

> make 5-6* | auto host rotation
```
## configulations
### irc section
- `server` : `string` domain name of osu irc server.
- `nick` : `string` your osu account name
- `opt.port` : `number` 
- `opt.password` : `string` your irc password. you can get it from [https://osu.ppy.sh/p/irc](https://osu.ppy.sh/p/irc).
```json
"irc": {
  "server": "irc.ppy.sh",
  "nick": "gnsksz",
  "opt": {
    "port": 6667,
    "password": "123456"
  }
}
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
### AutoHostSelector section 
- `show_host_order_every_after_match` : `boolean` set true if you want to show them.
- `host_order_chars_limit` : `number` Host-order messages are truncated to this length.
- `host_order_cooltime_ms` : `number` cool time for Host-order messages.
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
### MatchStarter section
!start vote configs
- `vote_rate` : `number(0.0 - 1.0)` rate of votes required to start.
- `vote_min`: `number` minimum required vote count.
- `vote_msg_defer_ms` : `number` cooltime for voteprogress message for not responding to every votes.
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
!mp make コマンドを発行し、新規のロビーを作成します。
BOTはIRCを通してロビーを管理しますが、IRCで通信できるのは!mp make コマンドで作ったロビーだけです。
通常の方法（osu!のマルチメニューの新規作成)で作ったロビーは管理できません。
自分でチャット欄に!mp make したロビーはIDを使って管理対象にできます。

### Entering Lobby
作成済みのロビーに入り、現在の設定や参加済みのプレイヤーを確認後、ロビー管理を行います。
キューは現在のホストから始まり、スロット順に下に進んでいきます。
通常の方法で作成したロビーには入れません。

### IRC chat
コンソール画面からロビーへチャットを送信できます。`say`につづけて送信したいメッセージを入力してください。
```bash
#mp_10000 > say hello guys!
```

### Auto host rotation
プレイヤーは入室時にホストキューの最後尾に追加され、ホストキューの先頭のプレイヤーがホストになります。
退出したプレイヤーが再入室した場合でも、最後尾に追加されます。
ホストキューは試合開始直後にローテーションされるため、試合中に参加したプレイヤーは現在のホストの後ろに追加されます。
ホストがマップ選択後にロビーを退出した場合、次のホストはそのまま試合を開始するか、マップを選択し直すか選ぶことができます。そのまま試合を開始した場合、試合後も継続してホストになります。
現在のキューを確認するにはコンソール画面上で`info`と入力してください。
例：
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
チャット欄に!skipと打ち込むとホストをスキップするための投票になります。ロビーの半数が投票するとホストが次に移ります。必要な投票率はコンフィグファイルから変更可能です。
ホストが!skipした場合は即座に次の人に移ります。
AFKになってしまったホストはこの機能で飛ばしてください。

### Starting the match
全員がready状態になると試合が自動で開始します。
ユーザーが抜けたことにより全員がready状態になった場合、諸々の事情により自動開始しないのでご注意ください。
プレイヤーは!startで試合開始投票を行えます。
Hostは !start time でスタートタイマーを起動できます。

### Voting for abort the match
試合開始後に waiting for players などと表示され、試合が進まなくなってしまった場合、!abort投票で試合を中断できます。
誰もマップをクリアしていない状態でabortが成立した場合、ホストは変更されません。そのまま試合を再開してください。この状態でマップを変更しようとするとホストが次に移ります。
誰かがマップをクリアしていた場合、通常の試合終了時と同様の動作になります。

### Closing the lobby
!mp makeで作ったロビーはプレイヤーが誰もいなくなっても一定時間経過するまで残り続けます。
残存期間が長く、他のユーザーに迷惑を掛ける可能性がるので、ロビーに誰もいない状態が一定時間継続するとロビーが自動的に終了します。  
コンソール画面から`close now`を入力すると、`!mp close`コマンドが発行され即座にロビーが終了します。  
`close 30`のように引数として秒数を指定すると、ロビーにパスワードが設定され、新しくプレイヤーが入れない状態になったあと、指定秒後にロビーが終了します。  
`close`とすると、ロビーにパスワードが設定され、全員が退出したあとにロビーが終了します。
