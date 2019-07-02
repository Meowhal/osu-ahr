import { assert } from 'chai';
import { DummyLobbyTest } from './DummyLobbyTest';
import { CommandParserTest } from './CommandParserTest';
import { DummyIrcClientTest } from './DummyIrcClientTest';
import { LobbyTest } from "./LobbyTest";

describe("ahr tests", () => {
  describe("ahr dummy lobby tests", DummyLobbyTest);
  describe("BanchoBot Parser Tests", CommandParserTest);
  describe("Dummy Irc Client Tests", DummyIrcClientTest);
  describe("lobby tests", LobbyTest);
});
