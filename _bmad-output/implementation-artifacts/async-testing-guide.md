# Async Testing Guidelines for Rust + Tauri

**Created:** 2026-02-05
**Purpose:** Prevent race conditions and ensure correct async behavior based on Epic 1 lessons learned
**Audience:** Developers working on async Rust code in Tauri backend

---

## Overview

Epic 1 revealed that **async operations with shared state are difficult to test correctly**. Race conditions in Stories 1-13 and 1-14 passed tests but were caught in code review. This guide provides patterns to test async code effectively.

---

## Common Async Patterns in Our Codebase

### 1. Shared State with Mutex

**Pattern:**
```rust
pub struct AppState {
    pub current_draft_id: Arc<Mutex<Option<i64>>>,
}
```

**Risk:** Multiple async tasks accessing same Mutex can interleave in unexpected ways.

---

## Testing Patterns

### Pattern 1: Test Concurrent Access to Shared State

**Problem:** Story 1-14 had race condition in draft auto-save - concurrent saves could violate atomicity.

**Solution:** Use `tokio::task::spawn` to create concurrent tasks and test ordering.

```rust
#[tokio::test]
async fn test_concurrent_draft_saves() {
    let draft_state = Arc::new(Mutex::new(None));
    let draft_state_clone1 = draft_state.clone();
    let draft_state_clone2 = draft_state.clone();

    // Spawn two concurrent tasks trying to update draft
    let task1 = tokio::task::spawn(async move {
        let mut draft = draft_state_clone1.lock().unwrap();
        *draft = Some(1);
    });

    let task2 = tokio::task::spawn(async move {
        let mut draft = draft_state_clone2.lock().unwrap();
        *draft = Some(2);
    });

    // Both should complete without panic
    let _ = tokio::join!(task1, task2);

    // Final state should be one of the values (non-deterministic but valid)
    let final_draft = *draft_state.lock().unwrap();
    assert!(final_draft == Some(1) || final_draft == Some(2));
}
```

**Key Insight:** Test that concurrent access is **safe** (no panics, no data corruption), even if order is non-deterministic.

---

### Pattern 2: Channel Draining (Message Queue Testing)

**Problem:** Story 1-14 used `tokio::sync::mpsc::unbounded_channel` for draft saves. Must verify all messages processed.

**Solution:** Close sender and drain receiver to completion.

```rust
#[tokio::test]
async fn test_draft_save_queue_drains_completely() {
    let (tx, mut rx) = tokio::sync::mpsc::unbounded_channel::<String>();

    // Send multiple messages
    tx.send("draft1".to_string()).unwrap();
    tx.send("draft2".to_string()).unwrap();
    tx.send("draft3".to_string()).unwrap();

    // Close sender (signals no more messages)
    drop(tx);

    // Drain receiver - collect all messages
    let mut received = Vec::new();
    while let Some(msg) = rx.recv().await {
        received.push(msg);
    }

    // Verify all messages received
    assert_eq!(received.len(), 3);
    assert_eq!(received, vec!["draft1", "draft2", "draft3"]);
}
```

**Key Insight:** Always test that channels drain completely. Use `drop(tx)` to close sender, then drain receiver.

---

### Pattern 3: Testing Retry Logic with Delays

**Problem:** Story 1-13 had race condition in retry logic - `incrementRetry()` called before delay completed.

**Solution:** Use `tokio::time::pause()` to control time in tests.

```rust
#[tokio::test]
async fn test_exponential_backoff_timing() {
    tokio::time::pause(); // Pause time in test

    let start = tokio::time::Instant::now();

    // Simulate retry with 1s delay
    tokio::time::sleep(Duration::from_secs(1)).await;
    let after_first_delay = start.elapsed();

    // Simulate second retry with 2s delay
    tokio::time::sleep(Duration::from_secs(2)).await;
    let after_second_delay = start.elapsed();

    // With paused time, these should be exact
    assert_eq!(after_first_delay, Duration::from_secs(1));
    assert_eq!(after_second_delay, Duration::from_secs(3));
}
```

**Key Insight:** `tokio::time::pause()` makes timing tests deterministic. Time only advances when you `await` sleep.

---

### Pattern 4: Testing Event Emission Order

**Problem:** Tauri event emission order matters for frontend state updates.

**Solution:** Collect events in order and verify sequence.

