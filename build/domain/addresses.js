"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const azure_storage_1 = require("azure-storage");
const queries_1 = require("./queries");
class AddressRepository {
    constructor(settings) {
        this.settings = settings;
        this.balanceTableName = "EosBalanceAddresses";
        this.historyTableName = "EosHostoryAddresses";
        this.table = azure_storage_1.createTableService(settings.EosApi.DataConnectionString);
    }
    async get(take = 100, continuation) {
        return new queries_1.QueryResult(await queries_1.select(this.table, this.balanceTableName, new azure_storage_1.TableQuery().top(take), queries_1.toAzure(continuation)), e => e.PartitionKey._);
    }
}
exports.AddressRepository = AddressRepository;
//# sourceMappingURL=addresses.js.map