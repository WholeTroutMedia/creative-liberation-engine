import * as crypto from "crypto";

export interface VerifiableCredential {
  context: string[];
  id: string;
  type: string[];
  issuer: string;
  issuanceDate: string;
  expirationDate?: string;
  credentialSubject: {
    id: string; // The agent ID
    authorizedActions: string[];
    allowedCategories: string[];
  };
  proof?: {
    type: string;
    created: string;
    verificationMethod: string;
    proofPurpose: string;
    jws: string;
  };
}

export class VerifiableCredentialVerifier {
  /**
   * Simple JWS/Signature proof generation helper
   */
  public static signCredential(
    credentialWithoutProof: Omit<VerifiableCredential, "proof">,
    issuerPrivateKeyPem: string,
    verificationMethod: string
  ): VerifiableCredential {
    const sign = crypto.createSign("SHA256");
    sign.update(JSON.stringify(credentialWithoutProof));
    sign.end();

    const signature = sign.sign(issuerPrivateKeyPem, "base64url");

    return {
      ...credentialWithoutProof,
      proof: {
        type: "JsonWebSignature2020",
        created: new Date().toISOString(),
        verificationMethod,
        proofPurpose: "assertionMethod",
        jws: signature
      }
    };
  }

  /**
   * Verify Verifiable Credential signatures
   */
  public static verifyCredential(credential: VerifiableCredential, issuerPublicKeyPem: string): boolean {
    if (!credential.proof) return false;

    const { proof, ...credentialWithoutProof } = credential;

    try {
      const verify = crypto.createVerify("SHA256");
      verify.update(JSON.stringify(credentialWithoutProof));
      verify.end();

      return verify.verify(issuerPublicKeyPem, proof.jws, "base64url");
    } catch {
      return false;
    }
  }
}
