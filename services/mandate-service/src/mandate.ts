import * as crypto from "crypto";

export enum MandateType {
  INTENT = "INTENT_MANDATE",
  CART = "CART_MANDATE"
}

export interface BaseMandate {
  type: MandateType;
  mandateId: string;
  userId: string;
  agentId: string;
  expiration: number; // Unix timestamp
  timestamp: number;
}

export interface IntentMandate extends BaseMandate {
  type: MandateType.INTENT;
  maxSpendLimit: number; // Absolute limit for this agent
  currency: string;      // e.g. "USD"
  authorityScope: string[]; // Allowed merchants/categories
}

export interface CartMandate extends BaseMandate {
  type: MandateType.CART;
  intentMandateId: string; // References parent Intent Mandate
  cartHash: string;        // SHA256 of item IDs and prices
  totalAmount: number;
}

export interface SignedMandate {
  mandate: IntentMandate | CartMandate;
  signature: string;
  publicKey: string;
}

export class MandateService {
  /**
   * Helper to generate a new key pair for users/agents
   */
  public static generateKeyPair(): { publicKey: string; privateKey: string } {
    const { publicKey, privateKey } = crypto.generateKeyPairSync("ec", {
      namedCurve: "prime256v1"
    });

    return {
      publicKey: publicKey.export({ type: "spki", format: "pem" }).toString(),
      privateKey: privateKey.export({ type: "pkcs8", format: "pem" }).toString()
    };
  }

  /**
   * Sign a mandate using a private key
   */
  public static signMandate(mandate: IntentMandate | CartMandate, privateKeyPem: string, publicKeyPem: string): SignedMandate {
    const sign = crypto.createSign("SHA256");
    sign.update(JSON.stringify(mandate));
    sign.end();
    
    const signature = sign.sign(privateKeyPem, "hex");

    return {
      mandate,
      signature,
      publicKey: publicKeyPem
    };
  }

  /**
   * Verify a signed mandate
   */
  public static verifyMandate(signedMandate: SignedMandate): boolean {
    const { mandate, signature, publicKey } = signedMandate;

    // Check expiration
    if (Date.now() > mandate.expiration) {
      return false;
    }

    try {
      const verify = crypto.createVerify("SHA256");
      verify.update(JSON.stringify(mandate));
      verify.end();

      return verify.verify(publicKey, signature, "hex");
    } catch {
      return false;
    }
  }

  /**
   * Validate Cart Mandate against parent Intent Mandate constraints
   */
  public static checkCartAgainstIntent(cartMandate: CartMandate, intentMandate: IntentMandate): boolean {
    if (cartMandate.intentMandateId !== intentMandate.mandateId) return false;
    if (cartMandate.totalAmount > intentMandate.maxSpendLimit) return false;
    if (cartMandate.userId !== intentMandate.userId) return false;
    if (cartMandate.agentId !== intentMandate.agentId) return false;
    return true;
  }
}
