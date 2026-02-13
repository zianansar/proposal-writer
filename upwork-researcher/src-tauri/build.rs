fn main() {
    // TD-5 AC-4: Cross-platform OpenSSL configuration guidance
    // On Windows, Cargo.toml uses `bundled-sqlcipher` which links against system OpenSSL.
    // If OPENSSL_DIR is not set, the build may fail to find OpenSSL.
    #[cfg(target_os = "windows")]
    {
        let has_openssl_dir = std::env::var("OPENSSL_DIR")
            .map(|dir| std::path::Path::new(&dir).exists())
            .unwrap_or(false);

        if !has_openssl_dir {
            println!(
                "cargo:warning=Windows detected without OPENSSL_DIR. \
                 The build requires system OpenSSL (e.g. via vcpkg). \
                 See .cargo/config.toml for setup instructions."
            );
        }
    }

    tauri_build::build()
}
