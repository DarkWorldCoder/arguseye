// Like jsonwebtoken (through safe-buffer): reaches Node's Buffer while loading, imported and as a global.
var Imported = require("buffer").Buffer;
exports.imported = Imported.from("imported").toString();
exports.viaGlobal = Buffer.from("global").toString();
