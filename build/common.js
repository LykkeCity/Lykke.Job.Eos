"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
}
Object.defineProperty(exports, "__esModule", { value: true });
const axios_1 = __importDefault(require("axios"));
const fs_1 = __importDefault(require("fs"));
const util_1 = __importDefault(require("util"));
const pkg = require("../package.json");
exports.APP_NAME = pkg.name.split(".").map((x) => `${x.charAt(0).toUpperCase()}${x.slice(1)}`).join(".");
exports.APP_VERSION = pkg.version;
exports.ENV_INFO = process.env.ENV_INFO;
exports.ADDRESS_SEPARATOR = "$";
var Encoding;
(function (Encoding) {
    Encoding["base64"] = "base64";
    Encoding["utf8"] = "utf8";
})(Encoding = exports.Encoding || (exports.Encoding = {}));
;
/**
 * Serializes object to JSON and then encodes result to base64
 * @param obj Object to serialize to JSON and encode to base64
 */
function toBase64(obj) {
    return Buffer.from(JSON.stringify(obj)).toString(Encoding.base64);
}
exports.toBase64 = toBase64;
/**
 * Converts base64 string to JSON and then parses result to `T`
 * @param str String in base64 encoding
 */
function fromBase64(str) {
    return JSON.parse(Buffer.from(str, Encoding.base64).toString(Encoding.utf8));
}
exports.fromBase64 = fromBase64;
/**
 * Application settings.
 * Defined as `class` instead of `interface` to make DI easier (no need of Token<Service>)
 */
class Settings {
}
exports.Settings = Settings;
/**
 * Loads application settings from file or URL as specified in `SettingsUrl` environment variable.
 */
async function loadSettings() {
    if (process.env.SettingsUrl.startsWith("http")) {
        return (await axios_1.default.get(process.env.SettingsUrl)).data;
    }
    else {
        return JSON.parse(await util_1.default.promisify(fs_1.default.readFile)(process.env.SettingsUrl, Encoding.utf8));
    }
}
exports.loadSettings = loadSettings;
//# sourceMappingURL=common.js.map