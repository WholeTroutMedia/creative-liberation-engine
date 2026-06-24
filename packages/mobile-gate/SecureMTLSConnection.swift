import Foundation
import Security
import UIKit

/// Resolved Dynamic Mobile Node Metadata to ensure absolute OS-agnostic compatibility.
struct DeviceMetadata {
    static var clientName: String {
        let name = UIDevice.current.name.replacingOccurrences(of: " ", with: "-").lowercased()
        let allowed = CharacterSet.alphanumerics.union(CharacterSet(charactersIn: "-_"))
        return String(name.unicodeScalars.filter { allowed.contains($0) })
    }
    
    static var displayName: String {
        return UIDevice.current.name.uppercased()
    }
}

/// High-Fidelity Client-Side mTLS Connection Broker for CLE Mobile Nodes.
/// Coordinates cryptographic handshakes with the NAS Gateway on Port 5051.
class SecureMTLSConnection: NSObject, URLSessionDelegate {
    static let shared = SecureMTLSConnection()
    
    private var session: URLSession?
    private let gatewayURL = "https://cle-core.local:5051"
    private var clientIdentity: SecIdentity?
    
    public var hasClientIdentity: Bool {
        return clientIdentity != nil
    }
    
    public var loadedCertCommonName: String? {
        guard let identity = self.clientIdentity else { return nil }
        var cert: SecCertificate?
        let status = SecIdentityCopyCertificate(identity, &cert)
        guard status == errSecSuccess, let certificate = cert else { return nil }
        if let summary = SecCertificateCopySubjectSummary(certificate) as String? {
            return summary
        }
        return nil
    }
    
    override init() {
        super.init()
        self.loadClientCredentials()
        
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = 30.0
        config.timeoutIntervalForResource = 3600.0 // Long timeouts for streaming SSE
        self.session = URLSession(configuration: config, delegate: self, delegateQueue: nil)
    }
    
    /// Loads client identity dynamically from a P12 certificate file (either in Documents folder or App Bundle)
    public func loadClientCredentials() {
        let fileManager = FileManager.default
        var p12URL: URL? = nil
        
        // 1. Scan the sandboxed Documents directory first (allows easy dynamic user import via the Files app)
        if let docsURL = fileManager.urls(for: .documentDirectory, in: .userDomainMask).first {
            do {
                let fileURLs = try fileManager.contentsOfDirectory(at: docsURL, includingPropertiesForKeys: nil)
                p12URL = fileURLs.first(where: { $0.pathExtension.lowercased() == "p12" })
            } catch {
                print("[SecureMTLS] Failed to scan documents directory: \(error.localizedDescription)")
            }
        }
        
        // 2. Scan the App Bundle as a fallback
        if p12URL == nil {
            if let bundleURLs = Bundle.main.urls(forResourcesWithExtension: "p12", subdirectory: nil) {
                p12URL = bundleURLs.first
            }
        }
        
        guard let finalURL = p12URL else {
            print("[SecureMTLS] ERROR: No client certificate bundle (.p12) found in either the Documents folder or App Bundle.")
            print("[SecureMTLS] Please import your .p12 certificate using the 'IMPORT .P12' UI button, or place it inside the 'CLEPocketGate' folder in the Files app after first launch.")
            print("[SecureMTLS] Running in simulated fallback mode.")
            return
        }
        
        print("[SecureMTLS] Found client certificate bundle: \(finalURL.lastPathComponent)")
        do {
            let p12Data = try Data(contentsOf: finalURL)
            let options: [String: Any] = [
                kSecImportExportPassphrase as String: "cle-secure"
            ]
            
            var rawItems: CFArray?
            let status = SecPKCS12Import(p12Data as CFData, options as CFDictionary, &rawItems)
            
            guard status == errSecSuccess, let items = rawItems as? [[String: Any]], !items.isEmpty else {
                print("[SecureMTLS] PKCS12 import failed with status: \(status)")
                return
            }
            
            if let identity = items[0][kSecImportItemIdentity as String] as? SecIdentity {
                self.clientIdentity = identity
                print("[SecureMTLS] Cryptographic client identity loaded successfully from \(finalURL.lastPathComponent)!")
            }
        } catch {
            print("[SecureMTLS] Failed to read P12 file: \(error.localizedDescription)")
        }
    }
    
    /// Handles the mTLS server challenge
    func urlSession(_ session: URLSession, didReceive challenge: URLAuthenticationChallenge, completionHandler: @escaping (URLSession.AuthChallengeDisposition, URLCredential?) -> Void) {
        if challenge.protectionSpace.authenticationMethod == NSURLAuthenticationMethodClientCertificate {
            if let identity = self.clientIdentity {
                let credential = URLCredential(identity: identity, certificates: nil, persistence: .forSession)
                print("[SecureMTLS] Supplying CLE ECC Client Certificate to gateway.")
                completionHandler(.useCredential, credential)
                return
            } else {
                print("[SecureMTLS] Server requested client certificate, but none loaded. Rejecting.")
                completionHandler(.cancelAuthenticationChallenge, nil)
                return
            }
        }
        
        // Self-signed CLE CA certificate trust verification bypass for private Tailscale network
        if challenge.protectionSpace.authenticationMethod == NSURLAuthenticationMethodServerTrust {
            if let serverTrust = challenge.protectionSpace.serverTrust {
                print("[SecureMTLS] Bypassing native server trust check for private CLE Root CA validation.")
                completionHandler(.useCredential, URLCredential(trust: serverTrust))
                return
            }
        }
        
        completionHandler(.performDefaultHandling, nil)
    }
    
    /// Exposes standard JSON-RPC Request Interface
    func sendRPCRequest(method: String, params: [String: Any], completion: @escaping (Result:[String: Any]?, Error: Error?) -> Void) {
        guard let session = self.session else {
            completion(nil, NSError(domain: "SecureMTLS", code: -1, userInfo: [NSLocalizedDescriptionKey: "Session not active"]))
            return
        }
        
        guard let url = URL(string: "\(gatewayURL)/mcp/request") else { return }
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        let payload: [String: Any] = [
            "jsonrpc": "2.0",
            "method": method,
            "params": params,
            "id": UUID().uuidString
        ]
        
        do {
            request.httpBody = try JSONSerialization.data(withJSONObject: payload)
        } catch {
            completion(nil, error)
            return
        }
        
        let task = session.dataTask(with: request) { data, response, error in
            if let error = error {
                completion(nil, error)
                return
            }
            
            guard let data = data else {
                completion(nil, NSError(domain: "SecureMTLS", code: -2, userInfo: [NSLocalizedDescriptionKey: "No data received"]))
                return
            }
            
            do {
                if let json = try JSONSerialization.jsonObject(with: data) as? [String: Any] {
                    if let errorObj = json["error"] as? [String: Any] {
                        let errMsg = errorObj["message"] as? String ?? "Unknown RPC error"
                        completion(nil, NSError(domain: "SecureMTLS", code: -3, userInfo: [NSLocalizedDescriptionKey: errMsg]))
                    } else {
                        completion(json["result"] as? [String: Any], nil)
                    }
                }
            } catch {
                completion(nil, error)
            }
        }
        task.resume()
    }
}
