// 桌面入口：Windows 下隐藏控制台
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    xiangqi_lib::run()
}
