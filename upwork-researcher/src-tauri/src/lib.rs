mod claude;

#[tauri::command]
async fn generate_proposal(job_content: String) -> Result<String, String> {
    claude::generate_proposal(&job_content).await
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![generate_proposal])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
