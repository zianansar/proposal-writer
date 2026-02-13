/**
 * Story TD-1 Round 3: AI Detection Validation with Revised Humanization
 *
 * Standalone script that replicates the app's proposal generation
 * (including TD-1 revised humanization prompts) for manual
 * ZeroGPT/GPTZero testing.
 *
 * SYNC NOTE: SYSTEM_PROMPT and HUMANIZATION_MEDIUM must match
 * src-tauri/src/claude.rs::SYSTEM_PROMPT and
 * src-tauri/src/humanization.rs::get_humanization_prompt(Medium).
 * If prompts change in Rust, update this file to match.
 *
 * Usage:
 *   set ANTHROPIC_API_KEY=sk-ant-...
 *   node test-proposals.mjs
 *
 * Then copy each proposal and paste into https://www.zerogpt.com/
 * and/or https://gptzero.me/
 */

const API_URL = "https://api.anthropic.com/v1/messages";
const API_VERSION = "2023-06-01";
const MODEL = "claude-sonnet-4-20250514";
const MAX_TOKENS = 1024;

// TD-1: Updated system prompt — removed formulaic "3-paragraph" structure
const SYSTEM_PROMPT = `You are writing an Upwork proposal on behalf of a freelancer. The proposal should:
- Open by showing you understand the client's specific problem (reference details from their job post)
- Briefly mention relevant experience and your approach
- End with availability and a clear next step

Keep it under 200 words. Write like a real freelancer — direct, confident, conversational.`;

// TD-1: Rewritten medium humanization — specific, countable requirements targeting
// statistical detection signals (burstiness, perplexity variation, structural unpredictability)
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

const JOB_POSTS = [
  {
    id: 1,
    industry: "SaaS/CRM",
    domainType: "Technical",
    content: `We need a specialist to set up and customize our CRM system (HubSpot or Salesforce). Must integrate with our existing email marketing tools, create automated workflows for lead nurturing, and build custom reporting dashboards. Experience with API integrations required. Budget: $3,000-5,000. Timeline: 3 weeks.`
  },
  {
    id: 2,
    industry: "Automation",
    domainType: "Technical/Creative",
    content: `Looking for someone to build automation workflows connecting our tools (Slack, Notion, Google Sheets, Stripe). Need Zapier/Make expertise to create multi-step automations for order processing, customer onboarding, and team notifications. We process about 200 orders/day and need these automations to be reliable. Budget: $2,000-3,500.`
  },
  {
    id: 3,
    industry: "UI/UX Design",
    domainType: "Creative",
    content: `Need a talented UI/UX designer to redesign our mobile banking app. Looking for someone who can conduct user research, create wireframes and prototypes in Figma, and deliver a modern, accessible design system. Experience with fintech is a plus. We have 50K+ active users and need to improve our NPS score. Budget: $5,000-8,000.`
  },
  {
    id: 4,
    industry: "ML/Data Analysis",
    domainType: "Technical/Creative",
    content: `Seeking a data analyst/ML engineer to build a customer churn prediction model. We have 2 years of user activity data in PostgreSQL. Need exploratory analysis, feature engineering, model training (Python/scikit-learn), and a dashboard for business stakeholders. Accuracy target: 85%+ AUC. Budget: $4,000-7,000.`
  },
  {
    id: 5,
    industry: "Copywriting",
    domainType: "Creative",
    content: `Need an experienced copywriter for our SaaS product launch. Deliverables include landing page copy, email drip sequence (5 emails), blog posts (3), and social media content calendar. Must understand B2B SaaS voice and conversion optimization. Our product helps small businesses manage inventory. Budget: $2,500-4,000.`
  }
];

async function generateProposal(jobPost, apiKey) {
  const systemPrompt = `${SYSTEM_PROMPT}\n${HUMANIZATION_MEDIUM}`;
  const userMessage = `<job_post>\n${jobPost.content}\n</job_post>\n\nGenerate a proposal for this job:`;

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

async function main() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("ERROR: Set ANTHROPIC_API_KEY environment variable first.");
    console.error("  set ANTHROPIC_API_KEY=sk-ant-api03-...");
    process.exit(1);
  }

  console.log("=" .repeat(70));
  console.log("Story TD-1 Round 3: AI Detection Validation (Revised Humanization)");
  console.log("Model:", MODEL);
  console.log("Humanization: MEDIUM (TD-1 revised — specific structural + word choice mandates)");
  console.log("=" .repeat(70));
  console.log();

  const results = [];

  for (const job of JOB_POSTS) {
    console.log(`\n${"─".repeat(70)}`);
    console.log(`Test ${job.id}: ${job.industry} (${job.domainType})`);
    console.log(`${"─".repeat(70)}`);
    console.log("Generating proposal...");

    const start = Date.now();
    try {
      const proposal = await generateProposal(job, apiKey);
      const elapsed = ((Date.now() - start) / 1000).toFixed(1);

      console.log(`\nGenerated in ${elapsed}s:\n`);
      console.log(proposal);
      console.log(`\n${"─".repeat(70)}`);
      console.log(">>> Copy the proposal above and paste into https://www.zerogpt.com/");
      console.log(">>> Record the AI detection percentage below:");
      console.log(`${"─".repeat(70)}`);

      results.push({
        id: job.id,
        industry: job.industry,
        domainType: job.domainType,
        genTime: elapsed,
        proposal: proposal,
        wordCount: proposal.split(/\s+/).length
      });
    } catch (err) {
      console.error(`FAILED: ${err.message}`);
      results.push({
        id: job.id,
        industry: job.industry,
        domainType: job.domainType,
        genTime: "FAILED",
        proposal: null,
        error: err.message
      });
    }

    // Brief pause between API calls
    if (job.id < 5) {
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  console.log(`\n\n${"=".repeat(70)}`);
  console.log("SUMMARY — All 5 proposals generated");
  console.log(`${"=".repeat(70)}`);
  console.log();
  console.log("| # | Industry | Domain | Gen Time | Words |");
  console.log("|---|----------|--------|----------|-------|");
  for (const r of results) {
    console.log(`| ${r.id} | ${r.industry} | ${r.domainType} | ${r.genTime}s | ${r.wordCount || "N/A"} |`);
  }
  console.log();
  console.log("Next: Paste each proposal into https://www.zerogpt.com/ and record scores.");
  console.log("Pass criteria: 4/5 must score <30% AI detection.");
}

main().catch(console.error);
