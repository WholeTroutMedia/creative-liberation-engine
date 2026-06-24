/** Mobile Bridge — Obsidian iOS sync. @capabilityId cap_mobile_bridge */
export class MobileBridge {
  constructor(opts = {}) { this.syncDir = opts.syncDir || '/volume2/obsidian'; }
  async syncNotes() { return { synced: 0, status: 'stub' }; }
  async pushNote(note) { return { noteId: note.memoryId, status: 'pushed' }; }
}
