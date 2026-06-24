import { 
    ensureStore, 
    getUserIntegration, 
    setUserIntegration, 
    deleteUserIntegration 
} from './store.js';

async function runTest() {
    console.log("Starting User Integrations Database Test...");
    
    // Set environment variables for DB if needed
    process.env.POSTGRES_URL = process.env.POSTGRES_URL || 'postgresql://cle:cle_secure_pass@127.0.0.1:5432/cle_genesis';
    
    try {
        // 1. Bootstrap store and migrate tables
        console.log("[Test] Running ensureStore() to run database migrations...");
        await ensureStore();
        
        const testUid = "jaharoni";
        const testPlatform = "metricool";
        const testAccountId = "6365754";
        const testCredentials = {
            blogId: "6365754",
            userId: "4904839",
            userToken: "sec_token_9999_xyz_abc_123"
        };
        const testMetadata = {
            brandName: "Creative Liberation Engine System",
            channels: ["facebook", "instagram", "threads", "youtube"]
        };
        
        // 2. Clean up any existing test data
        console.log("[Test] Preparing clean test environment...");
        await deleteUserIntegration(testUid, testPlatform);
        
        // 3. Write integration
        console.log(`[Test] Writing integration for ${testUid} on ${testPlatform}...`);
        await setUserIntegration(testUid, testPlatform, testAccountId, testCredentials, testMetadata);
        
        // 4. Retrieve integration and verify decryption
        console.log("[Test] Retrieving integration from DB...");
        const integration = await getUserIntegration(testUid, testPlatform);
        
        if (!integration) {
            throw new Error("FAIL: Retrieve returned undefined!");
        }
        
        console.log("SUCCESS: Retrieved integration:", JSON.stringify(integration, null, 2));
        
        // Verify credentials matches
        if (integration.credentials.userToken !== testCredentials.userToken) {
            throw new Error("FAIL: Decrypted userToken mismatch!");
        }
        if (integration.accountId !== testAccountId) {
            throw new Error("FAIL: accountId mismatch!");
        }
        if (integration.metadata.brandName !== testMetadata.brandName) {
            throw new Error("FAIL: metadata mismatch!");
        }
        console.log("SUCCESS: Credentials successfully decrypted and verified.");
        
        // 5. Update / Conflict test
        console.log("[Test] Testing conflict resolution / updates...");
        const updatedCredentials = { ...testCredentials, userToken: "updated_token_456" };
        await setUserIntegration(testUid, testPlatform, testAccountId, updatedCredentials, testMetadata);
        
        const updated = await getUserIntegration(testUid, testPlatform);
        if (!updated || updated.credentials.userToken !== "updated_token_456") {
            throw new Error("FAIL: Update conflict resolution failed!");
        }
        console.log("SUCCESS: Conflict resolution and upsert verified.");
        
        // 6. Delete test
        console.log("[Test] Deleting integration...");
        const deleteSuccess = await deleteUserIntegration(testUid, testPlatform);
        if (!deleteSuccess) {
            throw new Error("FAIL: deleteUserIntegration returned false!");
        }
        
        const empty = await getUserIntegration(testUid, testPlatform);
        if (empty !== undefined) {
            throw new Error("FAIL: Integration still exists after deletion!");
        }
        console.log("SUCCESS: Deletion verified.");
        console.log("\nALL DATABASE TESTS PASSED SUCCESSFULLY!");
        process.exit(0);
        
    } catch (err) {
        console.error("TEST FAILED:", err);
        process.exit(1);
    }
}

runTest();
