// System-level Tauri commands for performance monitoring and security

use sysinfo::{ProcessRefreshKind, RefreshKind, System};
use tauri::State;

#[derive(Debug, serde::Serialize, specta::Type)]
pub struct MemoryUsage {
    pub rss_bytes: i64,
    pub virtual_bytes: i64,
}

/// Gets current process memory usage
/// Used by performance benchmarks to monitor RAM consumption
#[tauri::command]
#[specta::specta]
pub fn get_memory_usage() -> Result<MemoryUsage, String> {
    let mut sys = System::new_with_specifics(
        RefreshKind::new().with_processes(ProcessRefreshKind::everything()),
    );

    // Refresh to get current process info
    sys.refresh_all();

    let pid = sysinfo::Pid::from_u32(std::process::id());
    let process = sys
        .process(pid)
        .ok_or("Could not find current process")?;

    Ok(MemoryUsage {
        rss_bytes: process.memory() as i64,
        virtual_bytes: process.virtual_memory() as i64,
    })
}

/// Emits a ready signal for startup benchmark tests
/// Used to measure time from process spawn to UI ready
#[tauri::command]
#[specta::specta]
pub fn signal_ready() -> Result<(), String> {
    // This is called when the app UI is fully loaded and ready
    println!("READY_TO_PASTE");
    Ok(())
}

/// Gets list of blocked network requests (Story 8.13 Task 4.1)
/// Returns all blocked requests tracked since app startup
/// Used for security transparency and debugging
#[tauri::command]
#[specta::specta]
pub fn get_blocked_requests(
    blocked_requests_state: State<crate::BlockedRequestsState>,
) -> Result<Vec<crate::BlockedRequest>, String> {
    Ok(blocked_requests_state.get_all())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_get_memory_usage() {
        let result = get_memory_usage();
        assert!(result.is_ok());

        let mem = result.unwrap();
        assert!(mem.rss_bytes > 0);
        assert!(mem.virtual_bytes > 0);
    }

    #[test]
    fn test_signal_ready() {
        let result = signal_ready();
        assert!(result.is_ok());
    }
}
