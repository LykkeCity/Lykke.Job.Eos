"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
const queries_1 = require("./queries");
class Params extends queries_1.AzureEntity {
}
__decorate([
    queries_1.Int64(),
    __metadata("design:type", Number)
], Params.prototype, "NextActionSequence", void 0);
exports.Params = Params;
class ParamsRepository extends queries_1.AzureRepository {
    constructor(settings) {
        super(settings.EosJob.DataConnectionString);
        this.settings = settings;
        this.tableName = "EosParams";
        this.partitionKey = "Params";
        this.rowKey = "";
    }
    async get() {
        return await this.select(Params, this.tableName, this.partitionKey, this.rowKey);
    }
    async upsert(params) {
        const entity = new Params();
        entity.PartitionKey = this.partitionKey;
        entity.RowKey = this.rowKey;
        entity.NextActionSequence = params.NextActionSequence;
        entity.LastProcessedBlockTimestamp = params.LastProcessedBlockTimestamp;
        await this.insertOrMerge(this.tableName, entity);
    }
}
exports.ParamsRepository = ParamsRepository;
//# sourceMappingURL=params.js.map