import { Settings } from "../common";
import { AzureEntity, Int64, AzureRepository } from "./queries";

export class ParamsEntity extends AzureEntity {
    LastIrreversibleBlockTime: Date;

    @Int64()
    NextActionSequence: number;
}

export class ParamsRepository extends AzureRepository {

    private tableName: string = "EosParams";
    private partitionKey = "Params";
    private rowKey = "";

    constructor(private settings: Settings) {
        super(settings.EosJob.DataConnectionString);
    }

    async get(): Promise<ParamsEntity> {
        return await this.select(ParamsEntity, this.tableName, this.partitionKey, this.rowKey);
    }

    async upsert(params: { nextActionSequence?: number, lastIrreversibleBlockTime?: Date }) {
        const entity = new ParamsEntity();
        entity.PartitionKey = this.partitionKey;
        entity.RowKey = this.rowKey;
        entity.NextActionSequence = params.nextActionSequence;
        entity.LastIrreversibleBlockTime = params.lastIrreversibleBlockTime;

        await this.insertOrMerge(this.tableName, entity);
    }
}