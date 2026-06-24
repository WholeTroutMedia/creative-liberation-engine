/**
 * Browser Pool — manages N parallel Playwright instances.
 * Each AVERI agent can acquire its own isolated session.
 */

import { chromium, type Browser, type BrowserContext, type Page } from "playwright";

export interface PoolInstance {
    instanceId: string;
    browser: Browser;
    context: BrowserContext;
    page: Page;
    agentId: string | null;
    status: "idle" | "busy";
    createdAt: Date;
}

export class BrowserPool {
    private instances: Map<string, PoolInstance> = new Map();
    private maxSize: number;
    private instanceCounter = 0;

    constructor(maxSize = 5) {
        this.maxSize = maxSize;
    }

    async acquire(agentId: string): Promise<PoolInstance> {
        for (const inst of this.instances.values()) {
            if (inst.agentId === agentId && inst.status === "idle") {
                inst.status = "busy";
                return inst;
            }
        }

        for (const inst of this.instances.values()) {
            if (inst.status === "idle") {
                inst.agentId = agentId;
                inst.status = "busy";
                return inst;
            }
        }

        if (this.instances.size >= this.maxSize) {
            throw new Error(`Browser pool exhausted (max ${this.maxSize} instances). Wait for an agent to release.`);
        }

        return this.spawn(agentId);
    }

    release(instanceId: string): void {
        const inst = this.instances.get(instanceId);
        if (inst) {
            inst.status = "idle";
            inst.agentId = null;
        }
    }

    status(): Array<{ instanceId: string; agentId: string | null; status: string; url: string }> {
        return Array.from(this.instances.values()).map(inst => ({
            instanceId: inst.instanceId,
            agentId: inst.agentId,
            status: inst.status,
            url: inst.page.url(),
        }));
    }

    async close(): Promise<void> {
        for (const inst of this.instances.values()) {
            await inst.browser.close().catch(() => void 0);
        }
        this.instances.clear();
    }

    private async spawn(agentId: string): Promise<PoolInstance> {
        const browser = await chromium.launch({
            headless: true,
            args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
        });
        const context = await browser.newContext({
            userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36",
            viewport: { width: 1280, height: 800 },
        });
        const page = await context.newPage();

        const instanceId = `pool-${++this.instanceCounter}`;
        const inst: PoolInstance = {
            instanceId,
            browser,
            context,
            page,
            agentId,
            status: "busy",
            createdAt: new Date(),
        };

        this.instances.set(instanceId, inst);
        return inst;
    }
}

export const pool = new BrowserPool(5);
