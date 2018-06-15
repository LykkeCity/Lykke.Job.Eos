"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const util_1 = require("util");
class OperationItem {
    constructor(from, to, asset, amount) {
        this.from = from;
        this.to = to;
        this.asset = asset;
        this.amount = util_1.isString(amount)
            ? parseInt(amount) / Math.pow(10, asset.accuracy)
            : amount;
    }
}
exports.OperationItem = OperationItem;
//# sourceMappingURL=operations.js.map