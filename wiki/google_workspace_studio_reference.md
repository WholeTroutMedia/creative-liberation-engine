---
memoryId: mem_google_workspace_studio_ref
kind: pattern
title: "Google Workspace Studio (Flows) Developer Reference & Integration Schema"
summary: "Technical guide and API/manifest structure for extending Google Workspace Studio using Apps Script custom steps, Webhooks, and Creative Liberation Engine gateway bridges."
source: KI
provenance:
  recordedBy: CORTEX
  recordedAt: 2026-06-11T08:25:00-04:00
  conversationId: 5d5473dd-4e77-41d4-bf52-8e504105f485
confidence: 1.0
retentionClass: durable
tags:
  - google-workspace-studio
  - apps-script
  - custom-steps
  - api-reference
createdAt: 2026-06-11T08:25:00-04:00
updatedAt: 2026-06-11T08:25:00-04:00
lifecycleState: active
---

# Google Workspace Studio (Flows) Developer Reference

Google Workspace Studio (Flows) allows developers to build AI-orchestrated agents directly inside Google Workspace apps (Gmail, Drive, Chat, Docs, Sheets, Calendar). By using Apps Script, we can construct **Custom Steps** that execute arbitrary code, call internal APIs, and trigger sovereign workflows in the Creative Liberation Engine.

---

## 1. Manifest Configuration (`appsscript.json`)

To expose custom steps to the Google Workspace Studio flow editor, you must define them inside the `flows` namespace within the `addOns` block of the add-on's manifest (`appsscript.json`).

```json
{
  "timeZone": "America/New_York",
  "exceptionLogging": "STACKDRIVER",
  "runtimeVersion": "V8",
  "addOns": {
    "common": {
      "name": "Creative Liberation Engine Bridge",
      "logoUrl": "https://raw.githubusercontent.com/WholeTroutMedia/creative-liberation-engine/main/assets/logo.png",
      "useLocaleFromApp": true
    },
    "flows": {
      "workflowElements": [
        {
          "id": "triggerInceptionTask",
          "state": "ACTIVE",
          "name": "Trigger Creative Liberation Engine Task",
          "description": "Dispatches a new task payload directly to the Creative Liberation Engine sovereign NAS.",
          "workflowAction": {
            "inputs": [
              {
                "id": "taskTitle",
                "description": "Title of the task or job to create",
                "cardinality": "SINGLE",
                "dataType": { "basicType": "STRING" }
              },
              {
                "id": "taskDescription",
                "description": "Detailed description or payload parameters",
                "cardinality": "SINGLE",
                "dataType": { "basicType": "STRING" }
              },
              {
                "id": "priority",
                "description": "Task priority level (e.g., P1, P2)",
                "cardinality": "SINGLE",
                "dataType": { "basicType": "STRING" }
              }
            ],
            "outputs": [
              {
                "id": "taskId",
                "description": "The unique ID of the queued task on the NAS",
                "cardinality": "SINGLE",
                "dataType": { "basicType": "STRING" }
              },
              {
                "id": "status",
                "description": "Ingress queue status (e.g., queued, running)",
                "cardinality": "SINGLE",
                "dataType": { "basicType": "STRING" }
              }
            ],
            "onExecuteFunction": "onExecuteInceptionTask",
            "onConfigFunction": "onConfigInceptionTask"
          }
        }
      ]
    }
  }
}
```

### Manifest Specifications

*   **`flows.workflowElements`**: Houses the catalog of custom steps.
*   **`dataType.basicType`**: Can be `STRING`, `INTEGER`, `BOOLEAN`, `DOUBLE`, `EMAIL_ADDRESS`, or `TIMESTAMP`.
*   **`onExecuteFunction`**: Defines the Apps Script handler run when the step is triggered.
*   **`onConfigFunction`**: (Optional) Declares the function used to generate a Card UI for custom parameters in the Studio interface.

---

## 2. Apps Script Execution Handler (`onExecuteInceptionTask`)

The execution function runs synchronously. It receives an event object containing input arguments, processes the logic, and returns a formatted `RenderAction` containing the expected output variables.

