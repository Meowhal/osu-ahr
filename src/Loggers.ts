import log4js from 'log4js';
export type Logger = log4js.Logger;

function selectConfigPath() {
  const proc = process.argv[0];
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
  } else if (proc.includes('ts-node') || hasVerboseFlag) {
    return './config/log_cli_verbose.json';
  } else {
    return './config/log_cli.json';
  }
}

const path = selectConfigPath();
console.log(`Loading log4js configuration from ${path}`);
log4js.configure(path);

export function getLogger(category?: string | undefined): Logger {
  const l = log4js.getLogger(category);
  l.addContext('channel', 'ahr'); // set default channel
  return l;
}