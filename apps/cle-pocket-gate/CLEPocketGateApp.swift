import SwiftUI

@main
struct CLEPocketGateApp: App {
    // Inject managers into App environment
    @StateObject private var networkManager = NetworkManager.shared
    
    var body: some Scene {
        WindowGroup {
            DashboardView()
                .environmentObject(networkManager)
                .onAppear {
                    setupAppLifecycles()
                }
        }
    }
    
    private func setupAppLifecycles() {
        print("[CLEPocketGateApp] Setting up Sovereign Pocket Gate edge lifecycles.")
        
        // Warm up SQLite databases
        _ = DatabaseManager.shared
        
        // Initial telemetry ping to the central NAS
        networkManager.checkConnection()
        
        // Establish permanent secure SSE gateway connection
        networkManager.connectSSE()
    }
}
