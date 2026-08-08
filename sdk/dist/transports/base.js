"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseTransport = void 0;
class BaseTransport {
    logger;
    isConnected = false;
    constructor(logger) {
        this.logger = logger;
    }
    connected() {
        return this.isConnected;
    }
}
exports.BaseTransport = BaseTransport;
//# sourceMappingURL=base.js.map