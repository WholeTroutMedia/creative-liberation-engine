import os
import requests
from datetime import datetime

# ─── Configuration ───────────────────────────────────────────────────────────
AGENT_MAIL_BASE = "https://agent-mail.wholetrou.workers.dev"
AGENT_MAIL_KEY = "cle-mail-3ZC5tHP6rnhiG9Fcpu7ldyN48kJB2YzXRKwMf0AEovg1LDmQ"
RECIPIENT = "inquiries@creativeliberationengine.org"

def generate_obsidian_instructions_html():
    return """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Creative Liberation Engine V6 — Obsidian Mobile Connection Guide</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0D0E12; color: #E2E8F0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #0D0E12; padding: 30px 0;">
    <tr>
      <td align="center">
        <table width="650" border="0" cellspacing="0" cellpadding="0" style="background-color: #12141C; border: 1px solid #232838; border-radius: 8px; overflow: hidden;">
          
          <!-- Header -->
          <tr style="background-color: #0A0B10; border-bottom: 2px solid #00FFCC;">
            <td style="padding: 25px; border-bottom: 2px solid #00FFCC;">
              <span style="font-family: 'Courier New', monospace; font-size: 10px; letter-spacing: 2px; color: #00FFCC; font-weight: bold; text-transform: uppercase;">SOVEREIGN USER WORKSPACE</span>
              <h1 style="margin: 5px 0 0 0; font-size: 20px; font-weight: 800; color: #FFFFFF; letter-spacing: -0.5px;">OBSIDIAN MOBILE CONNECTION GUIDE</h1>
              <span style="font-size: 11px; color: #8F9CAE; font-family: 'Courier New', monospace;">Context: creative-liberation-engine [docs] Vault</span>
            </td>
          </tr>
          
          <!-- Body -->
          <tr>
            <td style="padding: 25px; line-height: 1.6; font-size: 14px;">
              <div style="background-color: rgba(0, 255, 204, 0.05); border-left: 3px solid #00FFCC; padding: 15px; margin-bottom: 20px; color: #E2E8F0; font-size: 13px;">
                <strong style="color: #FFFFFF;">System Mapped Path:</strong><br/>
                PC Vault: <code style="color: #00FFCC; font-family: 'Courier New', monospace;">D:\\Google Antigravity\\Infusion Engine Brainchild\\creative-liberation-engine\\docs</code><br/>
                NAS Vault: <code style="color: #00FFCC; font-family: 'Courier New', monospace;">/app/creative-liberation-engine/docs</code>
              </div>
              
              <p>To connect the Obsidian app on your mobile device to your creative-liberation-engine vault, choose the method below based on your phone's operating system.</p>
              
              <!-- SECTION A: iOS -->
              <h3 style="color: #FFFFFF; font-size: 15px; text-transform: uppercase; font-family: 'Courier New', monospace; border-bottom: 1px solid #232838; padding-bottom: 5px; margin-top: 25px;">🍏 Connection Guide for iOS (iPhone)</h3>
              <p style="font-size: 13px; color: #8F9CAE;">Because iOS sandboxes app folders, you cannot directly open external cloud folders in mobile Obsidian. Use one of these sovereign sync strategies:</p>
              
              <strong style="color: #00E5FF; font-size: 13px; display: block; margin-top: 10px;">Method A1: Git Integration (Highly Recommended & Sovereign)</strong>
              <ol style="padding-left: 20px; font-size: 13px; color: #E2E8F0;">
                <li>Download the **Working Copy** app (the premium Git client for iOS) from the App Store.</li>
                <li>Clone your sovereign V6 repository from the NAS Forgejo server:<br/>
                    <code style="color: #00FFCC; font-family: 'Courier New', monospace;">http://127.0.0.1:3000/jaharoni/creative-liberation-engine.git</code></li>
                <li>In Working Copy, tap the repository settings, select **Link to Files App**, and target the local **Obsidian** app directory. This mounts the Git vault directly into Obsidian.</li>
                <li>Open Obsidian, choose **Open folder as vault**, and select the cloned directory.</li>
                <li>To sync changes, pull/push directly inside Working Copy or use the **Obsidian Git** community plugin inside Obsidian.</li>
              </ol>

              <strong style="color: #00E5FF; font-size: 13px; display: block; margin-top: 15px;">Method A2: WebDAV Sync via Remotely Save Plugin</strong>
              <ol style="padding-left: 20px; font-size: 13px; color: #E2E8F0;">
                <li>Create an empty vault in Obsidian iOS named `creative-liberation-engine`.</li>
                <li>Go to **Settings ➡️ Community Plugins**, search for, and install **Remotely Save**.</li>
                <li>Open Remotely Save settings and configure:
                  <ul style="padding-left: 15px; margin-top: 5px;">
                    <li>Sync Method: **WebDAV**</li>
                    <li>WebDAV URL: <code style="color: #00FFCC; font-family: 'Courier New', monospace;">https://127.0.0.1:5006/docker/creative-liberation-engine/docs</code> (Ensure Synology WebDAV package is running)</li>
                    <li>Enter your NAS username and password.</li>
                  </ul>
                </li>
                <li>Tap the sync icon in the Obsidian sidebar to trigger a two-way pull.</li>
              </ol>

              <!-- SECTION B: Android -->
              <h3 style="color: #FFFFFF; font-size: 15px; text-transform: uppercase; font-family: 'Courier New', monospace; border-bottom: 1px solid #232838; padding-bottom: 5px; margin-top: 30px;">🤖 Connection Guide for Android</h3>
              <p style="font-size: 13px; color: #8F9CAE;">Android supports open directory access, allowing you to sync any folder directly on the file system.</p>
              
              <strong style="color: #00E5FF; font-size: 13px; display: block; margin-top: 10px;">Method B1: Synology Drive Mobile Sync (Fastest NAS-Direct)</strong>
              <ol style="padding-left: 20px; font-size: 13px; color: #E2E8F0;">
                <li>Install the **Synology Drive** app from the Google Play Store.</li>
                <li>Log in using your NAS credentials (`127.0.0.1` or QuickConnect).</li>
                <li>Locate the `/app/creative-liberation-engine/docs` folder on your NAS.</li>
                <li>Set up a **Sync Task** in the app to sync this folder two-way with a folder in your phone’s local storage (e.g., `/Internal Storage/Documents/Obsidian/creative-liberation-engine`).</li>
                <li>Open Obsidian, choose **Open folder as vault**, and navigate to that synced local folder. Synology Drive will keep the phone and NAS in instant, two-way lockstep.</li>
              </ol>

              <strong style="color: #00E5FF; font-size: 13px; display: block; margin-top: 15px;">Method B2: DriveSync (Google Drive Automation)</strong>
              <ol style="padding-left: 20px; font-size: 13px; color: #E2E8F0;">
                <li>Install **Autosync for Google Drive** (DriveSync) from the Play Store.</li>
                <li>Authenticate with your primary Google Drive account.</li>
                <li>Create a folder pair syncing the Google Drive folder `Infusion Engine Brainchild/creative-liberation-engine/docs` directly to a local directory on your device.</li>
                <li>Open Obsidian and target that local folder.</li>
              </ol>
              
              <h3 style="color: #FFFFFF; font-size: 14px; text-transform: uppercase; font-family: 'Courier New', monospace; border-bottom: 1px solid #232838; padding-bottom: 5px; margin-top: 30px;">⚡ Mobile Clipper Setup (00_Inbox Integration)</h3>
              <p style="font-size: 13px; color: #E2E8F0;">
                Once synced, any markdown file you drop into the folder <code style="color: #00FFCC; font-family: 'Courier New', monospace;">00_Inbox</code> inside your vault will immediately trigger the **`obsidian_inbox_watcher.ps1`** background daemon on your local PC.
                <br/><br/>
                This daemon reads the new clipping, executes the **Teach-Back Processor**, and incorporates your captured thoughts directly into the sovereign memory spine.
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr style="background-color: #0A0B10; border-top: 1px solid #232838;">
            <td style="padding: 20px; text-align: center;">
              <span style="font-size: 11px; color: #8F9CAE; font-family: 'Courier New', monospace; line-height: 1.5; display: block;">
                CLE ENGINE V6 // MOBILE WORKSPACE EXTENSION // SECURE TRANSMISSION<br/>
                Processed autonomously by AVERI on local NAS.
              </span>
            </td>
          </tr>
          
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
"""

if __name__ == "__main__":
    html_content = generate_obsidian_instructions_html()
    
    payload = {
        "to": RECIPIENT,
        "subject": "Creative Liberation Engine V6 — Obsidian Mobile Connection Guide 🍏🤖",
        "body_text": "Please view the HTML version of this message to see the complete visual guide.",
        "body_html": html_content
    }
    
    headers = {
        "X-API-Key": AGENT_MAIL_KEY,
        "Content-Type": "application/json"
    }
    
    url = f"{AGENT_MAIL_BASE}/api/send"
    print(f"Dispatching Obsidian mobile connection guide to {RECIPIENT}...")
    try:
        response = requests.post(url, json=payload, headers=headers, timeout=20)
        if response.status_code in [200, 201]:
            print(f"✅ Obsidian connection guide successfully delivered! Status code: {response.status_code}")
        else:
            print(f"❌ Failed to dispatch guide. Status code: {response.status_code}")
            print(f"Response: {response.text}")
    except Exception as e:
        print(f"❌ Exception occurred: {e}")
