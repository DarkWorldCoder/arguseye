// Stand-in for the buffer polyfill Next vendors: compiled by ncc, so it reads `__dirname` and `global` while loading.
(function () {
  var __nccwpck_require__ = {};
  __nccwpck_require__.ab = __dirname + "/";
  var root = global;
  class Buffer extends Uint8Array {
    static from(text) { return new Buffer(new TextEncoder().encode(String(text))); }
    toString() { return new TextDecoder().decode(this) + (root === globalThis ? " via next" : ""); }
  }
  module.exports = { Buffer: Buffer };
})();
