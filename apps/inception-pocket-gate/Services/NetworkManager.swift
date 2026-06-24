import Foundation
import Combine

public final class NetworkManager: NSObject, URLSessionDelegate, URLSessionTaskDelegate {
    public static let shared = NetworkManager()
    
    // Publishers for UI Binding
    @Published public var isConnected = false
    @Published public var isSyncing = false
    @Published public var latencyMs: Double = 0.0
    @Published public var queuedCount: Int = 0
    
    private let baseURL = "https://127.0.0.1:5052" // Gateway proxy port (Helix D)
    private var session: URLSession!
    private var sseTask: URLSessionDataTask?
    private var isSseConnecting = false
    
    private override init() {
        super.init()
        setupSession()
        startPingTimer()
    }
    
    private func setupSession() {
        let configuration = URLSessionConfiguration.default
        configuration.timeoutIntervalForRequest = 10.0
        configuration.timeoutIntervalForResource = 30.0
        
        // Helix D security requirement: mTLS setup
        self.session = URLSession(configuration: configuration, delegate: self, delegateQueue: OperationQueue.main)
    }
    
    // MARK: - mTLS Certificate Handshake
    
    public func urlSession(_ session: URLSession, task: URLSessionTask, didReceive challenge: URLAuthenticationChallenge, completionHandler: @escaping (URLSession.AuthChallengeDisposition, URLCredential?) -> Void) {
        
        // 1. Handle SSL/TLS trust bypass for local self-signed core certificate
        if challenge.protectionSpace.authenticationMethod == NSURLAuthenticationMethodServerTrust {
            if let serverTrust = challenge.protectionSpace.serverTrust {
                completionHandler(.useCredential, URLCredential(trust: serverTrust))
                return
            }
        }
        
        // 2. Bound pocket node mTLS certificate validation (Helix D mTLS gate)
        if challenge.protectionSpace.authenticationMethod == NSURLAuthenticationMethodClientCertificate {
            print("[NetworkManager] Received client certificate authorization request from gateway.")
            
            // In a real device setup, the certificate and key are imported into the app bundle
            // or secured via Apple Keychain.
            if let certPath = Bundle.main.path(forResource: "iphone15-promax", ofType: "p12") {
                do {
                    let certData = try Data(contentsOf: URL(fileURLWithPath: certPath))
                    let options = [kSecImportExportPassphrase as String: "sovereign-pocket-passphrase"]
                    
                    var rawItems: CFArray?
                    let status = SecPKCS12Import(certData as CFData, options as CFDictionary, &rawItems)
                    
                    if status == errSecSuccess, let items = rawItems as? [[String: Any]], let firstItem = items.first {
                        if let identity = firstItem[kSecImportItemIdentity as String] as? SecIdentity {
                            let credential = URLCredential(identity: identity, certificates: nil, persistence: .forSession)
                            completionHandler(.useCredential, credential)
                            print("[NetworkManager] Successfully bound mTLS Client Certificate to URLSession.")
                            return
                        }
                    }
                } catch {
                    print("[NetworkManager] Failed to read PKCS12 file: \(error.localizedDescription)")
                }
            }
        }
        
        completionHandler(.performDefaultHandling, nil)
    }
    
    // MARK: - Network Diagnostic Handshake
    
    private func startPingTimer() {
        Timer.scheduledTimer(withTimeInterval: 5.0, repeats: true) { [weak self] _ in
            self?.checkConnection()
        }
    }
    
    public func checkConnection() {
        guard let url = URL(string: "\(baseURL)/health") else { return }
        
        let start = Date()
        let task = session.dataTask(with: url) { [weak self] data, response, error in
            guard let self = self else { return }
            
            DispatchQueue.main.async {
                if let error = error {
                    print("[NetworkManager] Core Mesh offline or Tailscale isolated: \(error.localizedDescription)")
                    self.isConnected = false
                    self.latencyMs = -1.0
                } else if let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 {
                    self.isConnected = true
                    self.latencyMs = Date().timeIntervalSince(start) * 1000.0
                    
                    // Log to local history for wellness diagnostics
                    let battery = Float(38.0) // Mock values or fetched via Apple UIDevice
                    let memory = Double(512.4)
                    DatabaseManager.shared.logTelemetry(battery: battery, aneTemp: 35.0, memory: memory, latency: self.latencyMs)
                    
                    // Restart SSE listening if disconnected
                    if self.sseTask == nil && !self.isSseConnecting {
                        self.connectSSE()
                    }
                    
                    // Auto-sync offline transaction buffer
                    self.syncOfflineQueue()
                } else {
                    self.isConnected = false
                    self.latencyMs = -1.0
                }
                
                // Update queue size count
                self.queuedCount = DatabaseManager.shared.fetchPendingTransactions().count
            }
        }
        task.resume()
    }
    
    // MARK: - Server-Sent Events (SSE) Mesh Ingress
    
