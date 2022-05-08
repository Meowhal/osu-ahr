import log4js from 'log4js';
export type Logger = log4js.Logger;

function selectConfigPath() {
  const exeFile = process.argv[1];
  const hasVerboseFlag = process.argv.some(v => v === '--verbose' || v === '-v');

  if (exeFile.includes('discord')) {
    return './config/log_discord.json';
  } else if (exeFile.includes('mocha')) {
    if (hasVerboseFlag) {
      return './config/log_mocha_verbose.json';
    } else {
      return './config/log_mocha.json';
    }
  } else if (process.env.NODE_ENV !== 'production' || hasVerboseFlag) {
    return './config/log_cli_verbose.json';
  } else {
    return './config/log_cli.json';
  }
}

const path = selectConfigPath();
console.log(`load log4js configuration from ${path}`);
const l = log4js.configure(path);

export function getLogger(category?: string | undefined): Logger {
  return l.getLogger(category);
}