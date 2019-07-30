import { assert } from 'chai';
import { CommandParserTest } from './CommandParserTest';
import { DummyIrcClientTest } from './DummyIrcClientTest';
import { LobbyTest } from "./LobbyTest";
import { AutoHostSelectorTest } from "./AutoHostSelectorTest";

describe("ahr tests", () => {
  describe("BanchoBot Parser Tests", CommandParserTest);
  describe("Dummy Irc Client Tests", DummyIrcClientTest);
  describe("lobby tests", LobbyTest);
  describe("AutoHostSelector Tests", AutoHostSelectorTest);
});
