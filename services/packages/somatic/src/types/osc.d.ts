declare module 'osc' {
  export class UDPPort {
    constructor(options: {
      localAddress?: string;
      localPort?: number;
      remoteAddress?: string;
      remotePort?: number;
      metadata?: boolean;
    });

    on(event: string, callback: (...args: any[]) => void): void;
    open(): void;
    close(): void;
    send(msg: { address: string; args: any[] }, address?: string, port?: number): void;
  }
}
