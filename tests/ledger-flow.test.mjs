/**
 * E2E Ledger Flow Verification Test Suite
 *
 * Runs double-entry check, transaction logging, Plaid reconciliation matchmaking,
 * tax estimations, and runway modeling.
 *
 * Run: npx tsx tests/ledger-flow.test.mjs
 */

import { LedgerFlow } from '../packages/genkit/src/flows/ledger.js';
import assert from 'assert';

let passed = 0;
let failed = 0;
const failures = [];

async function test(name, fn) {
  try {
    await fn();
    console.log(`  ✅ ${name}`);
    passed++;
  } catch (err) {
    console.log(`  ❌ ${name}`);
    console.log(`     ${err.stack || err.message}`);
    failed++;
    failures.push({ name, error: err.message });
  }
}

console.log('\n╔════════════════════════════════════════════════════════╗');
console.log('║   V6 E2E Ledger Swarm Parallel Helix Verification     ║');
console.log('╚════════════════════════════════════════════════════════╝\n');

async function runSuite() {
  // ─── 1. DOUBLE-ENTRY CHECK ────────────────────────────────────────────────
  await test('Booking a balanced double-entry transaction succeeds', async () => {
    const res = await LedgerFlow({
      action: 'add_transaction',
      transaction: {
        transactionId: 'tx_test_001',
        date: new Date().toISOString(),
        amount: 120.00,
        currency: 'USD',
        description: 'Monthly Adobe Creative Cloud subscription',
        source: 'stripe',
        postings: [
          { account: 'expenses:software:creative', amount: 120.00, type: 'debit' },
          { account: 'assets:bank:mercury', amount: 120.00, type: 'credit' }
        ],
        status: 'reconciled'
      }
    });

    assert.strictEqual(res.success, true);
    assert.ok(res.message.includes('Successfully booked transaction'));
    assert.strictEqual(res.data.transactionId, 'tx_test_001');
  });

  await test('Booking an unbalanced double-entry transaction fails', async () => {
    const res = await LedgerFlow({
      action: 'add_transaction',
      transaction: {
        transactionId: 'tx_test_002',
        date: new Date().toISOString(),
        amount: 120.00,
        currency: 'USD',
        description: 'Unbalanced posting trial',
        source: 'stripe',
        postings: [
          { account: 'expenses:software:creative', amount: 120.00, type: 'debit' },
          { account: 'assets:bank:mercury', amount: 110.00, type: 'credit' } // Unbalanced by $10
        ],
        status: 'reconciled'
      }
    });

    assert.strictEqual(res.success, false);
    assert.ok(res.message.includes('unbalanced'));
  });

  // ─── 2. QUERY & BALANCES ──────────────────────────────────────────────────
  await test('Querying ledger returns transactions and calculated balances', async () => {
    const res = await LedgerFlow({
      action: 'query_ledger'
    });

    assert.strictEqual(res.success, true);
    assert.ok(Array.isArray(res.data.transactions));
    assert.ok(res.data.transactions.length >= 3); // seeded defaults + tx_test_001

    const balances = res.data.balances;
    assert.ok(balances['assets:bank:mercury'] !== undefined);
  });

  await test('Querying ledger with account filter works', async () => {
    const res = await LedgerFlow({
      action: 'query_ledger',
      accountFilter: 'expenses:compute'
    });

    assert.strictEqual(res.success, true);
    assert.ok(res.data.transactions.every(tx => 
      tx.postings.some(p => p.account.includes('expenses:compute'))
    ));
  });

  // ─── 3. PLAID RECONCILIATION MATCHMAKING ──────────────────────────────────
  await test('Reconciliation automatically matches items with identical amounts', async () => {
    const res = await LedgerFlow({
      action: 'reconcile_transactions',
      unreconciledItems: [
        { bankTxId: 'bank_001', amount: 1500.00, description: 'Direct Deposit Aharoni', date: '2026-06-15' },
        { bankTxId: 'bank_002', amount: -50.00, description: 'Coffee shop payment', date: '2026-06-16' }
      ]
    });

    assert.strictEqual(res.success, true);
    const matches = res.data.matches;
    assert.strictEqual(matches.length, 2);

    // First transaction should match Alice Smith photoshoot invoice ($1500)
    assert.strictEqual(matches[0].bankTxId, 'bank_001');
    assert.strictEqual(matches[0].confidenceScore, 0.95);
    assert.strictEqual(matches[0].matchedEntity.invoiceId, 'inv_812');

    // Second transaction has no match
    assert.strictEqual(matches[1].bankTxId, 'bank_002');
    assert.strictEqual(matches[1].confidenceScore, 0.20);
    assert.strictEqual(matches[1].matchedEntity, null);
  });

  // ─── 4. TAX COMPLIANCE ESTIMATES ──────────────────────────────────────────
  await test('Tax estimation calculates gross income, write-offs, and estimated payment', async () => {
    const res = await LedgerFlow({
      action: 'estimate_taxes',
      taxYear: 2026
    });

    assert.strictEqual(res.success, true);
    const data = res.data;
    assert.ok(data.grossIncome > 0);
    assert.ok(data.totalWriteOffs > 0);
    assert.ok(data.estimatedAnnualSelfEmploymentTax > 0);
    assert.strictEqual(data.conformanceRules, 'LEX-IRS-SCHEDULE-SE');
  });

  // ─── 5. RUNWAY & ROI MODELING ─────────────────────────────────────────────
  await test('Runway modeling calculates bank balances and burn rates', async () => {
    const res = await LedgerFlow({
      action: 'calculate_runway'
    });

    assert.strictEqual(res.success, true);
    const data = res.data;
    assert.ok(data.bankBalance > 0);
    assert.ok(data.averageMonthlyBurn > 0);
    assert.ok(data.runwayMonths > 0);
    assert.strictEqual(data.computeCostRatio, 0.19);
  });

  // ─── 6. AUTONOMOUS INVOICING ──────────────────────────────────────────────
  await test('Generating invoice creates Stripe payment link and books pending ledger record', async () => {
    const res = await LedgerFlow({
      action: 'create_invoice',
      invoiceDetails: {
        clientName: 'Bob Vance',
        amount: 800.00,
        description: 'Refrigeration photoshoot inquire #901'
      }
    });

    assert.strictEqual(res.success, true);
    assert.ok(res.data.paymentLink.includes('https://stripe.com/pay/pl_test_'));
    assert.ok(res.data.transactionId.startsWith('tx_inv_'));
  });

  // ─── 7. VISION OCR FOR RECEIPTS ───────────────────────────────────────────
  await test('Processing local vision OCR receipt extracts transaction details and logs expense', async () => {
    const res = await LedgerFlow({
      action: 'process_ocr_receipt',
      receiptDetails: {
        vendor: 'AWS Cloud Services',
        amount: 55.40,
        tax: 4.20,
        category: 'expenses:software:cloud'
      }
    });

    assert.strictEqual(res.success, true);
    assert.ok(res.data.transactionId.startsWith('tx_ocr_'));
    assert.strictEqual(res.data.parsedReceipt.vendor, 'AWS Cloud Services');
  });

  // ─── 8. CRYPTO PAYMENT RAILS ──────────────────────────────────────────────
  await test('Executing crypto transfer triggers Solana gateway and updates ledger', async () => {
    const res = await LedgerFlow({
      action: 'transfer_crypto',
      cryptoDetails: {
        toAddress: '9xQeWvRN148nyA7SQ2CD2X7GvJk5b9C1yV1rV1rV1rV1',
        amount: 5.5,
        token: 'SOL'
      }
    });

    assert.strictEqual(res.success, true);
    assert.ok(res.data.signature.startsWith('sol_sig_test_'));
    assert.ok(res.data.transactionId.startsWith('tx_crypto_'));
  });

  // ─── 9. COMPUTE ARBITRAGE MODELING ────────────────────────────────────────
  await test('Compute arbitrage calculates spot vs local costs and recommends action', async () => {
    const res = await LedgerFlow({
      action: 'arbitrage_compute',
      arbitrageDetails: {
        trainingHours: 24,
        gpuType: 'H100'
      }
    });

    assert.strictEqual(res.success, true);
    const data = res.data;
    assert.ok(data.localCost > 0);
    assert.ok(data.spotCost > 0);
    assert.ok(data.cheapestOption === 'spot_instance' || data.cheapestOption === 'local_workstation');
    assert.strictEqual(data.rates.spotRatePerHour, 1.42);
  });

  console.log('\n╔════════════════════════════════════════════════════════╗');
  console.log(`║   Ledger Suite Results: ${passed} passed, ${failed} failed           ║`);
  console.log('╚════════════════════════════════════════════════════════╝\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runSuite();
