# osu-ahr memo

## 概要
OSUのマルチゲームにて、ホストローテーションを自動化するためのボット
Osu-Auto-Host-Rotation

## 処理の流れ初期案
- BanchoBot宛に!mp make [roomname]を送る、その返信から部屋番号をユーザーに通知する
- 作った部屋のchannel(#mp_[roomid]) に入る
- ロビー監視モード
  - if ユーザーが入ってきたら B([userid] joined in slot [slot].)
    - if 誰もいないなら /その人をホストにする
    - else /ホストキューに追加
  - if ユーザーが出ていったら B([userid] left the game.)
    - if ホストなら
      - if 誰かいるなら /次のホストを任命
    - else
      - キューから削除
    - if 誰もいないなら
      - タイマーで部屋を削除 
  - if ホストが選曲したら B(Beatmap changed to) /AFK検知タイマー停止
  - if ホストが変更されたら B([userid] became the host.)
      - if ホストキューと違う人が任命されたら /正しい人に変更
  - if ホストが部屋サイズ変更したら -> 検出できないかも
  - if ホストがキックしたら -> どうしよう
  - if B(All players are ready) -> 未準備の人が抜けると発生しないかもなので注意
  - if B(The match has started!) /ゲーム監視モード
- ゲーム監視モード
  - if ユーザーが入ってきたら B([userid] joined in slot [slot].)
    - /ホストキューに追加? 今のホストのあとに追加するべき？
  - if ユーザーが出ていったら B([userid] left the game.)
    - /ホストキューから削除
    - if キューが空なら /!mp abortでロビー削除タイマー
  - if プレイヤースコア B([userid] finished playing) 
    - /完了リストに追加 -> 完了リストいる？ 未所持で試合が始まった場合はここに乗らない
    - /試合終了タイマー（最後のプレイヤーが終了してから１０秒後に強制終了）
  - if 試合終了 B(The match has finished!) /試合終了処理
- 試合終了時の処理
  - 現在のホストをキューに追加
  - キューの先頭をホストに任命
  - 試合終了タイマーのキャンセル
  - 完了リストとホストキューを突き合わせる（監視開始前にプレイヤーがいた場合や、未想定の事態に備えて）
- lobbyが生きたままahrのプロセスが終了した場合に備えて、復帰機構をつける
  - 開始時に設定を保存、再開時にそのlobbyにアクセスを試みる。正常終了時に設定を削除
  - もしくは単純にユーザーにlobbyidを入力してもらう

## 構成
- IIrcClient : IRCクライアントのインターフェース、mockを作るため
- ILobby : BanchoBotとのテキストのやり取りを抽象化
- LobbyPlugin : ILobbyを介して、各種機能を実現する

## AutoHostSelector class 設計 
### 概要
オートホストローテーション機能を行うためLobbyPlugin
ILobbyのイベントに対して処理を行う
### 状態
<dl>
  <dt>S0</dt>
  <dd>初期状態。hostQueueが空</dd>
  <dt>S1</dt>
  <dd>ホスト未選択状態。hostQueueが空ではない。currentHostがnull</dd>
  <dt>H</dt>
  <dd>試合開始待ち状態。currentHostがnullでない</dd>
  <dt>M</dt>
  <dd>試合中。isMatchingがtrue</dd>
</dl>

### 状態遷移と動作
s0
- PlayerJoined
  - キューに追加して、!mp hostを発行。s1へ遷移
s1
- PlayerJoined
  - キューに追加
- PlayerLeft
  - キューから削除
  - キューが０人ならs0へ遷移
  - 先頭が変わったら!mp hostを再発行
- HostChanged (起こりうる？)
  - 先頭が対象ならHへ遷移
  - それ以外なら!mp hostを再発行
- MatchStarted
  - !mp abortを発行

H
- PlayerJoined
  - キューに追加
- PlayerLeft
  - キューから削除
  - キューが０人ならs0へ遷移
  - 先頭が変わったら!mp hostを再発行しS1へ遷移
- HostChanged
  - 前のホストを末尾に移動
  - 先頭が対象ならそのまま
  - それ以外なら!mp hostを再発行しS1へ遷移
- MatchStarted
  - 現在のhostをキューの末尾へ
  - Mへ遷移 

M 
- PlayerJoined
  - キューに追加
- PlayerLeft
  - キューから削除
  - 0人にはならないはず。
- MatchFinished
  - 次のホストを任命してS1へ遷移

## npm スクリプト
- build distフォルダを削除 -> srcをtscでコンパイル
- start
 ~~src/index.js を実行~~ 
 ts-node から tsファイルを直接実行する
- test testsフォルダの単体テストをmochaで実行する

## 注意
IRCでチャットを取得するには!mp make から部屋を作らないといけない。
!mp makeで部屋を作るとホストが抜けた場合、ホストが別の人に映らず誰もホストでない状態になる。

ライブラリ irc をインストールする際にエラーが出るが、文字コード識別機能を使わなければ問題ないらしい。
でも他のパッケージをインストールする際にエラーがでてインストール出来ない場合がある。
一旦ircを削除して、入れ直す？

## Irc と osuマルチロビーについて
IRCはOsuのゲーム内チャットのすべてに干渉できるわけではない。権限が異なるっぽい。
IRCで接続できるのは!mp make で作成したトーナメントロビーだけ
トーナメントロビーのIRCにはプレイヤーが参加していないがチャットメッセージは受信できる

## test用 dummy class
テストのたびにマルチロビー作るのはまずいので、ダミーのIRCクライアントを作る。

要求
IRC機能
  join
  part
  say
  
イベント
  Registered IRC接続時
  Join ロビー入室時
  Part ロビー退出時
  Message メッセージ受信

Banchobot機能
  プレイヤー入室
  プレイヤー退出
  ホストがマップ変更
  試合 -> 開始メッセージ、プレイヤー終了、試合終了

## コンフィグ
サーバーパスワードなどをgitに公開するのはまずいのでconfigモジュールで管理する。
configモジュールは現在のNODE_ENV環境変数により適切なjsonコンフィグファイルを選択してロードしてくれる。NODE_ENVが指定されていない場合はDevelopmentが使用され、Developmentが存在しない場合はdefaultが使用される。共通項目はdefault.jsonに記述。production.jsonとdevelopment.jsonに非公開情報を記述し、この2つをgitignoreに追加。

# usernameルール
banchobotのメッセージからユーザー名を抜き出すための正規表現を作る際に、
公式のusername要件が必要になったので調べた。
[github](https://github.com/ppy/osu-web/blob/master/app/Libraries/UsernameValidation.php)
### ルール
- ^[A-Za-z0-9-\[\]_ ]+$#u
- 名前の前後のスペースはだめ
- 3文字以上、15文字以下
- スペースを2つ以上続けてはだめ
- _ とスペースは同時に使えない

## logging
ログからプレイヤーのチャットを抜き出す正規表現
^([^@]*@msg\s+)(?!BanchoBot)\w+.*$

## ロビーヒストリーWebApi
下記url形式で時系列のイベントと関連したユーザーの情報が取得できる。
必要ならこれらの情報も解析して利用したい。

https://osu.ppy.sh/community/matches/54000487/history?after=1255711787&limit=100

## バックグラウンド実行
ターミナルからnpmを実行すると、ターミナルを閉じたときにアプリケーションが終了してしまう。  
`sudo nohup npm start -- [m / e] [lobby name / lobby id] &` 
でターミナルを閉じてもバックグラウンドで実行し続けるようにできる。
終了する場合は
```bash
ps -e
sudo kill [PID]
```

## 試合中断時のホスト変更について
案１：試合完走者がいないで中断したらフラグを立てて、試合再開時にローテーションしないようにする
案２：ホストがマップを変更しないで試合を開始したらローテーションしないようにする

案２は他の場合には、前ホストが変更後に去り、現ホストが変更しなかった場合に次回もホストでいられる
しかしこれではアボート時にマップを変更するとその次のユーザーまでスキップされてしまう。

案３：誰がマップを変更したか保存する　採用

# TASK
## todo
- マップを持っていないプレイヤーでも試合が開始するとPlayersInGameに入ってしまう。（どうしようもない？
- ゲームモードや勝利条件を変更したときに挙動が変化しないか確かめる
- 順番がどういう仕組なのか理解してもらえない？
- 試合開始１０後くらいに誰かがチャットしたらabortの案内を出す
- infoの自動表示機能、infoを見たユーザーを記録し、ロビーに誰もいない場合は表示する
- 再起動時現在のホストに!mp host が発行される
- 試合中にEnterした場合正常に動作する？
## wip
- team mode でのmp settings
## done
- Team modeになるとユーザー参加を検知できない
- 長い名前のユーザー名が処理できない
- cliで試合開始時にマップ名を表示したい
- レフェリー検出時にログ
- 権限ユーザーが!mp start 30 すると２重でチャットしてしまう 権限管理の見直し、プレイヤー情報に権限を保存
- cliからコマンドを起動したい
- wordcounter用のinfo出力作成
- skip受付後にメッセージが表示されない
- refereeが部屋を抜けたら？listref => 部屋を抜けてもrefreeは継続する
- spamフィルター対策
- MatchStarter拡張、!start vote, !start timer 機能を追加
- プレイヤーが一人のときにタイマーが起動中判定になってしまう
- auto abortまでの時間が短い?
- 試合中にhostsが抜けた状態でAbortが受け付けられるとhostが誰もいない状態になる
- !mp start の連続使用時の挙動
- !mp start 1, !mp start 60 のときの挙動 second(s)?
- mp response check !mp start, !mp aborttimer, !mp kick, !mp addref, !mp removeref, !mp listrefs
- !mp abortもAbort判定にしたい
- cli ロビー作成時と入室時にコンソールにもっと情報を表示する
- hostsキュー表示するとき全員を表示する必要はない？名前を省略するか、後半を省くか
- 試合がスタックした場合のabort投票。abort時のホスト切り替え（始まる前にスタックしたか、終了時にスタックしたか） => 一人でもmatch finishedなら切り替え。
- !mp abortで試合を終了した場合、ホストが変更されない
- マップを変更しなかった場合ホストを変更しない仕組み
- スキップ後に自動で変更されないことがあった　修正済み
- abort後に ismatching フラグを折り忘れていた　修正済み
- キューの先頭にゴミが付く 修正
- mp settings で名前に[] が入るプレイヤーを正しく認識できない 修正済み
- /skip機能の追加 hostなら即変更、それ以外なら投票で変更　
- host skip timer機能　
- host skipperの表示が投票0でも退出時に表示されてしまう。修正済み
- cliのdisplayの誤字とエラー　修正済み
- log4jsのコンフィグは起動時書き換えを有効にするために独立したファイルにしたほうがいい。
- プレイヤーのチャット専用のログファイルがほしい。
- auth2のプレイヤーがホストのときに/skipしても即スキップにならない
- ユーザーがいなくなったときにエラーが発生
-  ホストが試合中に抜けると順番がおかしくなる.キューの並び替えタイミングを変更 
- ロビーが空になった際の自動クローズ
- ホストのスキップ時間が迫ったときに警告文を出すか、チャットしたときにタイマーが再設定されるようにする
- 誰もいない状態で!mp settingsしたときにどうなるか？ -> players: 0で打ち切り
- スキップ時にたまりすぎる問題 -> クールタイムを設けた
- ロビーに入って!mp settingsで情報を取得した際に、ホストからスロット順で並ぶようにする
- skip voteの票が１つでも入っている場合、プレイヤーの入退出のたびにメッセージが出て鬱陶しいかもしれない。