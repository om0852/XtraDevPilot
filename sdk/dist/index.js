"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.XtraDevPilot = void 0;
const browser_js_1 = require("./browser.js");
__exportStar(require("./types/index.js"), exports);
__exportStar(require("./errors/index.js"), exports);
__exportStar(require("./utils/logger.js"), exports);
__exportStar(require("./transports/base.js"), exports);
__exportStar(require("./transports/stdio.js"), exports);
__exportStar(require("./transports/websocket.js"), exports);
__exportStar(require("./page.js"), exports);
__exportStar(require("./browser.js"), exports);
/**
 * Main SDK entrance wrapper for XtraDevPilot automation.
 */
class XtraDevPilot {
    browserInstance;
    options;
    constructor(options = {}) {
        this.options = options;
    }
    /**
     * Connect to the browser and return the active Page controller.
     */
    async connect() {
        this.browserInstance = await (0, browser_js_1.launch)(this.options);
        return this.browserInstance.page();
    }
    /**
     * Close session and disconnect.
     */
    async disconnect() {
        if (this.browserInstance) {
            await this.browserInstance.close();
            this.browserInstance = undefined;
        }
    }
}
exports.XtraDevPilot = XtraDevPilot;
//# sourceMappingURL=index.js.map