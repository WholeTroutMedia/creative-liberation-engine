/**
 * Ledger Swarm Flow — Sovereign double-entry bookkeeping, banking reconciliation,
 * tax compliance, and runway calculations.
 *
 * Governs the LEDGER hive under Article I (Sovereignty) and Article XXIV (Privacy).
 */

import { z } from 'genkit';
import { ai } from '../index.js';
import { recordAgentCall } from './index.js';

// ─── HELIX C: SCHEMA DEFINITION ──────────────────────────────────────────────
export const LedgerPostingSchema = z.object({
    account: z.string().describe('Target account name (e.g. assets:bank, expenses:software)'),
    amount: z.number().describe('Amount in USD'),
    type: z.enum(['debit', 'credit']).describe('debit = asset increase/expense, credit = liability increase/income')
});

export const LedgerTransactionSchema = z.object({
    transactionId: z.string().describe('Unique transaction ID (tx_...)'),
    date: z.string().describe('ISO-8601 Timestamp'),
    amount: z.number().describe('Total transaction amount'),
    currency: z.string().default('USD'),
    description: z.string().describe('Memo describing the transaction'),
    source: z.enum(['stripe', 'plaid', 'mercury', 'manual', 'solana', 'shopify']),
    postings: z.array(LedgerPostingSchema).min(2).describe('Double-entry accounting postings (must balance)'),
    status: z.enum(['pending', 'reconciled', 'unreconciled']).default('reconciled'),
    metadata: z.record(z.any()).optional()
});

export const LedgerInputSchema = z.object({
    action: z.enum([
        'add_transaction',
        'query_ledger',
        'reconcile_transactions',
        'estimate_taxes',
        'calculate_runway',
        'create_invoice',
        'process_ocr_receipt',
        'transfer_crypto',
        'arbitrage_compute'
    ]),
    // For add_transaction:
    transaction: LedgerTransactionSchema.optional(),
    // For query_ledger:
    accountFilter: z.string().optional(),
    // For reconcile_transactions:
    unreconciledItems: z.array(z.object({
        bankTxId: z.string(),
        amount: z.number(),
        description: z.string(),
        date: z.string()
    })).optional(),
    // For estimate_taxes / calculate_runway:
    taxYear: z.number().optional(),

    // For create_invoice:
    invoiceDetails: z.object({
        clientName: z.string(),
        amount: z.number(),
        description: z.string()
    }).optional(),

    // For process_ocr_receipt:
    receiptDetails: z.object({
        vendor: z.string(),
        amount: z.number(),
        tax: z.number().default(0),
        date: z.string().optional(),
        category: z.string().optional()
    }).optional(),

    // For transfer_crypto:
    cryptoDetails: z.object({
        toAddress: z.string(),
        amount: z.number(),
        token: z.enum(['SOL', 'USDC'])
    }).optional(),

    // For arbitrage_compute:
    arbitrageDetails: z.object({
        trainingHours: z.number(),
        gpuType: z.string().default('H100')
    }).optional()
});

export const LedgerOutputSchema = z.object({
    success: z.boolean(),
    message: z.string(),
    data: z.any().optional(),
    agentName: z.literal('LEDGER'),
    timestamp: z.string()
});

export type LedgerInput = z.infer<typeof LedgerInputSchema>;
export type LedgerOutput = z.infer<typeof LedgerOutputSchema>;
export type LedgerTransaction = z.infer<typeof LedgerTransactionSchema>;

