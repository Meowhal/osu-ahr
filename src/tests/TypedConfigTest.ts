import { assert } from 'chai';
import { BooleanOption, StringOption, NumberOption, OptionBase } from "../TypedConfig";

describe("TypedConfigTests", function () {
    describe("decorator tests", function () {
        it("create an option test", function () {
            class TestOption extends OptionBase {
                @NumberOption("number prop", false)
                num: number = 10;

                @StringOption("string prop", false)
                str1: string = "default string";

                @BooleanOption("boolean prop", false)
                bool1: boolean = false;

                constructor() {
                    super("TestOption");
                }
            };
            let v = new TestOption();
        });

        it("nullable validate test", function () {
            class TestOption extends OptionBase {
                @NumberOption("null allowed", true)
                nullable: number | null | undefined = 10;

                @NumberOption("null not allowed", false)
                notnull?: number | null | undefined = 10;

                constructor() {
                    super("TestOption");
                }
            };
            let v = new TestOption();
            v.validateAll();

            assert.doesNotThrow(() => {
                v.nullable = null;
                v.validateAll();
            });
            assert.doesNotThrow(() => {
                v.nullable = undefined;
                v.validateAll();
            });
            assert.throw(() => {
                v.notnull = null;
                v.validateAll();
            });
            assert.throw(() => {
                v.notnull = undefined;
                v.validateAll();
            });
        });

        describe("number option validate tests", function () {
            class TestOption extends OptionBase {
                @NumberOption("number", false)
                num: any = 10;

                @NumberOption("max100", false, undefined, 100)
                max100: any = 10;

                @NumberOption("min1", false, 1)
                min1: any = 10;

                @NumberOption("min1max100", false, 1, 100)
                min1max100: any = 10;

                @NumberOption("nullable", true, 1, 100)
                nullable: any = 10;

                constructor() {
                    super("TestOption");
                }
            };

            it("number type check test", () => {
                let v = new TestOption();
                assert.doesNotThrow(() => {
                    v.validateAll();
                });
                assert.doesNotThrow(() => {
                    v.num = 1;
                    v.validateAll();
                    v.num = -1;
                    v.validateAll();
                    v.num = 0.5;
                    v.validateAll();
                });
                assert.Throw(() => {
                    v.num = "aaa";
                    v.validateAll();
                });
                assert.Throw(() => {
                    v.num = "123";
                    v.validateAll();
                });
                assert.Throw(() => {
                    v.num = NaN;
                    v.validateAll();
                });
                assert.Throw(() => {
                    v.num = parseFloat("hello");
                    v.validateAll();
                });
                assert.Throw(() => {
                    v.num = [1, 2, 3];
                    v.validateAll();
                });
            });

            it("max test", () => {
                let v = new TestOption();
                assert.Throw(() => {
                    v.max100 = 101;
                    v.validateAll();
                });

                assert.doesNotThrow(() => {
                    v.max100 = -1000;
                    v.validateAll();
                    v.max100 = 0;
                    v.validateAll();
                    v.max100 = 100;
                    v.validateAll();
                });
            });

            it("min test", () => {
                let v = new TestOption();
                assert.Throw(() => {
                    v.min1 = -100;
                    v.validateAll();
                });

                assert.doesNotThrow(() => {
                    v.min1 = 1;
                    v.validateAll();
                    v.min1 = 1000;
                    v.validateAll();
                });
            });

            it("min max test", () => {
                let v = new TestOption();
                assert.Throw(() => {
                    v.min1max100 = -100;
                    v.validateAll();
                });

                assert.Throw(() => {
                    v.min1max100 = 1000;
                    v.validateAll();
                });

                assert.doesNotThrow(() => {
                    v.min1max100 = 1;
                    v.validateAll();
                    v.min1max100 = 50;
                    v.validateAll();
                    v.min1max100 = 100;
                    v.validateAll();
                });
            });

            it("nullable test", () => {
                let v = new TestOption();
                assert.Throw(() => {
                    v.nullable = -100;
                    v.validateAll();
                });

                assert.Throw(() => {
                    v.nullable = 1000;
                    v.validateAll();
                });

                assert.doesNotThrow(() => {
                    v.nullable = null;
                    v.validateAll();
                    v.nullable = undefined;
                    v.validateAll();
                    v.nullable = 50;
                    v.validateAll();
                });
            });
        });

        describe("string option validate tests", function () {

            function stringValidator(str: string) {
                if (str != "string") throw new Error("str must be string");
            }

            class TestOption extends OptionBase {
                @StringOption("string", false)
                str: any = "string";

                @StringOption("string", false, stringValidator)
                vali: any = "string";

                @StringOption("string", true, stringValidator)
                nullable: any = "string";

                constructor() {
                    super("TestOption");
                }
            };

            it("string type check test", () => {
                let v = new TestOption();
                assert.doesNotThrow(() => {
                    v.validateAll();
                    v.str = "aaa";
                    v.validateAll();
                    v.str = "";
                    v.validateAll();
                    v.str = (123).toString();
                    v.validateAll();
                });
                assert.throw(() => {
                    v.str = null;
                    v.validateAll();
                });
                assert.throw(() => {
                    v.str = 123;
                    v.validateAll();
                });
                assert.throw(() => {
                    v.str = NaN;
                    v.validateAll();
                });
                assert.throw(() => {
                    v.str = true;
                    v.validateAll();
                });
                assert.throw(() => {
                    v.str = ["aaa"];
                    v.validateAll();
                });
                assert.throw(() => {
                    v.str = { a: 123 };
                    v.validateAll();
                });
            });

            it("validator test", () => {
                let v = new TestOption();
                assert.doesNotThrow(() => {
                    v.validateAll();
                });
                assert.throw(() => {
                    v.vali = "aiueo";
                    v.validateAll();
                });
                assert.throw(() => {
                    v.vali = 123;
                    v.validateAll();
                });
            });

            it("nullable validator test", () => {
                let v = new TestOption();
                assert.doesNotThrow(() => {
                    v.validateAll();
                });
                assert.throw(() => {
                    v.nullable = "aiueo";
                    v.validateAll();
                });
                assert.doesNotThrow(() => {
                    v.nullable = null;
                    v.validateAll();
                });
            });
        });

        describe("boolean option validate tests", function () {
            class TestOption extends OptionBase {
                @BooleanOption("boolean", false)
                bool: any = true;

                @BooleanOption("boolean", true)
                nullable: any = true;

                constructor() {
                    super("TestOption");
                }
            };

            it("boolean type check test", () => {
                let v = new TestOption();
                assert.doesNotThrow(() => {
                    v.validateAll();
                    v.bool = false;
                    v.validateAll();
                });
                assert.throw(() => {
                    v.bool = null;
                    v.validateAll();
                });
                assert.throw(() => {
                    v.bool = 123;
                    v.validateAll();
                });
                assert.throw(() => {
                    v.bool = NaN;
                    v.validateAll();
                });
                assert.throw(() => {
                    v.bool = "true";
                    v.validateAll();
                });
                assert.throw(() => {
                    v.bool = ["aaa"];
                    v.validateAll();
                });
                assert.throw(() => {
                    v.bool = { a: 123 };
                    v.validateAll();
                });
            });

            it("nullable validator test", () => {
                let v = new TestOption();
                assert.doesNotThrow(() => {
                    v.validateAll();
                });
                assert.throw(() => {
                    v.nullable = "aiueo";
                    v.validateAll();
                });
                assert.doesNotThrow(() => {
                    v.nullable = null;
                    v.validateAll();
                });
            });
        });

        describe("parse tests", function () {
            class TestOption extends OptionBase {
                @NumberOption("num", false)
                num: any = 10;

                @NumberOption("num nullable", true)
                num_nullable: any = 10;

                @StringOption("str", false)
                str: any = "string";

                @StringOption("str nullable", true)
                str_nullable: any = "string";

                @BooleanOption("bool", false)
                bool: any = true;

                @BooleanOption("bool nullable", true)
                bool_nullable: any = true;

                constructor() {
                    super("TestOption");
                }
            };
            it("parse number test", () => {
                let v = new TestOption();
                v.num = "123";
                v.parse("num");
                assert.equal(v.num, 123);

                v.num = "0";
                v.parse("num");
                assert.equal(v.num, 0);

                v.num = "123.456";
                v.parse("num");
                assert.equal(v.num, 123.456);

                v.num = "-500";
                v.parse("num");
                assert.equal(v.num, -500);

                assert.throw(() => {
                    v.num = "abc";
                    v.parse("num");
                });

                assert.throw(() => {
                    v.num = null;
                    v.parse("num");
                });
            });

            it("parse number nullable test", () => {
                let v = new TestOption();
                v.num_nullable = "123";
                v.parse("num_nullable");
                assert.equal(v.num_nullable, 123);

                v.num_nullable = "0";
                v.parse("num_nullable");
                assert.equal(v.num_nullable, 0);

                v.num_nullable = "123.456";
                v.parse("num_nullable");
                assert.equal(v.num_nullable, 123.456);

                v.num_nullable = "-500";
                v.parse("num_nullable");
                assert.equal(v.num_nullable, -500);

                v.num_nullable = null;
                v.parse("num_nullable");
                assert.equal(v.num_nullable, null);

                assert.throw(() => {
                    v.num_nullable = "abc";
                    v.parse("num_nullable");
                });
            });

            it("parse string test", () => {
                let v = new TestOption();
                v.str = "";
                v.parse("str");
                assert.equal(v.str, "");

                v.str = "123";
                v.parse("str");
                assert.equal(v.str, "123");

                v.str = 123;
                v.parse("str");
                assert.equal(v.str, "123");

                v.str = true;
                v.parse("str");
                assert.equal(v.str, "true");

                v.str = NaN;
                v.parse("str");
                assert.equal(v.str, "NaN");

                assert.throw(() => {
                    v.str = null;
                    v.parse("str");
                });
            });

            it("parse string nullable test", () => {
                let v = new TestOption();
                v.str_nullable = "";
                v.parse("str_nullable");
                assert.equal(v.str_nullable, "");

                v.str_nullable = "123";
                v.parse("str_nullable");
                assert.equal(v.str_nullable, "123");

                v.str_nullable = 123;
                v.parse("str_nullable");
                assert.equal(v.str_nullable, "123");

                v.str_nullable = true;
                v.parse("str_nullable");
                assert.equal(v.str_nullable, "true");

                v.str_nullable = NaN;
                v.parse("str_nullable");
                assert.equal(v.str_nullable, "NaN");

                v.str_nullable = null;
                v.parse("str_nullable");
                assert.equal(v.str_nullable, null);
            });

            it("parse bool test", () => {
                let v = new TestOption();
                v.bool = true;
                v.parse("bool");
                assert.equal(v.bool, true);

                v.bool = false;
                v.parse("bool");
                assert.equal(v.bool, false);

                v.bool = 123;
                v.parse("bool");
                assert.equal(v.bool, true);

                v.bool = "abc";
                v.parse("bool");
                assert.equal(v.bool, true);

                v.bool = "";
                v.parse("bool");
                assert.equal(v.bool, false);

                v.bool = NaN;
                v.parse("bool");
                assert.equal(v.bool, false);

                assert.throw(() => {
                    v.bool = null;
                    v.parse("bool");
                });
            });

            it("parse bool nullable test", () => {
                let v = new TestOption();
                v.bool_nullable = true;
                v.parse("bool_nullable");
                assert.equal(v.bool_nullable, true);

                v.bool_nullable = false;
                v.parse("bool_nullable");
                assert.equal(v.bool_nullable, false);

                v.bool_nullable = 123;
                v.parse("bool_nullable");
                assert.equal(v.bool_nullable, true);

                v.bool_nullable = "abc";
                v.parse("bool_nullable");
                assert.equal(v.bool_nullable, true);

                v.bool_nullable = "";
                v.parse("bool_nullable");
                assert.equal(v.bool_nullable, false);

                v.bool_nullable = NaN;
                v.parse("bool_nullable");
                assert.equal(v.bool_nullable, false);

                v.bool_nullable = null;
                v.parse("bool_nullable");
                assert.equal(v.bool_nullable, null);
            });
        });

        it("toJson tests", function () {
            class TestOption extends OptionBase {
                @NumberOption("number prop", false)
                num: number = 10;

                @StringOption("string prop", false)
                str1: string = "default string";

                @BooleanOption("boolean prop", false)
                bool1: boolean = false;

                constructor() {
                    super("TestOption");
                }
            };
            let v = new TestOption();
            assert.equal(v.toJson(), `{"num":10,"str1":"default string","bool1":false}`);
            //console.log(v.toJson());
        });
    });
});