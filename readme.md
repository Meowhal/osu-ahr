# osu-ahr memo

## 概要
OSUのマルチゲームにて、ホストローテーションを自動化するためのボット
Osu-Auto-Host-Rotation

## やること書き出し
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
  - if ホストが選曲したら B(Beatmap changed to) /選曲済みフラグを立てる (いらないかも)
  - if ホストが変更されたら B([userid] became the host.)
      - if ホストキューと違う人が任命されたら /正しい人に変更
  - if ホストが部屋サイズ変更したら -> 検出できないかも
  - if ホストがキックしたら -> どうしよう
  - if B(All players are ready) -> 未準備の人が抜けると発生しないので使わない
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

## ahrbot class 設計
### 概要
オートホストローテーション機能を表現するclass
Lobbyclassのイベントに反応して、アクションを起こす
### プロパティ
- lobby
- ホストキュー
- 現在のホスト
- 申請中ホスト
- 次のホスト
- 試合中フラグ
- 選曲済みフラグ
- 部屋削除タイマー
- 試合終了タイマー
### イベントハンドリング
- LobbyOpend(lobbyid)
- Joined(userid, slotid)
- left(userid)
- BeatmapSelected(mapid)
- HostChanged(userid)
### アクション
- makeLobby(title)
- rotateHost(userid)
- addQueue(userid)
- removeQueue(userid)

## lobby class 設計
### 概要
Banchobotとのirc通信を抽象化するためのクラス。
!mpコマンドのメソッド化、IRC応答のイベント化
### プロパティ
- 部屋名
- 部屋ID
- ircクライアント
### イベント
- LobbyOpend(lobbyid)
- PlayerJoined(userid, slotid)
- PlayerLeft(userid)
- BeatmapSelected(mapid)
- HostChanged(userid)
- MatchStarted()
- PlayerFinished(userid, score)
- MatchFinished()
- EnteredLobby()
- LobbyClosed(err) // コマンドによる正常終了のほかサーバー強制終了なども考慮する
### アクション
- SendMpHost(userid)
- SendMpMake(title)
- SendMpAbort()
- SendMpClose()
- SendMessage(message)
- Enter(channel)
- Leave(channel)
## npm スクリプト
- build distフォルダを削除 -> srcをtscでコンパイル
- start
 ~~src/index.js を実行~~ 
 ts-node から tsファイルを直接実行する
- test testsフォルダの単体テストをmochaで実行する

## 注意
IRCでチャットを取得するには!mp make から部屋を作らないといけない。
!mp makeで部屋を作るとホストが抜けた場合、ホストが別の人に映らず誰もホストでない状態になる。

user名に入っているスペースは _に置換しないといけない。
Banchobotのメッセージはスペースになっているので注意。
コマンドを送る場合は_を使う

ライブラリ irc をインストールする際にエラーが出るが、文字コード識別機能を使わなければ問題ないらしい。
でも他のパッケージをインストールする際にエラーがでてインストール出来ない場合がある。
一旦ircを削除して、入れ直す？

## Irc と osuマルチロビーについて
Osuのゲーム内チャットとトーナメント用IRCは別モノ？
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