    public func connectSSE() {
        guard let url = URL(string: "\(baseURL)/mcp/sse") else { return }
        isSseConnecting = true
        
        print("[NetworkManager] Connecting to SSE mesh notification stream...")
        
        let request = URLRequest(url: url)
        let sseSession = URLSession(configuration: .default, delegate: self, delegateQueue: nil)
        
        sseTask = sseSession.dataTask(with: request)
        sseTask?.resume()
        
        // Listeners for SSE events (custom data tasks can override)
        // Here, we handle direct Server-Sent updates in iOS background modes
        isSseConnecting = false
    }
    
    public func disconnectSSE() {
        sseTask?.cancel()
        sseTask = nil
        print("[NetworkManager] SSE disconnected.")
    }
    
    // MARK: - Outgoing Tool Request API (MCP over mTLS)
    
    public func invokeMCPTool(method: String, params: [String: Any], completion: @escaping (Result<[String: Any], Error>) -> Void) {
        guard let url = URL(string: "\(baseURL)/mcp/request") else { return }
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.addValue("application/json", forHTTPHeaderField: "Content-Type")
        
        let jsonRPC: [String: Any] = [
            "jsonrpc": "2.0",
            "method": method,
            "params": params,
            "id": UUID().uuidString
        ]
        
        guard let httpBody = try? JSONSerialization.data(withJSONObject: jsonRPC, options: []) else {
            completion(.failure(NSError(domain: "SerializationError", code: -1, userInfo: nil)))
            return
        }
        
        request.httpBody = httpBody
        
        // Fallback for offline mode: Cache locally if network is down
        if !isConnected {
            print("[NetworkManager] Network isolated. Caching \(method) to local SQLite buffer.")
            DatabaseManager.shared.queueTransaction(action: method, payload: params)
            completion(.failure(NSError(domain: "NetworkIsolatedError", code: -2, userInfo: [NSLocalizedDescriptionKey: "Network unreachable. Action buffered locally."])))
            return
        }
        
        let task = session.dataTask(with: request) { data, response, error in
            if let error = error {
                completion(.failure(error))
                return
            }
            
            guard let data = data else {
                completion(.failure(NSError(domain: "EmptyResponseError", code: -3, userInfo: nil)))
                return
            }
            
            do {
                if let json = try JSONSerialization.jsonObject(with: data, options: []) as? [String: Any] {
                    if let errorObj = json["error"] as? [String: Any] {
                        let errMsg = errorObj["message"] as? String ?? "Unknown error"
                        completion(.failure(NSError(domain: "JSONRPCError", code: -4, userInfo: [NSLocalizedDescriptionKey: errMsg])))
                    } else if let result = json["result"] as? [String: Any] {
                        completion(.success(result))
                    } else {
                        completion(.success(json))
                    }
                }
            } catch {
                completion(.failure(error))
            }
        }
        task.resume()
    }
    
    // MARK: - High-Reliability Offline Ingestion Playback
    
    public func syncOfflineQueue() {
        let pending = DatabaseManager.shared.fetchPendingTransactions()
        guard !pending.isEmpty, !isSyncing else { return }
        
        isSyncing = true
        print("[NetworkManager] Found \(pending.count) locally buffered operations. Beginning sync playback...")
        
        guard let url = URL(string: "\(baseURL)/api/mobile/sync") else {
            isSyncing = false
            return
        }
        
        // Convert to gateway-compatible structure
        var transactionsList: [[String: Any]] = []
        for tx in pending {
            transactionsList.append([
                "id": tx["id"] as? String ?? UUID().uuidString,
                "action": tx["action"] as? String ?? "",
                "payload": tx["payload"] as? [String: Any] ?? [:],
                "timestamp": Int((tx["timestamp"] as? Double ?? Date().timeIntervalSince1970) * 1000.0)
            ])
        }
        
        let syncPayload: [String: Any] = [
            "clientId": "iphone15-promax",
            "transactions": transactionsList
        ]
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.addValue("application/json", forHTTPHeaderField: "Content-Type")
        
        guard let httpBody = try? JSONSerialization.data(withJSONObject: syncPayload, options: []) else {
            isSyncing = false
            return
        }
        request.httpBody = httpBody
        
        let task = session.dataTask(with: request) { [weak self] data, response, error in
            guard let self = self else { return }
            
            defer {
                DispatchQueue.main.async {
                    self.isSyncing = false
                    self.queuedCount = DatabaseManager.shared.fetchPendingTransactions().count
                }
            }
            
            if let error = error {
                print("[NetworkManager] Failed to post offline sync payload: \(error.localizedDescription)")
                return
            }
            
            guard let response = response as? HTTPURLResponse, response.statusCode == 200 else {
                print("[NetworkManager] Gateway rejected synchronization package.")
                return
            }
            
            print("[NetworkManager] Offline queue synchronization batch parsed and stored by central Core!")
            
            // Locally update SQLite status mapping
            for tx in pending {
                if let txId = tx["id"] as? String {
                    DatabaseManager.shared.updateTransactionStatus(id: txId, status: "completed")
                }
            }
            
            // Clean up database storage limits
            DatabaseManager.shared.deleteCompletedTransactions()
        }
        task.resume()
    }
}
