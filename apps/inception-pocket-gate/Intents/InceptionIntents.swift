import Foundation
import AppIntents

// MARK: - App Intents Metadata Registry

public struct CLEShortcutsProvider: AppShortcutsProvider {
    public static var appShortcuts: [AppShortcut] {
        return [
            AppShortcut(
                intent: StartTaskIntent(),
                phrases: [
                    "Start a task in the Creative Liberation Engine",
                    "Tell Creative Liberation Engine to \(.title)"
                ],
                shortTitle: "Start CLE Task",
                systemImageName: "play.cpu"
            ),
            AppShortcut(
                intent: AddMemoryIntent(),
                phrases: [
                    "Remember \(.content) in CLE",
                    "Add an CLE memory"
                ],
                shortTitle: "Add CLE Memory",
                systemImageName: "brain.head.profile"
            ),
            AppShortcut(
                intent: ToggleHomeEntityIntent(),
                phrases: [
                    "Toggle home mesh entity in CLE",
                    "Switch CLE light"
                ],
                shortTitle: "Toggle Home Mesh",
                systemImageName: "house.fill"
            ),
            AppShortcut(
                intent: SyncOfflineQueueIntent(),
                phrases: [
                    "Sync offline CLE queue",
                    "Flush pocket node cache"
                ],
                shortTitle: "Sync CLE Mesh",
                systemImageName: "arrow.triangle.2.circlepath.circle"
            )
        ]
    }
}

// MARK: - INTENT 1: Start Task Intent

public struct StartTaskIntent: AppIntent {
    public static var title: LocalizedStringKey = "Start CLE Task"
    public static var description = IntentDescription("Invokes an autonomous agent task or skill execution pipeline on the central NAS.")
    
    @Parameter(title: "Task Description or Title")
    public var title: String
    
    @Parameter(title: "Priority Level", default: "medium")
    public var priority: String
    
    public init() {}
    
    public func perform() async throws -> some IntentResult & ReturnsValue<String> {
        let params: [String: Any] = [
            "title": title,
            "description": "Triggered via Apple Shortcuts / Siri Voice Intent.",
            "priority": priority,
            "type": "task",
            "assignee": "unassigned",
            "tags": ["mobile-intent"]
        ]
        
        return await Swift.withCheckedContinuation { continuation in
            NetworkManager.shared.invokeMCPTool(method: "track_create_issue", params: params) { result in
                switch result {
                case .success(let payload):
                    let message = payload["message"] as? String ?? "Task '\(title)' successfully created on NAS."
                    continuation.resume(returning: .result(value: message, dialog: "I've started that CLE task for you."))
                case .failure(let error):
                    // Auto-buffered locally inside NetworkManager if offline
                    let fallbackMsg = "Connection unreachable. I've queued the task '\(title)' locally in the pocket node SQLite database."
                    continuation.resume(returning: .result(value: fallbackMsg, dialog: "I could not reach the NAS, but I've queued this task to sync when you reconnect."))
                }
            }
        }
    }
}

// MARK: - INTENT 2: Add Memory Intent

public struct AddMemoryIntent: AppIntent {
    public static var title: LocalizedStringKey = "Add CLE Memory"
    public static var description = IntentDescription("Directly creates a canonical knowledge document or journal note inside the Strata Memory Spine.")
    
    @Parameter(title: "Memory Content")
    public var content: String
    
    @Parameter(title: "Document Title", default: "Siri Spatial Note")
    public var documentTitle: String
    
    public init() {}
    
    public func perform() async throws -> some IntentResult & ReturnsValue<String> {
        let params: [String: Any] = [
            "title": documentTitle,
            "content": content,
            "document_type": "guide",
            "tags": ["siri-voice", "pocket-mesh"],
            "author": "Siri-2.0"
        ]
        
        return await Swift.withCheckedContinuation { continuation in
            NetworkManager.shared.invokeMCPTool(method: "hive_create_doc", params: params) { result in
                switch result {
                case .success(let payload):
                    let message = "Successfully logged memory: \(documentTitle)"
                    continuation.resume(returning: .result(value: message, dialog: "Memory successfully committed to the central core."))
                case .failure:
                    let fallbackMsg = "Mesh network isolated. Memory saved locally to transaction ledger."
                    continuation.resume(returning: .result(value: fallbackMsg, dialog: "I've saved that memory locally. It will auto-sync when Tailscale reconnects."))
                }
            }
        }
    }
}

// MARK: - INTENT 3: Toggle Home Entity Intent

public struct ToggleHomeEntityIntent: AppIntent {
    public static var title: LocalizedStringKey = "Toggle CLE Smart Device"
    public static var description = IntentDescription("Toggles a physical light, smart switch, or sprinkler pump through the Sovereign Home Mesh gateway.")
    
    @Parameter(title: "Smart Device Entity ID")
    public var entityId: String
    
    @Parameter(title: "Target State", default: "on")
    public var state: String
    
    public init() {}
    
    public func perform() async throws -> some IntentResult & ReturnsValue<String> {
        let params: [String: Any] = [
            "entity_id": entityId,
            "state": state
        ]
        
        return await Swift.withCheckedContinuation { continuation in
            NetworkManager.shared.invokeMCPTool(method: "soveriegn_home_set_state", params: params) { result in
                switch result {
                case .success:
                    let message = "Set \(entityId) to \(state)."
                    continuation.resume(returning: .result(value: message, dialog: "Smart device command triggered successfully."))
                case .failure:
                    let fallbackMsg = "Mesh network unreachable. Action buffered locally in SQLite queue."
                    continuation.resume(returning: .result(value: fallbackMsg, dialog: "Offline mode. I've queued this smart device change to run the second we hit the local network."))
                }
            }
        }
    }
}

// MARK: - INTENT 4: Sync Offline Queue Intent

public struct SyncOfflineQueueIntent: AppIntent {
    public static var title: LocalizedStringKey = "Sync CLE Mesh"
    public static var description = IntentDescription("Triggers immediate synchronization playback of all offline buffered transactions.")
    
    public init() {}
    
    public func perform() async throws -> some IntentResult & ReturnsValue<String> {
        NetworkManager.shared.syncOfflineQueue()
        
        // Return immediate status to Siri
        if NetworkManager.shared.queuedCount > 0 {
            return .result(value: "Synchronizing \(NetworkManager.shared.queuedCount) buffered actions...", dialog: "Sync process started. The pocket node is pushing queued tasks.")
        } else {
            return .result(value: "All mesh systems are fully synced. Local cache is clean.", dialog: "Your pocket node is completely up to date.")
        }
    }
}
