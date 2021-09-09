import "reflect-metadata";

const opt_type = Symbol();
const min_key = Symbol();
const max_key = Symbol();
const opt_tag = Symbol();
const str_val = Symbol();

function Option(tag: string) {
    return function <T extends { new(...args: any[]): {} }>(ctor: T) {
        return class extends ctor {
            constructor(...args: any[]) {
                super(...args);
                Reflect.defineMetadata(opt_tag, tag, this);
            }
        }

    }
}

function NumberOption(min: number, max: number) {
    return function (target: any, props: string) {
        Reflect.defineMetadata(opt_type, "number", target, props);
        Reflect.defineMetadata(min_key, min, target, props);
        Reflect.defineMetadata(max_key, max, target, props);
        console.log(`target ${JSON.stringify(target)}, props ${props}`);
    }
}

function StringOption(validator?: (val: string) => boolean) {
    return function (target: any, props: string) {
        Reflect.defineMetadata(opt_type, "string", target, props);
        Reflect.defineMetadata(str_val, validator, target, props);
    }
}

function validateOptions(target: any) {
    for (let key in target) {
        if (Reflect.hasMetadata(opt_type, target, key)) {
            validate(target, key);
        }
    }
}

function validate(target: any, key: string) {
    switch (Reflect.getMetadata(opt_type, target, key)) {
        case "number":
            const min = Reflect.getMetadata(min_key, target, key);
            const max = Reflect.getMetadata(max_key, target, key);
            console.log(`min ${min}, max ${max}, val ${target[key]}`);
            break;
        case "string":
            const val = Reflect.getMetadata(str_val, target, key) as ((val: string) => boolean) | null;
            if (val) {
                console.log(`string validator str=${target[key]} val=${val(target[key])}`);
            }
            break;
    }
}

@Option("ahr")
class Sample {
    @NumberOption(1, 100)
    val0: number = 10;

    @NumberOption(1, 100)
    val1: number = 1;

    @NumberOption(1, 100)
    val2: number = 3;

    @StringOption(v => v.includes("x"))
    str1: string = "abcx";

    @StringOption()
    str2: string = "abcx";

    constructor(init?: Partial<Sample>) {
        Object.assign(this, init);
    }
}

interface IF {
    message?: string;

}


export async function trial() {
    console.log("start");

    let s1 = new Sample({ val2: 1000 });

    validateOptions(s1);
    let tag = Reflect.getMetadata(opt_tag, s1);
    console.log(tag);
}