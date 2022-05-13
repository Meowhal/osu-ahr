import axios from 'axios';
import config from 'config';
import { WebApiClient } from '../webapi/WebApiClient';
export interface WebApiTrialOption {
  client_id: number,
  client_secret: string,
  callback: string,
  code: string,
}

const oAuthConfig = config.get<WebApiTrialOption>('WebApi');

export async function trial() {
  //getTokenTrial();

  const client = WebApiClient;

  const user = await client.lookupBeatmapset(2647589);
  console.log(JSON.stringify(user));
}

export async function getGuestTokenTrial(): Promise<void> {
  try {
    const response = await axios.post('https://osu.ppy.sh/oauth/token', {
      'grant_type': 'client_credentials',
      'client_id': `${oAuthConfig.client_id}`,
      'client_secret': oAuthConfig.client_secret,
      'scope': 'public'
    });
    const c = response.data;
    console.log(c);
  } catch (e: any) {
    console.error(`\n${e.message}\n${e.stack}`);
  }
}

export async function getTokenTrial(): Promise<void> {
  try {
    const response = await axios.post('https://osu.ppy.sh/oauth/token', {
      'grant_type': 'authorization_code',
      'client_id': `${oAuthConfig.client_id}`,
      'client_secret': oAuthConfig.client_secret,
      'code': oAuthConfig.code,
      'redirect_uri': oAuthConfig.callback
    });
    const c = response.data;
    console.log(c);
  } catch (e: any) {
    console.error(`\n${e.message}\n${e.stack}`);
  }
}

function objectToURLSearchParams(obj: any): URLSearchParams {
  const param = new URLSearchParams();
  for (const key in obj) {
    param.append(key, obj[key]);
  }
  return obj;
}

export async function fetchUpdateTrial(): Promise<void> {
  try {
    const r = await axios.get('https://osu.ppy.sh/community/chat/updates?since=2065115911');
    const c = r.data;
    console.log(c);
  } catch (e: any) {
    console.error(`\n${e.message}\n${e.stack}`);
  }
}
