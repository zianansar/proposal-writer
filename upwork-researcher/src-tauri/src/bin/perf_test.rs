use std::time::Instant;
use upwork_research_agent_lib::claude::generate_proposal;

const SAMPLE_JOB: &str = r#"
Looking for a React developer to build a dashboard for our SaaS product.

Requirements:
- 3+ years React experience
- TypeScript proficiency
- Experience with data visualization (charts, graphs)
- Responsive design skills

We're a startup with a small team. Need someone who can work independently.
Budget: $2000-3000
Timeline: 2 weeks
"#;

fn main() {
    println!("Performance Test: Claude API Generation");
    println!("========================================\n");

    // Use tauri's existing tokio runtime via current_thread
    let rt = tokio::runtime::Builder::new_current_thread()
        .enable_all()
        .build()
        .expect("Failed to create runtime");

    rt.block_on(async {
        println!("Starting generation...");
        let start = Instant::now();

        match generate_proposal(SAMPLE_JOB).await {
            Ok(proposal) => {
                let elapsed = start.elapsed();
                println!("\n✅ Generation successful!");
                println!("⏱️  Time: {:.2} seconds", elapsed.as_secs_f64());
                println!(
                    "\n--- Generated Proposal ---\n{}\n--------------------------",
                    proposal
                );

                if elapsed.as_secs_f64() < 8.0 {
                    println!("\n✅ PASS: Generation completed in <8 seconds (AC-4 satisfied)");
                } else {
                    println!("\n❌ FAIL: Generation took ≥8 seconds (AC-4 not met)");
                }
            }
            Err(e) => {
                let elapsed = start.elapsed();
                println!(
                    "\n❌ Generation failed after {:.2}s: {}",
                    elapsed.as_secs_f64(),
                    e
                );
            }
        }
    });
}
