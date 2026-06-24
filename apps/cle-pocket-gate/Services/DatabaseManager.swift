import Foundation
import SQLite3

public final class DatabaseManager {
    public static let shared = DatabaseManager()
    private var db: OpaquePointer?
    
    private init() {
        setupDatabase()
    }
    
    deinit {
        sqlite3_close(db)
    }
    
    private func setupDatabase() {
        let fileManager = FileManager.default
        guard let documentsURL = fileManager.urls(for: .documentDirectory, in: .userDomainMask).first else {
            print("[DatabaseManager] Error: Failed to resolve documents directory.")
            return
        }
        
        let dbURL = documentsURL.appendingPathComponent("cle_pocket_queue.sqlite")
        
        if sqlite3_open(dbURL.path, &db) != SQLITE_OK {
            print("[DatabaseManager] Error: Failed to open SQLite database at path: \(dbURL.path)")
            return
        }
        
        print("[DatabaseManager] SQLite Database opened successfully at: \(dbURL.path)")
        
        createTables()
    }
    
    private func createTables() {
        let createQueueTableQuery = """
        CREATE TABLE IF NOT EXISTS offline_transactions (
            id TEXT PRIMARY KEY,
            action TEXT NOT NULL,
            payload TEXT NOT NULL,
            timestamp REAL NOT NULL,
            status TEXT DEFAULT 'pending',
            attempts INTEGER DEFAULT 0,
            error TEXT
        );
        """
        
        let createTelemetryTableQuery = """
        CREATE TABLE IF NOT EXISTS local_telemetry_history (
            timestamp REAL PRIMARY KEY,
            battery_level REAL NOT NULL,
            ane_temp REAL NOT NULL,
            allocated_memory REAL NOT NULL,
            latency_ms REAL NOT NULL
        );
        """
        
        execute(query: createQueueTableQuery, description: "offline_transactions table")
        execute(query: createTelemetryTableQuery, description: "local_telemetry_history table")
    }
    
    private func execute(query: String, description: String) {
        var statement: OpaquePointer?
        if sqlite3_prepare_v2(db, query, -1, &statement, nil) == SQLITE_OK {
            if sqlite3_step(statement) == SQLITE_DONE {
                print("[DatabaseManager] \(description) initialized successfully.")
            } else {
                let errMsg = String(cString: sqlite3_errmsg(db))
                print("[DatabaseManager] Error: Failed to execute query for \(description). Error: \(errMsg)")
            }
        } else {
            let errMsg = String(cString: sqlite3_errmsg(db))
            print("[DatabaseManager] Error: Failed to prepare statement for \(description). Error: \(errMsg)")
        }
        sqlite3_finalize(statement)
    }
    
    // MARK: - Transaction Queue Operations
    
    public func queueTransaction(action: String, payload: [String: Any]) {
        let id = UUID().uuidString
        guard let jsonData = try? JSONSerialization.data(withJSONObject: payload, options: []),
              let payloadStr = String(data: jsonData, encoding: .utf8) else {
            print("[DatabaseManager] Error: Failed to serialize payload for transaction queue.")
            return
        }
        
        let query = "INSERT INTO offline_transactions (id, action, payload, timestamp, status) VALUES (?, ?, ?, ?, 'pending');"
        var statement: OpaquePointer?
        
        if sqlite3_prepare_v2(db, query, -1, &statement, nil) == SQLITE_OK {
            sqlite3_bind_text(statement, 1, (id as NSString).utf8String, -1, nil)
            sqlite3_bind_text(statement, 2, (action as NSString).utf8String, -1, nil)
            sqlite3_bind_text(statement, 3, (payloadStr as NSString).utf8String, -1, nil)
            sqlite3_bind_double(statement, 4, Date().timeIntervalSince1970)
            
            if sqlite3_step(statement) == SQLITE_DONE {
                print("[DatabaseManager] Transaction queued successfully. ID: \(id), Action: \(action)")
            } else {
                let errMsg = String(cString: sqlite3_errmsg(db))
                print("[DatabaseManager] Error: Failed to queue transaction. Error: \(errMsg)")
            }
        }
        sqlite3_finalize(statement)
    }
    
