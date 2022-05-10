export function trial() {
  const cases = ['a', 'asdflkj', ' $% BN |~=', '4-5 | alt | test @join', 'あいうおaaa', 'aa\n\raa'];
  for (const c of cases) {
    console.log(`${c} => ${rep(c)}`);
  }
}

function rep(text: string): string {
  text = text.replace(/[^ -~]/g, '');
  return text;
}