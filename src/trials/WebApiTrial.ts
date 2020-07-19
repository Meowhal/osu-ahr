import axios from 'axios';
import config from "config";

export interface WebApiTrialOption {
  client_id: number,
  client_secret: string,
  callback: string,
  code: string,
}

const oAuthConfig = config.get<WebApiTrialOption>("oAuthConfig");

export async function getTokenTrialUrlEncoded(): Promise<void> {
  try {
    const params = objectToURLSearchParams({
      "grant_type" : "authorization_code",
      "client_id" : "" + oAuthConfig.client_id,
      "client_secret" : oAuthConfig.client_secret,
      "redirect_uri" : oAuthConfig.callback,
      "code" : oAuthConfig.code,
    });
    const response = await axios.post("https://osu.ppy.sh/oauth/token", params);
    const c = response.data;
    console.log(c);
  } catch (e) {
    console.error(e);
  }
}

export async function getTokenTrial(): Promise<void> {
  try {
    const response = await axios.post("https://osu.ppy.sh/oauth/token", {
      "grant_type" : "authorization_code",
      "client_id" : "" + oAuthConfig.client_id,
      "client_secret" : oAuthConfig.client_secret,
      "redirect_uri" : oAuthConfig.callback,
      "code" : oAuthConfig.code,
    });
    const c = response.data;
    console.log(c);
  } catch (e) {
    console.error(e);
  }
}

function objectToURLSearchParams(obj: any): URLSearchParams {
  const param = new URLSearchParams();
  for(let key in obj) {
    param.append(key, obj[key]);
  }
  return obj;
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