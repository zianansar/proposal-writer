/**
 * Test proposals against free AI detection APIs
 *
 * SYNC NOTE: Proposal texts below are hardcoded from Round 3 generation output.
 * They also appear in test-zerogpt.mjs. If updating, keep both files in sync.
 */

const proposals = [
  {
    id: 1,
    industry: "SaaS/CRM",
    text: `I can see you're looking to get your CRM properly dialed in with automated workflows and custom reporting — that's exactly the kind of setup that makes or breaks a sales process.

I've been working with both HubSpot and Salesforce integrations for the past 4 years, and I'd recommend we start with a quick audit of your current email marketing stack to determine the best approach. Last month I built a similar system for a SaaS company that needed their Mailchimp and Salesforce to talk seamlessly — we ended up increasing their lead conversion by 40% just through better automation timing.

The timeline sounds pretty straightforward for what you're describing. I can handle the API work, custom dashboard creation, and workflow automation within your 3-week window. And honestly, staying within your $3K-$5K budget shouldn't be an issue since most of this is configuration work rather than custom development.

Happy to chat about your specific email tools and lead nurturing goals. Should we set up a quick call this week?`
  },
  {
    id: 2,
    industry: "Automation",
    text: `I see you're dealing with 200 orders daily and need bulletproof automations — that's exactly the kind of workflow challenge I love tackling.

I've built similar multi-step automations for e-commerce clients, including one that handled 300+ daily orders through Stripe → Sheets → Slack notifications without a hiccup. Your stack (Zapier/Make + Notion/Sheets/Stripe) is right up my alley, and I'm particularly good at building error handling so your automations won't break when APIs get moody.

Here's my approach: I'd start by mapping your current order flow, then build the automations in stages — order processing first, then customer onboarding, then team notifications. That way we can test each piece before connecting everything together. And I always include fallback triggers because reliability isn't negotiable when you're processing that volume.

I'm available to start next week and can have the first automation live within 5-7 days. Happy to hop on a quick call to walk through your specific workflow needs — sometimes the devil's in the details that don't make it into job posts.

Sound good?`
  },
  {
    id: 3,
    industry: "UI/UX Design",
    text: `Hi there!

I see you're looking to redesign your mobile banking app to boost that NPS score — sounds like the perfect challenge. With 50K+ users, you're definitely at the stage where even small UX improvements can make a huge impact on satisfaction and retention.

I've been designing fintech products for the past 4 years, and I actually just wrapped up a similar project for a credit union where we increased their app store rating from 2.8 to 4.2 stars. My approach is pretty straightforward: start with user interviews and analytics deep-dive, then build wireframes that solve real pain points (not just look pretty), and finally create a design system that'll scale as you grow.

Here's my take. Most banking apps fail because they prioritize features over user flows — but it sounds like you already know that since you're focused on the NPS piece. And honestly, accessibility in fintech isn't just nice-to-have anymore; it's essential for compliance and user trust.

I'm available to start next week and can have initial research findings ready within 10 days. Want to hop on a quick call to discuss your biggest user complaints?

Happy to chat!`
  },
  {
    id: 4,
    industry: "ML/Data Analysis",
    text: `Hey there!

I see you're looking to tackle customer churn with a predictive model — that's right up my alley. I've built similar models for SaaS companies and consistently hit 87-90% AUC by focusing on behavioral patterns and engagement metrics from activity data.

Here's my take. I'd start with exploratory analysis of your PostgreSQL data to identify key churn indicators, then engineer features around user engagement, session patterns, and usage trends. For modeling, I'd test gradient boosting and random forest algorithms (scikit-learn's my go-to) and validate with proper time-series splits since churn prediction is time-sensitive.

The dashboard part's pretty straightforward — I usually build these with Plotly Dash so stakeholders can filter by segments and see real-time churn risk scores. And I'd make sure everything's documented so your team can maintain it.

I'm available to start next week and can deliver this in 3-4 weeks. Happy to hop on a quick call to discuss your specific use case and walk through my approach.

Sound good?`
  },
  {
    id: 5,
    industry: "Copywriting",
    text: `Hey there!

I saw your SaaS launch project and it's right up my alley — I've written for several inventory management tools over the past couple years, including a landing page that boosted conversions by 34% for a similar B2B product. The combo of landing page copy, email sequences, and content calendar sounds like exactly what you need to nail this launch.

Here's my take: inventory management is all about solving real pain points (stockouts, overstocking, manual tracking headaches), so I'd focus the messaging on those specific problems your target audience faces daily. I've got experience with SaaS conversion optimization and know how to write copy that actually moves the needle — not just sounds pretty.

For the email drip sequence, I'd map out a journey that educates while building trust, and I can definitely handle the blog posts and social calendar to support the launch. Happy to chat about your specific positioning and timeline.

I'm available to start right away and can have initial drafts within a week. Want to hop on a quick call to discuss your target audience and key messaging?`
  }
];

// Try multiple AI detection endpoints
async function tryZeroGPT(text) {
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
  if (!data.success && data.code === 403) throw new Error("ZeroGPT: paid API required");
  return { tool: "ZeroGPT", score: data.data?.fake_percentage ?? data.fake_percentage ?? "unknown", raw: data };
}

async function tryContentAtScale(text) {
  const response = await fetch("https://contentatscale.ai/api/detect", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content: text })
  });
  const data = await response.json();
  return { tool: "ContentAtScale", score: data.probability ?? data.score ?? "unknown", raw: data };
}

async function tryWriter(text) {
  const response = await fetch("https://writer.com/wp-admin/admin-ajax.php", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
    },
    body: `action=ai_content_detector&text=${encodeURIComponent(text)}`
  });
  const data = await response.json();
  return { tool: "Writer", score: data.score ?? "unknown", raw: data };
}

async function testProposal(proposal) {
  const results = [];

  // Try each detector, catch errors
  for (const detector of [tryZeroGPT, tryContentAtScale, tryWriter]) {
    try {
      const result = await detector(proposal.text);
      results.push(result);
    } catch (err) {
      results.push({ tool: detector.name.replace("try", ""), score: "ERROR", error: err.message });
    }
  }

  return results;
}

async function main() {
  console.log("=".repeat(70));
  console.log("TD-1 Round 3: Multi-Tool AI Detection Results");
  console.log("=".repeat(70));
  console.log();

  const allResults = [];

  for (const proposal of proposals) {
    console.log(`\nProposal ${proposal.id} (${proposal.industry}):`);
    const results = await testProposal(proposal);

    for (const r of results) {
      console.log(`  ${r.tool}: ${r.score}${r.error ? ` (${r.error})` : ""}`);
    }

    allResults.push({ id: proposal.id, industry: proposal.industry, detections: results });

    // Rate limiting pause
    await new Promise(r => setTimeout(r, 2000));
  }

  console.log("\n" + "=".repeat(70));
  console.log("RAW RESULTS:");
  console.log(JSON.stringify(allResults, null, 2));
}

main().catch(console.error);
