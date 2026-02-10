-- Story 5.1: Hook Strategies Seed Data
-- AC-1: Create hook_strategies table with required columns
-- AC-4: Idempotent migration (can run multiple times safely)

CREATE TABLE IF NOT EXISTS hook_strategies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,              -- "Social Proof", "Contrarian", etc.
    description TEXT NOT NULL,               -- Brief description for UI card
    examples_json TEXT NOT NULL,             -- JSON array: ["Example 1...", "Example 2..."]
    best_for TEXT NOT NULL,                  -- "Best for: clients with clear metrics"
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- AC-2, AC-3: Seed 5 default hook strategies with 2-3 examples each
-- AC-4: Use INSERT OR IGNORE for idempotency

-- 1. Social Proof (maps to "Right Fit" + "Numbers Don't Lie" hooks)
INSERT OR IGNORE INTO hook_strategies (name, description, examples_json, best_for) VALUES (
    'Social Proof',
    'Lead with relevant experience and quantified results to build immediate credibility.',
    '["I''ve helped 12 clients in your industry achieve [specific outcome]...", "My clients see a 40% increase in [metric] on average...", "Just last month, I completed a nearly identical project that [result]..."]',
    'Clients who value proven track records and measurable results'
);

-- 2. Contrarian (original strategy, not in hook library)
INSERT OR IGNORE INTO hook_strategies (name, description, examples_json, best_for) VALUES (
    'Contrarian',
    'Challenge conventional approaches to stand out and demonstrate deeper expertise.',
    '["Most freelancers will tell you to [common advice], but I''ve found that...", "Here''s what others get wrong about [their problem]...", "The conventional approach to this would be X, but I recommend Y because..."]',
    'Clients frustrated with generic solutions or past failed attempts'
);

-- 3. Immediate Value (maps to "Micro-Milestone" hook)
INSERT OR IGNORE INTO hook_strategies (name, description, examples_json, best_for) VALUES (
    'Immediate Value',
    'Offer a quick win or actionable insight upfront to demonstrate competence.',
    '["Here''s a quick win you can implement today: [specific tip]...", "I can provide an initial [deliverable] within 24 hours to [benefit]...", "Before we even start, here''s something that will help: [insight]..."]',
    'Risk-averse clients or technical projects requiring trust-building'
);

-- 4. Problem-Aware (maps to "Problem-Solver" hook)
INSERT OR IGNORE INTO hook_strategies (name, description, examples_json, best_for) VALUES (
    'Problem-Aware',
    'Show you understand their pain points at a deeper level than surface symptoms.',
    '["I noticed your team is struggling with [specific pain point]...", "The real issue here isn''t [surface problem], it''s [root cause]...", "Looking at your requirements, I see a common pattern that causes [issue]..."]',
    'Clients with complex problems or unclear requirements'
);

-- 5. Question-Based (maps to "Curiosity Question" hook)
INSERT OR IGNORE INTO hook_strategies (name, description, examples_json, best_for) VALUES (
    'Question-Based',
    'Open with a strategic question that engages the client and shows strategic thinking.',
    '["What if you could reduce costs by 30% while improving quality?", "Quick question: are you optimizing for speed or long-term maintainability?", "Have you considered how [alternative approach] might affect [their goal]?"]',
    'Ambiguous job posts or projects with multiple valid approaches'
);
