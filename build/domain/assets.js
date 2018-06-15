"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const azure_storage_1 = require("azure-storage");
const queries_1 = require("./queries");
const util_1 = require("util");
class AssetRepository {
    constructor(settings) {
        this.settings = settings;
        this.tableName = "EosAssets";
        this.table = azure_storage_1.createTableService(settings.EosApi.DataConnectionString);
    }
    map(entity) {
        if (!entity) {
            return null;
        }
        else {
            return {
                assetId: entity.PartitionKey._,
                address: entity.Address._,
                name: entity.Name._,
                accuracy: entity.Accuracy._
            };
        }
    }
    async get(idOrTake, continuation) {
        if (util_1.isString(idOrTake)) {
            return this.map(await queries_1.select(this.table, this.tableName, idOrTake, ""));
        }
        else {
            return new queries_1.QueryResult(await queries_1.select(this.table, this.tableName, new azure_storage_1.TableQuery().top(idOrTake || 100), queries_1.toAzure(continuation)), this.map).items;
        }
    }
}
exports.AssetRepository = AssetRepository;
//# sourceMappingURL=assets.js.map