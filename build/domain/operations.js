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
const azure_storage_1 = require("azure-storage");
const queries_1 = require("./queries");
class OperationByTxIdEntity extends queries_1.AzureEntity {
    get TxId() {
        return this.PartitionKey;
    }
}
__decorate([
    queries_1.Ignore(),
    __metadata("design:type", String),
    __metadata("design:paramtypes", [])
], OperationByTxIdEntity.prototype, "TxId", null);
exports.OperationByTxIdEntity = OperationByTxIdEntity;
class OperationEntity extends queries_1.AzureEntity {
    get OperationId() {
        return this.PartitionKey;
    }
}
__decorate([
    queries_1.Ignore(),
    __metadata("design:type", String),
    __metadata("design:paramtypes", [])
], OperationEntity.prototype, "OperationId", null);
__decorate([
    queries_1.Int64(),
    __metadata("design:type", Number)
], OperationEntity.prototype, "BlockNum", void 0);
exports.OperationEntity = OperationEntity;
class OperationByExpiryTimeEntity extends queries_1.AzureEntity {
    get ExpiryTime() {
        return new Date(this.PartitionKey);
    }
    get OperationId() {
        return this.RowKey;
    }
}
__decorate([
    queries_1.Ignore(),
    __metadata("design:type", Date),
    __metadata("design:paramtypes", [])
], OperationByExpiryTimeEntity.prototype, "ExpiryTime", null);
__decorate([
    queries_1.Ignore(),
    __metadata("design:type", String),
    __metadata("design:paramtypes", [])
], OperationByExpiryTimeEntity.prototype, "OperationId", null);
exports.OperationByExpiryTimeEntity = OperationByExpiryTimeEntity;
class OperationRepository extends queries_1.AzureRepository {
    constructor(settings) {
        super(settings.EosApi.DataConnectionString);
        this.settings = settings;
        this.operationTableName = "EosOperations";
        this.operationByTxIdTableName = "EosOperationsByTxId";
        this.operationByExpiryTimeTableName = "EosOperationsByExpiryTime";
    }
    async updateCompleted(trxId, completedUtc, minedUtc, blockNum) {
        const operationByTxIdEntity = await this.select(OperationByTxIdEntity, this.operationByTxIdTableName, trxId, "");
        if (!!operationByTxIdEntity) {
            const operationEntity = new OperationEntity();
            operationEntity.PartitionKey = operationByTxIdEntity.OperationId;
            operationEntity.RowKey = "";
            operationEntity.CompletedUtc = completedUtc;
            operationEntity.MinedUtc = minedUtc;
            operationEntity.BlockNum = blockNum;
            await this.insertOrMerge(this.operationTableName, operationEntity);
        }
        return operationByTxIdEntity && operationByTxIdEntity.OperationId;
    }
    async updateFailed(operationId, failedUtc, error) {
        const operationEntity = new OperationEntity();
        operationEntity.PartitionKey = operationId;
        operationEntity.RowKey = "";
        operationEntity.FailedUtc = failedUtc;
        operationEntity.Error = error;
        await this.insertOrMerge(this.operationTableName, operationEntity);
    }
    async updateExpired(from, to) {
        let continuation = null;
        do {
            const query = new azure_storage_1.TableQuery().where("PartitionKey > ? and PartitionKey <= ?", from.toISOString(), to.toISOString());
            const chunk = await this.select(OperationByExpiryTimeEntity, this.operationByExpiryTimeTableName, query, continuation);
            for (const entity of chunk.items) {
                const operation = await this.select(OperationEntity, this.operationTableName, entity.OperationId, "");
                if (!!operation && !operation.CompletedUtc && !operation.FailedUtc) {
                    await this.updateFailed(entity.OperationId, entity.ExpiryTime, "Transaction expired");
                }
            }
            continuation = chunk.continuation;
        } while (!!continuation);
    }
}
exports.OperationRepository = OperationRepository;
//# sourceMappingURL=operations.js.map