const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Creative Liberation Engine Phase 3: Multi-Modal Ingestion
// Connects to the headless NAS browser, watches the active video stream, 
// takes periodic screenshots, and uses Vision AI to generate contextual descriptions.

const CDP_URL = process.env.CDP_URL || 'http://127.0.0.1:9224';
const SNAPSHOT_INTERVAL_MS = 10000; // Take a screenshot every 10 seconds
const RETRY_INTERVAL_MS = 15000; // Retry connection every 15 seconds

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "YOUR_API_KEY");

async function fileToGenerativePart(filePath, mimeType) {
  return {
    inlineData: {
      data: Buffer.from(fs.readFileSync(filePath)).toString("base64"),
      mimeType
    },
  };
}

async function analyzeFrame(imagePath) {
  try {
    const model = genAI.getGenerativeModel({ model: process.env.MODEL_CLOUD_VISION || "gemini-2.5-flash" });
    const prompt = "You are an expert technical archivist. Analyze this video frame. Extract any code, diagrams, or key text visible on screen. Provide a highly dense, technical summary of what is being shown.";
    
    const imagePart = await fileToGenerativePart(imagePath, "image/png");
    const result = await model.generateContent([prompt, imagePart]);
    const response = await result.response;
    return response.text();
  } catch (err) {
    console.error("[!] Vision API error:", err.message || err);
    return null;
  }
}

async function startMultiModalIngestion() {
  while (true) {
    console.log(`[*] Phase 3: Connecting to NAS Headless Browser at ${CDP_URL}...`);
    let browser;
    try {
      // Fetch the active WebSocket debugger URL
      const response = await fetch(`${CDP_URL}/json/version`);
      const data = await response.json();
      const wsUrl = data.webSocketDebuggerUrl;
      
      browser = await puppeteer.connect({ browserWSEndpoint: wsUrl });
      console.log("[+] Connected to NAS Chromium.");
      
      // Keep checking for an active page
      while (true) {
        try {
          const pages = await browser.pages();
          const activePage = pages.find(p => p && !p.url().includes('about:blank'));
          
          if (!activePage) {
            console.log("[*] No active content page found. Waiting...");
            await new Promise(resolve => setTimeout(resolve, RETRY_INTERVAL_MS));
            continue;
          }
          
          const url = activePage.url();
          console.log(`[+] Monitoring page: ${url}`);
          
          const outputDir = path.join(__dirname, 'ingestion_output', Date.now().toString());
          fs.mkdirSync(outputDir, { recursive: true });
          
          console.log(`[*] Starting multi-modal snapshot cycle (every ${SNAPSHOT_INTERVAL_MS/1000}s)`);
          
          let frameCount = 0;
          
          // Run the snapshot cycle until page is closed or navigates
          while (true) {
            try {
              // Verify page is still open and active
              if (activePage.isClosed()) {
                console.log("[*] Active page was closed. Re-scanning pages...");
                break;
              }
              
              frameCount++;
              const screenshotPath = path.join(outputDir, `frame_${frameCount}.png`);
              
              console.log(`\n[+] Capturing frame ${frameCount}...`);
              await activePage.screenshot({ path: screenshotPath });
              
              console.log(`[*] Analyzing frame ${frameCount} with Vision AI...`);
              const analysis = await analyzeFrame(screenshotPath);
              
              if (analysis) {
                console.log(`[Result Frame ${frameCount}]:\n`, analysis.substring(0, 150) + "...\n");
                
                // Save analysis to JSON
                const metadata = {
                  timestamp: new Date().toISOString(),
                  source_url: url,
                  frame: frameCount,
                  visual_context: analysis
                };
                
                fs.writeFileSync(
                  path.join(outputDir, `frame_${frameCount}_meta.json`), 
                  JSON.stringify(metadata, null, 2)
                );
              }
              
              await new Promise(resolve => setTimeout(resolve, SNAPSHOT_INTERVAL_MS));
            } catch (pageErr) {
              console.error("[!] Error during page snapshot cycle:", pageErr.message);
              break; // Break the snapshot loop to re-locate active page
            }
          }
        } catch (innerErr) {
          console.error("[!] Error inspecting browser pages:", innerErr.message);
          break; // Break the pages loop to reconnect
        }
      }
    } catch (err) {
      console.error("[!] Connection failed:", err.message || err);
    }
    
    console.log(`[*] Retrying connection in ${RETRY_INTERVAL_MS/1000}s...`);
    await new Promise(resolve => setTimeout(resolve, RETRY_INTERVAL_MS));
  }
}

startMultiModalIngestion();
