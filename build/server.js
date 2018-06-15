"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
}
Object.defineProperty(exports, "__esModule", { value: true });
const koa_1 = __importDefault(require("koa"));
const interval_promise_1 = __importDefault(require("interval-promise"));
const common_1 = require("./common");
const logService_1 = require("./services/logService");
const eosService_1 = require("./services/eosService");
const jsonMime = "application/json; charset=utf-8";
common_1.loadSettings()
    .then(settings => {
    const log = new logService_1.LogService(settings);
    const eos = new eosService_1.EosService(settings, log);
    const koa = new koa_1.default();
    // error handling middleware
    koa.use(async (ctx, next) => {
        try {
            await next();
        }
        catch (err) {
            // TODO: read and parse request body to log as context
            // log error
            await log.write(err.status && err.status < 500 ? logService_1.LogLevel.warning : logService_1.LogLevel.error, "Lykke.Job.Eos", ctx.url, err.message, undefined, err.name, err.stack);
            // return error info to client
            ctx.status = err.status || 500;
            ctx.type = jsonMime;
            ctx.body = JSON.stringify({ errorMessage: err.message });
        }
    });
    // GET /api/isalive
    koa.use(async (ctx, next) => {
        if (ctx.URL.pathname.toLowerCase() !== "/api/isalive") {
            ctx.throw(404);
        }
        else {
            ctx.type = jsonMime;
            ctx.body = JSON.stringify({
                name: common_1.APP_NAME,
                version: common_1.APP_VERSION,
                env: common_1.ENV_INFO
            });
        }
        throw new Error("qwe");
    });
    // start http server
    koa.listen(5000);
    // start job
    interval_promise_1.default(async () => {
        try {
            eos.handleActions();
        }
        catch (err) {
            await log.write(logService_1.LogLevel.error, "Lykke.Job.Eos", "HandleActions", err.message, undefined, err.name, err.stack);
        }
    }, settings.EosApi.Interval, { stopOnError: false });
})
    .then(_ => console.log("Started"), e => console.log(e));
//# sourceMappingURL=server.js.map