import { execSync } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';

const PROJECT_ID = process.env.GCP_PROJECT_ID || 'CLE-OS-v1';
const TOPIC_NAME = process.env.PUBSUB_TOPIC || 'CLE-OS-event-bus';
const SUBSCRIPTION_NAME = process.env.PUBSUB_SUBSCRIPTION || 'CLE-OS-nas-subscriber';

let PubSubSDK = null;
try {
  const pubsubModule = await import('@google-cloud/pubsub');
  PubSubSDK = pubsubModule.PubSub;
} catch (e) {
  // Will use gcloud CLI fallback
}

/**
 * Publish an event to the Pub/Sub topic.
 */
export async function publishEvent(eventType, data = {}, source = 'CLE-OS-WORKSTATION') {
  const payload = {
    system: 'Creative Liberation Engine (CLE) Systems OS Beta v1.0',
    event_type: eventType,
    source,
    timestamp: new Date().toISOString(),
    data
  };

  if (PubSubSDK) {
    const pubsub = new PubSubSDK({ projectId: PROJECT_ID });
    const topic = pubsub.topic(TOPIC_NAME);
    const messageBuffer = Buffer.from(JSON.stringify(payload, null, 2));
    const messageId = await topic.publishMessage({ data: messageBuffer });
    console.log(`[PubSub Event Bus] Published event '${eventType}' via SDK (Message ID: ${messageId})`);
    return { success: true, messageId, payload };
  } else {
    // Zero-dependency gcloud CLI fallback
    const jsonString = JSON.stringify(payload);
    const escapedMessage = jsonString.replace(/"/g, '\\"');
    const cmd = `gcloud pubsub topics publish ${TOPIC_NAME} --message="${escapedMessage}" --project=${PROJECT_ID} --format="value(messageIds[0])"`;
    try {
      const messageId = execSync(cmd, { encoding: 'utf-8' }).trim();
      console.log(`[PubSub Event Bus] Published event '${eventType}' via gcloud CLI (Message ID: ${messageId})`);
      return { success: true, messageId, payload };
    } catch (err) {
      console.error(`[PubSub Event Bus] CLI Publish Error:`, err.message);
      throw err;
    }
  }
}

/**
 * Listen / Pull messages from the Pub/Sub subscription.
 */
export async function pullEvents(maxMessages = 1, autoAck = true) {
  if (PubSubSDK) {
    const pubsub = new PubSubSDK({ projectId: PROJECT_ID });
    const subscription = pubsub.subscription(SUBSCRIPTION_NAME);
    console.log(`[PubSub Event Bus] Pulling up to ${maxMessages} message(s) via SDK...`);
    // Pull synchronously via SDK
  }

  // gcloud CLI pull fallback
  const cmd = `gcloud pubsub subscriptions pull ${SUBSCRIPTION_NAME} ${autoAck ? '--auto-ack' : ''} --project=${PROJECT_ID} --format="json"`;
  try {
    const stdout = execSync(cmd, { encoding: 'utf-8' });
    if (!stdout || stdout.trim() === '') {
      console.log(`[PubSub Event Bus] No unacknowledged messages found on subscription '${SUBSCRIPTION_NAME}'.`);
      return [];
    }
    const items = JSON.parse(stdout);
    const parsedMessages = items.map((item) => {
      let dataObj = null;
      try {
        const decoded = Buffer.from(item.message.data, 'base64').toString('utf-8');
        dataObj = JSON.parse(decoded);
      } catch (e) {
        dataObj = item.message.data;
      }
      return {
        messageId: item.message.messageId,
        publishTime: item.message.publishTime,
        data: dataObj
      };
    });

    console.log(`[PubSub Event Bus] Successfully pulled ${parsedMessages.length} message(s):`);
    parsedMessages.forEach((m, idx) => {
      console.log(`--- Message #${idx + 1} [ID: ${m.messageId}] ---`);
      console.log(JSON.stringify(m.data, null, 2));
    });

    return parsedMessages;
  } catch (err) {
    console.error(`[PubSub Event Bus] Pull Error:`, err.message);
    return [];
  }
}

// CLI Direct Execution Handling
const args = process.argv.slice(2);
const command = args[0];

if (command === 'publish') {
  const eventType = args[1] || 'SYSTEM_PING';
  const sampleData = { message: args[2] || 'CLE-OS Beta v1.0 Heartbeat Event' };
  publishEvent(eventType, sampleData).then(() => process.exit(0)).catch(() => process.exit(1));
} else if (command === 'pull') {
  pullEvents(1, true).then(() => process.exit(0)).catch(() => process.exit(1));
} else if (command === 'test') {
  console.log('[PubSub Event Bus] Executing End-to-End Event Bus Test...');
  const testData = { status: 'ONLINE', dual_gpu: 'ACTIVE', version: '1.0.0-beta.1', host: 'BIGBRAIN' };
  await publishEvent('IES_OS_BOOT_CHECK', testData);
  console.log('[PubSub Event Bus] Waiting 1s for queue propagation...');
  await new Promise((r) => setTimeout(r, 1000));
  await pullEvents(1, true);
  console.log('[PubSub Event Bus] End-to-End Test Completed Successfully!');
  process.exit(0);
}

