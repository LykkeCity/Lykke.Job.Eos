import { Settings } from "../common";
import { AzureEntity, Int64, AzureRepository } from "./queries";

export class Params extends AzureEntity {
    LastProcessedBlockTimestamp: Date;

    @Int64()
    NextActionSequence: number;
}

export class ParamsRepository extends AzureRepository {

    private tableName: string = "EosParams";
    private partitionKey = "Params";
    private rowKey = "";

    constructor(private settings: Settings) {
        super(settings.EosApi.DataConnectionString);
    }

    async get(): Promise<Params> {
        return await this.select(Params, this.tableName, this.partitionKey, this.rowKey);
    }

    async upsert(params: Params): Promise<void> {

        const entity = new Params();
        entity.PartitionKey = this.partitionKey;
        entity.RowKey = this.rowKey;
        entity.NextActionSequence = params.NextActionSequence;
        entity.LastProcessedBlockTimestamp = params.LastProcessedBlockTimestamp;

        await this.insertOrMerge(this.tableName, entity);
    }
}