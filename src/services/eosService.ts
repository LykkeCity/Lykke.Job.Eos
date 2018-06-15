import { promisify } from "util";
import { Asset } from "../domain/assets";
import { OperationItem } from "../domain/operations";
import { Settings, ADDRESS_SEPARATOR } from "../common";
import { LogService } from "./logService";
import { ParamsRepository } from "../domain/params";

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
        };
        block_num: number;
    }[];
    last_irreversible_block: number;
}

// EOSJS has no typings, so use it as regular node module
const Eos = require("eosjs");

export class EosService {

    private eos: any;
    private paramsRepository: ParamsRepository;

    private isFake(item: OperationItem): boolean {
        return item.from.indexOf(ADDRESS_SEPARATOR) >= 0 || item.to.indexOf(ADDRESS_SEPARATOR) >= 0;
    }

    constructor(private settings: Settings, private log: LogService) {
        this.eos = Eos.Localnet({ httpEndpoint: settings.EosApi.Eos.HttpEndpoint });
        this.paramsRepository = new ParamsRepository(settings);
    }

    async handleActions(): Promise<void> {
        let params = (await this.paramsRepository.get()) || { nextActionSequence: 0 };

        console.log(params.nextActionSequence);

        while (true) {
            let data: ActionsResult = await this.eos.getActions(this.settings.EosApi.HotWalletAccount, params.nextActionSequence, 0);
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
            } else {
                return;
            }
        }
    }
}