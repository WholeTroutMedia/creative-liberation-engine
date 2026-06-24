import SwiftUI
import UniformTypeIdentifiers

/// Stunning Pitch Black Brutalist Dashboard for the Pocket CLE Node (iPhone 17 Pro Max).
/// Leverages modern, harmonized color schemes, micro-animations, and visual indicators.
struct ContentView: View {
    @State private var isConnected = true
    @State private var activeTasksCount = 4
    @State private var batteryTemp: CGFloat = 34.2
    @State private var localInferenceSpeed = 15.4
    @State private var logText = ""
    @State private var syncQueueSize = 0
    @State private var statusMessage = "Sovereign Mesh: Connected via Tailscale"
    
    // Cryptographic Certificate Management
    @State private var isCertLoaded = false
    @State private var certName = "None"
    @State private var isShowingFileImporter = false
    
    var body: some View {
        ZStack {
            // Cinematic Pitch Black Brutalist background
            Color.black.ignoresSafeArea()
            
            // Glowing neon geometric mesh accent
            VStack {
                HStack {
                    Circle()
                        .fill(Color(red: 0.1, green: 0.8, blue: 0.4)) // Harmonious Cyber Green
                        .frame(width: 8, height: 8)
                        .blur(radius: 1)
                        .scaleEffect(isConnected ? 1.2 : 0.8)
                        .animation(.easeInOut(duration: 1.0).repeatForever(), value: isConnected)
                    
                    Text("NODE: \(DeviceMetadata.displayName)")
                        .font(.system(.caption, design: .monospaced))
                        .foregroundColor(.gray)
                    
                    Spacer()
                    
                    Text("ONLINE")
                        .font(.system(.caption, design: .monospaced))
                        .fontWeight(.bold)
                        .foregroundColor(isConnected ? Color(red: 0.1, green: 0.8, blue: 0.4) : .red)
                }
                .padding()
                
                // Giant Cinematic Status Card
                VStack(alignment: .leading, spacing: 12) {
                    Text("AVERI MESH CONTEXT")
                        .font(.system(.caption2, design: .monospaced))
                        .foregroundColor(.gray)
                    
                    Text("CLE V6 ACTIVE")
                        .font(.system(.title2, design: .rounded))
                        .fontWeight(.heavy)
                        .foregroundColor(.white)
                    
                    Text(statusMessage)
                        .font(.system(.subheadline, design: .monospaced))
                        .foregroundColor(isConnected ? .emerald : .orange)
                }
                .padding()
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(
                    RoundedRectangle(cornerRadius: 12)
                        .fill(Color(white: 0.05))
                        .overlay(
                            RoundedRectangle(cornerRadius: 12)
                                .stroke(Color(white: 0.15), lineWidth: 1)
                        )
                )
                .padding(.horizontal)
                
                // Cryptographic Identity & Certificate Management Card
                VStack(alignment: .leading, spacing: 10) {
                    HStack {
                        VStack(alignment: .leading, spacing: 4) {
                            Text("SOVEREIGN DEVI-KEY STATUS")
                                .font(.system(.caption2, design: .monospaced))
                                .foregroundColor(.gray)
                            
                            HStack(spacing: 6) {
                                Circle()
                                    .fill(isCertLoaded ? Color.emerald : Color.orange)
                                    .frame(width: 6, height: 6)
                                Text(isCertLoaded ? "VALID mTLS IDENTITY ACTIVE" : "NO CRYPTOGRAPHIC IDENTITY")
                                    .font(.system(.caption, design: .monospaced))
                                    .fontWeight(.bold)
                                    .foregroundColor(isCertLoaded ? .emerald : .orange)
                            }
                            
                            if isCertLoaded {
                                Text("CN: \(certName)")
                                    .font(.system(.caption2, design: .monospaced))
                                    .foregroundColor(.gray)
                            }
                        }
                        
                        Spacer()
                        
                        Button(action: { isShowingFileImporter = true }) {
                            Text(isCertLoaded ? "REPLACE .P12" : "IMPORT .P12")
                                .font(.system(.caption, design: .monospaced))
                                .fontWeight(.bold)
                                .foregroundColor(.black)
                                .padding(.horizontal, 12)
                                .padding(.vertical, 6)
                                .background(Color.white)
                                .cornerRadius(6)
                        }
                    }
                }
                .padding()
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(
                    RoundedRectangle(cornerRadius: 12)
                        .fill(Color(white: 0.05))
                        .overlay(
                            RoundedRectangle(cornerRadius: 12)
                                .stroke(isCertLoaded ? Color.emerald.opacity(0.3) : Color(white: 0.15), lineWidth: 1)
                        )
                )
                .padding(.horizontal)
                .padding(.top, 8)
                
                // Diagnostics Grid
                LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 16) {
                    // Cell 1: Local Model stats
                    VStack(alignment: .leading) {
                        Text("LOCAL LiteRT-LM")
                            .font(.system(.caption2, design: .monospaced))
                            .foregroundColor(.gray)
                        Text("Gemma 4")
                            .font(.system(.title3, design: .rounded))
                            .fontWeight(.bold)
                            .foregroundColor(.white)
                        Text("\(localInferenceSpeed, specifier: "%.1f") tok/sec")
                            .font(.system(.caption, design: .monospaced))
                            .foregroundColor(.emerald)
                    }
                    .padding()
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(Color(white: 0.04))
                    .cornerRadius(8)
                    .overlay(RoundedRectangle(cornerRadius: 8).stroke(Color(white: 0.1), lineWidth: 1))
                    
                    // Cell 2: Offload Engine
                    VStack(alignment: .leading) {
                        Text("OFFLOAD TARGET")
                            .font(.system(.caption2, design: .monospaced))
                            .foregroundColor(.gray)
                        Text("NAS RTX 4090")
                            .font(.system(.title3, design: .rounded))
                            .fontWeight(.bold)
                            .foregroundColor(.white)
                        Text("vLLM FP16 Mode")
                            .font(.system(.caption, design: .monospaced))
                            .foregroundColor(.violet)
                    }
                    .padding()
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(Color(white: 0.04))
                    .cornerRadius(8)
                    .overlay(RoundedRectangle(cornerRadius: 8).stroke(Color(white: 0.1), lineWidth: 1))
                    
                    // Cell 3: Vitals
                    VStack(alignment: .leading) {
                        Text("ANE TEMPERATURE")
                            .font(.system(.caption2, design: .monospaced))
                            .foregroundColor(.gray)
                        Text("\(batteryTemp, specifier: "%.1f")°C")
                            .font(.system(.title3, design: .rounded))
                            .fontWeight(.bold)
                            .foregroundColor(.white)
                        Text("SAGE Metric: Normal")
                            .font(.system(.caption, design: .monospaced))
                            .foregroundColor(.gray)
                    }
                    .padding()
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(Color(white: 0.04))
                    .cornerRadius(8)
                    .overlay(RoundedRectangle(cornerRadius: 8).stroke(Color(white: 0.1), lineWidth: 1))
                    
                    // Cell 4: Offline queue buffer
                    VStack(alignment: .leading) {
                        Text("OFFLINE BUFFER")
                            .font(.system(.caption2, design: .monospaced))
                            .foregroundColor(.gray)
                        Text("\(syncQueueSize) Pending")
                            .font(.system(.title3, design: .rounded))
                            .fontWeight(.bold)
                            .foregroundColor(syncQueueSize > 0 ? .orange : .white)
                        Text("Auto-Flushes")
                            .font(.system(.caption, design: .monospaced))
                            .foregroundColor(.gray)
                    }
                    .padding()
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(Color(white: 0.04))
                    .cornerRadius(8)
                    .overlay(RoundedRectangle(cornerRadius: 8).stroke(Color(white: 0.1), lineWidth: 1))
                }
                .padding()
                
                // Logging Action Panel
                VStack(alignment: .leading) {
                    Text("DIRECT SENSORY STREAM")
                        .font(.system(.caption2, design: .monospaced))
                        .foregroundColor(.gray)
                        .padding(.horizontal)
                    
                    TextField("Enter yard logs, soil readings, vehicle anomalies...", text: $logText)
                        .padding()
                        .background(Color(white: 0.06))
                        .foregroundColor(.white)
                        .cornerRadius(8)
                        .overlay(RoundedRectangle(cornerRadius: 8).stroke(Color(white: 0.15), lineWidth: 1))
                        .padding(.horizontal)
                    
                    HStack {
                        Button(action: triggerLogSensory) {
                            HStack {
                                Image(systemName: "mic.fill")
                                Text("LOG EVENT")
                                    .fontWeight(.bold)
                            }
                            .font(.system(.subheadline, design: .monospaced))
                            .foregroundColor(.black)
                            .padding()
                            .frame(maxWidth: .infinity)
                            .background(Color.white)
                            .cornerRadius(8)
                        }
                        
                        Button(action: triggerOfflineSim) {
                            Text("SIM DISCONNECT")
                                .font(.system(.caption, design: .monospaced))
                                .foregroundColor(.gray)
                                .padding()
                                .background(Color(white: 0.08))
                                .cornerRadius(8)
                                .overlay(RoundedRectangle(cornerRadius: 8).stroke(Color(white: 0.15), lineWidth: 1))
                        }
                    }
                    .padding()
                }
                
                Spacer()
            }
        }
        .onAppear {
            self.refreshQueueSize()
            self.checkLoadedCertificate()
            self.createPlaceholderImportInstructions()
        }
        .fileImporter(
            isPresented: $isShowingFileImporter,
            allowedContentTypes: [UTType(filenameExtension: "p12") ?? .data],
            allowsMultipleSelection: false
        ) { result in
            switch result {
            case .success(let urls):
                guard let selectedURL = urls.first else { return }
                self.importCertificate(from: selectedURL)
            case .failure(let error):
                self.statusMessage = "Import failed: \(error.localizedDescription)"
            }
        }
    }
    
    private func triggerLogSensory() {
        guard !logText.isEmpty else { return }
        
        let content = logText
        logText = ""
        
        if isConnected {
            statusMessage = "Broadcasting sensory capture..."
            SecureMTLSConnection.shared.sendRPCRequest(method: "log_sensory_event", params: ["content": content]) { result, error in
                DispatchQueue.main.async {
                    if let error = error {
                        self.statusMessage = "Sync failed: \(error.localizedDescription). Saved to offline queue."
                        OfflineSyncQueue.shared.queue(action: "log_sensory", payload: ["content": content])
                        self.refreshQueueSize()
                    } else {
                        self.statusMessage = "Event logged successfully directly to central Obsidian Spine!"
                    }
                }
            }
        } else {
            statusMessage = "Offline. Event saved to secure SQLite queue."
            OfflineSyncQueue.shared.queue(action: "log_sensory", payload: ["content": content])
            self.refreshQueueSize()
        }
    }
    
    private func triggerOfflineSim() {
        isConnected.toggle()
        if isConnected {
            statusMessage = "Connection recovered! Initiating auto-flush..."
            OfflineSyncQueue.shared.flushQueue(clientId: DeviceMetadata.clientName)
            DispatchQueue.main.asyncAfter(deadline: .now() + 2.0) {
                self.refreshQueueSize()
            }
        } else {
            statusMessage = "Disconnected from Tailscale. Sovereign offline mode engaged."
        }
    }
    
    private func refreshQueueSize() {
        self.syncQueueSize = OfflineSyncQueue.shared.getQueue().count
    }
    
    private func checkLoadedCertificate() {
        self.isCertLoaded = SecureMTLSConnection.shared.hasClientIdentity
        if self.isCertLoaded {
            self.certName = SecureMTLSConnection.shared.loadedCertCommonName ?? "Client Identity"
        } else {
            self.certName = "None"
        }
    }
    
    private func createPlaceholderImportInstructions() {
        // Automatically create a placeholder file in the sandboxed Documents folder.
        // This forces iOS to instantly generate and show the app's folder in the native "Files app" on launch!
        let fileManager = FileManager.default
        guard let docsURL = fileManager.urls(for: .documentDirectory, in: .userDomainMask).first else { return }
        
        let guideURL = docsURL.appendingPathComponent("CERTIFICATE_IMPORT_GUIDE.txt")
        if !fileManager.fileExists(atPath: guideURL.path) {
            let guideText = """
            ============================================================
            CLE POCKET GATE: CRYPTOGRAPHIC CLIENT CERTIFICATE GUIDE
            ============================================================
            To connect this mobile node securely via mutual TLS (mTLS):
            
            Option A (Fastest - Built-In Import):
            1. Tap "IMPORT .P12" inside the CLEPocketGate App UI.
            2. Choose any .p12 certificate file (e.g. downloaded to your device or iCloud).
            
            Option B (Files App Direct Sync):
            1. Place your .p12 file directly into this folder ("CLEPocketGate").
            2. Relaunch or open the app, and the certificate will auto-detect!
            
            Passphrase for client certificate: cle-secure
            ============================================================
            """
            try? guideText.write(to: guideURL, atomically: true, encoding: .utf8)
            print("[ContentView] Placeholder guide written. App directory is now active in Files app.")
        }
    }
    
    private func importCertificate(from url: URL) {
        guard url.startAccessingSecurityScopedResource() else {
            self.statusMessage = "Access denied to selected certificate."
            return
        }
        defer { url.stopAccessingSecurityScopedResource() }
        
        do {
            let data = try Data(contentsOf: url)
            
            let fileManager = FileManager.default
            guard let docsURL = fileManager.urls(for: .documentDirectory, in: .userDomainMask).first else { return }
            let destinationURL = docsURL.appendingPathComponent("client.p12")
            
            if fileManager.fileExists(atPath: destinationURL.path) {
                try fileManager.removeItem(at: destinationURL)
            }
            try data.write(to: destinationURL)
            
            // Trigger credentials reload in connection broker
            SecureMTLSConnection.shared.loadClientCredentials()
            
            DispatchQueue.main.async {
                self.checkLoadedCertificate()
                if self.isCertLoaded {
                    self.statusMessage = "Certificate successfully imported and validated!"
                } else {
                    self.statusMessage = "Certificate copied, but connection broker failed to unlock. Verify passphrase."
                }
            }
        } catch {
            DispatchQueue.main.async {
                self.statusMessage = "Import failed: \(error.localizedDescription)"
            }
        }
    }
}

// ── CUSTOM GLOWING NEON COLORS ───────────────────────────────────────────────
extension Color {
    static let emerald = Color(red: 0.0, green: 0.9, blue: 0.4)
    static let violet = Color(red: 0.6, green: 0.3, blue: 1.0)
}

struct ContentView_Previews: PreviewProvider {
    static var previews: some View {
        ContentView()
    }
}
