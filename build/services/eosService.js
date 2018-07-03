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
    constructor(settings, logService) {
        this.settings = settings;
        this.logService = logService;
        this.eos = Eos({ httpEndpoint: settings.EosJob.Eos.HttpEndpoint });
        this.paramsRepository = new params_1.ParamsRepository(settings);
        this.balanceRepository = new balances_1.BalanceRepository(settings);
        this.assetRepository = new assets_1.AssetRepository(settings);
        this.operationRepository = new operations_1.OperationRepository(settings);
        this.historyRepository = new history_1.HistoryRepository(settings);
        this.log = (l, m, c) => this.logService.write(l, EosService.name, this.handleActions.name, m, JSON.stringify(c));
    }
    async handleActions() {
        const params = await this.paramsRepository.get();
        let nextActionSequence = (params && params.NextActionSequence) || 0;
        let lastIrreversibleBlock = 0;
        while (true) {
            const actionResult = await this.eos.getActions(this.settings.EosJob.HotWalletAccount, nextActionSequence, 0);
            const action = actionResult.actions[0];
            lastIrreversibleBlock = actionResult.last_irreversible_block;
            if (!!action && action.block_num <= actionResult.last_irreversible_block) {
                await this.log(logService_1.LogLevel.info, "Action detected", {
                    Account: this.settings.EosJob.HotWalletAccount,
                    Seq: action.account_action_seq
                });
                const transfer = action.action_trace.act.name == "transfer" && action.action_trace.act.data;
                const block = action.block_num;
                const blockTime = common_1.isoUTC(action.block_time);
                const txId = action.action_trace.trx_id;
                const actionId = action.action_trace.receipt.act_digest;
                if (!!transfer) {
                    // set operation state to completed, if any
                    const operationId = await this.operationRepository.getOperationIdByTxId(txId);
                    if (!!operationId) {
                        await this.operationRepository.update(operationId, { completionTime: new Date(), blockTime, block });
                    }
                    // get amount and asset
                    const parts = transfer.quantity.split(" ", 2);
                    const value = parseFloat(parts[0]);
                    const asset = await this.assetRepository.get(parts[1]);
                    if (!!asset) {
                        const assetId = asset.AssetId;
                        const valueInBaseUnit = asset.toBaseUnit(value);
                        const to = !!transfer.memo
                            ? transfer.to + common_1.ADDRESS_SEPARATOR + transfer.memo
                            : transfer.to;
                        // record history
                        await this.historyRepository.upsert(transfer.from, to, assetId, value, valueInBaseUnit, block, blockTime, txId, actionId, operationId);
                        await this.log(logService_1.LogLevel.info, "Transfer recorded", transfer);
                        // external operations can affect balances (internal are already accounted)
                        if (!operationId) {
                            const balanceChanges = [
                                { address: transfer.from, affix: -value, affixInBaseUnit: -valueInBaseUnit },
                                { address: to, affix: value, affixInBaseUnit: valueInBaseUnit }
                            ];
                            for (const bc of balanceChanges) {
                                await this.balanceRepository.upsert(bc.address, assetId, txId, bc.affix, bc.affixInBaseUnit);
                                await this.log(logService_1.LogLevel.info, "Balance change recorded", Object.assign({}, bc, { assetId, txId }));
                            }
                        }
                    }
                    else {
                        await this.log(logService_1.LogLevel.warning, "Not tracked token", parts[1]);
                    }
                }
                else {
                    await this.log(logService_1.LogLevel.warning, "Not a transfer", action.action_trace.act.name);
                }
                // increment counter to fetch next action
                nextActionSequence++;
                // update state
                await this.paramsRepository.upsert({
                    nextActionSequence: nextActionSequence
                });
            }
            else {
                break;
            }
        }
        return lastIrreversibleBlock;
    }
    async handleExpired(lastActionIrreversibleBlockNumber) {
        // some actions may come after handleActions() and before handleExpired() calling,
        // such operations will be wrongly marked as failed if we get last irreversible block from getInfo() here,
        // that's why we must use last irreversible block from getActions()
        const params = await this.paramsRepository.get();
        const lastProcessedIrreversibleBlockTime = (params && params.LastProcessedIrreversibleBlockTime) || new Date(0);
        const lastActionIrreversibleBlock = (await this.eos.getBlock(lastActionIrreversibleBlockNumber));
        const lastActionIrreversibleBlockTime = common_1.isoUTC(lastActionIrreversibleBlock.timestamp);
        // mark expired operations as failed, if any
        const presumablyExpired = await this.operationRepository.geOperationIdByExpiryTime(lastProcessedIrreversibleBlockTime, lastActionIrreversibleBlockTime);
        for (let i = 0; i < presumablyExpired.length; i++) {
            const operation = await this.operationRepository.get(presumablyExpired[i]);
            if (!!operation && !operation.isCompleted() && !operation.isFailed()) {
                const operationId = operation.OperationId;
                const assetId = operation.AssetId;
                // mark operation as failed
                await this.operationRepository.update(operationId, {
                    failTime: new Date(),
                    error: "Transaction expired"
                });
                // reverse balances changes
                const actions = await this.operationRepository.getActions(operationId);
                for (const action of actions) {
                    for (const address of [action.FromAddress, action.ToAddress]) {
                        await this.balanceRepository.update(address, assetId, operationId, { isCancelled: true });
                        await this.log(logService_1.LogLevel.info, "Balance change cancelled", {
                            address, assetId, operationId
                        });
                    }
                }
            }
        }
        // update state
        await this.paramsRepository.upsert({
            lastProcessedIrreversibleBlockTime: lastActionIrreversibleBlockTime
        });
    }
}
exports.EosService = EosService;
//# sourceMappingURL=eosService.js.map