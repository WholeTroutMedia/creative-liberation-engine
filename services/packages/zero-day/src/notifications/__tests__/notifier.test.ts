import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ZeroDayNotifier } from '../notifier.js';

// ─── Mock external SDKs ────────────────────────────────────────────────────────
vi.mock('resend', () => ({
    Resend: vi.fn().mockImplementation(() => ({
        emails: {
            send: vi.fn().mockResolvedValue({ id: 'mock-resend-id' }),
        },
    })),
}));

vi.mock('nodemailer', () => ({
    default: {
        createTransport: vi.fn().mockReturnValue({
            sendMail: vi.fn().mockResolvedValue({ messageId: 'mock-nodemailer' }),
        }),
    },
}));

vi.mock('axios', () => ({
    default: {
        post: vi.fn().mockResolvedValue({ status: 200 }),
    },
}));

// ─── Test helpers ──────────────────────────────────────────────────────────────

function makeNotifier(envOverrides: Record<string, string> = {}): ZeroDayNotifier {
    const saved: Record<string, string | undefined> = {};
    for (const [k, v] of Object.entries(envOverrides)) {
        saved[k] = process.env[k];
        process.env[k] = v;
    }
    const n = new ZeroDayNotifier();
    // restore
    for (const [k, v] of Object.entries(saved)) {
        if (v === undefined) delete process.env[k];
        else process.env[k] = v;
    }
    return n;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ZeroDayNotifier', () => {
    let notifier: ZeroDayNotifier;

    beforeEach(() => {
        vi.clearAllMocks();
        notifier = new ZeroDayNotifier();
    });

    // ── Core send() ────────────────────────────────────────────────────────────

    it('returns { email: false, sms: false } when no to_email or to_phone', async () => {
        const result = await notifier.send({
            type: 'contract_sent',
            client_name: 'Test Client',
        });
        expect(result.email).toBe(false);
        expect(result.sms).toBe(false);
    });

    it('returns { email: true } in dev mode (no SMTP or Resend configured)', async () => {
        const devNotifier = makeNotifier({});
        const result = await devNotifier.send({
            type: 'intake_received',
            to_email: 'client@test.com',
            client_name: 'Test Client',
        });
        expect(result.email).toBe(true); // dev fallback
    });

    it('sends via Resend when RESEND_API_KEY is set', async () => {
        const { Resend } = await import('resend');
        const mockSend = vi.fn().mockResolvedValue({ id: 'resend-id-123' });
        (Resend as any).mockImplementation(() => ({ emails: { send: mockSend } }));

        process.env.RESEND_API_KEY = 'test-key';
        const resendNotifier = new ZeroDayNotifier();

        const result = await resendNotifier.send({
            type: 'invoice_sent',
            to_email: 'client@test.com',
            client_name: 'Test Client',
            project_title: 'Brand Shoot',
            amount: 2500,
            cta_url: 'https://portal.cleengine.co/invoice/1',
        });

        expect(result.email).toBe(true);
        expect(mockSend).toHaveBeenCalledOnce();
        const callArgs = mockSend.mock.calls[0][0];
        expect(callArgs.to).toBe('client@test.com');
        expect(callArgs.subject).toMatch(/Invoice/);

        delete process.env.RESEND_API_KEY;
    });

    // ── Shorthand methods ───────────────────────────────────────────────────────

    it('sendIntakeConfirmation logs without throwing', async () => {
        await expect(
            notifier.sendIntakeConfirmation({
                client_email: 'intake@test.com',
                client_name: 'Intake Client',
                session_id: 'sess-001',
            })
        ).resolves.not.toThrow();
    });

    it('sendProjectComplete logs without throwing', async () => {
        await expect(
            notifier.sendProjectComplete({
                client_email: 'done@test.com',
                client_name: 'Done Client',
                project_name: 'Summer Campaign',
                portal_url: 'https://portal.test/assets',
            })
        ).resolves.not.toThrow();
    });

    it('sendPaymentReceived logs without throwing', async () => {
        await expect(
            notifier.sendPaymentReceived({
                client_email: 'paid@test.com',
                amount: 1200,
                invoice_id: 'inv-42',
            })
        ).resolves.not.toThrow();
    });

    it('sendInvoiceSent logs without throwing', async () => {
        await expect(
            notifier.sendInvoiceSent({
                client_email: 'billing@test.com',
                client_name: 'Billing Client',
                invoice_number: 'INV-2026-001',
                amount: 4500,
                due_date: '2026-04-01',
                invoice_url: 'https://invoice.test/001',
            })
        ).resolves.not.toThrow();
    });

    it('sendMagicLink logs without throwing', async () => {
        await expect(
            notifier.sendMagicLink({
                client_email: 'portal@test.com',
                client_name: 'Portal Client',
                magic_link: 'https://portal.test/magic/abc123',
                expires_in_minutes: 30,
            })
        ).resolves.not.toThrow();
    });

    it('sendValidationLink logs without throwing', async () => {
        await expect(
            notifier.sendValidationLink({
                client_email: 'validate@test.com',
                client_name: 'Validator',
                project_name: 'Genesis Deploy',
                validation_url: 'https://validate.test/deploy/v1',
            })
        ).resolves.not.toThrow();
    });

    // ── SMS ────────────────────────────────────────────────────────────────────

    it('skips SMS when TELNYX_API_KEY is not set', async () => {
        const result = await notifier.send({
            type: 'deliverable_sent',
            to_phone: '+15551234567',
            client_name: 'SMS Client',
            project_title: 'Photo Edit',
        });
        expect(result.sms).toBe(false);
    });

    // ── Email template coverage ────────────────────────────────────────────────

    const allTypes = [
        'intake_received',
        'contract_sent',
        'invoice_sent',
        'deliverable_sent',
        'approval_received',
        'revision_requested',
        'project_complete',
        'follow_up_needed',
        'payment_received',
        'payment_overdue',
        'validation_sent',
    ] as const;

    allTypes.forEach((type) => {
        it(`template "${type}" renders without throwing`, async () => {
            await expect(
                notifier.send({
                    type,
                    to_email: 'template@test.com',
                    client_name: 'Template Test',
                    project_title: 'Project X',
                    amount: 1000,
                    cta_url: 'https://portal.test/cta',
                    cta_label: 'Click Here',
                    body: 'Optional body text',
                })
            ).resolves.not.toThrow();
        });
    });
});
