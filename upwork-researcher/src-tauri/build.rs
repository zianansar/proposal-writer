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

        // Embed comctl32 v6 manifest in test binaries to fix STATUS_ENTRYPOINT_NOT_FOUND.
        // Tauri links against TaskDialogIndirect (comctl32 v6 only). Without the manifest,
        // Windows loads comctl32 v5 which lacks this function, crashing test binaries on load.
        // The main app binary gets a manifest from tauri_build, but test binaries do not.
        let manifest_path = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("test.manifest");
        println!("cargo:rustc-link-arg-tests=/MANIFEST:EMBED");
        println!(
            "cargo:rustc-link-arg-tests=/MANIFESTINPUT:{}",
            manifest_path.display()
        );
    }

    tauri_build::build()
}
