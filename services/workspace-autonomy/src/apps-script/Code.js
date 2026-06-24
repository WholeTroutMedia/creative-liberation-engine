/**
 * Creative Liberation Engine V6 — Google Apps Script for Spark Webhook Gateway
 *
 * This Apps Script runs on Google Cloud Platform, monitors events across
 * Google Calendar, Google Sheets, Google Docs, and Google Keep (via polling),
 * signs payloads with HMAC-SHA256, and posts them to the CLE Tunnel.
 *
 * Install Instructions:
 * 1. Open script.google.com and create a new project.
 * 2. Paste this code into Code.js.
 * 3. Set Project Properties (Script Properties):
 *    - SPARK_SECRET: your shared secret (e.g., test_google_spark_secret_key_12345)
 *    - CLE_TUNNEL_URL: your public Cloudflare Tunnel ingress URL (e.g., https://tunnel.cleengine.systems/api/ingress/spark)
 * 4. Configure triggers:
 *    - Set up a time-based trigger for `pollKeepAndGmail` (every 5-15 mins).
 *    - Set up a Calendar trigger for `onCalendarChange`.
 */

const Properties = PropertiesService.getScriptProperties();

// Retrieve configuration
function getSecret() {
  return Properties.getProperty('SPARK_SECRET') || 'test_google_spark_secret_key_12345';
}

function getTunnelUrl() {
  return Properties.getProperty('CLE_TUNNEL_URL') || 'https://tunnel.cleengine.systems/api/ingress/spark';
}

/**
 * Computes HMAC-SHA256 signature for payload verification
 */
function computeSignature(payloadString, secret) {
  const key = Utilities.newBlob(secret).getBytes();
  const data = Utilities.newBlob(payloadString).getBytes();
  const signature = Utilities.computeHmacSignature(Utilities.MacAlgorithm.HMAC_SHA_256, data, key);
  
  // Convert signature bytes to hex
  return signature.map(function(byte) {
    var hex = (byte & 0xFF).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  }).join('');
}

/**
 * Sends signed payload to Creative Liberation Engine Ingress via secure tunnel
 */
function sendWebhook(event, payload) {
  const url = getTunnelUrl();
  const secret = getSecret();
  
  const eventData = {
    source: 'google-spark-apps-script',
    timestamp: new Date().toISOString(),
    event: event,
    payload: payload
  };
  
  const payloadString = JSON.stringify(eventData);
  const signature = computeSignature(payloadString, secret);
  
  console.log(`[Spark Gateway] Posting event "${event}" to ${url}...`);
  
  const options = {
    method: 'post',
    contentType: 'application/json',
    headers: {
      'x-spark-signature': signature
    },
    payload: payloadString,
    muteHttpExceptions: true
  };
  
  try {
    const response = UrlFetchApp.fetch(url, options);
    const code = response.getResponseCode();
    const content = response.getContentText();
    console.log(`[Spark Gateway] Ingress responded with code ${code}: ${content}`);
    return code === 200;
  } catch (err) {
    console.error(`[Spark Gateway] Network error posting webhook: ${err.message || err}`);
    return false;
  }
}

/**
 * Trigger: Runs when Calendar events are added/modified/deleted
 */
function onCalendarChange(e) {
  const calendarId = e.calendarId || 'primary';
  console.log(`[Calendar Trigger] Change detected in calendar: ${calendarId}`);
  
  // Fetch recent calendar changes (last 5 mins)
  const now = new Date();
  const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
  
  try {
    const calendar = CalendarApp.getCalendarById(calendarId);
    const events = calendar.getEvents(fiveMinutesAgo, new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000));
    
    events.forEach(function(event) {
      if (event.getLastUpdated().getTime() >= fiveMinutesAgo.getTime()) {
        const payload = {
          eventId: event.getId(),
          title: event.getTitle(),
          description: event.getDescription(),
          startTime: event.getStartTime().toISOString(),
          endTime: event.getEndTime().toISOString(),
          workstream: 'scheduling',
          assigned_to_capability: 'general'
        };
        sendWebhook('calendar.event_updated', payload);
      }
    });
  } catch (err) {
    console.error(`[Calendar Trigger] Error fetching events: ${err.message}`);
  }
}

/**
 * Trigger: Polling Keep & Gmail.
 */
function pollKeepAndGmail() {
  console.log('[Poll Trigger] Scanning inbox for incoming spark notes/braindumps...');
  
  // Search Gmail for unread notes with label or subject
  const threads = GmailApp.search('subject:"Brain dump" is:unread', 0, 5);
  
  threads.forEach(function(thread) {
    const messages = thread.getMessages();
    messages.forEach(function(message) {
      if (message.isUnread()) {
        const payload = {
          title: message.getSubject(),
          description: message.getPlainBody(),
          from: message.getFrom(),
          priority: 'P2',
          workstream: 'communications',
          assigned_to_capability: 'research'
        };
        
        const success = sendWebhook('keep.note_created', payload);
        if (success) {
          message.markRead(); // Mark read to prevent duplicate ingest
        }
      }
    });
  });
}

/**
 * Trigger: Runs when a Google Doc is edited
 * (Must be bound to a Google Doc to get onEdit context)
 */
function onDocEdit(e) {
  const doc = DocumentApp.getActiveDocument();
  console.log(`[Doc Trigger] Edit detected in document: ${doc.getName()} (${doc.getId()})`);
  
  const payload = {
    docId: doc.getId(),
    title: doc.getName(),
    description: `Google Doc "${doc.getName()}" edited.`,
    docUrl: doc.getUrl(),
    workstream: 'general',
    assigned_to_capability: 'general'
  };
  
  sendWebhook('docs.document_edited', payload);
}

/**
 * Trigger: Runs when a Google Sheet is edited
 * (Must be bound to a Google Sheet to get onEdit context)
 */
function onSheetEdit(e) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet();
  const range = e.range;
  console.log(`[Sheet Trigger] Edit detected in spreadsheet: ${sheet.getName()} at cell ${range.getA1Notation()}`);
  
  const payload = {
    sheetId: sheet.getId(),
    sheetName: sheet.getName(),
    cellEdited: range.getA1Notation(),
    newValue: e.value || '',
    oldValue: e.oldValue || '',
    workstream: 'general',
    assigned_to_capability: 'general'
  };
  
  sendWebhook('sheets.cell_edited', payload);
}
