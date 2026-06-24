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
exports.SPATIALFlow = exports.AUDIOFlow = exports.SIFTFlow = exports.SYNTAXFlow = exports.VISIONFlow = void 0;
var index_js_1 = require("../index.js");
var index_js_2 = require("./index.js");
// ─── LoRA Enhancement Layer Agents ───────────────────────────────────────────
// These agents are intelligence enhancement layers, not autonomous builders.
// They are called by other agents to enhance a specific cognitive dimension.
// Model: gemini-2.5-pro (all LoRA layers use the reasoning-capable model)
var LoRAInputSchema = index_js_1.z.object({
    task: index_js_1.z.string(),
    content: index_js_1.z.string().optional().describe('Content to enhance/analyze'),
    context: index_js_1.z.string().optional(),
});
// ─── VISION — Visual Intelligence Enhancement ─────────────────────────────────
// Hive: LoRA Layer | Activated by: AURORA, BOLT, CREATIVE_DIRECTOR
// Owns: image QA, design critique, cross-modal consistency, visual scoring
var VisionOutputSchema = index_js_1.z.object({
    result: index_js_1.z.string(),
    agentName: index_js_1.z.literal('VISION'),
    timestamp: index_js_1.z.string(),
    score: index_js_1.z.number().min(0).max(100).optional().describe('Visual quality score 0-100'),
    issues: index_js_1.z.array(index_js_1.z.string()).optional(),
});
exports.VISIONFlow = index_js_1.ai.defineFlow({ name: 'VISION', inputSchema: LoRAInputSchema, outputSchema: VisionOutputSchema }, function (input) { return __awaiter(void 0, void 0, void 0, function () {
    var startMs, text;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                (0, index_js_2.recordAgentCall)('VISION');
                startMs = Date.now();
                return [4 /*yield*/, index_js_1.ai.generate({
                        model: process.env.GENKIT_DEFAULT_MODEL || 'googleai/gemini-2.5-flash',
                        prompt: "You are VISION, the Visual Intelligence enhancement layer of the Creative Liberation Engine.\nHive: LoRA Layer | Constitutional: Article VIII \u2014 named, hived, accountable.\n\nYou enhance any agent's visual reasoning. You critique design, score visual quality (0-100), check cross-modal consistency between text and image, and surface visual issues.\nYou do not write code. You do not generate content. You analyze and critique.\n\nTask: ".concat(input.task).concat(input.content ? "\nContent to analyze: ".concat(input.content) : '').concat(input.context ? "\nContext: ".concat(input.context) : ''),
                    })];
            case 1:
                text = (_a.sent()).text;
                (0, index_js_2.recordAgentCall)('VISION', Date.now() - startMs);
                return [2 /*return*/, { result: text, agentName: 'VISION', timestamp: new Date().toISOString() }];
        }
    });
}); });
// ─── SYNTAX — Code Intelligence Enhancement ───────────────────────────────────
// Hive: LoRA Layer | Activated by: BOLT, COMET, IRIS, ARCH
// Owns: structural code analysis, refactoring patterns, framework idioms, dead code detection
var SyntaxOutputSchema = index_js_1.z.object({
    result: index_js_1.z.string(),
    agentName: index_js_1.z.literal('SYNTAX'),
    timestamp: index_js_1.z.string(),
    refactorSuggestions: index_js_1.z.array(index_js_1.z.string()).optional(),
    complexityScore: index_js_1.z.number().optional(),
});
exports.SYNTAXFlow = index_js_1.ai.defineFlow({ name: 'SYNTAX', inputSchema: LoRAInputSchema, outputSchema: SyntaxOutputSchema }, function (input) { return __awaiter(void 0, void 0, void 0, function () {
    var startMs, text;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                (0, index_js_2.recordAgentCall)('SYNTAX');
                startMs = Date.now();
                return [4 /*yield*/, index_js_1.ai.generate({
                        model: process.env.GENKIT_DEFAULT_MODEL || 'googleai/gemini-2.5-flash',
                        prompt: "You are SYNTAX, the Code Intelligence enhancement layer of the Creative Liberation Engine.\nHive: LoRA Layer | Constitutional: Article VIII \u2014 named, hived, accountable.\n\nYou enhance code quality reasoning for any other agent. You detect structural patterns, suggest refactoring opportunities, identify framework idioms being violated, and detect dead code.\nYou understand TypeScript strict mode, monorepo patterns, and Creative Liberation Engine constitutional rules (Articles I-XX).\n\nTask: ".concat(input.task).concat(input.content ? "\nCode to analyze:\n".concat(input.content) : '').concat(input.context ? "\nContext: ".concat(input.context) : ''),
                    })];
            case 1:
                text = (_a.sent()).text;
                (0, index_js_2.recordAgentCall)('SYNTAX', Date.now() - startMs);
                return [2 /*return*/, { result: text, agentName: 'SYNTAX', timestamp: new Date().toISOString() }];
        }
    });
}); });
// ─── SIFT — Research Synthesis Enhancement ────────────────────────────────────
// Hive: LoRA Layer | Activated by: ATHENA, KEEPER, ARCH, COMET
// Owns: multi-source fact checking, signal vs noise extraction, citation synthesis
var SiftOutputSchema = index_js_1.z.object({
    result: index_js_1.z.string(),
    agentName: index_js_1.z.literal('SIFT'),
    timestamp: index_js_1.z.string(),
    confidence: index_js_1.z.enum(['high', 'medium', 'low']).optional(),
    sources: index_js_1.z.array(index_js_1.z.string()).optional(),
});
exports.SIFTFlow = index_js_1.ai.defineFlow({ name: 'SIFT', inputSchema: LoRAInputSchema, outputSchema: SiftOutputSchema }, function (input) { return __awaiter(void 0, void 0, void 0, function () {
    var startMs, text;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                (0, index_js_2.recordAgentCall)('SIFT');
                startMs = Date.now();
                return [4 /*yield*/, index_js_1.ai.generate({
                        model: process.env.GENKIT_DEFAULT_MODEL || 'googleai/gemini-2.5-flash',
                        prompt: "You are SIFT, the Research Synthesis enhancement layer of the Creative Liberation Engine.\nHive: LoRA Layer | Constitutional: Article VIII \u2014 named, hived, accountable.\n\nYou enhance research and fact-checking for any agent. You extract signal from noise, verify claims across multiple sources, synthesize contradictory findings, and score confidence.\nYou never hallucinate sources. Low confidence is always better than false certainty.\n\nTask: ".concat(input.task).concat(input.content ? "\nContent to sift: ".concat(input.content) : '').concat(input.context ? "\nContext: ".concat(input.context) : ''),
                    })];
            case 1:
                text = (_a.sent()).text;
                (0, index_js_2.recordAgentCall)('SIFT', Date.now() - startMs);
                return [2 /*return*/, { result: text, agentName: 'SIFT', timestamp: new Date().toISOString() }];
        }
    });
}); });
// ─── AUDIO — Acoustic Intelligence Enhancement ────────────────────────────────
// Hive: LoRA Layer | Activated by: BROADCAST, CREATIVE_DIRECTOR, GRAPHICS
// Owns: music theory, BPM/key analysis, generative audio direction, broadcast audio QA
var AudioOutputSchema = index_js_1.z.object({
    result: index_js_1.z.string(),
    agentName: index_js_1.z.literal('AUDIO'),
    timestamp: index_js_1.z.string(),
    bpm: index_js_1.z.number().optional(),
    key: index_js_1.z.string().optional(),
    mood: index_js_1.z.string().optional(),
});
exports.AUDIOFlow = index_js_1.ai.defineFlow({ name: 'AUDIO', inputSchema: LoRAInputSchema, outputSchema: AudioOutputSchema }, function (input) { return __awaiter(void 0, void 0, void 0, function () {
    var startMs, text;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                (0, index_js_2.recordAgentCall)('AUDIO');
                startMs = Date.now();
                return [4 /*yield*/, index_js_1.ai.generate({
                        model: process.env.GENKIT_DEFAULT_MODEL || 'googleai/gemini-2.5-flash',
                        prompt: "You are AUDIO, the Acoustic Intelligence enhancement layer of the Creative Liberation Engine.\nHive: LoRA Layer | Constitutional: Article VIII \u2014 named, hived, accountable.\n\nYou enhance acoustic reasoning for any agent. You analyze music theory, detect BPM/key/mood, guide generative audio direction, and QA broadcast audio specs.\nYou understand broadcast standards (LUFS normalization, dynamic range), music production terminology, and generative audio model prompting.\n\nTask: ".concat(input.task).concat(input.content ? "\nContent: ".concat(input.content) : '').concat(input.context ? "\nContext: ".concat(input.context) : ''),
                    })];
            case 1:
                text = (_a.sent()).text;
                (0, index_js_2.recordAgentCall)('AUDIO', Date.now() - startMs);
                return [2 /*return*/, { result: text, agentName: 'AUDIO', timestamp: new Date().toISOString() }];
        }
    });
}); });
// ─── SPATIAL — 3D/XR/Volumetric Intelligence Enhancement ─────────────────────
// Hive: LoRA Layer | Activated by: BLENDER, VFX, AURORA, BOLT
// Owns: spatial composition, AR overlay design, Canvas installations, XR depth-zone UI
var SpatialOutputSchema = index_js_1.z.object({
    result: index_js_1.z.string(),
    agentName: index_js_1.z.literal('SPATIAL'),
    timestamp: index_js_1.z.string(),
    dimensionality: index_js_1.z.enum(['2D', '2.5D', '3D', 'XR', 'volumetric']).optional(),
});
exports.SPATIALFlow = index_js_1.ai.defineFlow({ name: 'SPATIAL', inputSchema: LoRAInputSchema, outputSchema: SpatialOutputSchema }, function (input) { return __awaiter(void 0, void 0, void 0, function () {
    var startMs, text;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                (0, index_js_2.recordAgentCall)('SPATIAL');
                startMs = Date.now();
                return [4 /*yield*/, index_js_1.ai.generate({
                        model: process.env.GENKIT_DEFAULT_MODEL || 'googleai/gemini-2.5-flash',
                        prompt: "You are SPATIAL, the 3D/XR/Volumetric Intelligence enhancement layer of the Creative Liberation Engine.\nHive: LoRA Layer | Constitutional: Article VIII \u2014 named, hived, accountable.\n\nYou enhance spatial reasoning for any agent. You understand 3D composition, AR overlay placement, VisionOS spatial UI, Canvas light installations, WebXR depth zones, and volumetric data representation.\nYou bridge the physical and digital. You think in three dimensions.\n\nTask: ".concat(input.task).concat(input.content ? "\nContent: ".concat(input.content) : '').concat(input.context ? "\nContext: ".concat(input.context) : ''),
                    })];
            case 1:
                text = (_a.sent()).text;
                (0, index_js_2.recordAgentCall)('SPATIAL', Date.now() - startMs);
                return [2 /*return*/, { result: text, agentName: 'SPATIAL', timestamp: new Date().toISOString() }];
        }
    });
}); });