```rust
#[tokio::test]
async fn test_generation_events_emitted_in_order() {
    let mut events_received = Vec::new();

    // Mock event listener
    let (tx, mut rx) = tokio::sync::mpsc::unbounded_channel::<String>();

    // Simulate generation emitting events
    tokio::task::spawn(async move {
        tx.send("generation:start".to_string()).unwrap();
        tx.send("generation:token".to_string()).unwrap();
        tx.send("generation:token".to_string()).unwrap();
        tx.send("generation:complete".to_string()).unwrap();
    });

    // Collect events in order
    drop(tx); // Close sender
    while let Some(event) = rx.recv().await {
        events_received.push(event);
    }

    // Verify order
    assert_eq!(events_received[0], "generation:start");
    assert_eq!(events_received[3], "generation:complete");
}
```

**Key Insight:** Event order matters for UI state consistency. Test that events emit in expected sequence.

---

### Pattern 5: Testing Database Operations in Transactions

**Problem:** Story 1-14 code review flagged missing transaction wrapping for draft updates (NFR-19).

**Solution:** Test that operations are atomic - either all succeed or all fail.

```rust
#[tokio::test]
async fn test_draft_update_is_atomic() {
    let db = create_test_db(); // Helper to create in-memory DB
    let conn = db.conn.lock().unwrap();

    // Start explicit transaction
    conn.execute("BEGIN TRANSACTION", []).unwrap();

    // Perform multiple operations
    conn.execute("INSERT INTO proposals (job_content, generated_text, status) VALUES (?, ?, ?)",
        params!["job1", "draft1", "draft"]).unwrap();

    conn.execute("UPDATE proposals SET generated_text = ? WHERE id = ?",
        params!["draft1_updated", 1]).unwrap();

    // Simulate error before commit
    let result = conn.execute("ROLLBACK", []);
    assert!(result.is_ok());

    // Verify rollback - no data persisted
    let count: i64 = conn.query_row("SELECT COUNT(*) FROM proposals", [], |row| row.get(0)).unwrap();
    assert_eq!(count, 0); // Transaction rolled back
}
```

**Key Insight:** Test both commit path (all succeed) and rollback path (one fails, all revert).

---

### Pattern 6: Testing Timeout Behavior

**Problem:** API calls should timeout gracefully without hanging.

**Solution:** Use `tokio::time::timeout` in tests.

```rust
#[tokio::test]
async fn test_api_call_respects_timeout() {
    let result = tokio::time::timeout(
        Duration::from_secs(1),
        async {
            // Simulate slow API call
            tokio::time::sleep(Duration::from_secs(2)).await;
            Ok::<String, String>("response".to_string())
        }
    ).await;

    // Should timeout (Err) not hang forever
    assert!(result.is_err());
}
```

**Key Insight:** Always test timeout paths, not just success paths.

---

## Anti-Patterns (What NOT to Do)

### ❌ Anti-Pattern 1: Testing Without Awaiting

```rust
#[tokio::test]
async fn bad_test() {
    let future = some_async_function();
    // BUG: Never awaited! Test passes but function never runs.
}
```

**Fix:** Always `.await` async functions in tests.

---

### ❌ Anti-Pattern 2: Assuming Deterministic Ordering Without Synchronization

```rust
#[tokio::test]
async fn bad_race_test() {
    let mut state = 0;

    tokio::task::spawn(async { state += 1; }); // BUG: No synchronization
    tokio::task::spawn(async { state += 1; });

    // This assertion is flaky - race condition!
    assert_eq!(state, 2);
}
```

**Fix:** Use `Arc<Mutex<T>>` or channels to synchronize.

---

### ❌ Anti-Pattern 3: Not Draining Channels Before Asserting

```rust
#[tokio::test]
async fn bad_channel_test() {
    let (tx, mut rx) = tokio::sync::mpsc::unbounded_channel();

    tx.send("msg").unwrap();

    // BUG: Sender still open, receiver blocks forever
    let msg = rx.recv().await;
}
```

**Fix:** Always `drop(tx)` before final `recv().await`.

---

### ❌ Anti-Pattern 4: Testing Only Success Path

```rust
#[tokio::test]
async fn bad_incomplete_test() {
    let result = api_call_with_retry().await;
    assert!(result.is_ok()); // Only tests success path!
}
```

**Fix:** Test failure paths, timeout paths, and edge cases.

---

## Epic 1 Case Studies

### Case Study 1: Story 1-13 Retry Race Condition

**Issue:** `incrementRetry()` called before delay, causing UI to show wrong retry count.

**Code (Buggy):**
```rust
async fn handle_retry() {
    incrementRetry(); // BUG: Increments immediately
    tokio::time::sleep(backoff_delay).await; // Delay happens after
    retry_generation().await;
}
```

**Code (Fixed):**
```rust
async fn handle_retry() {
    tokio::time::sleep(backoff_delay).await; // Delay first
    incrementRetry(); // Then increment
    retry_generation().await;
}
```

