import fs from "fs";
import { randomBytes } from "node:crypto";
export const inBrowser = typeof fs.readFileSync !== "function" && typeof randomBytes !== "function";
export const label = "ok";
