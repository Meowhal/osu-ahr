import config from "config";
import { IClientOpts } from "./libs/irc";
import "reflect-metadata";

export interface IAhrConfig {
  irc: IIrcConfig;
}

export interface IIrcConfig {
  server: string;
  nick: string;
  opt: IClientOpts;
}

export function getIrcConfig(): IIrcConfig {
  return config.get<IIrcConfig>("irc");
}

export function getConfig<T>(ctor: { new(init?: Partial<T>): T }): T {
  let tag = "";
  let c = config.get<T>(tag);
  return new ctor(c);
}

export class OptionValdateError extends Error {
  constructor(message: string) {
    super(message);
    this.message = message;
    this.name = 'OptionValdateError';
  }
}

export class OptionParseError extends Error {
  constructor(message: string) {
    super(message);
    this.message = message;
    this.name = 'OptionParseError';
  }
}

export class OptionNotNullableError extends OptionValdateError {
  constructor(message: string) {
    super(message);
    this.message = message;
    this.name = 'OptionNotNullableError';
  }
}

export class OptionTypeMismatchError extends OptionValdateError {
  constructor(message: string) {
    super(message);
    this.message = message;
    this.name = 'OptionTypeMismatchError';
  }
}

const OPTION_TYPE = Symbol();
const OPTION_DESC = Symbol();
const OPTION_NULLABLE = Symbol();
const OPTION_NUM_MIN = Symbol();
const OPTION_NUM_MAX = Symbol();
const OPTION_STR_VALIDATOR = Symbol();

export function NumberOption(description: string, nullable: boolean, min?: number, max?: number) {
  return function (target: any, props: string) {
    Reflect.defineMetadata(OPTION_NUM_MIN, min, target, props);
    Reflect.defineMetadata(OPTION_NUM_MAX, max, target, props);
    setMetadatas(target, props, "number", description, nullable);
  }
}

export function StringOption(description: string, nullable: boolean, validator?: (value: string) => void) {
  return function (target: any, props: string) {
    if (validator) {
      Reflect.defineMetadata(OPTION_STR_VALIDATOR, validator, target, props);
    }
    setMetadatas(target, props, "string", description, nullable);
  }
}

export function BooleanOption(description: string, nullable: boolean) {
  return function (target: any, props: string) {
    setMetadatas(target, props, "boolean", description, nullable);
  }
}

function setMetadatas(target: any, props: string, type: string, description: string, nullable: boolean) {
  Reflect.defineMetadata(OPTION_TYPE, type, target, props);
  Reflect.defineMetadata(OPTION_DESC, description, target, props);
  Reflect.defineMetadata(OPTION_NULLABLE, nullable, target, props);
}
export class OptionBase {
  tag: string;
  lobbyId?: string;

  constructor(tag: string, lobbyId?: string) {
    this.tag = tag;
    this.lobbyId = lobbyId;
  }

  validateAll() {
    for (let props in this) {
      if (Reflect.hasMetadata(OPTION_TYPE, this, props)) {
        this.validate(props)
      }
    }
  }

  validate(props: string) {
    let value = (this as any)[props];
    if (value == null) { // value is null or undefined
      if (Reflect.getMetadata(OPTION_NULLABLE, this, props) === false) {
        throw new OptionNotNullableError(`${this.tag}.${props} is not nullable.`);
      } else {
        // nullable かつ nullなら検証完了
        return;
      }
    }

    switch (Reflect.getMetadata(OPTION_TYPE, this, props)) {
      case "number":
        if (typeof (value) != "number" || Number.isNaN(value)) {
          throw new OptionTypeMismatchError(`${this.tag}.${props}(${value}) must be number.`);
        }
        const min = Reflect.getMetadata(OPTION_NUM_MIN, this, props);
        const max = Reflect.getMetadata(OPTION_NUM_MAX, this, props);
        if (value < min) {
          throw new OptionValdateError(`${this.tag}.${props}(${value}) must be ${min} or greater.`);
        }
        if (max < value) {
          throw new OptionValdateError(`${this.tag}.${props}(${value}) must be ${max} or less.`);
        }
        break;
      case "string":
        if (typeof (value) != "string") {
          throw new OptionTypeMismatchError(`${this.tag}.${props}(${value}) must be string.`);
        }
        if (Reflect.hasMetadata(OPTION_STR_VALIDATOR, this, props)) {
          const validator = Reflect.getMetadata(OPTION_STR_VALIDATOR, this, props) as (value: string) => void;
          validator(value as string);
        }
        break;
      case "boolean":
        if (typeof (value) != "boolean") {
          throw new OptionTypeMismatchError(`${this.tag}.${props}(${value}) must be boolean.`);
        }
        break;
    }
  }

  parse(props: string) {
    let value = (this as any)[props];
    if (value == null || value == "null" || value == "undefined") {
      if (Reflect.getMetadata(OPTION_NULLABLE, this, props) === false) {
        throw new OptionParseError(`${this.tag}.${props} is not nullable.`)
      } else {
        (this as any)[props] = null;
        return;
      }
    }

    switch (Reflect.getMetadata(OPTION_TYPE, this, props)) {
      case "number":
        let v = Number(value);
        if (Number.isNaN(v)) {
          throw new OptionParseError(`${this.tag}.${props}(${value}) is not a number.`);
        }
        (this as any)[props] = v;
        break;
      case "string":
        (this as any)[props] = value.toString();
        break;
      case "boolean":
        if (typeof (value) == "string" && value.toLocaleLowerCase() == "false") {
          (this as any)[props] = false;
        } else {
          (this as any)[props] = !!value;
        }
        break;
    }
  }

  toJson() {
    return JSON.stringify(this, function (key: string, value: any) {
      if (!key) return value;
      if (Reflect.hasMetadata(OPTION_TYPE, this, key)) {
        return value;
      } else {
        return undefined;
      }
    });
  }
}