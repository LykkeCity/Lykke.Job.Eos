import { Asset } from "./assets";
import { TableService, createTableService, TableQuery, TableUtilities } from "azure-storage";
import { Settings } from "../common";
import { select } from "./queries";

export interface Balance {
    address: string;
    assetId: string;
    amount: number;
}

export class BalanceRepository {

    private tableName: string = "EosBalances";
    private table: TableService;

    constructor(private settings: Settings) {
        this.table = createTableService(settings.EosApi.DataConnectionString);
    }

    async upsert(address: string, asset: Asset, affix: number): Promise<void> {
        return select(this.table, this.tableName, address, asset.assetId)
            .then(entity => {
                return new Promise<void>((res, rej) => {
                    if (entity) {
                        entity.amount._ += affix;
                    } else {
                        entity = {
                            PartitionKey: TableUtilities.entityGenerator.String(address),
                            RowKey: TableUtilities.entityGenerator.String(asset.assetId),
                            Amount: TableUtilities.entityGenerator.String(affix.toFixed(asset.accuracy))
                        };
                    }

                    this.table.insertOrReplaceEntity(this.tableName, entity, (err, result) => {
                        if (err) {
                            rej(err);
                        } else {
                            res();
                        }
                    });
                });
            });
    }
}