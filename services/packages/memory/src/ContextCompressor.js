"use strict";
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
exports.ContextCompressor = void 0;
var result_ts_1 = require("../../cle-core/src/utils/result.ts");
var ContextCompressor = /** @class */ (function () {
    function ContextCompressor() {
        this.ollamaEndpoint = 'http://localhost:11434/api/generate';
    }
    /**
     * Compresses raw observational dumps (e.g., full DOM or terminal outputs)
     * into lean, actionable markdown summaries using a local LLM.
     */
    ContextCompressor.prototype.compressObservation = function (rawInput, strategy, options) {
        return __awaiter(this, void 0, void 0, function () {
            var model, prompt, response, data, err_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        model = (options === null || options === void 0 ? void 0 : options.model) || 'qwen3-coder:latest';
                        prompt = this.buildPrompt(rawInput, strategy);
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 4, , 5]);
                        return [4 /*yield*/, fetch(this.ollamaEndpoint, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    model: model,
                                    prompt: prompt,
                                    stream: false,
                                    options: {
                                        num_predict: (options === null || options === void 0 ? void 0 : options.maxTokens) || 1024,
                                        temperature: 0.1 // Low temp for deterministic extraction
                                    }
                                })
                            })];
                    case 2:
                        response = _a.sent();
                        if (!response.ok) {
                            return [2 /*return*/, (0, result_ts_1.Err)("Ollama API error: ".concat(response.statusText))];
                        }
                        return [4 /*yield*/, response.json()];
                    case 3:
                        data = _a.sent();
                        return [2 /*return*/, (0, result_ts_1.Ok)(data.response.trim())];
                    case 4:
                        err_1 = _a.sent();
                        return [2 /*return*/, (0, result_ts_1.Err)(err_1 instanceof Error ? err_1.message : String(err_1))];
                    case 5: return [2 /*return*/];
                }
            });
        });
    };
    ContextCompressor.prototype.buildPrompt = function (rawInput, strategy) {
        if (strategy === 'dom') {
            return "You are a visual context compressor for an autonomous agent.\nAnalyze the following raw DOM/HTML dump.\nExtract ONLY the actionable interactive elements (buttons, links, inputs with their IDs/names) and the primary structural content.\nFormat as a clean, highly compressed Markdown list. Ignore styling, scripts, and visual noise.\n\nRAW DOM:\n".concat(rawInput, "\n\nCOMPRESSED OBSERVATION:");
        }
        if (strategy === 'terminal') {
            return "You are a context compressor for an autonomous agent.\nAnalyze the following raw terminal output.\nExtract ONLY the final success/error states, crucial output values, and required next steps.\nFormat as a clean, highly compressed Markdown summary. Ignore progress bars, repetitive logs, and visual noise.\n\nRAW TERMINAL OUTPUT:\n".concat(rawInput, "\n\nCOMPRESSED OBSERVATION:");
        }
        return rawInput;
    };
    return ContextCompressor;
}());
exports.ContextCompressor = ContextCompressor;