**Test:**
```rust
#[tokio::test]
async fn test_retry_increments_after_delay() {
    tokio::time::pause();

    let retry_count = Arc::new(Mutex::new(0));
    let retry_count_clone = retry_count.clone();

    tokio::task::spawn(async move {
        tokio::time::sleep(Duration::from_secs(1)).await;
        let mut count = retry_count_clone.lock().unwrap();
        *count += 1;
    }).await.unwrap();

    // After 1 second, retry count should be incremented
    assert_eq!(*retry_count.lock().unwrap(), 1);
}
```

**Lesson:** Test timing-sensitive operations with `tokio::time::pause()`.

---

### Case Study 2: Story 1-14 Draft Auto-Save Race

**Issue:** Concurrent draft saves could violate NFR-11 atomicity - two saves might interleave.

**Code (Buggy):**
```rust
// Multiple token batches arrive concurrently
for token in tokens {
    tokio::task::spawn(async {
        save_draft(token).await; // BUG: No synchronization!
    });
}
```

**Code (Fixed):**
```rust
// Use unbounded channel to serialize saves
let (save_tx, mut save_rx) = tokio::sync::mpsc::unbounded_channel();

// Producer: queue saves
for token in tokens {
    save_tx.send(token).unwrap();
}

// Consumer: process saves sequentially
drop(save_tx); // Close sender
while let Some(token) = save_rx.recv().await {
    save_draft(token).await; // Runs sequentially
}
```

**Test:**
```rust
#[tokio::test]
async fn test_draft_saves_are_sequential() {
    let (tx, mut rx) = tokio::sync::mpsc::unbounded_channel();

    // Send multiple saves
    for i in 0..100 {
        tx.send(i).unwrap();
    }
    drop(tx);

    // Drain and verify all received in order
    let mut received = Vec::new();
    while let Some(val) = rx.recv().await {
        received.push(val);
    }

    assert_eq!(received.len(), 100);
    // Verify sequential (not concurrent/interleaved)
    for (idx, val) in received.iter().enumerate() {
        assert_eq!(*val, idx);
    }
}
```

**Lesson:** Use channels to serialize concurrent operations.

---

## Testing Checklist for Async Code

Before marking async code as complete, verify:

- [ ] **Concurrency tested** - Spawn multiple tasks and verify safety
- [ ] **Channels drained** - All messages received, no leaks
- [ ] **Timeouts tested** - Code doesn't hang forever on slow operations
- [ ] **Timing tested** - Use `tokio::time::pause()` for deterministic timing
- [ ] **Failure paths tested** - Not just success path
- [ ] **Transaction atomicity tested** - All-or-nothing for DB operations
- [ ] **Event order tested** - UI state depends on correct sequence
- [ ] **Race conditions checked** - Code review looks for shared state issues

---

## Tools and Techniques

### 1. `tokio::time::pause()`
**Use:** Make time-based tests deterministic
**When:** Testing retries, delays, timeouts

### 2. `tokio::task::spawn`
**Use:** Create concurrent tasks
**When:** Testing race conditions and shared state safety

### 3. `tokio::sync::mpsc` channels
**Use:** Serialize concurrent operations
**When:** Need sequential processing of concurrent events

### 4. `tokio::time::timeout`
**Use:** Test that operations complete within time limit
**When:** Testing API calls, long-running operations

### 5. `Arc<Mutex<T>>`
**Use:** Share state across tasks safely
**When:** Multiple tasks need to read/write same data

### 6. `tempfile` crate
**Use:** Create isolated test databases
**When:** Testing database operations

---

## When to Write Async Tests

**Always write async tests for:**
- Tauri commands (all are async)
- Database operations
- API calls
- Event emission
- Retry logic
- Operations with timeouts
- Channel-based message passing
- Any code with `Arc<Mutex<T>>` shared state

**Can skip async tests for:**
- Pure functions with no I/O
- Synchronous data transformations
- Simple struct constructors

---

## References

- **Story 1-13:** API error handling with retry logic (race condition case study)
- **Story 1-14:** Draft recovery with auto-save (channel usage case study)
- **Epic 1 Retrospective:** Identified async testing as critical gap
- [Tokio Testing Documentation](https://docs.rs/tokio/latest/tokio/time/fn.pause.html)
- [Rust Async Book - Testing](https://rust-lang.github.io/async-book/08_ecosystem/00_chapter.html)

---

**Epic 2 Application:**

This guide is **critical for Story 2-3 (SQLite to SQLCipher Migration)**. The migration involves:
- Async database operations
- Transaction atomicity (AR-2, NFR-19)
- Potential timeouts with large databases
- Rollback on failure

Apply these patterns rigorously when testing the migration code.

---

**Last Updated:** 2026-02-05
**Next Review:** After Epic 2 completion