"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const common_1 = require("../common");
const logService_1 = require("./logService");
const assets_1 = require("../domain/assets");
const operations_1 = require("../domain/operations");
const params_1 = require("../domain/params");
const balances_1 = require("../domain/balances");
const history_1 = require("../domain/history");
// EOSJS has no typings, so use it as regular node module
const Eos = require("eosjs");
class EosService {
    constructor(settings, log) {
        this.settings = settings;
        this.log = log;
        this.eos = Eos({ httpEndpoint: settings.EosJob.Eos.HttpEndpoint });
        this.paramsRepository = new params_1.ParamsRepository(settings);
        this.balanceRepository = new balances_1.BalanceRepository(settings);
        this.assetRepository = new assets_1.AssetRepository(settings);
        this.operationRepository = new operations_1.OperationRepository(settings);
        this.historyRepository = new history_1.HistoryRepository(settings);
        this.logInfo = (m, c) => this.log.write(logService_1.LogLevel.info, EosService.name, this.handleActions.name, m, JSON.stringify(c));
    }
    /**
     * Tracks blockchain actions and updates operations state.
     */
    async handleActions() {
        const assets = await this.assetRepository.all();
        let params = await this.paramsRepository.get();
        if (!params) {
            params = new params_1.Params();
            params.LastProcessedBlockTimestamp = new Date(0);
            params.NextActionSequence = 0;
        }
        let last_irreversible_block = 0;
        while (true) {
            const actionResult = await this.eos.getActions(this.settings.EosJob.HotWalletAccount, params.NextActionSequence, 0);
            const action = actionResult.actions[0];
            last_irreversible_block = actionResult.last_irreversible_block;
            if (!!action && action.block_num <= actionResult.last_irreversible_block) {
                await this.logInfo("Action detected", { Account: this.settings.EosJob.HotWalletAccount, Seq: action.account_action_seq });
                const transfer = action.action_trace.act.name == "transfer" && action.action_trace.act.data;
                if (!!transfer) {
                    // set operation state to completed, if any
                    const operationId = await this.operationRepository.updateCompleted(action.action_trace.trx_id, new Date(), common_1.isoUTC(action.block_time), action.block_num);
                    // get amount and asset
                    const parts = transfer.quantity.split(" ", 2);
                    const value = parseFloat(parts[0]);
                    const asset = assets.find(a => a.AssetId == parts[1]);
                    if (!!asset) {
                        const to = !!transfer.memo
                            ? transfer.to + common_1.ADDRESS_SEPARATOR + transfer.memo
                            : transfer.to;
                        // record history
                        await this.historyRepository.upsert(transfer.from, to, value, asset, action.block_num, action.action_trace.trx_id, action.action_trace.receipt.act_digest);
                        await this.logInfo("Transfer recorded", transfer);
                        // update balance of deposit wallet
                        if (transfer.to == this.settings.EosJob.HotWalletAccount && !!transfer.memo) {
                            const balance = await this.balanceRepository.upsert(to, asset, value);
                            await this.logInfo("Balance updated", { Address: to, Affix: value, Asset: asset.AssetId, FinalBalance: balance });
                        }
                    }
                    else {
                        await this.logInfo("Not tracked token", parts[1]);
                    }
                }
                else {
                    await this.logInfo("Not a transfer", action.action_trace.act.name);
                }
                params.NextActionSequence++;
                await this.paramsRepository.upsert(params);
            }
            else {
                break;
            }
        }
        // update expired operations (mark as failed)
        const block = await this.eos.getBlock(last_irreversible_block);
        const blockTime = common_1.isoUTC(block.timestamp);
        await this.operationRepository.updateExpired(params.LastProcessedBlockTimestamp, blockTime);
        // update state
        params.LastProcessedBlockTimestamp = blockTime;
        await this.paramsRepository.upsert(params);
    }
}
exports.EosService = EosService;
//# sourceMappingURL=eosService.js.map