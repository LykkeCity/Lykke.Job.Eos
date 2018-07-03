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
const azure_1 = require("./azure");
class ParamsEntity extends azure_1.AzureEntity {
}
__decorate([
    azure_1.Int64(),
    __metadata("design:type", Number)
], ParamsEntity.prototype, "NextActionSequence", void 0);
exports.ParamsEntity = ParamsEntity;
class ParamsRepository extends azure_1.AzureRepository {
    constructor(settings) {
        super(settings.EosJob.Azure.ConnectionString);
        this.settings = settings;
        this.tableName = "EosParams";
        this.partitionKey = "Params";
        this.rowKey = "";
    }
    async get() {
        return await this.select(ParamsEntity, this.tableName, this.partitionKey, this.rowKey);
    }
    async upsert(params) {
        const entity = new ParamsEntity();
        entity.PartitionKey = this.partitionKey;
        entity.RowKey = this.rowKey;
        entity.NextActionSequence = params.nextActionSequence;
        entity.LastProcessedIrreversibleBlockTime = params.lastProcessedIrreversibleBlockTime;
        await this.insertOrMerge(this.tableName, entity);
    }
}
exports.ParamsRepository = ParamsRepository;
//# sourceMappingURL=params.js.map