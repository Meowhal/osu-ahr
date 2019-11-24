# osu-ahr
irc bot for [osu!](https://osu.ppy.sh/home) multi lobby auto host rotation.  
The order of hosts is managed by queue. Added last when a player joins the lobby.

## chat commands
|for player|desc|
|:--|:--|
|`!queue`| Shows host queue.|
|`!skip `| Votes to skip current host.|
|`!start`| Votes to start the match.|
|`!abort`| Votes to abort the match. Use when the match is stuck.|
|`!update`| Updates current selected map to the latest version. Use when has host old map.|

 
|for host|desc|ex|
|:--|:--|:--|
|`!skip`| Transfers host to next player.||
|`!start [secs]`| Begins start timer.|`!start 30`|
|`!stop`| Stops current start timer.||

|for owner|desc|ex|
|:--|:--|:--|
|`*start`|Force start the match.||
|`*skip`|Force skip current host.||
|`*skipto [player]`|Force skip to specified player.|`*skipto p2`|
|`*order [players list]`| Reorder the queue in specified order. |`*order p1, p2, p3`|


(I am looking for ppl who can correct my English mistakes..😖)


## Usage
### Setup

[Setup Guide Video](https://youtu.be/8kYbBWgMfIQ) (Special Thanks : [weebskinosu](https://github.com/weebskinosu))
+ Install Node.js and Git
  + [Node.js](https://nodejs.org/)
  + [Git](https://git-scm.com/)
+ clone repo and install libs
```bash
> git clone https://github.com/Meowhal/osu-ahr.git
> npm install
```
+ get irc password from [osu! IRC Authentication](https://osu.ppy.sh/p/irc)
+ copy `./config/default.json` to `./config/development.json`
+ enter your account id and irc password to `./config/development.json`
+ launch the bot
```bash 
> npm start
> [m]ake, [e]nter, [q]uit > m lobby_name
```

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
コンソール画面からロビーへチャットを送信できます。`s`につづけて送信したいメッセージを入力してください。
```bash
[s]ay, [i]nfo, [c]lose, [q]quit > s hello guys!
```

### Auto host rotation
プレイヤーは入室時にホストキューの最後尾に追加され、ホストキューの先頭のプレイヤーがホストになります。
退出したプレイヤーが再入室した場合でも、最後尾に追加されます。
ホストキューは試合開始直後にローテーションされるため、試合中に参加したプレイヤーは現在のホストの後ろに追加されます。
ホストがマップ選択後にロビーを退出した場合、次のホストはそのまま試合を開始するか、マップを選択し直すか選ぶことができます。そのまま試合を開始した場合、試合後も継続してホストになります。
現在のキューを確認するにはコンソール画面上で`i`と入力してください。
例：
```bash
[s]ay, [i]nfo, [c]lose, [q]quit > i
=== lobby status ===
  lobby id : 123456
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
コンソール画面から`c`を入力すると、`!mp close`コマンドが発行され即座にロビーが終了します。  
`c 30`のように引数として秒数を指定すると、ロビーにパスワードが設定され、新しくプレイヤーが入れない状態になったあと、指定秒後にロビーが終了します。  
`c p`とすると、ロビーにパスワードが設定され、全員が退出したあとにロビーが終了します。