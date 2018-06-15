"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const common_1 = require("../common");
const util_1 = require("util");
class QueryResult {
    constructor(azureQueryResult, toT) {
        this.items = azureQueryResult.entries.map(toT);
        this.continuation = !!azureQueryResult.continuationToken
            ? common_1.toBase64(JSON.stringify(azureQueryResult.continuationToken))
            : null;
    }
}
exports.QueryResult = QueryResult;
function toAzure(continuation) {
    return !!continuation
        ? JSON.parse(common_1.fromBase64(continuation))
        : null;
}
exports.toAzure = toAzure;
async function ensureTable(table, tableName) {
    return new Promise((res, rej) => {
        table.createTableIfNotExists(tableName, err => {
            if (err) {
                rej(err);
            }
            else {
                res();
            }
        });
    });
}
exports.ensureTable = ensureTable;
async function select(table, tableName, partitionKeyOrQuery, rowKeyOrContinuationToken) {
    return ensureTable(table, tableName)
        .then(() => {
        return new Promise((res, rej) => {
            if (util_1.isString(partitionKeyOrQuery)) {
                table.retrieveEntity(tableName, partitionKeyOrQuery, rowKeyOrContinuationToken, (err, result, response) => {
                    if (err && response.statusCode != 404) {
                        rej(err);
                    }
                    else {
                        res(result);
                    }
                });
            }
            else {
                table.queryEntities(tableName, partitionKeyOrQuery, rowKeyOrContinuationToken, (err, result, response) => {
                    if (err) {
                        rej(err);
                    }
                    else {
                        res(result);
                    }
                });
            }
        });
    });
}
exports.select = select;
//# sourceMappingURL=queries.js.map