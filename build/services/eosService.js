"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const common_1 = require("../common");
const params_1 = require("../domain/params");
class ActionsResult {
}
exports.ActionsResult = ActionsResult;
// EOSJS has no typings, so use it as regular node module
const Eos = require("eosjs");
class EosService {
    constructor(settings, log) {
        this.settings = settings;
        this.log = log;
        this.eos = Eos.Localnet({ httpEndpoint: settings.EosApi.Eos.HttpEndpoint });
        this.paramsRepository = new params_1.ParamsRepository(settings);
    }
    isFake(item) {
        return item.from.indexOf(common_1.ADDRESS_SEPARATOR) >= 0 || item.to.indexOf(common_1.ADDRESS_SEPARATOR) >= 0;
    }
    async handleActions() {
        let params = (await this.paramsRepository.get()) || { nextActionSequence: 0 };
        console.log(params.nextActionSequence);
        while (true) {
            let data = await this.eos.getActions(this.settings.EosApi.HotWalletAccount, params.nextActionSequence, 0);
            if (data &&
                data.actions &&
                data.actions.length &&
                data.actions[0].block_num <= data.last_irreversible_block) {
                let transfer = data.actions[0].action_trace.act.name == "transfer" &&
                    data.actions[0].action_trace.act.data;
                if (transfer) {
                    // TODO: write history
                    if (transfer.to == this.settings.EosApi.HotWalletAccount && transfer.memo) {
                        // TODO: write balnce record of "this.settings.EosApi.HotWalletAccount$${data.actions[0].action_trace.act.data.memo}"
                    }
                }
                // increment processed action number
                params.nextActionSequence++;
                await this.paramsRepository.update(params.nextActionSequence);
            }
            else {
                return;
            }
        }
    }
}
exports.EosService = EosService;
//# sourceMappingURL=eosService.js.map