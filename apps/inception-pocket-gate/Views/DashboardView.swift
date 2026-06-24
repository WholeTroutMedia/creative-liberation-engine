import SwiftUI

public struct DashboardView: View {
    @StateObject private var networkManager = NetworkManager.shared
    @State private var mockBattery: Float = 94.0
    @State private var mockAneTemp: Float = 36.4
    @State private var isGlowAnimating = false
    
    public init() {}
    
    public var body: some View {
        ZStack {
            // Dark Brutalist Background with gradient ambient glows
            Color.black.ignoresSafeArea()
            
            RadialGradient(
                colors: [Color(red: 0.1, green: 0.0, blue: 0.05), Color.black],
                center: .topTrailing,
                startRadius: 10,
                endRadius: 500
            )
            .ignoresSafeArea()
            
            VStack(spacing: 20) {
                // Header (Brutalist style)
                HStack {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("CLE OS")
                            .font(.system(.caption, design: .monospaced))
                            .foregroundColor(.gray)
                            .tracking(3)
                        Text("POCKET EDGE NODE")
                            .font(.system(.title2, design: .rounded))
                            .fontWeight(.black)
                            .foregroundColor(.white)
                    }
                    Spacer()
                    
                    // Connected Status Glowing Badge
                    HStack(spacing: 6) {
                        Circle()
                            .fill(networkManager.isConnected ? Color.green : Color.red)
                            .frame(width: 8, height: 8)
                            .scaleEffect(isGlowAnimating ? 1.3 : 1.0)
                            .opacity(isGlowAnimating ? 0.7 : 1.0)
                            .onAppear {
                                withAnimation(Animation.easeInOut(duration: 1.2).repeatForever(autoreverses: true)) {
                                    isGlowAnimating = true
                                }
                            }
                        
                        Text(networkManager.isConnected ? "CONNECTED" : "ISOLATED")
                            .font(.system(.caption2, design: .monospaced))
                            .fontWeight(.bold)
                            .foregroundColor(networkManager.isConnected ? .green : .red)
                    }
                    .padding(.horizontal, 10)
                    .padding(.vertical, 6)
                    .background(
                        RoundedRectangle(cornerRadius: 12)
                            .stroke(networkManager.isConnected ? Color.green.opacity(0.3) : Color.red.opacity(0.3), lineWidth: 1)
                    )
                }
                .padding(.horizontal)
                
                // Real-time Status Card (Glassmorphic)
                VStack(spacing: 16) {
                    HStack {
                        VStack(alignment: .leading, spacing: 4) {
                            Text("LATENCY TO NAS CORE")
                                .font(.system(.caption2, design: .monospaced))
                                .foregroundColor(.gray)
                            HStack(alignment: .firstTextBaseline, spacing: 2) {
                                Text(networkManager.isConnected ? String(format: "%.1f", networkManager.latencyMs) : "--")
                                    .font(.system(.largeTitle, design: .monospaced))
                                    .fontWeight(.bold)
                                    .foregroundColor(.white)
                                Text("ms")
                                    .font(.caption)
                                    .foregroundColor(.gray)
                            }
                        }
                        Spacer()
                        Image(systemName: "bolt.horizontal.circle.fill")
                            .font(.largeTitle)
                            .foregroundColor(networkManager.isConnected ? .cyan : .gray)
                    }
                    
                    Divider()
                        .background(Color.white.opacity(0.1))
                    
                    HStack(spacing: 20) {
                        // Diagnostic 1: ANE Temp
                        VStack(alignment: .leading, spacing: 4) {
                            Text("ANE TEMP")
                                .font(.system(.caption2, design: .monospaced))
                                .foregroundColor(.gray)
                            Text(String(format: "%.1f°C", mockAneTemp))
                                .font(.system(.headline, design: .monospaced))
                                .foregroundColor(.white)
                        }
                        Spacer()
                        // Diagnostic 2: Battery
                        VStack(alignment: .leading, spacing: 4) {
                            Text("BATTERY")
                                .font(.system(.caption2, design: .monospaced))
                                .foregroundColor(.gray)
                            Text(String(format: "%.0f%%", mockBattery))
                                .font(.system(.headline, design: .monospaced))
                                .foregroundColor(.white)
                        }
                        Spacer()
                        // Diagnostic 3: Queue Status
                        VStack(alignment: .leading, spacing: 4) {
                            Text("OFFLINE QUEUE")
                                .font(.system(.caption2, design: .monospaced))
                                .foregroundColor(.gray)
                            Text("\(networkManager.queuedCount) queued")
                                .font(.system(.headline, design: .monospaced))
                                .foregroundColor(networkManager.queuedCount > 0 ? .orange : .green)
                        }
                    }
                }
                .padding()
                .background(
                    RoundedRectangle(cornerRadius: 20)
                        .fill(Color.white.opacity(0.04))
                )
                .overlay(
                    RoundedRectangle(cornerRadius: 20)
                        .stroke(Color.white.opacity(0.08), lineWidth: 1)
                )
                .padding(.horizontal)
                
                // Intuitively exposes Siri shortcuts instruction
                VStack(alignment: .leading, spacing: 10) {
                    Text("Siri App Intents")
                        .font(.system(.headline, design: .rounded))
                        .foregroundColor(.white)
                    
                    Text("The Apple Intelligence layer routes commands autonomously directly to your pocket node via voice controls:")
                        .font(.caption)
                        .foregroundColor(.gray)
                        .lineSpacing(4)
                    
                    VStack(alignment: .leading, spacing: 8) {
                        Label("Remember [something] in CLE", systemImage: "brain.head.profile")
                        Label("Start a task in the Creative Liberation Engine", systemImage: "play.cpu")
                        Label("Toggle home mesh entity in CLE", systemImage: "house.fill")
                    }
                    .font(.system(.footnote, design: .monospaced))
                    .foregroundColor(.cyan)
                    .padding(.top, 4)
                }
                .padding()
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(
                    RoundedRectangle(cornerRadius: 16)
                        .fill(Color.white.opacity(0.02))
                )
                .overlay(
                    RoundedRectangle(cornerRadius: 16)
                        .stroke(Color.white.opacity(0.04), lineWidth: 1)
                )
                .padding(.horizontal)
                
                Spacer()
                
                // Operational Action Panel
                VStack(spacing: 12) {
                    Button(action: {
                        networkManager.checkConnection()
                    }) {
                        HStack {
                            Image(systemName: "waveform.path.ecg")
                            Text("DIAGNOSTIC HANDSHAKE")
                                .fontWeight(.bold)
                        }
                        .font(.system(.subheadline, design: .monospaced))
                        .foregroundColor(.black)
                        .frame(maxWidth: .infinity)
                        .padding()
                        .background(Color.cyan)
                        .cornerRadius(12)
                    }
                    
                    Button(action: {
                        networkManager.syncOfflineQueue()
                    }) {
                        HStack {
                            if networkManager.isSyncing {
                                ProgressView()
                                    .progressViewStyle(CircularProgressViewStyle(tint: .white))
                                    .padding(.trailing, 5)
                            } else {
                                Image(systemName: "arrow.triangle.2.circlepath")
                            }
                            Text(networkManager.isSyncing ? "SYNCING PLAYBACK LEDGER..." : "FORCE SYNCHRONISE QUEUE")
                                .fontWeight(.bold)
                        }
                        .font(.system(.subheadline, design: .monospaced))
                        .foregroundColor(.white)
                        .frame(maxWidth: .infinity)
                        .padding()
                        .background(
                            RoundedRectangle(cornerRadius: 12)
                                .stroke(Color.white.opacity(0.2), lineWidth: 1)
                        )
                    }
                    .disabled(networkManager.isSyncing)
                }
                .padding(.horizontal)
                .padding(.bottom, 20)
            }
            .padding(.top, 10)
        }
    }
}

// SwiftUI Preview Helper
struct DashboardView_Previews: PreviewProvider {
    static var previews: some View {
        DashboardView()
    }
}
