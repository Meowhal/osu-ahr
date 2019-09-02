# osu-ahr
irc bot for [osu!](https://osu.ppy.sh/home) multi lobby auto host rotation.  
The host order is based on when Player entered the lobby.

## chat commands
|for player||
|:--|:--|
|- `!queue`| Show host queue.|
|- `!skip `| Votes to skip current host.|
|- `!start`| Votes to start the match.|
|- `!abort`| Votes to abort the match. Use when the match is stuck.|
 
|for host||
|:--|:--|
|`!skip`| Transfers host to next player.|
|`!start [secs]`| Begins start timer.|
|`!abort`| Stops current start timer.|

(I am looking for someone to correct my English mistakes..😖)


osu!のマルチロビーでホストを自動的にローテーションするためのIRCボットです。

## 使用方法
+ このリポジトリをクローン
+ [osu! IRC Authentication](https://osu.ppy.sh/p/irc)にアクセスし、IRC用のパスワードを取得
+ ./config/default.jsonにユーザー名とパスワードを記入
+ $ npm start で起動
+ メニューで新しいロビーを作成 (mylobbyという名前でロビーを作る場合は m mylobby と入力)

## 機能
- ロビーの作成 
- ホストの自動ローテーション
- ホストのスキップ投票 
- AFKホスト検知タイマー
- 自動試合開始
- 自動ロビー終了

### ロビー作成
!mp make コマンドの発行を行います。
BOTはIRCを通してロビーを管理しますが、IRCで通信できるのは!mp make コマンドで作ったロビーだけです。
通常の方法（osu!のマルチメニューの新規作成)で作ったロビーは管理できません。
自分でチャット欄に!mp make したロビーはIDを使って管理対象にできます。

### ホストの自動ローテーション
ホストはスロットの位置ではなく、入室した順にキューに追加され試合ごとにローテーションしていきます。
スロットベースの順番だと、新しく入室してきたプレイヤーがすぐにホストになる可能性があり、それが不公平だと感じたためこのシステムにしました。

### ホストのスキップ投票
!skipで投票、ロビーの半数が投票するとホストが次の人に移ります。ホストが!skipした場合は即座に次の人に移ります。
AFKになってしまったホストはこの機能で飛ばしてください。

### AFKホスト検知タイマー
ホスト任命後から一定時間マップを選択しなかった場合に動作します。
もともとは一定時間マップを選択しないホストをAFK扱いでスキップする機能でしたが不評だったため、
（主に試合後にチャットで感想を述べていたり、マップ選択の意見を求めていたり、ラグが発生したりしてスキップされたホスト達から）
デフォルトではメッセージを出すだけにしました。
オプションで挙動を変更可能です。

### 自動試合開始
全員がready状態になったら!mp startで試合を開始します。
８人以上のロビーだとプレイヤーの状態確認にスクロールが必要で面倒だったのでつけました。
一定時間でダウンロードが完了しないユーザーを無視する機能や、Readyしないユーザーを無視する機能もつけてほしいと言われましたが、
試合開始のコントロールはホストの仕事だと考えているので、これ以上の機能はつけないつもりです。
注意点として、not readyなユーザーがロビーを退出し、その結果全員がready状態になったとき、それを検知できない場合があります。
!mp settingsコマンドを使うと全員の状態を確認できますが、チャット欄をあまり汚したくないのでこれの対処はしていません。

### 自動ロビー終了
!mp makeで作ったロビーはプレイヤーが誰もいなくなっても一定時間経過するまで残り続けます。
わりと残存期間が長く、他のユーザーに迷惑を掛ける可能性があったので、任意の時間経過でロビーを閉じる機能をつけました。
