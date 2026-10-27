"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const React = require("react");
exports.Greeting = function Greeting({ name }) { const [p] = React.useState("!"); return "Hello " + name + p; };
exports.shout = function shout(s) { return s.toUpperCase(); };
