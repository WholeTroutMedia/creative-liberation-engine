import pkg from 'pg';
const { Client } = pkg;

async function run() {
    const client = new Client({ connectionString: 'postgresql://cle:cle_secure_pass@127.0.0.1:5432/cle_genesis' });
    await client.connect();
    
    // Reset our mock Telnyx tasks
    const r = await client.query(`UPDATE tasks SET status='queued', claimed_by=NULL, completed_at=NULL, updated=NOW() WHERE source='telnyx-sms'`);
    console.log(`Reset ${r.rowCount} tasks to queued for dispatch-worker testing`);
    
    await client.end();
}
run().catch(console.error);