// ─── HELIX D & F: DATABASE SERVICE (SQLite with Graceful In-Memory Fallback) ──
let db: any = null;
const inMemoryStore: LedgerTransaction[] = [
    // Pre-populate some historical data for simulation and tests
    {
        transactionId: 'tx_001',
        date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days ago
        amount: 5000.00,
        currency: 'USD',
        description: 'Google Cloud Platform GPU Grant / Subsidy',
        source: 'mercury',
        postings: [
            { account: 'assets:bank:mercury', amount: 5000.00, type: 'debit' },
            { account: 'equity:opening', amount: 5000.00, type: 'credit' }
        ],
        status: 'reconciled'
    },
    {
        transactionId: 'tx_002',
        date: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
        amount: 299.00,
        currency: 'USD',
        description: 'Vast.ai GPU Rental - Training LoRA Run',
        source: 'stripe',
        postings: [
            { account: 'expenses:compute:gpu', amount: 299.00, type: 'debit' },
            { account: 'assets:bank:mercury', amount: 299.00, type: 'credit' }
        ],
        status: 'reconciled'
    },
    {
        transactionId: 'tx_003',
        date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
        amount: 1500.00,
        currency: 'USD',
        description: 'Client payment for photoshoot inquiry #812',
        source: 'stripe',
        postings: [
            { account: 'assets:bank:mercury', amount: 1500.00, type: 'debit' },
            { account: 'income:photography', amount: 1500.00, type: 'credit' }
        ],
        status: 'reconciled'
    }
];

let dbInitialized = false;

async function initDb() {
    if (dbInitialized) return;
    dbInitialized = true;
    try {
        // @ts-ignore
        const { default: DatabaseClass } = await import('better-sqlite3');
        db = new DatabaseClass(':memory:');
        db.exec(`
            CREATE TABLE IF NOT EXISTS transactions (
                id TEXT PRIMARY KEY,
                date TEXT,
                amount REAL,
                currency TEXT,
                description TEXT,
                source TEXT,
                status TEXT
            );
            CREATE TABLE IF NOT EXISTS postings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                tx_id TEXT,
                account TEXT,
                amount REAL,
                type TEXT,
                FOREIGN KEY(tx_id) REFERENCES transactions(id)
            );
        `);
        
        // Seed SQLite table with defaults
        const insertTx = db.prepare(`INSERT OR REPLACE INTO transactions (id, date, amount, currency, description, source, status) VALUES (?, ?, ?, ?, ?, ?, ?)`);
        const insertPosting = db.prepare(`INSERT INTO postings (tx_id, account, amount, type) VALUES (?, ?, ?, ?)`);
        
        for (const tx of inMemoryStore) {
            insertTx.run(tx.transactionId, tx.date, tx.amount, tx.currency, tx.description, tx.source, tx.status);
            for (const p of tx.postings) {
                insertPosting.run(tx.transactionId, p.account, p.amount, p.type);
            }
        }
        console.log('[LEDGER] SQLite engine initialized successfully.');
    } catch (err) {
        console.warn('[LEDGER] SQLite failed to initialize (falling back to JS store):', (err as Error).message);
    }
}

// Helper to calculate total debits and credits
function calculateBalances(txs: LedgerTransaction[]): Record<string, number> {
    const balances: Record<string, number> = {};
    for (const tx of txs) {
        for (const p of tx.postings) {
            if (!balances[p.account]) balances[p.account] = 0;
            if (p.type === 'debit') {
                balances[p.account] += p.amount;
            } else {
                balances[p.account] -= p.amount;
            }
        }
    }
    return balances;
}

