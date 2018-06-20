"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const common_1 = require("../common");
const assets_1 = require("../domain/assets");
const operations_1 = require("../domain/operations");
const params_1 = require("../domain/params");
const balances_1 = require("../domain/balances");
const history_1 = require("../domain/history");
class ActionsResult {
}
exports.ActionsResult = ActionsResult;
// EOSJS has no typings, so use it as regular node module
const Eos = require("eosjs");
class EosService {
    constructor(settings, log) {
        this.settings = settings;
        this.log = log;
        this.eos = Eos({ httpEndpoint: settings.EosApi.Eos.HttpEndpoint });
        this.paramsRepository = new params_1.ParamsRepository(settings);
        this.balanceRepository = new balances_1.BalanceRepository(settings);
        this.assetRepository = new assets_1.AssetRepository(settings);
        this.operationRepository = new operations_1.OperationRepository(settings);
        this.historyRepository = new history_1.HistoryRepository(settings);
    }
    /**
     * Tracks blockchain actions and updates operations state.
     */
    async handleActions() {
        const assets = await this.assetRepository.all();
        const parameters = (await this.paramsRepository.get()) || { nextActionSequence: 0, lastProcessedBlockTimestamp: new Date(0) };
        let last_irreversible_block = 0;
        while (true) {
            const actionResult = await this.eos.getActions(this.settings.EosApi.HotWalletAccount, parameters.nextActionSequence, 0);
            const action = actionResult.actions[0];
            last_irreversible_block = actionResult.last_irreversible_block;
            if (!!action && action.block_num <= actionResult.last_irreversible_block) {
                const transfer = action.action_trace.act.name == "transfer" && action.action_trace.act.data;
                if (!!transfer) {
                    // set operation state to completed, if any
                    const operationId = await this.operationRepository.updateCompleted(action.action_trace.trx_id, new Date(), action.block_time, action.block_num);
                    // get amount and asset
                    const parts = transfer.quantity.split(" ", 2);
                    const value = parseFloat(parts[0]);
                    const asset = assets.find(a => a.assetId == parts[1]);
                    if (!!asset) {
                        const to = !!transfer.memo
                            ? transfer.to + common_1.ADDRESS_SEPARATOR + transfer.memo
                            : transfer.to;
                        // record history
                        await this.historyRepository.upsert(transfer.from, to, value, asset, action.block_num, action.action_trace.trx_id, action.action_trace.receipt.act_digest);
                        // update balance of deposit wallet
                        if (transfer.to == this.settings.EosApi.HotWalletAccount && transfer.memo) {
                            this.balanceRepository.upsert(to, asset, value);
                        }
                    }
                }
                parameters.nextActionSequence++;
            }
            else {
                break;
            }
        }
        // update expired operations (mark as failed)
        const block = await this.eos.getBlock(last_irreversible_block);
        await this.operationRepository.updateExpired(parameters.lastProcessedBlockTimestamp, block.timestamp);
        // update state
        parameters.lastProcessedBlockTimestamp = block.timestamp;
        await this.paramsRepository.upsert(parameters);
    }
}
exports.EosService = EosService;
//# sourceMappingURL=eosService.js.map