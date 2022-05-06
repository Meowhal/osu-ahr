import { assert } from 'chai';
import { CONFIG_OPTION, generateDefaultOptionTypeHint, loadEnvConfigWithTypeHint } from '../TypedConfig';

describe('TypedConfigTests', function () {
  let CONFIG_OPTION_USE_ENV_DEFAULT = false;
  before(function () {
    CONFIG_OPTION_USE_ENV_DEFAULT = CONFIG_OPTION.USE_ENV;
    CONFIG_OPTION.USE_ENV = false;
  });
  after(function () {
    CONFIG_OPTION.USE_ENV = CONFIG_OPTION_USE_ENV_DEFAULT;
  });

  describe('generateDefaultOptionTypeHint tests', function () {
    it('create boolean hints', function () {
      const hint = generateDefaultOptionTypeHint({
        a: false,
        b: true
      });
      assert.deepEqual(hint, [
        { key: 'a', nullable: false, type: 'boolean' },
        { key: 'b', nullable: false, type: 'boolean' }
      ]);
    });
    it('create number typehint', function () {
      const hint = generateDefaultOptionTypeHint({
        a: 0,
        b: 1,
        c: 0xffffffff,
        d: Number.POSITIVE_INFINITY,
        f: Number.NaN,
      });
      assert.deepEqual(hint, [
        { key: 'a', nullable: false, type: 'number' },
        { key: 'b', nullable: false, type: 'number' },
        { key: 'c', nullable: false, type: 'number' },
        { key: 'd', nullable: false, type: 'number' },
        { key: 'f', nullable: false, type: 'number' },
      ]);
    });
    it('create string typehint', function () {
      const hint = generateDefaultOptionTypeHint({
        a: '',
        b: 'hello'
      });
      assert.deepEqual(hint, [
        { key: 'a', nullable: false, type: 'string' },
        { key: 'b', nullable: false, type: 'string' }
      ]);
    });
    it('create array typehint', function () {
      const hint = generateDefaultOptionTypeHint({
        a: [],
        b: ['a'],
        c: ['a', 'b'],
        d: [1, 2, 3],
      });
      assert.deepEqual(hint, [
        { key: 'a', nullable: false, type: 'array' },
        { key: 'b', nullable: false, type: 'array' },
        { key: 'c', nullable: false, type: 'array' },
        { key: 'd', nullable: false, type: 'array' }
      ]);
    });
    it('create nullable typehint', function () {
      const hint = generateDefaultOptionTypeHint({
        a: null,
        b: undefined,
      });
      assert.deepEqual(hint, [
        { key: 'a', nullable: true, type: 'number' },
        { key: 'b', nullable: true, type: 'number' },
      ]);
    });
  });

  describe('loadEnvConfigWithTypeHint', function () {
    it('load bool', function () {
      const hints = generateDefaultOptionTypeHint({ a: false, b: true });
      const opt = loadEnvConfigWithTypeHint('test', hints, { ahr_test_a: 'false', ahr_test_b: 'true' });
      assert.deepEqual(opt, { a: false, b: true });
    });
    it('load extra bool', function () {
      const hints = generateDefaultOptionTypeHint({ a: false, b: true });
      const opt = loadEnvConfigWithTypeHint('test', hints, { ahr_test_a: 'false', ahr_test_b: 'true', ahr_test_c: 'sfd', ahr_test_d: 'safsaf' });
      assert.deepEqual(opt, { a: false, b: true });
    });
    it('load partial bool', function () {
      const hints = generateDefaultOptionTypeHint({ a: false, b: true });
      const opt = loadEnvConfigWithTypeHint('test', hints, { ahr_test_a: 'false' });
      assert.deepEqual(opt, { a: false });
    });
    it('load invalid bool', function () {
      const hints = generateDefaultOptionTypeHint({ a: false, b: true });
      assert.throw(() => {
        loadEnvConfigWithTypeHint('test', hints, { ahr_test_a: 'aaa' });
      });
      assert.throw(() => {
        loadEnvConfigWithTypeHint('test', hints, { ahr_test_a: '' });
      });
      assert.throw(() => {
        loadEnvConfigWithTypeHint('test', hints, { ahr_test_a: '[]' });
      });
      assert.throw(() => {
        loadEnvConfigWithTypeHint('test', hints, { ahr_test_b: '100' });
      });
    });
    it('load num', function () {
      const hints = generateDefaultOptionTypeHint({ a: 0, b: 1 });
      const opt = loadEnvConfigWithTypeHint('test', hints, { ahr_test_a: '0', ahr_test_b: '1' });
      assert.deepEqual(opt, { a: 0, b: 1 });
    });
    it('load float', function () {
      const hints = generateDefaultOptionTypeHint({ a: 0, b: 1 });
      const opt = loadEnvConfigWithTypeHint('test', hints, { ahr_test_a: '0.0125', ahr_test_b: '-0' });
      assert.approximately(opt['a'] as number, 0.0125, 0.001);
      assert.approximately(opt['b'] as number, 0, 0.001);
    });
    it('load extra num', function () {
      const hints = generateDefaultOptionTypeHint({ a: 0, b: 1 });
      const opt = loadEnvConfigWithTypeHint('test', hints, { ahr_test_a: '0', ahr_test_b: '1', ahr_test_c: '2', ahr_test_d: '3' });
      assert.deepEqual(opt, { a: 0, b: 1 });
    });
    it('load partial num', function () {
      const hints = generateDefaultOptionTypeHint({ a: 0, b: 1 });
      const opt = loadEnvConfigWithTypeHint('test', hints, { ahr_test_a: '0' });
      assert.deepEqual(opt, { a: 0 });
    });
    it('load invalid num', function () {
      const hints = generateDefaultOptionTypeHint({ a: 0, b: 1 });
      assert.throw(() => {
        loadEnvConfigWithTypeHint('test', hints, { ahr_test_a: 'aaa' });
      });
      assert.throw(() => {
        loadEnvConfigWithTypeHint('test', hints, { ahr_test_a: '' });
      });
      assert.throw(() => {
        loadEnvConfigWithTypeHint('test', hints, { ahr_test_a: '[]' });
      });
      assert.throw(() => {
        loadEnvConfigWithTypeHint('test', hints, { ahr_test_b: 'NaN' });
      });
    });
    it('load string', function () {
      const hints = generateDefaultOptionTypeHint({ a: '', b: 'aaa' });
      const opt = loadEnvConfigWithTypeHint('test', hints, { ahr_test_a: '', ahr_test_b: 'aaa' });
      assert.deepEqual(opt, { a: '', b: 'aaa' });
    });
    it('load extra string', function () {
      const hints = generateDefaultOptionTypeHint({ a: '', b: 'aaa' });
      const opt = loadEnvConfigWithTypeHint('test', hints, { ahr_test_a: '0', ahr_test_b: '1', ahr_test_c: '2', ahr_test_d: '3' });
      assert.deepEqual(opt, { a: '0', b: '1' });
    });
    it('load partial string', function () {
      const hints = generateDefaultOptionTypeHint({ a: '', b: 'aaa' });
      const opt = loadEnvConfigWithTypeHint('test', hints, { ahr_test_a: '0' });
      assert.deepEqual(opt, { a: '0' });
    });
    it('load array', function () {
      const hints = generateDefaultOptionTypeHint({ a: [], b: ['aa', 'bb'] });
      const opt = loadEnvConfigWithTypeHint('test', hints, { ahr_test_a: '[]', ahr_test_b: '["a", "b"]' });
      assert.deepEqual(opt, { a: [], b: ['a', 'b'] });
    });
    it('load extra array', function () {
      const hints = generateDefaultOptionTypeHint({ a: [], b: ['aa', 'bb'] });
      const opt = loadEnvConfigWithTypeHint('test', hints, { ahr_test_a: '["0"]', ahr_test_b: '["1"]', ahr_test_c: '["2"]', ahr_test_d: '["3"]' });
      assert.deepEqual(opt, { a: ['0'], b: ['1'] });
    });
    it('load partial array', function () {
      const hints = generateDefaultOptionTypeHint({ a: [], b: ['aa', 'bb'] });
      const opt = loadEnvConfigWithTypeHint('test', hints, { ahr_test_a: '["0"]' });
      assert.deepEqual(opt, { a: ['0'] });
    });
    it('load invalid array', function () {
      const hints = generateDefaultOptionTypeHint({ a: [], b: ['aa', 'bb'] });
      assert.throw(() => {
        loadEnvConfigWithTypeHint('test', hints, { ahr_test_a: 'aaa' });
      });
      assert.throw(() => {
        loadEnvConfigWithTypeHint('test', hints, { ahr_test_a: '' });
      });
      assert.throw(() => {
        loadEnvConfigWithTypeHint('test', hints, { ahr_test_a: '[[],[]]' });
      });
      assert.throw(() => {
        loadEnvConfigWithTypeHint('test', hints, { ahr_test_b: '[1,2,3,4]' });
      });
    });
  });
  describe('nullable hints', function () {
    it('declear nullable bool', function () {
      const hints = generateDefaultOptionTypeHint({ a: false, b: false });
      hints[1].nullable = true;
      assert.throw(() => {
        loadEnvConfigWithTypeHint('test', hints, { ahr_test_a: 'null' });
      });
      const opt = loadEnvConfigWithTypeHint('test', hints, { ahr_test_b: 'null' });
      assert.deepEqual(opt, { b: null });
    });
    it('declear nullable number', function () {
      const hints = generateDefaultOptionTypeHint({ a: 0, b: 0 });
      hints[1].nullable = true;
      assert.throw(() => {
        loadEnvConfigWithTypeHint('test', hints, { ahr_test_a: 'null' });
      });
      const opt = loadEnvConfigWithTypeHint('test', hints, { ahr_test_b: 'null' });
      assert.deepEqual(opt, { b: null });
    });
    it('declear nullable string', function () {
      const hints = generateDefaultOptionTypeHint({ a: '', b: '' });
      hints[1].nullable = true;
      const opt = loadEnvConfigWithTypeHint('test', hints, { ahr_test_a: 'null', ahr_test_b: 'null' });
      assert.deepEqual(opt, { a: 'null', b: null });
    });
    it('declear nullable array', function () {
      const hints = generateDefaultOptionTypeHint({ a: [], b: [] });
      hints[1].nullable = true;
      assert.throw(() => {
        loadEnvConfigWithTypeHint('test', hints, { ahr_test_a: 'null' });
      });
      const opt = loadEnvConfigWithTypeHint('test', hints, { ahr_test_b: 'null' });
      assert.deepEqual(opt, { b: null });
    });
  });
});