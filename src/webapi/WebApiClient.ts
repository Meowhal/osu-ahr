import axios from 'axios';
import config from "config";
import log4js from "log4js";
import http from "http";
import open from "open";
import path from "path";
import { URL } from 'url';
import { promises as fs } from 'fs';
import { UserProfile, trimProfile } from "./UserProfile";
import { Beatmap } from "./Beatmapsets";

export interface ApiToken {
  token_type: string,
  expires_in: number,
  access_token: string,
  isGuest: boolean
}

function isExpired(token: ApiToken | undefined): boolean {
  if (token == undefined) return true;
  return Date.now() / 1000 > token.expires_in;
}

export interface WebApiClientOption {
  client_id: number,
  client_secret: string,
  callback: string,
  callback_port: number,
  asGuest: boolean,
  token_store_dir: string,
}

export class WebApiClient {
  option: WebApiClientOption;
  logger: log4js.Logger;

  token: ApiToken | undefined;

  constructor(option: Partial<WebApiClientOption> = {}) {
    const WebApiDefaultOption = config.get<WebApiClientOption>("WebApi");
    this.option = { ...WebApiDefaultOption, ...option } as WebApiClientOption;
    this.logger = log4js.getLogger("webapi");
  }

  async updateToken(): Promise<boolean> {
    if (!isExpired(this.token)) return true;
    let token: ApiToken | undefined;
    token = await this.loadStoredToken(this.option.asGuest);
    if (token) {
      this.token = token;
      return true;
    }

    token = this.option.asGuest ? await this.getGuestToken() : await this.getAuthorizedToken();
    if (token) {
      this.storeToken(token);
      this.token = token;
      return true;
    }

    return false;
  }

  private getTokenPath(asGuest: boolean) {
    return path.join(this.option.token_store_dir, asGuest ? "guest_token.json" : "token.json");
  }

  private async storeToken(token: ApiToken): Promise<boolean> {
    if (this.option.token_store_dir == "") return false;
    try {
      const p = this.getTokenPath(token.isGuest);
      await fs.mkdir(path.dirname(p), { recursive: true });
      await fs.writeFile(p, JSON.stringify(token), { encoding: "utf8", flag: "w" });
      this.logger.info("stored token to : " + p);
      return true;
    } catch (e) {
      this.logger.error("storeToken error : " + e);
      return false;
    }
  }

  private async loadStoredToken(asGuest: boolean): Promise<ApiToken | undefined> {
    if (this.option.token_store_dir == "") return;
    const p = this.getTokenPath(asGuest);
    try {
      await fs.access(p);
    } catch (e) {
      return;
    }

    try {
      const j = await fs.readFile(p, "utf8");
      const token = JSON.parse(j) as ApiToken;
      if (!isExpired(token)) {
        this.logger.info("loaded stored token from : " + p);
        return token;
      }
      this.deleteStoredToken(asGuest);
      this.logger.info("deleted expired stored token");
    } catch (e) {
      this.logger.error("loadStoredToken error : " + e);
    }
  }

  private async deleteStoredToken(asGuest: boolean): Promise<void> {
    const p = this.getTokenPath(asGuest);
    try {
      await fs.access(p);
    } catch (e) {
      return;
    }
    try {
      fs.unlink(p);
    } catch (e) {
      this.logger.error("load token error : " + e);
    }
  }

  private async getAuthorizedToken(): Promise<ApiToken | undefined> {
    try {
      const code = await this.getAuthorizeCode();
      const response = await axios.post("https://osu.ppy.sh/oauth/token", {
        "client_id": "" + this.option.client_id,
        "client_secret": this.option.client_secret,
        "code": code,
        "grant_type": "authorization_code",
        "redirect_uri": this.option.callback
      });
      response.data.isGuest = false;
      response.data.expires_in += Date.now() / 1000;
      this.logger.info("get Authorized token");
      return response.data;
    } catch (e) {
      this.logger.error(`getAuthorizedToken error : ${e}`);
    }
  }

