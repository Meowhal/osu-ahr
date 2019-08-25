import { assert } from 'chai';
import { CommandParserTest } from './CommandParserTest';
import { DummyIrcClientTest } from './DummyIrcClientTest';
import { LobbyTest } from "./LobbyTest";
import { AutoHostSelectorTest } from "./AutoHostSelectorTest";
import { MpSettingsParserTest } from "./MpSettingsParserTest";
import { HostSkipperTest } from "./HostSkipperTest";
import log4js from "log4js";

describe("ahr tests", () => {
  before(function() {
    log4js.configure("config/log_mocha_silent.json");
  });
  describe("BanchoBot Parser Tests", CommandParserTest);
  describe("Dummy Irc Client Tests", DummyIrcClientTest);
  describe("lobby tests", LobbyTest);
  describe("AutoHostSelector Tests", AutoHostSelectorTest);
  describe("MpSettingsParser Tests", MpSettingsParserTest);
  describe("HostSkipper tests", HostSkipperTest);
});
