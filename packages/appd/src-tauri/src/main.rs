// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

#[tauri::command]
fn get_system_topology() -> String {
    println!("[appd] Native Tauri Command Invoked: get_system_topology");
    let topology = deviced::probe_system_topology();
    serde_json::to_string(&topology).unwrap_or_else(|_| "{}".to_string())
}

fn main() {
    println!("[appd] Booting Sovereign Native Host Container...");
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![get_system_topology])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
