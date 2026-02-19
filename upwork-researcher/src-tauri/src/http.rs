use reqwest::Client;
use std::sync::OnceLock;

/// Shared HTTP client for connection pooling across all modules.
/// Initialized once on first use. Per-request timeouts should be set
/// via `RequestBuilder::timeout()` at each call site.
static HTTP_CLIENT: OnceLock<Client> = OnceLock::new();

pub fn client() -> &'static Client {
    HTTP_CLIENT.get_or_init(|| Client::builder().build().expect("Failed to create HTTP client"))
}
