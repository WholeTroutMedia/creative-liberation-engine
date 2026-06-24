"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.loraInjectorMiddleware = loraInjectorMiddleware;
var registry_js_1 = require("../loras/registry.js");
/**
 * LoraInjector Middleware
 *
 * Intercepts Genkit execution requests and inspects the context/headers for
 * requested LoRA persona injections. If found, it dynamically prepends the
 * domain-specific instructional core to the system prompt and adjusts the
 * model's temperature accordingly.
 */
function loraInjectorMiddleware(req, // The Genkit GenerateRequest
next) {
    return __awaiter(this, void 0, void 0, function () {
        var requestedLoras, appendedPrompt, totalTempBias, appliedLenses, _i, requestedLoras_1, loraId, lens, modifiedReq, systemMessageIndex;
        var _a;
        return __generator(this, function (_b) {
            requestedLoras = ((_a = req.context) === null || _a === void 0 ? void 0 : _a.loras) || [];
            if (requestedLoras.length === 0) {
                return [2 /*return*/, next(req)];
            }
            appendedPrompt = '';
            totalTempBias = 0;
            appliedLenses = [];
            for (_i = 0, requestedLoras_1 = requestedLoras; _i < requestedLoras_1.length; _i++) {
                loraId = requestedLoras_1[_i];
                lens = (0, registry_js_1.getLoraLens)(loraId);
                if (lens) {
                    appendedPrompt += "\n\n".concat(lens.instructionalCore, "\n");
                    totalTempBias += lens.temperatureBias;
                    appliedLenses.push(lens.name);
                }
                else {
                    console.warn("[LORA INJECTOR] Warning: Requested LoRA lens '".concat(loraId, "' not found in registry."));
                }
            }
            if (appliedLenses.length > 0) {
                console.log("[LORA INJECTOR] \uD83E\uDDE0 Injecting reasoning lenses: ".concat(appliedLenses.join(', ')));
                modifiedReq = __assign({}, req);
                // Ensure system prompt exists
                if (!modifiedReq.messages)
                    modifiedReq.messages = [];
                systemMessageIndex = modifiedReq.messages.findIndex(function (m) { return m.role === 'system'; });
                if (systemMessageIndex >= 0) {
                    modifiedReq.messages[systemMessageIndex].content.unshift({
                        text: "\n--- DYNAMIC REASONING ENHANCERS APPLIED ---\n".concat(appendedPrompt, "\n-------------------------------------------\n\n")
                    });
                }
                else {
                    modifiedReq.messages.unshift({
                        role: 'system',
                        content: [{ text: "\n--- DYNAMIC REASONING ENHANCERS APPLIED ---\n".concat(appendedPrompt, "\n-------------------------------------------\n\n") }]
                    });
                }
                // Adjust temperature if config exists
                if (modifiedReq.config && typeof modifiedReq.config.temperature === 'number') {
                    modifiedReq.config.temperature = Math.max(0.0, Math.min(1.0, modifiedReq.config.temperature + totalTempBias));
                    console.log("[LORA INJECTOR] \uD83C\uDF21\uFE0F Adjusted temperature by ".concat(totalTempBias, " to ").concat(modifiedReq.config.temperature));
                }
                return [2 /*return*/, next(modifiedReq)];
            }
            return [2 /*return*/, next(req)];
        });
    });
}
