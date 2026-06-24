import { describe, it, expect } from "vitest";
import { MandateService, MandateType, IntentMandate, CartMandate } from "../src/mandate.js";
import { VerifiableCredentialVerifier } from "../src/vc-verifier.js";

describe("AP2 Mandate Service Suite", () => {
  it("should successfully generate keys, sign mandates, and verify them", () => {
    const keys = MandateService.generateKeyPair();

    const intent: IntentMandate = {
      type: MandateType.INTENT,
      mandateId: "mandate-intent-001",
      userId: "user-100",
      agentId: "agent-200",
      expiration: Date.now() + 60000,
      timestamp: Date.now(),
      maxSpendLimit: 500.0,
      currency: "USD",
      authorityScope: ["groceries", "electronics"]
    };

    const signed = MandateService.signMandate(intent, keys.privateKey, keys.publicKey);
    expect(signed.signature).toBeDefined();

    const isValid = MandateService.verifyMandate(signed);
    expect(isValid).toBe(true);
  });

  it("should enforce spend limits and validate cart mandates against intent mandates", () => {
    const intent: IntentMandate = {
      type: MandateType.INTENT,
      mandateId: "mandate-intent-001",
      userId: "user-100",
      agentId: "agent-200",
      expiration: Date.now() + 60000,
      timestamp: Date.now(),
      maxSpendLimit: 100.0,
      currency: "USD",
      authorityScope: ["books"]
    };

    const cartUnderLimit: CartMandate = {
      type: MandateType.CART,
      mandateId: "mandate-cart-002",
      userId: "user-100",
      agentId: "agent-200",
      expiration: Date.now() + 60000,
      timestamp: Date.now(),
      intentMandateId: "mandate-intent-001",
      cartHash: "hash-example-123",
      totalAmount: 45.99
    };

    const cartOverLimit: CartMandate = {
      type: MandateType.CART,
      mandateId: "mandate-cart-003",
      userId: "user-100",
      agentId: "agent-200",
      expiration: Date.now() + 60000,
      timestamp: Date.now(),
      intentMandateId: "mandate-intent-001",
      cartHash: "hash-example-123",
      totalAmount: 150.00
    };

    expect(MandateService.checkCartAgainstIntent(cartUnderLimit, intent)).toBe(true);
    expect(MandateService.checkCartAgainstIntent(cartOverLimit, intent)).toBe(false);
  });

  it("should sign and verify credentials", () => {
    const keys = MandateService.generateKeyPair();

    const subject = {
      context: ["https://www.w3.org/2018/credentials/v1"],
      id: "vc-agent-auth-001",
      type: ["VerifiableCredential", "AgentAuthorityCredential"],
      issuer: "did:cle:authority",
      issuanceDate: new Date().toISOString(),
      credentialSubject: {
        id: "agent-200",
        authorizedActions: ["initiate-payments", "modify-cart"],
        allowedCategories: ["procurement"]
      }
    };

    const vc = VerifiableCredentialVerifier.signCredential(subject, keys.privateKey, "did:cle:authority#key-1");
    expect(vc.proof).toBeDefined();

    const isVerified = VerifiableCredentialVerifier.verifyCredential(vc, keys.publicKey);
    expect(isVerified).toBe(true);
  });
});