```javascript
/**
 * Executes the Creative Liberation Engine Task trigger step.
 * @param {Object} e The event object passed by Google Workspace Studio.
 * @return {RenderAction}
 */
function onExecuteInceptionTask(e) {
  try {
    // 1. Extract inputs from the event invocation payload
    const actionInvocation = e.workflow.actionInvocation;
    const inputs = actionInvocation.inputs;
    
    const taskTitle = inputs["taskTitle"] ? inputs["taskTitle"].stringValues[0] : "Untitled Spark Task";
    const taskDescription = inputs["taskDescription"] ? inputs["taskDescription"].stringValues[0] : "";
    const priority = inputs["priority"] ? inputs["priority"].stringValues[0] : "P2";

    // 2. Dispatch payload to the Creative Liberation Engine REST Gateway (Cloud Run)
    const gatewayUrl = "https://cle-server-xyz.a.run.app/api/ingress/spark"; // Replaced by live Cloud Run URL
    const secretKey = "YOUR_SHARED_HMAC_SECRET_KEY"; // Retrieve from user PropertiesService in practice
    
    const payload = {
      source: "google-spark-mesh",
      timestamp: new Date().toISOString(),
      event: "studio.custom_step_triggered",
      data: {
        title: taskTitle,
        description: taskDescription,
        priority: priority
      }
    };
    
    const payloadString = JSON.stringify(payload);
    
    // Generate HMAC-SHA256 signature for verification
    const signature = generateHmacSha256(payloadString, secretKey);

    const options = {
      method: "post",
      contentType: "application/json",
      headers: {
        "x-spark-signature": signature
      },
      payload: payloadString,
      muteHttpExceptions: true
    };

    const response = UrlFetchApp.fetch(gatewayUrl, options);
    const responseCode = response.getResponseCode();
    const responseBody = response.getContentText();

    if (responseCode !== 200 && responseCode !== 201) {
      throw new Error("Gateway responded with status: " + responseCode + " - " + responseBody);
    }

    const responseData = JSON.parse(responseBody);
    const remoteTaskId = responseData.taskId || "unknown";
    const remoteStatus = responseData.status || "failed";

    // 3. Construct outputs to match manifest requirements
    const variableDataMap = {
      "taskId": AddOnsResponseService.newVariableData().addStringValue(remoteTaskId),
      "status": AddOnsResponseService.newVariableData().addStringValue(remoteStatus)
    };

    const workflowAction = AddOnsResponseService.newReturnOutputVariablesAction()
      .setVariableDataMap(variableDataMap);

    return AddOnsResponseService.newRenderActionBuilder()
      .setHostAppAction(
        AddOnsResponseService.newHostAppAction().setWorkflowAction(workflowAction)
      )
      .build();

  } catch (err) {
    console.error("Execution error:", err.message);
    
    // Return a structured error action to the flow
    const errorAction = AddOnsResponseService.newReturnElementErrorAction()
      .setErrorType(AddOnsResponseService.ErrorType.RECOVERABLE)
      .setErrorMessage("Inception Gateway Error: " + err.message);

    return AddOnsResponseService.newRenderActionBuilder()
      .setHostAppAction(
        AddOnsResponseService.newHostAppAction().setWorkflowAction(errorAction)
      )
      .build();
  }
}

/**
 * Generates an HMAC-SHA256 signature for API payload verification.
 */
function generateHmacSha256(message, secret) {
  const byteSignature = Utilities.computeHmacSha256Signature(message, secret);
  return byteSignature.map(function(byte) {
    return ('0' + (byte & 0xFF).toString(16)).slice(-2);
  }).join('');
}
```

---

## 3. Creative Liberation Engine Ingress Gatekeeper (REST Endpoint)

To maintain **sovereign security** over our NAS network, all incoming requests from Google Cloud Services must be authenticated on the gateway (`cle-server` running on Cloud Run or a secure Cloudflare Tunnel).

### Endpoint: `POST /api/ingress/spark`

#### Signature Verification Middleware (Express.js Example)

```javascript
import crypto from 'node:crypto';

export function verifySparkSignature(req, res, next) {
  const signature = req.headers['x-spark-signature'];
  if (!signature) {
    return res.status(401).json({ error: 'Missing x-spark-signature header' });
  }

  // Retrieve shared HMAC secret key from the secure environment configuration
  const secret = process.env.GOOGLE_SPARK_WEBHOOK_SECRET;
  if (!secret) {
    return res.status(500).json({ error: 'Webhook secret key not configured' });
  }

  const payload = JSON.stringify(req.body);
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(Buffer.from(payload, 'utf8'))
    .digest('hex');

  // Time-constant comparison to avoid timing attacks
  const signatureBuffer = Buffer.from(signature, 'hex');
  const expectedBuffer = Buffer.from(expectedSignature, 'hex');

  if (signatureBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(signatureBuffer, expectedBuffer)) {
    return res.status(403).json({ error: 'Forbidden: Invalid signature signature' });
  }

  next();
}
```

---

## 4. Operational Deployment Workflow

1.  **Create Script:** Initialize a new Apps Script project at `script.google.com`.
2.  **Manifest Access:** Navigate to Project Settings and check "Show 'appsscript.json' manifest file in editor."
3.  **Merge Configuration:** Merge the `flows` block into `appsscript.json`.
4.  **Write Logic:** Copy the execution script, replacing the gateway details with our active Cloud Run gateway URL (managed by `/deploy-gcp`).
5.  **Test Deployment:** Click **Deploy > Test deployments** and choose "Google Workspace Add-on" to sideload the custom step directly into the Google Workspace Studio builder.
6.  **Admin Enablement:** Ensure the Workspace Admin settings permit using custom steps and calling external APIs via webhooks.
