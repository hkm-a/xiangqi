#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // 记住窗口位置 / 尺寸 / 最大化
        .plugin(tauri_plugin_window_state::Builder::default().build())
        // 自动更新（从 GitHub Releases 拉取签名产物）
        .plugin(tauri_plugin_updater::Builder::new().build())
        // 更新后重启进程
        .plugin(tauri_plugin_process::init())
        .run(tauri::generate_context!())
        .expect("启动中國象棋失败");
}
