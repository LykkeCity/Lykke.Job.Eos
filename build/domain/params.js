"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const azure_storage_1 = require("azure-storage");
const queries_1 = require("./queries");
class ParamsRepository {
    constructor(settings) {
        this.settings = settings;
        this.tableName = "EosParams";
        this.partitionKey = "Params";
        this.rowKey = "";
        this.table = azure_storage_1.createTableService(settings.EosApi.DataConnectionString);
    }
    map(entity) {
        if (!entity) {
            return null;
        }
        else {
            return {
                nextActionSequence: entity.NextActionSequence._,
            };
        }
    }
    async get() {
        return this.map(await queries_1.select(this.table, this.tableName, this.partitionKey, this.rowKey));
    }
    async update(nextActionSequence) {
        return queries_1.ensureTable(this.table, this.tableName)
            .then(() => {
            return new Promise((res, rej) => {
                const entity = {
                    PartitionKey: azure_storage_1.TableUtilities.entityGenerator.String(this.partitionKey),
                    RowKey: azure_storage_1.TableUtilities.entityGenerator.String(this.rowKey),
                    NextActionSequence: azure_storage_1.TableUtilities.entityGenerator.Int64(nextActionSequence)
                };
                this.table.insertOrReplaceEntity(this.tableName, entity, (err, result) => {
                    if (err) {
                        rej(err);
                    }
                    else {
                        res(result);
                    }
                });
            });
        });
    }
}
exports.ParamsRepository = ParamsRepository;
//# sourceMappingURL=params.js.map