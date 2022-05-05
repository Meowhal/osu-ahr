import config from 'config';
import { IClientOpts } from './libs/irc';

export const CONFIG_OPTION = {
  USE_ENV: false
}

export interface IAhrConfig {
  irc: IIrcConfig;
}

export interface IIrcConfig {
  server: string;
  nick: string;
  opt: IClientOpts;
}

export function getIrcConfig(): IIrcConfig {
  const d = config.get<IIrcConfig>("irc");
  const e = loadEnvConfig("irc", d);
  const c = { ...d, ...e };
  return c;
}

export function getConfig<T>(tag: string, c: Partial<T>): T {
  if (CONFIG_OPTION.USE_ENV) {
    const d = config.get<T>(tag);
    const e = loadEnvConfig(tag, d);
    return { ...d, ...c, ...e };
  } else {
    return { ...config.get<T>(tag), ...c };
  }
}

export type ConfigTypeHint = {
  key: string,
  nullable: boolean,
  type: string
}

export type EnvConfigs = { [key: string]: boolean | number | string | object | null };
export function generateDefaultOptionTypeHint(option: any): ConfigTypeHint[] {
  let r = [];
  for (const key in option) {
    if (option[key] === null || option[key] === undefined) {
      r.push({ key, nullable: true, type: "number" });
    } else if (Array.isArray(option[key])) {
      r.push({ key, nullable: false, type: "array" });
    } else {
      r.push({ key, nullable: false, type: typeof option[key] });
    }
  }
  return r;
}

export function loadEnvConfigWithTypeHint(category: string, hints: ConfigTypeHint[], env: { [key: string]: string | undefined }): EnvConfigs {
  let r: EnvConfigs = {};
  for (const hint of hints) {
    const envKey = `ahr_${category}_${hint.key}`;
    let envVar = env[envKey];
    if (hint.nullable && (envVar === "null")) {
      r[hint.key] = null;
    } else if (envVar !== undefined) {
      switch (hint.type) {
        case "boolean":
          let bool = envVar.toLowerCase();
          if (bool === "true") {
            r[hint.key] = true;
          } else if (bool === "false") {
            r[hint.key] = false;
          } else {
            throw new Error(`env:${envKey} type mismatched. ${hint.key} must be true/false but "${envVar}"`);
          }
          break;
        case "number":
          let num = parseInt(envVar);
          if (!Number.isNaN(num)) {
            r[hint.key] = num;
          } else {
            throw new Error(`env:${envKey} type mismatched. ${hint.key} must be number but "${envVar}"`);
          }
          break;
        case "string":
          r[hint.key] = envVar;
          break;
        case "array":
          let arr = JSON.parse(envVar);
          if (isStringArray(arr)) {
            r[hint.key] = arr;
          } else {
            throw new Error(`env:${envKey} type mismatched. ${hint.key} must be str array(e.g. ["aaa", "bbb", "ccc"] ) but "${envVar}"`);
          }
          break;
        default:
          throw new Error(`env:${envKey} unsupported type. can't set ${hint.type} via env. ${envVar}`);
      }
    }
  }
  return r;
}

function isStringArray(arr: any) {
  if (!Array.isArray(arr)) return false;
  return arr.every(v => typeof v === "string");
}

export function loadEnvConfig(category: string, template: any) {
  const hints = generateDefaultOptionTypeHint(template);
  return loadEnvConfigWithTypeHint(category, hints, process.env);
}