    public func fetchPendingTransactions() -> [[String: Any]] {
        let query = "SELECT id, action, payload, timestamp, attempts FROM offline_transactions WHERE status = 'pending' OR (status = 'failed' AND attempts < 5) ORDER BY timestamp ASC;"
        var statement: OpaquePointer?
        var transactions: [[String: Any]] = []
        
        if sqlite3_prepare_v2(db, query, -1, &statement, nil) == SQLITE_OK {
            while sqlite3_step(statement) == SQLITE_ROW {
                let id = String(cString: sqlite3_column_text(statement, 0))
                let action = String(cString: sqlite3_column_text(statement, 1))
                let payloadStr = String(cString: sqlite3_column_text(statement, 2))
                let timestamp = sqlite3_column_double(statement, 3)
                let attempts = sqlite3_column_int(statement, 4)
                
                var payloadDict: [String: Any] = [:]
                if let data = payloadStr.data(using: .utf8),
                   let dict = try? JSONSerialization.jsonObject(with: data, options: []) as? [String: Any] {
                    payloadDict = dict
                }
                
                transactions.append([
                    "id": id,
                    "action": action,
                    "payload": payloadDict,
                    "timestamp": timestamp,
                    "attempts": Int(attempts)
                ])
            }
        }
        sqlite3_finalize(statement)
        return transactions
    }
    
    public func updateTransactionStatus(id: String, status: String, error: String? = nil) {
        let query = "UPDATE offline_transactions SET status = ?, error = ?, attempts = attempts + 1 WHERE id = ?;"
        var statement: OpaquePointer?
        
        if sqlite3_prepare_v2(db, query, -1, &statement, nil) == SQLITE_OK {
            sqlite3_bind_text(statement, 1, (status as NSString).utf8String, -1, nil)
            if let err = error {
                sqlite3_bind_text(statement, 2, (err as NSString).utf8String, -1, nil)
            } else {
                sqlite3_bind_null(statement, 2)
            }
            sqlite3_bind_text(statement, 3, (id as NSString).utf8String, -1, nil)
            
            if sqlite3_step(statement) != SQLITE_DONE {
                let errMsg = String(cString: sqlite3_errmsg(db))
                print("[DatabaseManager] Error: Failed to update status for transaction \(id). Error: \(errMsg)")
            }
        }
        sqlite3_finalize(statement)
    }
    
    public func deleteCompletedTransactions() {
        let query = "DELETE FROM offline_transactions WHERE status = 'completed';"
        execute(query: query, description: "Clear completed transactions")
    }
    
    // MARK: - Telemetry History Operations
    
    public func logTelemetry(battery: Float, aneTemp: Float, memory: Double, latency: Double) {
        let query = "INSERT OR REPLACE INTO local_telemetry_history (timestamp, battery_level, ane_temp, allocated_memory, latency_ms) VALUES (?, ?, ?, ?, ?);"
        var statement: OpaquePointer?
        
        if sqlite3_prepare_v2(db, query, -1, &statement, nil) == SQLITE_OK {
            sqlite3_bind_double(statement, 1, Date().timeIntervalSince1970)
            sqlite3_bind_double(statement, 2, Double(battery))
            sqlite3_bind_double(statement, 3, Double(aneTemp))
            sqlite3_bind_double(statement, 4, memory)
            sqlite3_bind_double(statement, 5, latency)
            
            if sqlite3_step(statement) != SQLITE_DONE {
                let errMsg = String(cString: sqlite3_errmsg(db))
                print("[DatabaseManager] Error: Failed to log local telemetry. Error: \(errMsg)")
            }
        }
        sqlite3_finalize(statement)
        
        // Compact history (keep only last 100 entries)
        let compactQuery = "DELETE FROM local_telemetry_history WHERE timestamp NOT IN (SELECT timestamp FROM local_telemetry_history ORDER BY timestamp DESC LIMIT 100);"
        execute(query: compactQuery, description: "Compact telemetry history")
    }
    
    public func fetchLatestTelemetry() -> [String: Any]? {
        let query = "SELECT battery_level, ane_temp, allocated_memory, latency_ms, timestamp FROM local_telemetry_history ORDER BY timestamp DESC LIMIT 1;"
        var statement: OpaquePointer?
        var telemetry: [String: Any]? = nil
        
        if sqlite3_prepare_v2(db, query, -1, &statement, nil) == SQLITE_OK {
            if sqlite3_step(statement) == SQLITE_ROW {
                let battery = sqlite3_column_double(statement, 0)
                let ane = sqlite3_column_double(statement, 1)
                let memory = sqlite3_column_double(statement, 2)
                let latency = sqlite3_column_double(statement, 3)
                let timestamp = sqlite3_column_double(statement, 4)
                
                telemetry = [
                    "batteryLevel": Float(battery),
                    "aneTemp": Float(ane),
                    "allocatedMemory": memory,
                    "latencyMs": latency,
                    "timestamp": timestamp
                ]
            }
        }
        sqlite3_finalize(statement)
        return telemetry
    }
}
