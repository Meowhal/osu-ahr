# osu-ahr
irc bot for [osu!](https://osu.ppy.sh/home) multi lobby auto host rotation.  
The host order is based on when Player entered the lobby.

## chat commands
|for player||
|:--|:--|
|- `!queue`| Shows host queue.|
|- `!skip `| Votes to skip current host.|
|- `!start`| Votes to start the match.|
|- `!abort`| Votes to abort the match. Use when the match is stuck.|
|- `!update`| Updates current selected map to the latest version. Use when host old map.|

 
|for host||
|:--|:--|
|`!skip`| Transfers host to next player.|
|`!start [secs]`| Begins start timer.|
|`!stop`| Stops current start timer.|

(I am looking for ppl who can correct my English mistakes..😖)


## Usage
+ clone repo and install libs
```bash
git clone https://github.com/Meowhal/osu-ahr.git
npm install
```
+ get irc password from [osu! IRC Authentication](https://osu.ppy.sh/p/irc)
+ copy `./config/default.json` to `./config/development.json`
+ enter your account id and irc password to `./config/development.json`
+ lauch bot
```bash 
npm start
[m]ake lobby, [e]nter lobby, [q]uit > m lobby_name
```

## Functions
- Making Lobby
- Entering Lobby
- IRC chat
- Auto host rotation
- Voting for skipping current host
- Starting match
- Voting for abort match
- Auto lobby closing

### Making Lobby
!mp make コマンドを発行し、新規のロビーを作成します。
BOTはIRCを通してロビーを管理しますが、IRCで通信できるのは!mp make コマンドで作ったロビーだけです。
通常の方法（osu!のマルチメニューの新規作成)で作ったロビーは管理できません。
自分でチャット欄に!mp make したロビーはIDを使って管理対象にできます。

### Entering Lobby
作成済みのロビーに入り、現在の設定や参加済みのプレイヤーを確認後、ロビー管理を行います。
キューは現在のホストから始まり、スロット順に下に進んでいきます。
通常の方法で作成したロビーには入れません。

### Auto host rotation
プレイヤーは入室時にホストキューの最後尾に追加され、ホストキューの先頭のプレイヤーがホストになります。
退出したプレイヤーが再入室した場合でも、最後尾に追加されます。
ホストキューは試合開始直後にローテーションされるため、試合中に参加したプレイヤーは現在のホストの後ろに追加されます。
ホストがマップ選択後にロビーを退出した場合、次のホストはそのまま試合を開始するか、マップを選択し直すか選ぶことができます。そのまま試合を開始した場合、試合後も継続してホストになります。

### Voting for skipping current host
チャット欄に!skipと打ち込むとホストをスキップするための投票になります。ロビーの半数が投票するとホストが次に移ります。必要な投票率はコンフィグファイルから変更可能です。
ホストが!skipした場合は即座に次の人に移ります。
AFKになってしまったホストはこの機能で飛ばしてください。

### Starting match
全員がready状態になると試合が自動で開始します。
ユーザーが抜けたことにより全員がready状態になった場合、諸々の事情により自動開始しないのでご注意ください。
プレイヤーは!startで試合開始投票を行えます。
Hostは !start time でスタートタイマーを起動できます。

### Voting for abort match
試合開始後に waiting for players などと表示され、試合が進まなくなってしまった場合、!abort投票で試合を中断できます。
誰もマップをクリアしていない状態でabortが成立した場合、ホストは変更されません。そのまま試合を再開してください。この状態でマップを変更しようとするとホストが次に移ります。
誰かがマップをクリアしていた場合、通常の試合終了時と同様の動作になります。

### Auto lobby closing
!mp makeで作ったロビーはプレイヤーが誰もいなくなっても一定時間経過するまで残り続けます。
残存期間が長く、他のユーザーに迷惑を掛ける可能性がるので、ロビーに誰もいない状態が一定時間継続するとロビーが自動的に終了します。
また、日本時間の午前０時に、osuから寝る時間だよと催促のメッセージが送信されることがあります。
この場合、指定時間後に自動でロビーを強制終了する機能を付ける予定です。
