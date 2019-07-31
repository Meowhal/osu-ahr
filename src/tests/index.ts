import { assert } from 'chai';
import { CommandParserTest } from './CommandParserTest';
import { DummyIrcClientTest } from './DummyIrcClientTest';
import { LobbyTest } from "./LobbyTest";
import { AutoHostSelectorTest } from "./AutoHostSelectorTest";
import { MpSettingsParserTest } from "./MpSettingsParserTest";

describe("ahr tests", () => {
  describe("BanchoBot Parser Tests", CommandParserTest);
  describe("Dummy Irc Client Tests", DummyIrcClientTest);
  describe("lobby tests", LobbyTest);
  describe("AutoHostSelector Tests", AutoHostSelectorTest);
  describe("MpSettingsParser Tests", MpSettingsParserTest);
});
