import { createTableService, TableService, TableQuery, TableUtilities } from "azure-storage";
import { Settings } from "../common";
import { QueryResult, select, toAzure } from "./queries";
import { isString } from "util";

export class AddressRepository {

    private balanceTableName: string = "EosBalanceAddresses";
    private historyTableName: string = "EosHostoryAddresses";
    private table: TableService;

    constructor(private settings: Settings) {
        this.table = createTableService(settings.EosApi.DataConnectionString);
    }

    async get(take = 100, continuation?: string): Promise<QueryResult<string>> {
        return new QueryResult<string>(await select(this.table, this.balanceTableName, new TableQuery().top(take), toAzure(continuation)), e => e.PartitionKey._);
    }
}