import { Asset } from "./assets";
import { TableService, createTableService, TableQuery, TableUtilities } from "azure-storage";
import { Settings } from "../common";
import { select, AzureEntity } from "./queries";

export class Balance extends AzureEntity {
    constructor(address?: string) {

    }
    Address: string;
    AssetId: string;
    Amount: number;
}

export class BalanceRepository {

    private tableName: string = "EosBalances";
    private table: TableService;

    constructor(private settings: Settings) {
        this.table = createTableService(settings.EosApi.DataConnectionString);
    }

    /**
     * Updates or creates balance record for address.
     * @param address Address
     * @param asset Asset
     * @param affix Amount to add (if positive) or subtract (if negative)
     */
    async upsert(address: string, asset: Asset, affix: number): Promise<void> {
        return select<Balance>(this.table, this.tableName, address, asset.AssetId)
            .then(entity => {
                return new Promise<void>((res, rej) => {
                    if (entity) {
                        entity.Amount += affix;
                    } else {
                        entity = {
                            PartitionKey: TableUtilities.entityGenerator.String(address),
                            RowKey: TableUtilities.entityGenerator.String(asset.AssetId),
                            Amount: TableUtilities.entityGenerator.String(affix.toFixed(asset.Accuracy))
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