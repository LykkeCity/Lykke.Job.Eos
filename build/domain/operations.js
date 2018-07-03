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
const azure_1 = require("./azure");
var OperationType;
(function (OperationType) {
    OperationType["Single"] = "Single";
    OperationType["ManyInputs"] = "ManyInputs";
    OperationType["ManyOutputs"] = "ManyOutputs";
})(OperationType = exports.OperationType || (exports.OperationType = {}));
class OperationEntity extends azure_1.AzureEntity {
    get OperationId() {
        return this.PartitionKey;
    }
    isNotBuiltOrDeleted() {
        return !this.DeleteTime && (this.isSent() || this.isFailed());
    }
    isSent() {
        return !!this.SendTime;
    }
    isFailed() {
        return !!this.FailTime;
    }
}
__decorate([
    azure_1.Ignore(),
    __metadata("design:type", String),
    __metadata("design:paramtypes", [])
], OperationEntity.prototype, "OperationId", null);
__decorate([
    azure_1.Double(),
    __metadata("design:type", Number)
], OperationEntity.prototype, "Amount", void 0);
__decorate([
    azure_1.Int64(),
    __metadata("design:type", Number)
], OperationEntity.prototype, "AmountInBaseUnit", void 0);
__decorate([
    azure_1.Int64(),
    __metadata("design:type", Number)
], OperationEntity.prototype, "Block", void 0);
exports.OperationEntity = OperationEntity;
class OperationActionEntity extends azure_1.AzureEntity {
    get OperationId() {
        return this.PartitionKey;
    }
}
__decorate([
    azure_1.Ignore(),
    __metadata("design:type", String),
    __metadata("design:paramtypes", [])
], OperationActionEntity.prototype, "OperationId", null);
__decorate([
    azure_1.Double(),
    __metadata("design:type", Number)
], OperationActionEntity.prototype, "Amount", void 0);
__decorate([
    azure_1.Int64(),
    __metadata("design:type", Number)
], OperationActionEntity.prototype, "AmountInBaseUnit", void 0);
exports.OperationActionEntity = OperationActionEntity;
class OperationByExpiryTimeEntity extends azure_1.AzureEntity {
    get ExpiryTime() {
        return new Date(this.PartitionKey);
    }
    get OperationId() {
        return this.RowKey;
    }
}
__decorate([
    azure_1.Ignore(),
    __metadata("design:type", Date),
    __metadata("design:paramtypes", [])
], OperationByExpiryTimeEntity.prototype, "ExpiryTime", null);
__decorate([
    azure_1.Ignore(),
    __metadata("design:type", String),
    __metadata("design:paramtypes", [])
], OperationByExpiryTimeEntity.prototype, "OperationId", null);
exports.OperationByExpiryTimeEntity = OperationByExpiryTimeEntity;
class OperationByTxIdEntity extends azure_1.AzureEntity {
    get TxId() {
        return this.PartitionKey;
    }
}
__decorate([
    azure_1.Ignore(),
    __metadata("design:type", String),
    __metadata("design:paramtypes", [])
], OperationByTxIdEntity.prototype, "TxId", null);
exports.OperationByTxIdEntity = OperationByTxIdEntity;
class OperationRepository extends azure_1.AzureRepository {
    constructor(settings) {
        super(settings.EosJob.Azure.ConnectionString);
        this.settings = settings;
        this.operationTableName = "EosOperations";
        this.operationActionTableName = "EosOperationActions";
        this.operationByExpiryTimeTableName = "EosOperationsByExpiryTime";
        this.operationByTxIdTableName = "EosOperationsByTxId";
    }
    async upsert(operationId, type, assetId, actions, expiryTime) {
        const operationEntity = new OperationEntity();
        operationEntity.PartitionKey = operationId;
        operationEntity.RowKey = "";
        operationEntity.Type = type;
        operationEntity.AssetId = assetId;
        operationEntity.Amount = actions.reduce((sum, action) => sum + action.amount, 0);
        operationEntity.AmountInBaseUnit = actions.reduce((sum, action) => sum + action.amountInBaseUnit, 0);
        operationEntity.BuildTime = new Date();
        operationEntity.ExpiryTime = expiryTime;
        const operationActionEntities = actions.map((action, i) => {
            const entity = new OperationActionEntity();
            entity.PartitionKey = operationId;
            entity.RowKey = i.toString().padStart(4, "0");
            entity.FromAddress = action.fromAddress;
            entity.ToAddress = action.toAddress;
            entity.Amount = action.amount;
            entity.AmountInBaseUnit = action.amountInBaseUnit;
            return entity;
        });
        const operationByExpiryTimeEntity = new OperationByExpiryTimeEntity();
        operationByExpiryTimeEntity.PartitionKey = expiryTime.toISOString();
        operationByExpiryTimeEntity.RowKey = operationId;
        await this.insertOrMerge(this.operationTableName, operationEntity);
        await this.insertOrMerge(this.operationActionTableName, operationActionEntities);
        await this.insertOrMerge(this.operationByExpiryTimeTableName, operationByExpiryTimeEntity);
    }
    async update(operationId, operation) {
        const operationEntity = new OperationEntity();
        operationEntity.PartitionKey = operationId;
        operationEntity.RowKey = "";
        operationEntity.SendTime = operation.sendTime;
        operationEntity.CompletionTime = operation.completionTime;
        operationEntity.FailTime = operation.failTime;
        operationEntity.DeleteTime = operation.deleteTime;
        operationEntity.TxId = operation.txId;
        operationEntity.BlockTime = operation.blockTime;
        operationEntity.Block = operation.block;
        operationEntity.Error = operation.error;
        await this.insertOrMerge(this.operationTableName, operationEntity);
    }
    async get(operationId) {
        return await this.select(OperationEntity, this.operationTableName, operationId, "");
    }
    async getActions(operationId) {
        return await this.selectAll(async (c) => await this.select(OperationActionEntity, this.operationActionTableName, new azure_storage_1.TableQuery().where("PartitionKey == ?", operationId), c));
    }
    async getOperationIdByTxId(txId) {
        const operationByTxIdEntity = await this.select(OperationByTxIdEntity, this.operationByTxIdTableName, txId, "");
        if (!!operationByTxIdEntity) {
            return operationByTxIdEntity.OperationId;
        }
        else {
            return null;
        }
    }
    async geOperationIdByExpiryTime(from, to) {
        const query = new azure_storage_1.TableQuery()
            .where("PartitionKey > ? and PartitionKey <= ?", from.toISOString(), to.toISOString());
        const entities = await this.selectAll(async (c) => this.select(OperationByExpiryTimeEntity, this.operationByExpiryTimeTableName, query, c));
        return entities.map(e => e.OperationId);
    }
}
exports.OperationRepository = OperationRepository;
//# sourceMappingURL=operations.js.map