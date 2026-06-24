import { fetchResult } from "wrangler/src/cfetch/index.js";

const ACCOUNT_ID = "8d718b480ea7c11a85e6f99bd12ad7af";

// Get zones
const zones = await fetchResult(`/zones?name=cleengine.systems&per_page=5`);
console.log("Zones:", JSON.stringify(zones, null, 2));
