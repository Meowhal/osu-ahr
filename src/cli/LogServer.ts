import { startLogServer } from "../web/LogServer";
import config from "config";
import {OahrCliOption} from "./OahrBase";

const OahrCliDefaultOption = config.get<OahrCliOption>("OahrCli");

startLogServer(OahrCliDefaultOption.log_server_port);