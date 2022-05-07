import { TypedEvent } from '../libs/TypedEvent';

export function trial() {
  const e1 = new TypedEvent<number>();
  e1.once(n => console.log(`fired e1 arg = ${n}`));
  e1.emit(1);

  const e2 = new TypedEvent<[number, string]>();
  e2.once((t) => console.log(`fired e2 arg1 = ${t[0]} arg2 = ${t[1]}`));
  e2.emit([1, 'x']);

  const e3 = new TypedEvent<{ a: number, b: string }>();
  e3.once((t) => console.log(`fired e2 a = ${t.a} b = ${t.b}`));
  const a = 1;
  const b = 'x';
  const c = 'c';
  e3.emit({ a, b });
}
