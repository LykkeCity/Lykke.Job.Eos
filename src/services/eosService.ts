import { Settings, ADDRESS_SEPARATOR } from "../common";
import { LogService } from "./logService";
import { AssetRepository } from "../domain/assets";
import { OperationRepository } from "../domain/operations";
import { ParamsRepository, Params } from "../domain/params";
import { BalanceRepository } from "../domain/balances";
import { HistoryRepository } from "../domain/history";

export class ActionsResult {
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

// EOSJS has no typings, so use it as regular node module
const Eos = require("eosjs");

export class EosService {

    private eos: any;
    private paramsRepository: ParamsRepository;
    private balanceRepository: BalanceRepository;
    private assetRepository: AssetRepository;
    private operationRepository: OperationRepository;
    private historyRepository: HistoryRepository;

    constructor(private settings: Settings, private log: LogService) {
        this.eos = Eos({ httpEndpoint: settings.EosApi.Eos.HttpEndpoint });
        this.paramsRepository = new ParamsRepository(settings);
        this.balanceRepository = new BalanceRepository(settings);
        this.assetRepository = new AssetRepository(settings);
        this.operationRepository = new OperationRepository(settings);
        this.historyRepository = new HistoryRepository(settings);
    }

    /**
     * Tracks blockchain actions and updates operations state.
     */
    async handleActions(): Promise<void> {
        const assets = await this.assetRepository.all();
        const parameters = (await this.paramsRepository.get()) || { nextActionSequence: 0, lastProcessedBlockTimestamp: new Date(0) };

        let last_irreversible_block = 0;

        while (true) {
            const actionResult: ActionsResult = await this.eos.getActions(this.settings.EosApi.HotWalletAccount, parameters.nextActionSequence, 0);
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
                            ? transfer.to + ADDRESS_SEPARATOR + transfer.memo
                            : transfer.to;

                        // record history
                        await this.historyRepository.upsert(transfer.from, to, value, asset,
                            action.block_num, action.action_trace.trx_id, action.action_trace.receipt.act_digest);

                        // update balance of deposit wallet
                        if (transfer.to == this.settings.EosApi.HotWalletAccount && transfer.memo) {
                            this.balanceRepository.upsert(to, asset, value);
                        }
                    }
                }

                parameters.nextActionSequence++;
            } else {
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