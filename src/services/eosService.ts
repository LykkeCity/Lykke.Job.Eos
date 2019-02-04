import { Settings, ADDRESS_SEPARATOR, isoUTC, isUuid } from "../common";
import { LogService, LogLevel } from "./logService";
import { AssetRepository } from "../domain/assets";
import { OperationRepository, ErrorCode } from "../domain/operations";
import { ParamsRepository, ParamsEntity } from "../domain/params";
import { BalanceRepository } from "../domain/balances";
import { HistoryRepository } from "../domain/history";

export interface ActionsResult {
    actions: {
        account_action_seq: number;
        action_trace: {
            act: {
                account: string;
                name: string;
                data: {
                    from: string;
                    to: string;
                    quantity: string;
                    memo: string;
                };
            };
            receipt: {
                receiver: string;
                act_digest: string;
                global_sequence: number;
            };
            trx_id: string;
        };
        block_num: number;
        block_time: string;
    }[];
    last_irreversible_block: number;
}

export interface Block {
    timestamp: string;
    block_num: number;
}

// EOSJS has no typings, so use it as regular node module
const Eos = require("eosjs");

export class EosService {

    private eos: any;
    private paramsRepository: ParamsRepository;
    private balanceRepository: BalanceRepository;
    private assetRepository: AssetRepository;
    private operationRepository: OperationRepository;
    private historyRepository: HistoryRepository;
    private log: (level: LogLevel, message: string, context?: any) => Promise<void>;

    constructor(private settings: Settings, private logService: LogService) {
        this.eos = Eos({ httpEndpoint: settings.EosJob.Eos.HttpEndpoint });
        this.paramsRepository = new ParamsRepository(settings);
        this.balanceRepository = new BalanceRepository(settings);
        this.assetRepository = new AssetRepository(settings);
        this.operationRepository = new OperationRepository(settings);
        this.historyRepository = new HistoryRepository(settings);
        this.log = (l, m, c) => this.logService.write(l, EosService.name, this.handleActions.name, m, JSON.stringify(c));
    }

