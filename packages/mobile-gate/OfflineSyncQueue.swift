import Foundation

/// Absolute Offline-Resilient Transaction Buffer.
/// Prevents data loss during yard/garden operations when cellular signal drops.
class OfflineSyncQueue {
    static let shared = OfflineSyncQueue()
    
    private let queueKey = "cle_offline_queue"
    private let lock = NSLock()
    
    struct QueuedAction: Codable {
        let id: String
        let action: String
        let payload: [String: String] // Simple string dictionary payload
        let timestamp: Int64
    }
    
    /// Buffers a single transaction locally when offline
    func queue(action: String, payload: [String: String]) {
        lock.lock()
        defer { lock.unlock() }
        
        var currentQueue = self.getQueue()
        let newAction = QueuedAction(
            id: UUID().uuidString,
            action: action,
            payload: payload,
            timestamp: Int64(Date().timeIntervalSince1970 * 1000)
        )
        
        currentQueue.append(newAction)
        
        if let encoded = try? JSONEncoder().encode(currentQueue) {
            UserDefaults.standard.set(encoded, forKey: queueKey)
            print("[OfflineQueue] Buffered action \(action) locally. Total queue: \(currentQueue.count)")
        }
    }
    
    /// Retrieves all buffered transactions
    func getQueue() -> [QueuedAction] {
        guard let data = UserDefaults.standard.data(forKey: queueKey),
              let queue = try? JSONDecoder().decode([QueuedAction].self) else {
            return []
        }
        return queue
    }
    
    /// Flush local queue to NAS Mobile Gateway upon connection recovery
    func flushQueue(clientId: String) {
        lock.lock()
        let queueToFlush = self.getQueue()
        lock.unlock()
        
        if queueToFlush.isEmpty { return }
        
        print("[OfflineQueue] Connection recovered. Flushing \(queueToFlush.count) transactions to NAS mobile-gateway...")
        
        // Prepare sync HTTP request payload
        let urlString = "https://cle-core.local:5051/api/mobile/sync"
        guard let url = URL(string: urlString) else { return }
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue(clientId, forHTTPHeaderField: "X-SSL-Client-S-DN") // Simulate cert CN if needed in dev
        
        // Map QueuedActions to simple dictionary array
        let transactionsMap = queueToFlush.map { tx -> [String: Any] in
            return [
                "id": tx.id,
                "action": tx.action,
                "payload": tx.payload,
                "timestamp": tx.timestamp
            ]
        }
        
        let body: [String: Any] = [
            "clientId": clientId,
            "transactions": transactionsMap
        ]
        
        do {
            request.httpBody = try JSONSerialization.data(withJSONObject: body)
        } catch {
            print("[OfflineQueue] Failed to serialize sync payload: \(error)")
            return
        }
        
        // Execute request using the mTLS connection session delegate setup
        let session = URLSession(configuration: .default, delegate: SecureMTLSConnection.shared, delegateQueue: nil)
        let task = session.dataTask(with: request) { [weak self] data, response, error in
            guard let self = self else { return }
            
            if let error = error {
                print("[OfflineQueue] Playback failed: \(error.localizedDescription). Remaining buffered.")
                return
            }
            
            guard let response = response as? HTTPURLResponse, response.statusCode == 200 else {
                print("[OfflineQueue] Server rejected sync batch. Retrying later.")
                return
            }
            
            // Success! Clear the queue
            self.lock.lock()
            UserDefaults.standard.removeObject(forKey: self.queueKey)
            self.lock.unlock()
            
            print("[OfflineQueue] Sync completed successfully! Local transaction queue cleared.")
        }
        task.resume()
    }
}
