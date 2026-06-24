export class AgentSpawner {
  async spawnFromManifest(_args: { agent: string; skills: string[] }) {
    return { status: 'ready' };
  }
}
