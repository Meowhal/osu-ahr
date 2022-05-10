"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const chai_1 = require("chai");
const TypedConfig_1 = require("../TypedConfig");
describe('TypedConfigTests', function () {
    let CONFIG_OPTION_USE_ENV_DEFAULT = false;
    before(function () {
        CONFIG_OPTION_USE_ENV_DEFAULT = TypedConfig_1.CONFIG_OPTION.USE_ENV;
        TypedConfig_1.CONFIG_OPTION.USE_ENV = false;
    });
    after(function () {
        TypedConfig_1.CONFIG_OPTION.USE_ENV = CONFIG_OPTION_USE_ENV_DEFAULT;
    });
    describe('generateDefaultOptionTypeHint tests', function () {
        it('create boolean hints', function () {
            const hint = (0, TypedConfig_1.generateDefaultOptionTypeHint)({
                a: false,
                b: true
            });
            chai_1.assert.deepEqual(hint, [
                { key: 'a', nullable: false, type: 'boolean' },
                { key: 'b', nullable: false, type: 'boolean' }
            ]);
        });
        it('create number typehint', function () {
            const hint = (0, TypedConfig_1.generateDefaultOptionTypeHint)({
                a: 0,
                b: 1,
                c: 0xffffffff,
                d: Number.POSITIVE_INFINITY,
                f: Number.NaN,
            });
            chai_1.assert.deepEqual(hint, [
                { key: 'a', nullable: false, type: 'number' },
                { key: 'b', nullable: false, type: 'number' },
                { key: 'c', nullable: false, type: 'number' },
                { key: 'd', nullable: false, type: 'number' },
                { key: 'f', nullable: false, type: 'number' },
            ]);
        });
        it('create string typehint', function () {
            const hint = (0, TypedConfig_1.generateDefaultOptionTypeHint)({
                a: '',
                b: 'hello'
            });
            chai_1.assert.deepEqual(hint, [
                { key: 'a', nullable: false, type: 'string' },
                { key: 'b', nullable: false, type: 'string' }
            ]);
        });
        it('create array typehint', function () {
            const hint = (0, TypedConfig_1.generateDefaultOptionTypeHint)({
                a: [],
                b: ['a'],
                c: ['a', 'b'],
                d: [1, 2, 3],
            });
            chai_1.assert.deepEqual(hint, [
                { key: 'a', nullable: false, type: 'array' },
                { key: 'b', nullable: false, type: 'array' },
                { key: 'c', nullable: false, type: 'array' },
                { key: 'd', nullable: false, type: 'array' }
            ]);
        });
        it('create nullable typehint', function () {
            const hint = (0, TypedConfig_1.generateDefaultOptionTypeHint)({
                a: null,
                b: undefined,
            });
            chai_1.assert.deepEqual(hint, [
                { key: 'a', nullable: true, type: 'number' },
                { key: 'b', nullable: true, type: 'number' },
            ]);
        });
    });
    describe('loadEnvConfigWithTypeHint', function () {
        it('load bool', function () {
            const hints = (0, TypedConfig_1.generateDefaultOptionTypeHint)({ a: false, b: true });
            const opt = (0, TypedConfig_1.loadEnvConfigWithTypeHint)('test', hints, { ahr_test_a: 'false', ahr_test_b: 'true' });
            chai_1.assert.deepEqual(opt, { a: false, b: true });
        });
        it('load extra bool', function () {
            const hints = (0, TypedConfig_1.generateDefaultOptionTypeHint)({ a: false, b: true });
            const opt = (0, TypedConfig_1.loadEnvConfigWithTypeHint)('test', hints, { ahr_test_a: 'false', ahr_test_b: 'true', ahr_test_c: 'sfd', ahr_test_d: 'safsaf' });
            chai_1.assert.deepEqual(opt, { a: false, b: true });
        });
        it('load partial bool', function () {
            const hints = (0, TypedConfig_1.generateDefaultOptionTypeHint)({ a: false, b: true });
            const opt = (0, TypedConfig_1.loadEnvConfigWithTypeHint)('test', hints, { ahr_test_a: 'false' });
            chai_1.assert.deepEqual(opt, { a: false });
        });
        it('load invalid bool', function () {
            const hints = (0, TypedConfig_1.generateDefaultOptionTypeHint)({ a: false, b: true });
            chai_1.assert.throw(() => {
                (0, TypedConfig_1.loadEnvConfigWithTypeHint)('test', hints, { ahr_test_a: 'aaa' });
            });
            chai_1.assert.throw(() => {
                (0, TypedConfig_1.loadEnvConfigWithTypeHint)('test', hints, { ahr_test_a: '' });
            });
            chai_1.assert.throw(() => {
                (0, TypedConfig_1.loadEnvConfigWithTypeHint)('test', hints, { ahr_test_a: '[]' });
            });
            chai_1.assert.throw(() => {
                (0, TypedConfig_1.loadEnvConfigWithTypeHint)('test', hints, { ahr_test_b: '100' });
            });
        });
        it('load num', function () {
            const hints = (0, TypedConfig_1.generateDefaultOptionTypeHint)({ a: 0, b: 1 });
            const opt = (0, TypedConfig_1.loadEnvConfigWithTypeHint)('test', hints, { ahr_test_a: '0', ahr_test_b: '1' });
            chai_1.assert.deepEqual(opt, { a: 0, b: 1 });
        });
        it('load float', function () {
            const hints = (0, TypedConfig_1.generateDefaultOptionTypeHint)({ a: 0, b: 1 });
            const opt = (0, TypedConfig_1.loadEnvConfigWithTypeHint)('test', hints, { ahr_test_a: '0.0125', ahr_test_b: '-0' });
            chai_1.assert.approximately(opt['a'], 0.0125, 0.001);
            chai_1.assert.approximately(opt['b'], 0, 0.001);
        });
        it('load extra num', function () {
            const hints = (0, TypedConfig_1.generateDefaultOptionTypeHint)({ a: 0, b: 1 });
            const opt = (0, TypedConfig_1.loadEnvConfigWithTypeHint)('test', hints, { ahr_test_a: '0', ahr_test_b: '1', ahr_test_c: '2', ahr_test_d: '3' });
            chai_1.assert.deepEqual(opt, { a: 0, b: 1 });
        });
        it('load partial num', function () {
            const hints = (0, TypedConfig_1.generateDefaultOptionTypeHint)({ a: 0, b: 1 });
            const opt = (0, TypedConfig_1.loadEnvConfigWithTypeHint)('test', hints, { ahr_test_a: '0' });
            chai_1.assert.deepEqual(opt, { a: 0 });
        });
        it('load invalid num', function () {
            const hints = (0, TypedConfig_1.generateDefaultOptionTypeHint)({ a: 0, b: 1 });
            chai_1.assert.throw(() => {
                (0, TypedConfig_1.loadEnvConfigWithTypeHint)('test', hints, { ahr_test_a: 'aaa' });
            });
            chai_1.assert.throw(() => {
                (0, TypedConfig_1.loadEnvConfigWithTypeHint)('test', hints, { ahr_test_a: '' });
            });
            chai_1.assert.throw(() => {
                (0, TypedConfig_1.loadEnvConfigWithTypeHint)('test', hints, { ahr_test_a: '[]' });
            });
            chai_1.assert.throw(() => {
                (0, TypedConfig_1.loadEnvConfigWithTypeHint)('test', hints, { ahr_test_b: 'NaN' });
            });
        });
        it('load string', function () {
            const hints = (0, TypedConfig_1.generateDefaultOptionTypeHint)({ a: '', b: 'aaa' });
            const opt = (0, TypedConfig_1.loadEnvConfigWithTypeHint)('test', hints, { ahr_test_a: '', ahr_test_b: 'aaa' });
            chai_1.assert.deepEqual(opt, { a: '', b: 'aaa' });
        });
        it('load extra string', function () {
            const hints = (0, TypedConfig_1.generateDefaultOptionTypeHint)({ a: '', b: 'aaa' });
            const opt = (0, TypedConfig_1.loadEnvConfigWithTypeHint)('test', hints, { ahr_test_a: '0', ahr_test_b: '1', ahr_test_c: '2', ahr_test_d: '3' });
            chai_1.assert.deepEqual(opt, { a: '0', b: '1' });
        });
        it('load partial string', function () {
            const hints = (0, TypedConfig_1.generateDefaultOptionTypeHint)({ a: '', b: 'aaa' });
            const opt = (0, TypedConfig_1.loadEnvConfigWithTypeHint)('test', hints, { ahr_test_a: '0' });
            chai_1.assert.deepEqual(opt, { a: '0' });
        });
        it('load array', function () {
            const hints = (0, TypedConfig_1.generateDefaultOptionTypeHint)({ a: [], b: ['aa', 'bb'] });
            const opt = (0, TypedConfig_1.loadEnvConfigWithTypeHint)('test', hints, { ahr_test_a: '[]', ahr_test_b: '["a", "b"]' });
            chai_1.assert.deepEqual(opt, { a: [], b: ['a', 'b'] });
        });
        it('load extra array', function () {
            const hints = (0, TypedConfig_1.generateDefaultOptionTypeHint)({ a: [], b: ['aa', 'bb'] });
            const opt = (0, TypedConfig_1.loadEnvConfigWithTypeHint)('test', hints, { ahr_test_a: '["0"]', ahr_test_b: '["1"]', ahr_test_c: '["2"]', ahr_test_d: '["3"]' });
            chai_1.assert.deepEqual(opt, { a: ['0'], b: ['1'] });
        });
        it('load partial array', function () {
            const hints = (0, TypedConfig_1.generateDefaultOptionTypeHint)({ a: [], b: ['aa', 'bb'] });
            const opt = (0, TypedConfig_1.loadEnvConfigWithTypeHint)('test', hints, { ahr_test_a: '["0"]' });
            chai_1.assert.deepEqual(opt, { a: ['0'] });
        });
        it('load invalid array', function () {
            const hints = (0, TypedConfig_1.generateDefaultOptionTypeHint)({ a: [], b: ['aa', 'bb'] });
            chai_1.assert.throw(() => {
                (0, TypedConfig_1.loadEnvConfigWithTypeHint)('test', hints, { ahr_test_a: 'aaa' });
            });
            chai_1.assert.throw(() => {
                (0, TypedConfig_1.loadEnvConfigWithTypeHint)('test', hints, { ahr_test_a: '' });
            });
            chai_1.assert.throw(() => {
                (0, TypedConfig_1.loadEnvConfigWithTypeHint)('test', hints, { ahr_test_a: '[[],[]]' });
            });
            chai_1.assert.throw(() => {
                (0, TypedConfig_1.loadEnvConfigWithTypeHint)('test', hints, { ahr_test_b: '[1,2,3,4]' });
            });
        });
    });
    describe('nullable hints', function () {
        it('declear nullable bool', function () {
            const hints = (0, TypedConfig_1.generateDefaultOptionTypeHint)({ a: false, b: false });
            hints[1].nullable = true;
            chai_1.assert.throw(() => {
                (0, TypedConfig_1.loadEnvConfigWithTypeHint)('test', hints, { ahr_test_a: 'null' });
            });
            const opt = (0, TypedConfig_1.loadEnvConfigWithTypeHint)('test', hints, { ahr_test_b: 'null' });
            chai_1.assert.deepEqual(opt, { b: null });
        });
        it('declear nullable number', function () {
            const hints = (0, TypedConfig_1.generateDefaultOptionTypeHint)({ a: 0, b: 0 });
            hints[1].nullable = true;
            chai_1.assert.throw(() => {
                (0, TypedConfig_1.loadEnvConfigWithTypeHint)('test', hints, { ahr_test_a: 'null' });
            });
            const opt = (0, TypedConfig_1.loadEnvConfigWithTypeHint)('test', hints, { ahr_test_b: 'null' });
            chai_1.assert.deepEqual(opt, { b: null });
        });
        it('declear nullable string', function () {
            const hints = (0, TypedConfig_1.generateDefaultOptionTypeHint)({ a: '', b: '' });
            hints[1].nullable = true;
            const opt = (0, TypedConfig_1.loadEnvConfigWithTypeHint)('test', hints, { ahr_test_a: 'null', ahr_test_b: 'null' });
            chai_1.assert.deepEqual(opt, { a: 'null', b: null });
        });
        it('declear nullable array', function () {
            const hints = (0, TypedConfig_1.generateDefaultOptionTypeHint)({ a: [], b: [] });
            hints[1].nullable = true;
            chai_1.assert.throw(() => {
                (0, TypedConfig_1.loadEnvConfigWithTypeHint)('test', hints, { ahr_test_a: 'null' });
            });
            const opt = (0, TypedConfig_1.loadEnvConfigWithTypeHint)('test', hints, { ahr_test_b: 'null' });
            chai_1.assert.deepEqual(opt, { b: null });
        });
    });
});
//# sourceMappingURL=TypedConfigTest.js.map