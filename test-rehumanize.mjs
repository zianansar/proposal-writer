/**
 * Story TD-1 Task 6: Test re-humanization on Round 3 failure (Proposal 5 - Copywriting)
 *
 * Simulates the re-humanization flow (attempt 1 boost + medium humanization)
 * then tests the result against ZeroGPT.
 *
 * SYNC NOTE: SYSTEM_PROMPT, HUMANIZATION_MEDIUM, and REHUMANIZATION_BOOST_* must match
 * src-tauri/src/claude.rs::SYSTEM_PROMPT,
 * src-tauri/src/humanization.rs::get_humanization_prompt(Medium), and
 * src-tauri/src/humanization.rs::get_rehumanization_boost().
 * If prompts change in Rust, update this file to match.
 */

const API_URL = "https://api.anthropic.com/v1/messages";
const API_VERSION = "2023-06-01";
const MODEL = "claude-sonnet-4-20250514";
const MAX_TOKENS = 1024;

const SYSTEM_PROMPT = `You are writing an Upwork proposal on behalf of a freelancer. The proposal should:
- Open by showing you understand the client's specific problem (reference details from their job post)
- Briefly mention relevant experience and your approach
- End with availability and a clear next step

Keep it under 200 words. Write like a real freelancer — direct, confident, conversational.`;

const HUMANIZATION_MEDIUM = `
CRITICAL: Write this as a real human freelancer would actually type it. This is a quick, confident message — NOT a formal cover letter.

MANDATORY STRUCTURE (follow these exactly):
- Do NOT write exactly 3 equal paragraphs. Use 2-4 paragraphs of varying length.
- At least one paragraph must be only 1-2 sentences. Another must be 3+ sentences.
- Include at least ONE sentence under 6 words (e.g. "Here's my take." or "Happy to chat.")
- Include at least ONE sentence over 20 words.
- Start at least one sentence with "And", "But", or "So".
- Use at least one parenthetical aside (like this) or em-dash — for a natural break.

MANDATORY WORD CHOICE:
- Use contractions everywhere: I'm, I've, you're, that's, won't, can't, I'd, we'll — minimum 6 per 200 words.
- Reference ONE specific detail from past experience (a project type, a metric, a tool).
- Include at least one casual expression: "happy to chat", "sounds like", "right up my alley", "pretty straightforward", "the short version", "quick note".
- Replace formal verbs with casual ones: "utilize" → "use", "implement" → "build", "facilitate" → "help", "demonstrate" → "show".

ABSOLUTELY FORBIDDEN (these instantly flag AI detection):
Words: "delve", "leverage", "utilize", "robust", "multifaceted", "tapestry", "holistic", "nuanced", "paradigm", "game-changing", "transformative", "innovative", "cutting-edge", "state-of-the-art", "comprehensive", "seamless", "streamline", "optimize", "spearheaded", "synergy", "ecosystem", "landscape", "realm", "endeavor", "keen", "pivotal", "elevate", "foster", "harness", "empower", "facilitate", "cornerstone", "testament", "underscore", "meticulous"
Phrases: "I am excited to", "I am confident that", "I would be happy to", "It's important to note", "It is worth mentioning", "In today's", "In the ever-evolving", "I look forward to", "rest assured", "don't hesitate to", "feel free to", "my extensive experience", "proven track record", "I am well-versed in", "I bring a wealth of"
Patterns: Starting 3+ sentences the same way. Every paragraph being similar length. Using the same transition word twice.

TONE: Imagine you're messaging a potential client about a project that genuinely interests you — confident but not salesy, direct but not blunt.

QUALITY GUARDRAILS:
- Stay professional — casual doesn't mean sloppy
- Technical claims must be accurate
- The message should be clear and actionable
- Typos are NOT humanization — maintain correct spelling`;

// Re-humanization boost prompts (matching humanization.rs)
const REHUMANIZATION_BOOST_1 = `

IMPORTANT — PREVIOUS VERSION WAS FLAGGED AS AI-GENERATED. Apply these additional fixes:
- Rewrite the opening sentence to be more specific and personal (reference a real-sounding detail)
- Break up any paragraph longer than 3 sentences into two shorter ones
- Add one conversational aside you wouldn't see in formal writing
- Make sure no two consecutive sentences start the same way
- Include at least one short reaction or opinion ("Neat.", "That's smart.", "Big fan of that approach.")`;

const REHUMANIZATION_BOOST_2 = `

CRITICAL — SECOND ATTEMPT. The previous two versions were flagged as AI. Be MORE aggressive:
- Write as if you're typing this on your phone during lunch — keep it casual and direct
- Start with something unexpected (a question, a brief reaction, or a specific observation)
- Cut any sentence that sounds like a template or could appear in any proposal
- Use at least 2 sentence fragments (under 5 words) as standalone emphasis
- Vary paragraph lengths dramatically — one paragraph should be a single sentence
- Include ONE personal detail that sounds specific ("I just wrapped up a similar project for a SaaS startup last month")
- Do NOT use formal proposal language — this should read like a genuine message from a real person`;

