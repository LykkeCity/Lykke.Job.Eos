import { Settings, ADDRESS_SEPARATOR, isoUTC } from "../common";
import { LogService, LogLevel } from "./logService";
import { AssetRepository } from "../domain/assets";
import { OperationRepository } from "../domain/operations";
import { ParamsRepository, Params } from "../domain/params";
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
    private logInfo: (message: string, context?: any) => Promise<void>;

    constructor(private settings: Settings, private log: LogService) {
        this.eos = Eos({ httpEndpoint: settings.EosJob.Eos.HttpEndpoint });
        this.paramsRepository = new ParamsRepository(settings);
        this.balanceRepository = new BalanceRepository(settings);
        this.assetRepository = new AssetRepository(settings);
        this.operationRepository = new OperationRepository(settings);
        this.historyRepository = new HistoryRepository(settings);
        this.logInfo = (m, c) => this.log.write(LogLevel.info, EosService.name, this.handleActions.name, m, JSON.stringify(c));
    }

    /**
     * Tracks blockchain actions and updates operations state.
     */
    async handleActions(): Promise<void> {
        const assets = await this.assetRepository.all();
        let params = await this.paramsRepository.get();

        if (!params) {
            params = new Params();
            params.LastProcessedBlockTimestamp = new Date(0);
            params.NextActionSequence = 0;
        }

        let last_irreversible_block = 0;

        while (true) {
            const actionResult: ActionsResult = await this.eos.getActions(this.settings.EosJob.HotWalletAccount, params.NextActionSequence, 0);
            const action = actionResult.actions[0];

            last_irreversible_block = actionResult.last_irreversible_block;

            if (!!action && action.block_num <= actionResult.last_irreversible_block) {

                await this.logInfo("Action detected", { Account: this.settings.EosJob.HotWalletAccount, Seq: action.account_action_seq });

                const transfer = action.action_trace.act.name == "transfer" && action.action_trace.act.data;

                if (!!transfer) {
                    // set operation state to completed, if any
                    const operationId = await this.operationRepository.updateCompleted(action.action_trace.trx_id,
                        new Date(), isoUTC(action.block_time), action.block_num);

                    // get amount and asset
                    const parts = transfer.quantity.split(" ", 2);
                    const value = parseFloat(parts[0]);
                    const asset = assets.find(a => a.AssetId == parts[1]);

                    if (!!asset) {
                        const to = !!transfer.memo
                            ? transfer.to + ADDRESS_SEPARATOR + transfer.memo
                            : transfer.to;

                        // record history
                        await this.historyRepository.upsert(transfer.from, to, value, asset,
                            action.block_num, action.action_trace.trx_id, action.action_trace.receipt.act_digest);
                        await this.logInfo("Transfer recorded", transfer);

                        // update balance of deposit wallet
                        if (transfer.to == this.settings.EosJob.HotWalletAccount && !!transfer.memo) {
                            const balance = await this.balanceRepository.upsert(to, asset, value);
                            await this.logInfo("Balance updated", { Address: to, Affix: value, Asset: asset.AssetId, FinalBalance: balance });
                        }
                    } else {
                        await this.logInfo("Not tracked token", parts[1]);
                    }
                } else {
                    await this.logInfo("Not a transfer", action.action_trace.act.name);
                }

                params.NextActionSequence++;
                await this.paramsRepository.upsert(params);

            } else {
                break;
            }
        }

        // update expired operations (mark as failed)
        const block: Block = await this.eos.getBlock(last_irreversible_block);
        const blockTime = isoUTC(block.timestamp);
        await this.operationRepository.updateExpired(params.LastProcessedBlockTimestamp, blockTime);

        // update state
        params.LastProcessedBlockTimestamp = blockTime;
        await this.paramsRepository.upsert(params);
    }
}