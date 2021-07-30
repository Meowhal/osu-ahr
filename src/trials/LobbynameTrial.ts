export function trial() {
    let cases = ["a", "asdflkj", " $% BN |~=", "4-5 | alt | test @join", "あいうおaaa", "aa\n\raa"];
    for (let c of cases) {
        console.log(`${c} => ${rep(c)}`);
    }
}

function rep(text: string): string {
    text = text.replace(/[^ -/:-@\[-~0-9a-zA-Z]/g, "");
    return text;
}