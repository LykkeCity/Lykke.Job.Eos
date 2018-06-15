"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
}
Object.defineProperty(exports, "__esModule", { value: true });
const common_1 = require("../common");
const axios_1 = __importDefault(require("axios"));
var LogLevel;
(function (LogLevel) {
    LogLevel["error"] = "error";
    LogLevel["warning"] = "warning";
    LogLevel["info"] = "info";
})(LogLevel = exports.LogLevel || (exports.LogLevel = {}));
class LogService {
    constructor(settings) {
        this.settings = settings;
    }
    /**
     * Writes log entry to all configured stores (console by default).
     *
     * @param level Log level - `error | warning | info`
     * @param component Component or class or file name
     * @param process Process or method name
     * @param message Event description
     * @param context Event additional data
     * @param type Type of error if any
     * @param stack Stack trace of error if any
     */
    async write(level, component, process, message, context, type, stack) {
        console.log(`${new Date().toISOString()} [${level}] ${component} : ${process} : ${message} : ${stack} : ${context}`);
        if (!!this.settings.EosApi &&
            !!this.settings.EosApi.LogAdapterUrl) {
            try {
                await axios_1.default.post(this.settings.EosApi.LogAdapterUrl, {
                    appName: common_1.APP_NAME,
                    appVersion: common_1.APP_VERSION,
                    envInfo: common_1.ENV_INFO,
                    level,
                    component,
                    process,
                    context,
                    message,
                    callstack: stack,
                    exceptionType: type,
                    additionalSlackChannels: this.settings.EosApi.LogSlackChannels
                });
            }
            catch (err) {
                console.warn("LogAdapter is configured, but throws error:");
                console.warn(err);
            }
        }
    }
}
exports.LogService = LogService;
//# sourceMappingURL=logService.js.map