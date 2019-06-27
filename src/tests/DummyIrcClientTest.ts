import { assert } from 'chai';
import { DummyIrcClient } from './DummyIrcClient';
import { CommandParser } from "../CommandParser";
import { IIrcClient, logIrcEvent } from "../IIrcClient";

export function DummyIrcClientTest() {

  // ロビー作成テスト
  it("make lobby test", (done) => {
    const client = new DummyIrcClient("osu_irc_server", "owner");
    const parser = new CommandParser();
    const lobbyTitle = "testlobby";
    let f_joined = 0;
    let f_make_res = 0;
    let f_registered = 0;
    logIrcEvent(client);
    client.on('registered', function (message) {
      f_registered ++;
      client.say("BanchoBot", "!mp make " + lobbyTitle);
    });
    client.on('pm', function (nick, message) {
      const v = parser.ParseMpMakeResponse(nick, message);
      if (v != null) {
        f_make_res++;
        console.log(`--- parsed pm id=${v.id} title=${v.title}`);
        assert.equal(v.title, lobbyTitle);
      } else {
        assert.fail();
      }
    });
    client.on('join', function (channel, who) {
      f_joined++;
      setTimeout(() => {
        client.say(channel, "!mp close");
      }, 10);
    });
    client.on('part', function (channel, who, reason) {
      assert.equal(f_joined, 1);
      assert.equal(f_make_res, 1);
      assert.equal(f_registered, 1);
      done();
    });
  });

  it ("match test", (done) => {
    const client = new DummyIrcClient("osu_irc_server", "owner");
    const parser = new CommandParser();
    const lobbyTitle = "testlobby";
    const players = ["p1", "p2", "p3"];

    logIrcEvent(client);
    client.on('registered', function (message) {
      client.say("BanchoBot", "!mp make " + lobbyTitle);
    });
    client.on('join', function (channel, who) {
      players.forEach((v, i, a) => client.emulateAddPlayerAsync(v));
      setTimeout(() => {
        client.say(channel, "!mp close");
      }, 10);
      
    });
    client.on('part', function (channel, who, reason) {
      done();
    });
  });
}