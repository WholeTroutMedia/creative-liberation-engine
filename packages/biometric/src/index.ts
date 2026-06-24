export interface BiometricTelemetry {
  heartRate: number;
  heartRateVariabilityMs: number; // HRV
  pupilDilationMm?: number;
  voiceStressIndex?: number;
  timestamp: number;
}

export interface VerificationSignature {
  credentialId: string;
  signature: string; // Cryptographic passkey signature
  deviceType: 'Glasses' | 'Watch' | 'SecureEnclave';
}

export class BiometricManager {
  private authorizedCredentialIds: Set<string> = new Set();
  private stressThresholdHrvMs: number = 40; // Stress indicator if HRV drops below this

  public registerCredential(credentialId: string): void {
    this.authorizedCredentialIds.add(credentialId);
  }

  /**
   * Cryptographically verifies a passkey/biometric signature for human sign-off
   */
  public verifySignature(signature: VerificationSignature, challenge: string): boolean {
    if (!this.authorizedCredentialIds.has(signature.credentialId)) {
      return false;
    }
    // Simulate cryptographic verification inside the local secure enclave / TPM
    return signature.signature.startsWith('valid_sig_for_' + challenge.slice(0, 8));
  }

  /**
   * Evaluates cognitive load/stress state from real-time biometric telemetry
   * to guide adaptive context rules.
   */
  public evaluateCognitiveState(telemetry: BiometricTelemetry): {
    state: 'calm' | 'focused' | 'stressed';
    actionNeeded: 'none' | 'dampen_notifications' | 'simplify_decisions';
  } {
    if (telemetry.heartRateVariabilityMs < this.stressThresholdHrvMs) {
      return {
        state: 'stressed',
        actionNeeded: 'dampen_notifications'
      };
    }
    
    if (telemetry.heartRate > 100 && telemetry.voiceStressIndex && telemetry.voiceStressIndex > 7) {
      return {
        state: 'stressed',
        actionNeeded: 'simplify_decisions'
      };
    }

    return {
      state: 'focused',
      actionNeeded: 'none'
    };
  }
}
export default BiometricManager;