  private getAuthorizeCode(): Promise<string> {
    return new Promise((resoleve, reject) => {
      const server = http.createServer();
      let code: string | null = null;
      server.once("request", (req: http.IncomingMessage, res: http.ServerResponse) => {
        res.setHeader('Content-Type', 'text/html');
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        if (!req.url) {
          res.end("missing req.url");
          return;
        }
        const url = new URL(req.url, `http://${req.headers.host}`);
        code = url.searchParams.get("code");
        if (code == null) {
          res.end("missing code");
          return;
        }
        res.end("ok : " + code);
        console.log("got code! " + code);
        server.close(() => {
          console.log("closed callback");
        });
        if (res.connection) {
          res.connection.end();
          res.connection.destroy();
        } else {
          reject("no connection");
        }

      });
      server.once("close", () => {
        console.log("closed event");
        if (code == null) {
          reject("no code");
        } else {
          this.logger.info("get Authorized code");
          resoleve(code);
        }
      });
      server.listen(this.option.callback_port);
      const nurl = new URL("https://osu.ppy.sh/oauth/authorize");
      nurl.searchParams.set("client_id", this.option.client_id.toString());
      nurl.searchParams.set("redirect_uri", this.option.callback);
      nurl.searchParams.set("response_type", "code");
      nurl.searchParams.set("scope", "public");
      open(nurl.toString());
    });
  }

  private async getGuestToken(): Promise<ApiToken | undefined> {
    try {
      const response = await axios.post("https://osu.ppy.sh/oauth/token", {
        "grant_type": "client_credentials",
        "client_id": "" + this.option.client_id,
        "client_secret": this.option.client_secret,
        "scope": "public"
      });
      response.data.isGuest = true;
      response.data.expires_in += Date.now() / 1000;
      return response.data;
    } catch (e) {
      this.logger.error(`getGuestToken error : ${e}`);
    }
  }

  async accessApi(url: string, config: any = {}, tryCount: number = 2): Promise<any> {
    while (tryCount-- > 0) {
      if (!await this.updateToken() || !this.token) {
        throw new Error(`accessApi error : couldn't get valid token`);
      }

      config.headers = {
        "Authorization": `Bearer ${this.token.access_token}`,
        "Accept": "application/json",
        "Content-Type": "application/json",
      };

      try {
        const response = await axios(url, config);
        if (response.status != 200) {
          this.logger.error(`accessApi error: ${url}, status: ${response.status}, msg: ${response.statusText}`);
        }
        return response.data;
      } catch (e) {
        switch (e?.response?.status) {
          case 401:
            this.logger.info(`api access failed, delete current token.`);
            this.deleteStoredToken(this.option.asGuest);
            this.token = undefined;
            break;
          default:
            console.error(`${e.response.status} ${e.response.statusText}`);
            throw e;
        }
      }
    }
    throw new Error("couldn't access api");
  }

  async getChatUpdates() {
    const data = await this.accessApi("https://osu.ppy.sh/api/v2/chat/updates", {
      method: "GET",
      params: {
        "since": "0"
      }
    });
    return data;
  }

  async getChannels() {
    const data = await this.accessApi("https://osu.ppy.sh/api/v2/chat/channels", {
      method: "GET"
    });
    return data;
  }

  async getMe() {
    const data = await this.accessApi("https://osu.ppy.sh/api/v2/me/osu", {
      method: "GET"
    });
    return data;
  }

  async getNotifications() {
    const data = await this.accessApi("https://osu.ppy.sh/api/v2/notifications", {
      method: "GET"
    });
    return data;
  }

  async getUserRecentActivity(id: number) {
    const data = await this.accessApi(`https://osu.ppy.sh/api/v2/users/${id}/recent_activity`, {
      method: "GET"
    });
    return data;
  }

  async getUser(id: number | string): Promise<UserProfile | null> {
    try {
      const data = await this.accessApi(`https://osu.ppy.sh/api/v2/users/${id}/osu`, {
        method: "GET"
      });
      data.get_time = Date.now();
      return trimProfile(data);
    } catch (e) {
      if (e?.response?.status == 404) {
        return null;
      }
      throw e;
    }
  }

  async lookupBeatmap(mapid: number): Promise<Beatmap | undefined> {
    try {
      const data = await this.accessApi(`https://osu.ppy.sh/api/v2/beatmaps/lookup?id=${mapid}`, {
        method: "GET"
      });
      data.get_time = Date.now();
      return data;
    } catch (e) {
      if (e?.response?.status == 404) {
      } else {
        throw e;
      }
    }
  }
}