const REHUMANIZATION_BOOST_3 = `

FINAL ATTEMPT — Every previous version was flagged. Throw out everything and start fresh:
- Pretend you're voice-texting a reply while walking — raw, unpolished, genuine
- Open with a specific observation or question about the job post (NOT a greeting)
- Maximum 3 paragraphs. One must be a single sentence.
- Use at least 3 sentence fragments. No sentence over 18 words.
- Include a self-correction or mid-thought change ("actually, scratch that — ...")
- Reference a hyper-specific past detail (client name style, dollar amount, timeline)
- Zero transition words between paragraphs — just jump between ideas
- If it sounds like it could be in a template, delete it`;

const FAILING_JOB_POST = `Need an experienced copywriter for our SaaS product launch. Deliverables include landing page copy, email drip sequence (5 emails), blog posts (3), and social media content calendar. Must understand B2B SaaS voice and conversion optimization. Our product helps small businesses manage inventory. Budget: $2,500-4,000.`;

async function generateProposal(systemPrompt, jobPost, apiKey) {
  const userMessage = `<job_post>\n${jobPost}\n</job_post>\n\nGenerate a proposal for this job:`;

  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": API_VERSION,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }]
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`API error ${response.status}: ${error}`);
  }

  const data = await response.json();
  return data.content[0].text;
}

async function testZeroGPT(text) {
  const response = await fetch("https://api.zerogpt.com/api/detect/detectText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      "Origin": "https://www.zerogpt.com",
      "Referer": "https://www.zerogpt.com/"
    },
    body: JSON.stringify({ input_text: text })
  });
  const data = await response.json();
  return data;
}

async function main() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("ERROR: Set ANTHROPIC_API_KEY environment variable first.");
    process.exit(1);
  }

  console.log("=".repeat(70));
  console.log("TD-1 Task 6: Re-humanization Test on Proposal 5 (Copywriting)");
  console.log("Original Round 3 score: 74.28% AI — FAILED");
  console.log("=".repeat(70));

  // Attempt 1: Medium + Boost 1
  console.log("\n--- Attempt 1: Medium + Re-humanization Boost 1 ---");
  const systemPrompt1 = `${SYSTEM_PROMPT}\n${HUMANIZATION_MEDIUM}${REHUMANIZATION_BOOST_1}`;
  console.log("Generating...");
  const proposal1 = await generateProposal(systemPrompt1, FAILING_JOB_POST, apiKey);
  console.log("\nProposal (Boost 1):\n");
  console.log(proposal1);
  console.log(`\nWord count: ${proposal1.split(/\s+/).length}`);

  // Test against ZeroGPT
  console.log("\nTesting against ZeroGPT...");
  await new Promise(r => setTimeout(r, 1500));
  const result1 = await testZeroGPT(proposal1);
  const pct1 = result1.data?.fakePercentage ?? "unknown";
  const feedback1 = result1.data?.feedback ?? "unknown";
  console.log(`ZeroGPT: ${pct1}% AI detected — ${feedback1}`);
  const pass1 = typeof pct1 === "number" && pct1 < 30;
  console.log(`Result: ${pass1 ? "PASS" : "FAIL"}`);

  await new Promise(r => setTimeout(r, 2000));

  // Attempt 2: Medium + Boost 2 (only if Attempt 1 failed)
  let proposal2 = null;
  let pct2 = null;
  let pass2 = false;
  if (!pass1) {
    console.log("\n--- Attempt 2: Medium + Re-humanization Boost 2 ---");
    const systemPrompt2 = `${SYSTEM_PROMPT}\n${HUMANIZATION_MEDIUM}${REHUMANIZATION_BOOST_2}`;
    console.log("Generating...");
    proposal2 = await generateProposal(systemPrompt2, FAILING_JOB_POST, apiKey);
    console.log("\nProposal (Boost 2):\n");
    console.log(proposal2);
    console.log(`\nWord count: ${proposal2.split(/\s+/).length}`);

    console.log("\nTesting against ZeroGPT...");
    await new Promise(r => setTimeout(r, 1500));
    const result2 = await testZeroGPT(proposal2);
    pct2 = result2.data?.fakePercentage ?? "unknown";
    const feedback2 = result2.data?.feedback ?? "unknown";
    console.log(`ZeroGPT: ${pct2}% AI detected — ${feedback2}`);
    pass2 = typeof pct2 === "number" && pct2 < 30;
    console.log(`Result: ${pass2 ? "PASS" : "FAIL"}`);
  }

  // Summary
  console.log("\n" + "=".repeat(70));
  console.log("RE-HUMANIZATION SUMMARY");
  console.log("=".repeat(70));
  console.log(`Original (no boost):    74.28% AI — FAIL`);
  console.log(`Attempt 1 (Boost 1):    ${pct1}% AI — ${pass1 ? "PASS" : "FAIL"}`);
  if (proposal2 !== null) {
    console.log(`Attempt 2 (Boost 2):    ${pct2}% AI — ${pass2 ? "PASS" : "FAIL"}`);
  } else {
    console.log(`Attempt 2 (Boost 2):    Skipped (Boost 1 passed)`);
  }
  console.log(`\nAC-4 Result: Re-humanization ${pass1 || pass2 ? "SUCCEEDED" : "FAILED"} — boost ${pass1 ? "1" : pass2 ? "2" : "neither"} brought failing proposal below threshold`);
}

main().catch(console.error);
