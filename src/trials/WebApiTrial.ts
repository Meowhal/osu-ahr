import axios from 'axios';
import config from "config";

const temp_code = "*";

export interface WebApiTrialOption {
  client_id: number,
  client_secret: string,
  callback: string
}

const oAuthConfig = config.get<WebApiTrialOption>("oAuthConfig");

export async function getTokenTrial(): Promise<void> {
  try {
    const params = new URLSearchParams();
    params.append("grant_type", "authorization_code");
    params.append("client_id", "" + oAuthConfig.client_id);
    params.append("client_secret", oAuthConfig.client_secret);
    params.append("redirect_uri", oAuthConfig.callback);
    params.append("code", temp_code);
    const response = await axios.post("https://osu.ppy.sh/oauth/token", params);
    const c = response.data;
    console.log(c);
  } catch (e) {
    console.error(e);
  }
}

export async function fetchUpdateTrial(): Promise<void> {
  try {
    const r = await axios.get("https://osu.ppy.sh/community/chat/updates?since=2065115911");
    const c = r.data;
    console.log(c);
  } catch (e) {
    console.error(e);
  }
}