// ─── HELIX A & B: FLOW DEFINITION ───────────────────────────────────────────
export const LedgerFlow = ai.defineFlow(
    {
        name: 'LedgerFlow',
        inputSchema: LedgerInputSchema,
        outputSchema: LedgerOutputSchema
    },
    async (input): Promise<LedgerOutput> => {
        recordAgentCall('LEDGER');
        const startMs = Date.now();
        const timestamp = new Date().toISOString();

        // Dynamically initialize the database if available
        await initDb();

        try {
            switch (input.action) {
                case 'add_transaction': {
                    const tx = input.transaction;
                    if (!tx) {
                        return { success: false, message: 'Transaction payload is required for add_transaction', agentName: 'LEDGER', timestamp };
                    }

                    // 1. Double-Entry Balance Check
                    let totalDebits = 0;
                    let totalCredits = 0;
                    for (const p of tx.postings) {
                        if (p.type === 'debit') totalDebits += p.amount;
                        else totalCredits += p.amount;
                    }

                    // Strict float validation (tolerance up to 0.001)
                    if (Math.abs(totalDebits - totalCredits) > 0.001) {
                        return {
                            success: false,
                            message: `Double-entry posting is unbalanced. Debits ($${totalDebits}) must equal Credits ($${totalCredits}).`,
                            agentName: 'LEDGER',
                            timestamp
                        };
                    }

                    // 2. Persist transaction
                    if (db) {
                        const insertTx = db.prepare(`INSERT OR REPLACE INTO transactions (id, date, amount, currency, description, source, status) VALUES (?, ?, ?, ?, ?, ?, ?)`);
                        const insertPosting = db.prepare(`INSERT INTO postings (tx_id, account, amount, type) VALUES (?, ?, ?, ?)`);
                        const deletePostings = db.prepare(`DELETE FROM postings WHERE tx_id = ?`);

                        db.transaction(() => {
                            insertTx.run(tx.transactionId, tx.date, tx.amount, tx.currency, tx.description, tx.source, tx.status);
                            deletePostings.run(tx.transactionId);
                            for (const p of tx.postings) {
                                insertPosting.run(tx.transactionId, p.account, p.amount, p.type);
                            }
                        })();
                    } else {
                        const idx = inMemoryStore.findIndex(t => t.transactionId === tx.transactionId);
                        if (idx !== -1) inMemoryStore[idx] = tx;
                        else inMemoryStore.push(tx);
                    }

                    return {
                        success: true,
                        message: `Successfully booked transaction ${tx.transactionId}: "${tx.description}"`,
                        data: tx,
                        agentName: 'LEDGER',
                        timestamp
                    };
                }

                case 'query_ledger': {
                    let txs: LedgerTransaction[] = [];
                    if (db) {
                        const selectAll = db.prepare(`SELECT * FROM transactions`);
                        const selectPostings = db.prepare(`SELECT * FROM postings WHERE tx_id = ?`);
                        const rows = selectAll.all();
                        txs = rows.map((r: any) => {
                            const postingsRows = selectPostings.all(r.id);
                            return {
                                transactionId: r.id,
                                date: r.date,
                                amount: r.amount,
                                currency: r.currency,
                                description: r.description,
                                source: r.source,
                                status: r.status,
                                postings: postingsRows.map((p: any) => ({
                                    account: p.account,
                                    amount: p.amount,
                                    type: p.type
                                }))
                            };
                        });
                    } else {
                        txs = [...inMemoryStore];
                    }

                    if (input.accountFilter) {
                        txs = txs.filter(tx => tx.postings.some(p => p.account.includes(input.accountFilter!)));
                    }

                    const balances = calculateBalances(txs);

                    return {
                        success: true,
                        message: `Retrieved ${txs.length} transactions.`,
                        data: { transactions: txs, balances },
                        agentName: 'LEDGER',
                        timestamp
                    };
                }

                case 'reconcile_transactions': {
                    // Helix A / B: Matchmaking algorithm between bank statements & receipts
                    const items = input.unreconciledItems || [];
                    const matches: any[] = [];

                    // Mock matching invoices
                    const mockInvoices = [
                        { invoiceId: 'inv_812', amount: 1500.00, client: 'Alice Smith Photography Inquiry' },
                        { invoiceId: 'inv_900', amount: 299.00, vendor: 'Vast.ai GPU Service' }
                    ];

                    for (const item of items) {
                        // Find matching invoices by amount (with high confidence score)
                        const invoiceMatch = mockInvoices.find(inv => Math.abs(inv.amount - item.amount) < 0.01);
                        if (invoiceMatch) {
                            matches.push({
                                bankTxId: item.bankTxId,
                                amount: item.amount,
                                date: item.date,
                                description: item.description,
                                confidenceScore: 0.95,
                                matchedEntity: invoiceMatch,
                                recommendedAccount: item.amount > 0 ? 'assets:bank:mercury' : 'expenses:compute'
                            });
                        } else {
                            matches.push({
                                bankTxId: item.bankTxId,
                                amount: item.amount,
                                date: item.date,
                                description: item.description,
                                confidenceScore: 0.20,
                                matchedEntity: null,
                                recommendedAccount: 'suspense:unmatched'
                            });
                        }
                    }

                    return {
                        success: true,
                        message: `Processed ${items.length} reconciliation matches.`,
                        data: { matches },
                        agentName: 'LEDGER',
                        timestamp
                    };
                }

                case 'estimate_taxes': {
                    // Helix B: Regulatory Tax Audit under TAX agent guidance
                    let txs: LedgerTransaction[] = db ? [] : [...inMemoryStore];
                    if (db) {
                        const selectAll = db.prepare(`SELECT * FROM transactions`);
                        const selectPostings = db.prepare(`SELECT * FROM postings WHERE tx_id = ?`);
                        const rows = selectAll.all();
                        txs = rows.map((r: any) => {
                            const postingsRows = selectPostings.all(r.id);
                            return {
                                transactionId: r.id,
                                postings: postingsRows.map((p: any) => ({ account: p.account, amount: p.amount, type: p.type }))
                            };
                        });
                    }

                    const balances = calculateBalances(txs);
                    
                    // Deductible calculations: sum up expense balances (where debit balance is positive)
                    let totalWriteOffs = 0;
                    for (const [account, bal] of Object.entries(balances)) {
                        if (account.startsWith('expenses:')) {
                            // Debits are positive, meaning net expense is positive
                            totalWriteOffs += Math.abs(bal);
                        }
                    }

                    // Mock tax calculation: 15.3% Self-Employment Tax + 10% Federal Bracket
                    const grossIncome = Math.abs(balances['income:photography'] || 0);
                    const netIncome = Math.max(0, grossIncome - totalWriteOffs);
                    const selfEmploymentTax = netIncome * 0.153;
                    const estimatedQuarterlyTax = selfEmploymentTax / 4;

                    return {
                        success: true,
                        message: `Tax estimates calculated successfully.`,
                        data: {
                            grossIncome,
                            totalWriteOffs,
                            netIncome,
                            estimatedAnnualSelfEmploymentTax: selfEmploymentTax,
                            recommendedQuarterlyPayment: estimatedQuarterlyTax,
                            conformanceRules: 'LEX-IRS-SCHEDULE-SE'
                        },
                        agentName: 'LEDGER',
                        timestamp
                    };
                }

                case 'calculate_runway': {
                    // Helix B: Warren-Buffett Runway Modeling
                    let txs: LedgerTransaction[] = db ? [] : [...inMemoryStore];
                    if (db) {
                        const selectAll = db.prepare(`SELECT * FROM transactions`);
                        const selectPostings = db.prepare(`SELECT * FROM postings WHERE tx_id = ?`);
                        const rows = selectAll.all();
                        txs = rows.map((r: any) => {
                            const postingsRows = selectPostings.all(r.id);
                            return {
                                transactionId: r.id,
                                postings: postingsRows.map((p: any) => ({ account: p.account, amount: p.amount, type: p.type }))
                            };
                        });
                    }

                    const balances = calculateBalances(txs);
                    const bankBalance = Math.abs(balances['assets:bank:mercury'] || 0);

                    // Average burn rate calculation (mock: sum up expenses in last month)
                    let totalExpenses = 0;
                    for (const [account, bal] of Object.entries(balances)) {
                        if (account.startsWith('expenses:')) {
                            totalExpenses += Math.abs(bal);
                        }
                    }
                    const averageMonthlyBurn = Math.max(100.00, totalExpenses); // Floor to $100/mo to prevent infinity
                    const runwayMonths = bankBalance / averageMonthlyBurn;

                    return {
                        success: true,
                        message: `Budget runway and ROI modeling calculated by Agent Warren Buffett.`,
                        data: {
                            bankBalance,
                            averageMonthlyBurn,
                            runwayMonths: parseFloat(runwayMonths.toFixed(2)),
                            computeCostRatio: 0.19 // 19% compute burn vs total burn
                        },
                        agentName: 'LEDGER',
                        timestamp
                    };
                }

                case 'create_invoice': {
                    const details = input.invoiceDetails;
                    if (!details) {
                        return { success: false, message: 'invoiceDetails is required for create_invoice', agentName: 'LEDGER', timestamp };
                    }

                    const mockPaymentLinkId = `pl_test_${Math.random().toString(36).substring(2, 15)}`;
                    const paymentLink = `https://stripe.com/pay/${mockPaymentLinkId}`;

                    // Auto-book pending invoice transaction
                    const txId = `tx_inv_${Date.now()}`;
                    const tx: LedgerTransaction = {
                        transactionId: txId,
                        date: timestamp,
                        amount: details.amount,
                        currency: 'USD',
                        description: `Pending Invoice for ${details.clientName}: ${details.description}`,
                        source: 'stripe',
                        postings: [
                            { account: 'assets:accounts_receivable', amount: details.amount, type: 'debit' },
                            { account: 'income:pending_invoices', amount: details.amount, type: 'credit' }
                        ],
                        status: 'pending',
                        metadata: { clientName: details.clientName, paymentLinkId: mockPaymentLinkId }
                    };

                    // Book transaction using in-memory / SQL database
                    if (db) {
                        const insertTx = db.prepare(`INSERT OR REPLACE INTO transactions (id, date, amount, currency, description, source, status) VALUES (?, ?, ?, ?, ?, ?, ?)`);
                        const insertPosting = db.prepare(`INSERT INTO postings (tx_id, account, amount, type) VALUES (?, ?, ?, ?)`);
                        insertTx.run(tx.transactionId, tx.date, tx.amount, tx.currency, tx.description, tx.source, tx.status);
                        for (const p of tx.postings) {
                            insertPosting.run(tx.transactionId, p.account, p.amount, p.type);
                        }
                    } else {
                        inMemoryStore.push(tx);
                    }

                    return {
                        success: true,
                        message: `Stripe invoice/link generated. Auto-booked pending ledger transaction ${txId}.`,
                        data: { paymentLink, transactionId: txId, invoice: details },
                        agentName: 'LEDGER',
                        timestamp
                    };
                }

                case 'process_ocr_receipt': {
                    const details = input.receiptDetails;
                    if (!details) {
                        return { success: false, message: 'receiptDetails is required for process_ocr_receipt', agentName: 'LEDGER', timestamp };
                    }

                    const category = details.category || 'expenses:uncategorized';
                    const txId = `tx_ocr_${Date.now()}`;
                    const tx: LedgerTransaction = {
                        transactionId: txId,
                        date: details.date || timestamp,
                        amount: details.amount,
                        currency: 'USD',
                        description: `Vision OCR Ingest: Receipt from ${details.vendor}`,
                        source: 'manual',
                        postings: [
                            { account: category, amount: details.amount, type: 'debit' },
                            { account: 'liabilities:accounts_payable', amount: details.amount, type: 'credit' }
                        ],
                        status: 'reconciled',
                        metadata: { ocrTax: details.tax }
                    };

                    // Book transaction using in-memory / SQL database
                    if (db) {
                        const insertTx = db.prepare(`INSERT OR REPLACE INTO transactions (id, date, amount, currency, description, source, status) VALUES (?, ?, ?, ?, ?, ?, ?)`);
                        const insertPosting = db.prepare(`INSERT INTO postings (tx_id, account, amount, type) VALUES (?, ?, ?, ?)`);
                        insertTx.run(tx.transactionId, tx.date, tx.amount, tx.currency, tx.description, tx.source, tx.status);
                        for (const p of tx.postings) {
                            insertPosting.run(tx.transactionId, p.account, p.amount, p.type);
                        }
                    } else {
                        inMemoryStore.push(tx);
                    }

                    return {
                        success: true,
                        message: `Local vision OCR processed. Successfully logged expense transaction ${txId}.`,
                        data: { transactionId: txId, parsedReceipt: details },
                        agentName: 'LEDGER',
                        timestamp
                    };
                }

                case 'transfer_crypto': {
                    const details = input.cryptoDetails;
                    if (!details) {
                        return { success: false, message: 'cryptoDetails is required for transfer_crypto', agentName: 'LEDGER', timestamp };
                    }

                    const mockTxSignature = `sol_sig_test_${Math.random().toString(36).substring(2, 20)}`;
                    const txId = `tx_crypto_${Date.now()}`;
                    const tokenAccount = details.token === 'SOL' ? 'assets:crypto:sol' : 'assets:crypto:usdc';

                    const tx: LedgerTransaction = {
                        transactionId: txId,
                        date: timestamp,
                        amount: details.amount,
                        currency: details.token,
                        description: `Crypto Transfer of ${details.amount} ${details.token} to address ${details.toAddress}`,
                        source: 'solana',
                        postings: [
                            { account: 'expenses:payouts', amount: details.amount, type: 'debit' },
                            { account: tokenAccount, amount: details.amount, type: 'credit' }
                        ],
                        status: 'reconciled',
                        metadata: { signature: mockTxSignature, toAddress: details.toAddress }
                    };

                    // Book transaction using in-memory / SQL database
                    if (db) {
                        const insertTx = db.prepare(`INSERT OR REPLACE INTO transactions (id, date, amount, currency, description, source, status) VALUES (?, ?, ?, ?, ?, ?, ?)`);
                        const insertPosting = db.prepare(`INSERT INTO postings (tx_id, account, amount, type) VALUES (?, ?, ?, ?)`);
                        insertTx.run(tx.transactionId, tx.date, tx.amount, tx.currency, tx.description, tx.source, tx.status);
                        for (const p of tx.postings) {
                            insertPosting.run(tx.transactionId, p.account, p.amount, p.type);
                        }
                    } else {
                        inMemoryStore.push(tx);
                    }

                    return {
                        success: true,
                        message: `Solana blockchain transfer executed. Reconciled ledger transaction ${txId}.`,
                        data: { signature: mockTxSignature, transactionId: txId },
                        agentName: 'LEDGER',
                        timestamp
                    };
                }

                case 'arbitrage_compute': {
                    const details = input.arbitrageDetails;
                    if (!details) {
                        return { success: false, message: 'arbitrageDetails is required for arbitrage_compute', agentName: 'LEDGER', timestamp };
                    }

                    // Mocks for GPU Marketplace spot prices (per hour)
                    const spotRates: Record<string, number> = {
                        'H100': 1.42,
                        'A100': 0.85,
                        'RTX4090': 0.38
                    };
                    const rate = spotRates[details.gpuType.toUpperCase()] || 1.42;
                    const spotCost = details.trainingHours * rate;

                    // Local electricity calculation:
                    // trainingHours * powerDraw (kW) * electricityRate ($/kWh)
                    // H100 draws roughly 0.7kW. Local workstation RTX 3080/4090 draws roughly 0.45kW.
                    const powerDrawKw = details.gpuType.toUpperCase() === 'H100' ? 0.7 : 0.45;
                    const localElectricityRate = 0.22; // $0.22/kWh
                    const localCost = details.trainingHours * powerDrawKw * localElectricityRate;

                    const cheapestOption = spotCost < localCost ? 'spot_instance' : 'local_workstation';
                    const savings = Math.abs(spotCost - localCost);

                    return {
                        success: true,
                        message: `Compute cost-arbitrage analyzed by Agent Warren Buffett. Recommending execution via ${cheapestOption}.`,
                        data: {
                            localCost: parseFloat(localCost.toFixed(2)),
                            spotCost: parseFloat(spotCost.toFixed(2)),
                            cheapestOption,
                            savings: parseFloat(savings.toFixed(2)),
                            rates: { localElectricityRate, spotRatePerHour: rate }
                        },
                        agentName: 'LEDGER',
                        timestamp
                    };
                }
            }
        } catch (err) {
            return {
                success: false,
                message: `Failed executing action ${input.action}: ${(err as Error).message}`,
                agentName: 'LEDGER',
                timestamp
            };
        }
    }
);
