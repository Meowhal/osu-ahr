import 'dotenv/config';
import config from 'config';
import { IClientOpts } from './libs/irc';
import { getLogger } from './Loggers';

const configLogger = getLogger('cfg');

export const CONFIG_OPTION = {
  USE_ENV: false,
  PRINT_LOADED_ENV_CONFIG: false,
};

export interface IAhrConfig {
  irc: IIrcConfig;
}

export interface IIrcConfig {
  server: string;
  nick: string;
  opt: IClientOpts;
}

export function getIrcConfig(): IIrcConfig {
  const d = config.get<IIrcConfig>('irc');
  const e = loadEnvConfig('irc', d, [
    { key: 'server', nullable: false, type: 'string' },
    { key: 'nick', nullable: false, type: 'string' },
    { key: 'port', nullable: false, type: 'number' },
    { key: 'password', nullable: false, type: 'string' }
  ]);
  const c = { ...d, ...e };
  c.opt = { ...c.opt };
  if (typeof e.port === 'number') {
    c.opt.port = e.port;
  }
  if (typeof e.password === 'string') {
    c.opt.password = e.password;
  }
  return c;
}

/**
 * craete a config from config files, in-code options and environment variables.
 *   files -> Default settings, etc.
 *   in-code options -> For setting directly from code for testing and debugging.
 *   environment variables -> For confidential. Highest priority.
 * @param tag
 * @param option
 * @returns
 */
export function getConfig<T>(tag: string, option: Partial<T>, hints?: ConfigTypeHint[]): T {
  if (CONFIG_OPTION.USE_ENV) {
    const d = config.get<T>(tag);
    const e = loadEnvConfig(tag, d, hints);
    return { ...d, ...option, ...e };
  } else {
    return { ...config.get<T>(tag), ...option };
  }
}

export type ConfigTypeHint = {
  key: string,
  nullable: boolean,
  type: string
}

export type EnvConfigs = { [key: string]: boolean | number | string | object | null };
export function generateDefaultOptionTypeHint(option: any): ConfigTypeHint[] {
  const r = [];
  for (const key in option) {
    if (option[key] === null || option[key] === undefined) {
      r.push({ key, nullable: true, type: 'number' });
    } else if (Array.isArray(option[key])) {
      r.push({ key, nullable: false, type: 'array' });
    } else {
      r.push({ key, nullable: false, type: typeof option[key] });
    }
  }
  return r;
}

function genEnvKey(category: string, key: string): string {
  return `ahr_${category}_${key}`;
}

export function loadEnvConfigWithTypeHint(category: string, hints: ConfigTypeHint[], env: { [key: string]: string | undefined }): EnvConfigs {
  const r: EnvConfigs = {};
  for (const hint of hints) {
    const envKey = genEnvKey(category, hint.key);
    const envVar = env[envKey];
    if (hint.nullable && (envVar === 'null')) {
      r[hint.key] = null;
    } else if (envVar !== undefined) {
      switch (hint.type) {
        case 'boolean':
          const bool = envVar.toLowerCase();
          if (bool === 'true') {
            r[hint.key] = true;
          } else if (bool === 'false') {
            r[hint.key] = false;
          } else {
            throw new Error(`Environment key ${envKey}'s type mismatched. ${hint.key} must be a boolean but received "${envVar}"`);
          }
          break;
        case 'number':
          const num = parseFloat(envVar);
          if (!Number.isNaN(num)) {
            r[hint.key] = num;
          } else {
            throw new Error(`Environment key ${envKey}'s type mismatched. ${hint.key} must be a number but received "${envVar}"`);
          }
          break;
        case 'string':
          r[hint.key] = envVar;
          break;
        case 'array':
          const arr = JSON.parse(envVar);
          if (isStringArray(arr)) {
            r[hint.key] = arr;
          } else {
            throw new Error(`Environment key ${envKey}'s type mismatched. ${hint.key} must be a string array, e.g., ["aaa", "bbb", "ccc"] but received "${envVar}"`);
          }
          break;
        default:
          throw new Error(`Environment key ${envKey} has an unsupported type. Cannot set ${hint.type} via environment. Received ${envVar}`);
      }
    }
  }
  if (CONFIG_OPTION.PRINT_LOADED_ENV_CONFIG) {
    for (const key in r) {
      if (key.toLocaleLowerCase().match(/(password)|(token)/)) {
        configLogger.info(`Loaded environment key: ${genEnvKey(category, key)}=${'*'.repeat(r[key]?.toString().length ?? 3)}`);
      } else {
        configLogger.info(`Loaded environment key: ${genEnvKey(category, key)}=${r[key]}`);
      }
    }
  }
  return r;
}

function isStringArray(arr: any) {
  if (!Array.isArray(arr)) return false;
  return arr.every(v => typeof v === 'string');
}

export function loadEnvConfig(category: string, template: any, hints?: ConfigTypeHint[]) {
  if (hints === undefined) {
    hints = generateDefaultOptionTypeHint(template);
  }
  return loadEnvConfigWithTypeHint(category, hints, process.env);
}
