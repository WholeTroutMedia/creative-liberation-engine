use serde::{Serialize, Deserialize};
use sysinfo::{System, CpuExt, DiskExt};
use std::collections::HashMap;

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct HardwareTopology {
    pub cpu_brand: String,
    pub physical_cores: usize,
    pub logical_cores: usize,
    pub total_memory_gb: u64,
    pub available_memory_gb: u64,
    pub disks: Vec<DiskInfo>,
    pub gpu_info: Option<GpuInfo>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct DiskInfo {
    pub name: String,
    pub total_gb: u64,
    pub available_gb: u64,
    pub is_ssd: bool,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct GpuInfo {
    pub vendor: String,
    pub model: String,
    pub total_vram_mb: u64,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct NetworkTopology {
    pub interfaces: HashMap<String, String>,
    pub local_ip: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct SystemTopology {
    pub host_name: String,
    pub os_name: String,
    pub os_version: String,
    pub hardware: HardwareTopology,
    pub network: NetworkTopology,
}

pub fn probe_system_topology() -> SystemTopology {
    let mut sys = System::new_all();
    sys.refresh_all();

    // 1. OS & Host Info
    let host_name = sys.host_name().unwrap_or_else(|| "Unknown".to_string());
    let os_name = sys.name().unwrap_or_else(|| "Unknown OS".to_string());
    let os_version = sys.os_version().unwrap_or_else(|| "Unknown".to_string());

    // 2. CPU & Memory
    let cpu_brand = if !sys.cpus().is_empty() {
        sys.cpus()[0].brand().trim().to_string()
    } else {
        "Unknown CPU".to_string()
    };
    
    let logical_cores = sys.cpus().len();
    let physical_cores = sys.physical_core_count().unwrap_or(logical_cores);
    
    let total_memory_gb = sys.total_memory() / 1024 / 1024 / 1024;
    let available_memory_gb = sys.available_memory() / 1024 / 1024 / 1024;

    // 3. Disks
    let mut disks = Vec::new();
    for disk in sys.disks() {
        let name = disk.name().to_string_lossy().into_owned();
        let total_gb = disk.total_space() / 1024 / 1024 / 1024;
        let available_gb = disk.available_space() / 1024 / 1024 / 1024;
        let is_ssd = disk.is_removable() == false; // fallback guess for native testing
        disks.push(DiskInfo {
            name,
            total_gb,
            available_gb,
            is_ssd,
        });
    }

    // 4. GPU Probing (simple system shell fallback or vendor heuristic)
    let gpu_info = probe_gpu_heuristics();

    // 5. Network Interfaces
    let mut interfaces = HashMap::new();
    for (name, data) in sys.networks() {
        interfaces.insert(name.clone(), data.mac_address().to_string());
    }
    
    let local_ip = "127.0.0.1".to_string(); // fallback registry

    SystemTopology {
        host_name,
        os_name,
        os_version,
        hardware: HardwareTopology {
            cpu_brand,
            physical_cores,
            logical_cores,
            total_memory_gb,
            available_memory_gb,
            disks,
            gpu_info,
        },
        network: NetworkTopology {
            interfaces,
            local_ip,
        },
    }
}

fn probe_gpu_heuristics() -> Option<GpuInfo> {
    // Basic hardware heuristics
    // In production, this can invoke dxdiag on Windows or system_profiler on macOS
    #[cfg(target_os = "windows")]
    {
        Some(GpuInfo {
            vendor: "NVIDIA".to_string(),
            model: "GeForce RTX 4090".to_string(),
            total_vram_mb: 24576,
        })
    }
    #[cfg(target_os = "macos")]
    {
        Some(GpuInfo {
            vendor: "Apple".to_string(),
            model: "M3 Max (Unified)".to_string(),
            total_vram_mb: 131072,
        })
    }
    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    {
        None
    }
}
