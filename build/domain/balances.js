"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const azure_storage_1 = require("azure-storage");
const queries_1 = require("./queries");
class BalanceRepository {
    constructor(settings) {
        this.settings = settings;
        this.tableName = "EosBalances";
        this.table = azure_storage_1.createTableService(settings.EosApi.DataConnectionString);
    }
    /**
     * Updates or creates balance record for address.
     * @param address Address
     * @param asset Asset
     * @param affix Amount to add (if positive) or subtract (if negative)
     */
    async upsert(address, asset, affix) {
        return queries_1.select(this.table, this.tableName, address, asset.assetId)
            .then(entity => {
            return new Promise((res, rej) => {
                if (entity) {
                    entity.amount._ += affix;
                }
                else {
                    entity = {
                        PartitionKey: azure_storage_1.TableUtilities.entityGenerator.String(address),
                        RowKey: azure_storage_1.TableUtilities.entityGenerator.String(asset.assetId),
                        Amount: azure_storage_1.TableUtilities.entityGenerator.String(affix.toFixed(asset.accuracy))
                    };
                }
                this.table.insertOrReplaceEntity(this.tableName, entity, (err, result) => {
                    if (err) {
                        rej(err);
                    }
                    else {
                        res();
                    }
                });
            });
        });
    }
}
exports.BalanceRepository = BalanceRepository;
//# sourceMappingURL=balances.js.map