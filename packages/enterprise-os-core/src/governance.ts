import { EventEmitter } from 'events';
import { z } from 'zod';

export type GovernanceLevel = 'autonomous' | 'human_in_the_loop' | 'strict_audit';

export interface AuditLog {
  timestamp: string;
  source: string;
  target: string;
  payload: any;
  status: 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED' | 'AUTO_EXECUTED' | 'AUDITED';
  approvedBy?: string;
}

export class ConstitutionMap {
  private auditTrail: AuditLog[] = [];
  
  constructor(private eventBus: EventEmitter) {}

  public evaluateDispatch(
    source: string, 
    target: string, 
    payload: any, 
    level: GovernanceLevel
  ): boolean {
    const logEntry: AuditLog = {
      timestamp: new Date().toISOString(),
      source,
      target,
      payload,
      status: 'AUTO_EXECUTED'
    };

    if (level === 'strict_audit') {
      logEntry.status = 'AUDITED';
      this.auditTrail.push(logEntry);
      this.flushAuditLog(logEntry);
      return true; // Still autonomous but heavily audited
    }

    if (level === 'human_in_the_loop') {
      logEntry.status = 'PENDING_APPROVAL';
      this.auditTrail.push(logEntry);
      this.requestHumanApproval(logEntry);
      return false; // Blocks immediate execution
    }

    // autonomous
    this.auditTrail.push(logEntry);
    return true; 
  }

  private flushAuditLog(entry: AuditLog): void {
    console.log(`[STRICT AUDIT] Writing to immutable ledger:`, JSON.stringify(entry));
    // In a real system, this writes to a WORM drive, NAS log, or blockchain
  }

  private requestHumanApproval(entry: AuditLog): void {
    console.log(`[HUMAN IN THE LOOP] Approval required for dispatch: ${entry.source} -> ${entry.target}`);
    console.log(`[HUMAN IN THE LOOP] Payload summary:`, JSON.stringify(entry.payload).substring(0, 100));
    
    // Emit event that UI or dispatch server can listen to
    this.eventBus.emit('approval:required', entry);
  }

  public approveDispatch(logIndex: number, approver: string): void {
    if (this.auditTrail[logIndex] && this.auditTrail[logIndex].status === 'PENDING_APPROVAL') {
      this.auditTrail[logIndex].status = 'APPROVED';
      this.auditTrail[logIndex].approvedBy = approver;
      console.log(`[HUMAN IN THE LOOP] Dispatch approved by ${approver}`);
      // Re-emit or continue execution logic goes here
    }
  }

  public getAuditTrail(): AuditLog[] {
    return [...this.auditTrail];
  }
}