    async handleActions(): Promise<number> {
        const operationsCache: string[] = [];
        const params = await this.paramsRepository.get();

        let nextActionSequence = (params && params.NextActionSequence) || 0;
        let lastIrreversibleBlock = 0;

        while (true) {
            const actionResult: ActionsResult = await this.eos.getActions(this.settings.EosJob.HotWalletAccount, nextActionSequence, 0);
            const action = actionResult.actions[0];

            lastIrreversibleBlock = actionResult.last_irreversible_block;

            if (!!action && action.block_num <= actionResult.last_irreversible_block) {

                await this.log(LogLevel.info, "Action detected", {
                    Account: this.settings.EosJob.HotWalletAccount,
                    Seq: action.account_action_seq
                });

                if (action.action_trace.receipt.receiver == this.settings.EosJob.HotWalletAccount) {

                    const transfer = action.action_trace.act.name == "transfer" && action.action_trace.act.data;
                    const block = action.block_num * 10;
                    const blockTime = isoUTC(action.block_time);
                    const txId = action.action_trace.trx_id;

                    // act_digest is identical for identical actions;
                    // if such actions are added to the same transaction
                    // then we can not distinguish them by digest,
                    // so use global action sequence number as action ID,
                    // on re-processing history transparently megrate
                    // old records to new format
                    const actionId = action.action_trace.receipt.global_sequence.toFixed();
                    const legacyActionId = action.action_trace.receipt.act_digest;

                    if (!!transfer) {
                        const operationId = await this.operationRepository.getOperationIdByTxId(txId);
                        if (!!operationId) {

                            // this is our operation, so use our data
                            // to record balance changes and history

                            // do not update operation multiple times (by every action)
                            if (operationsCache.indexOf(operationId) < 0) {
                                const operationActions = await this.operationRepository.getActions(operationId);
                                const operation = await this.operationRepository.get(operationId);

                                for (const action of operationActions) {
                                    // record balance changes
                                    const balanceChanges = [
                                        { address: action.FromAddress, affix: -action.Amount, affixInBaseUnit: -action.AmountInBaseUnit },
                                        { address: action.ToAddress, affix: action.Amount, affixInBaseUnit: action.AmountInBaseUnit }
                                    ];
                                    for (const bc of balanceChanges) {
                                        await this.balanceRepository.upsert(bc.address, operation.AssetId, operationId, action.RowKey, bc.affix, bc.affixInBaseUnit, block);
                                        await this.log(LogLevel.info, "Balance change recorded", {
                                            ...bc, assetId: operation.AssetId, txId
                                        });
                                    }

                                    // upsert history of operation action
                                    await this.historyRepository.upsert(action.FromAddress, action.ToAddress, operation.AssetId, action.Amount, action.AmountInBaseUnit,
                                        block, blockTime, txId, action.RowKey, operationId);
                                }

                                // set operation state to completed
                                await this.operationRepository.update(operationId, { completionTime: new Date(), blockTime, block });

                                // add operation to cache
                                operationsCache.push(operationId);
                            } else {
                                await this.log(LogLevel.info, "Operation already processed", operationId);
                            }
                        } else {

                            // this is external transaction, so use blockchain
                            // data to record balance changes and history

                            // get amount and asset
                            const parts = transfer.quantity.split(" ", 2);
                            const value = parseFloat(parts[0]);
                            const asset = await this.assetRepository.get(parts[1]);

                            if (!!asset && asset.Address == action.action_trace.act.account) {
                                const assetId = asset.AssetId;
                                const valueInBaseUnit = asset.toBaseUnit(value);
                                const to = !!transfer.memo && isUuid(transfer.memo) // check if destination is deposit wallet
                                    ? transfer.to + ADDRESS_SEPARATOR + transfer.memo
                                    : transfer.to;

                                // record history
                                await this.historyRepository.upsert(transfer.from, to, assetId, value, valueInBaseUnit, block, blockTime, txId, actionId, operationId, legacyActionId);
                                await this.log(LogLevel.info, "Transfer recorded", transfer);

                                // record balance changes
                                const balanceChanges = [
                                    { address: transfer.from, affix: -value, affixInBaseUnit: -valueInBaseUnit },
                                    { address: to, affix: value, affixInBaseUnit: valueInBaseUnit }
                                ];
                                for (const bc of balanceChanges) {
                                    await this.balanceRepository.upsert(bc.address, assetId, txId, actionId, bc.affix, bc.affixInBaseUnit, block);
                                    await this.log(LogLevel.info, "Balance change recorded", {
                                        ...bc, assetId, txId
                                    });
                                }
                            } else {
                                await this.log(LogLevel.warning, "Not tracked token", {
                                    account: action.action_trace.act.account,
                                    token: parts[1],
                                });
                            }
                        }
                    } else {
                        await this.log(LogLevel.warning, "Not a transfer", action.action_trace.act.name);
                    }
                } else {
                    await this.log(LogLevel.info, "Not tracked receipt receiver", action.action_trace.receipt.receiver);
                }

                // increment counter to fetch next action
                nextActionSequence++;

                // update state
                await this.paramsRepository.upsert({
                    nextActionSequence: nextActionSequence
                });
            } else {
                break;
            }
        }

        return lastIrreversibleBlock;
    }

    async handleExpired(lastActionIrreversibleBlockNumber: number) {

        // some actions may come after handleActions() and before handleExpired() calling,
        // such operations will be wrongly marked as failed if we get last irreversible block from getInfo() here,
        // that's why we must use last irreversible block from getActions()

        const params = await this.paramsRepository.get();
        const lastProcessedIrreversibleBlockTime = (params && params.LastProcessedIrreversibleBlockTime) || new Date(0);
        const lastActionIrreversibleBlock = (await this.eos.getBlock(lastActionIrreversibleBlockNumber)) as Block;
        const lastActionIrreversibleBlockTime = isoUTC(lastActionIrreversibleBlock.timestamp);

        // mark expired operations as failed, if any

        const presumablyExpired = await this.operationRepository.geOperationIdByExpiryTime(lastProcessedIrreversibleBlockTime, lastActionIrreversibleBlockTime);

        for (let i = 0; i < presumablyExpired.length; i++) {
            const operation = await this.operationRepository.get(presumablyExpired[i])
            if (!!operation && !operation.isCompleted() && !operation.isFailed()) {
                await this.log(LogLevel.warning, "Transaction expired", operation.OperationId);
                await this.operationRepository.update(operation.OperationId, {
                    errorCode: ErrorCode.buildingShouldBeRepeated,
                    error: "Transaction expired",
                    failTime: new Date(),
                });
            }
        }

        // update state

        await this.paramsRepository.upsert({
            lastProcessedIrreversibleBlockTime: lastActionIrreversibleBlockTime
        });
    }
}