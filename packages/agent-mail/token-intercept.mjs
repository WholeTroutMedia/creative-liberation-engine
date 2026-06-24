import https from "https";
import { execFileSync } from "child_process";
import { createWriteStream } from "fs";

let capturedToken = null;
const originalRequest = https.request.bind(https);

https.request = function(options, callback) {
    const headers = options.headers || {};
    const auth = headers["Authorization"] || headers["authorization"];
    if (auth && auth.startsWith("Bearer ") && !capturedToken) {
        capturedToken = auth.replace("Bearer ", "").trim();
        console.error("CAPTURED_TOKEN:" + capturedToken);
        process.exit(0);
    }
    return originalRequest(options, callback);
};

// Now load wrangler which will use https.request
await import("./node_modules/wrangler/wrangler-dist/cli.js");
