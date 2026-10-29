// Stand-in for Next's vendored React canary: the project's React plus the canary-only APIs the app router has.
const React = require("../../../../react");
module.exports = { ...React, cache: (fn) => fn, __vendored: true };
