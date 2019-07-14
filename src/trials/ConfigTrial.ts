import config from 'config';
import { ITrialConfg } from "../config";

// node_envの値によりコンフィグが切り替わる動作のデモ
// 実行
// $ npx ts-node ./src/tests/ConfigTrial.ts
// $ npx cross-env NODE_ENV=development ts-node ./src/tests/ConfigTrial.ts
export function configTrial() {
  const c = config.get<ITrialConfg>("trial");
  console.log("NODE_ENV = " + process.env.NODE_ENV);
  console.log("config.env = " + c.env);
  console.log("config.default_value = " + c.default_value);
}

