# Data Models

> Generated: 2026-02-19 | 15 tables | 30 migrations (V1-V30) | SQLCipher AES-256

## Overview

The application uses **SQLCipher** (AES-256 encrypted SQLite) for all local data storage. The database is managed using the **Refinery** migration framework (Rust) with 30 sequential SQL migrations.

**Configuration:**
- Encryption: SQLCipher 4.x with AES-256
- Key derivation: Argon2id (12-char minimum passphrase)
- Journal mode: WAL (Write-Ahead Logging)
- Foreign keys: Enforced (`PRAGMA foreign_keys=ON`)
- Salt: Stored in `.salt` file (base64 encoded)

## Entity Relationship Summary

```
proposals ──< proposal_revisions       (1:N, CASCADE)
proposals ──< safety_overrides         (1:N, CASCADE)
proposals >── job_posts                (N:1, SET NULL)
job_posts ──< job_skills               (1:N, CASCADE)
job_posts ──< job_scores               (1:1, CASCADE + UNIQUE)
job_posts ──< scoring_feedback         (1:N, CASCADE)
job_posts ──< rss_imports              (N:1, via batch_id)
hook_strategies                        (standalone + remote sync)
voice_profiles                         (1 per user)
golden_set_proposals                   (standalone, 3-5 samples)
encryption_metadata                    (singleton, id=1)
settings                               (key-value store)
remote_config                          (config cache)
```

## Tables

### 1. proposals (V1, V4, V5, V24, V25, V27, V29)

Core table for AI-generated proposal drafts.

| Column | Type | Default | Notes |
|--------|------|---------|-------|
| `id` | INTEGER | PK AUTOINCREMENT | |
| `job_content` | TEXT | NOT NULL | Job post text analyzed |
| `generated_text` | TEXT | NOT NULL | AI-generated proposal |
| `created_at` | TEXT | datetime('now') | |
| `updated_at` | TEXT | | |
| `status` | TEXT | 'draft' | draft, completed |
| `generation_params` | TEXT | | JSON humanization params (V5) |
| `archived_revisions` | BLOB | | Compressed JSON (V24) |
| `outcome_status` | TEXT | 'pending' | pending, submitted, response_received, interview, hired, no_response, rejected (V27) |
| `outcome_updated_at` | TEXT | | (V27) |
| `hook_strategy_id` | TEXT | | Strategy used (e.g., 'social_proof') (V27) |
| `job_post_id` | INTEGER | | FK → job_posts.id (V27) |
| `ab_assigned` | INTEGER | 0 | 1=A/B assigned, 0=manual (V29) |
| `ab_weight_at_assignment` | REAL | | Weight at generation time (V29) |

**Indexes:** created_at DESC, status, outcome_status, hook_strategy_id, job_post_id, (id, created_at DESC), ab_assigned

### 2. proposal_revisions (V8, V23)

Edit history for proposals (enables restore and archive).

| Column | Type | Default | Notes |
|--------|------|---------|-------|
| `id` | INTEGER | PK AUTOINCREMENT | |
| `proposal_id` | INTEGER | NOT NULL | FK → proposals.id (CASCADE) |
| `content` | TEXT | NOT NULL | Revision content |
| `revision_number` | INTEGER | NOT NULL | Sequential counter |
| `created_at` | TEXT | datetime('now') | |
| `revision_type` | TEXT | 'edit' | generation, edit, restore (V23) |
| `restored_from_id` | INTEGER | | Self-reference FK (V23) |

**Indexes:** proposal_id, (proposal_id, revision_number DESC), (proposal_id, created_at DESC)

### 3. job_posts (V3, V10, V13, V15, V17)

Upwork job posts for analysis and scoring.

| Column | Type | Default | Notes |
|--------|------|---------|-------|
| `id` | INTEGER | PK AUTOINCREMENT | |
| `url` | TEXT | | Upwork job URL |
| `raw_content` | TEXT | NOT NULL | Full job description |
| `client_name` | TEXT | | Extracted client name |
| `created_at` | TEXT | datetime('now') | |
| `hidden_needs` | TEXT | | JSON array (V10) |
| `budget_min` | REAL | | (V13) |
| `budget_max` | REAL | | (V13) |
| `budget_type` | TEXT | 'unknown' | hourly, fixed, unknown (V13) |
| `budget_alignment_pct` | INTEGER | | 0-100+ (V13) |
| `budget_alignment_status` | TEXT | 'gray' | green, yellow, red, gray, mismatch (V13) |
| `source` | TEXT | 'manual' | manual, rss (V15) |
| `analysis_status` | TEXT | 'none' | none, pending_analysis, analyzing, analyzed, error (V15) |
| `import_batch_id` | TEXT | | RSS batch reference (V15) |
| `job_title` | TEXT | | (V17) |
| `overall_score` | REAL | | Denormalized score (V17) |
| `score_color` | TEXT | 'gray' | green, yellow, red, gray (V17) |
| `skills_match_percent` | INTEGER | | 0-100 (V17) |
| `client_quality_percent` | INTEGER | | 0-100 (V17) |

**Indexes:** created_at DESC, url, import_batch_id, analysis_status, budget_alignment_status, overall_score DESC, client_name, score_color

### 4. job_skills (V9)

Skills extracted from job posts.

| Column | Type | Default | Notes |
|--------|------|---------|-------|
| `id` | INTEGER | PK AUTOINCREMENT | |
| `job_post_id` | INTEGER | NOT NULL | FK → job_posts.id (CASCADE) |
| `skill_name` | TEXT | NOT NULL | e.g., "React", "Python" |

**Indexes:** job_post_id, skill_name

### 5. job_scores (V12, V14)

Calculated weighted scores for jobs.

| Column | Type | Default | Notes |
|--------|------|---------|-------|
| `id` | INTEGER | PK AUTOINCREMENT | |
| `job_post_id` | INTEGER | UNIQUE NOT NULL | FK → job_posts.id (CASCADE) |
| `skills_match_percentage` | REAL | | 0.0-100.0 |
| `client_quality_score` | INTEGER | | 0-100 |
| `budget_alignment_score` | INTEGER | | 0-100 |
| `overall_score` | REAL | | 0.0-100.0 weighted |
| `calculated_at` | TEXT | CURRENT_TIMESTAMP | |
| `color_flag` | TEXT | 'gray' | green, yellow, red, gray (V14) |

**Indexes:** job_post_id, overall_score DESC, color_flag

### 6. user_skills (V11)

Freelancer's skills for job matching.

| Column | Type | Default | Notes |
|--------|------|---------|-------|
| `id` | INTEGER | PK AUTOINCREMENT | |
| `skill` | TEXT | NOT NULL | UNIQUE COLLATE NOCASE |
| `added_at` | TEXT | CURRENT_TIMESTAMP | |
| `is_primary` | BOOLEAN | 0 | Future: flag top skills |

**Indexes:** skill (COLLATE NOCASE), added_at DESC

### 7. scoring_feedback (V18)

User feedback on incorrect scores (quality improvement loop).

| Column | Type | Default | Notes |
|--------|------|---------|-------|
| `id` | INTEGER | PK | |
| `job_post_id` | INTEGER | NOT NULL | FK → job_posts.id (CASCADE) |
| `reported_at` | TEXT | datetime('now') | |
| `overall_score_at_report` | REAL | | Score snapshot |
| `color_flag_at_report` | TEXT | | |
| `skills_match_at_report` | REAL | | |
| `client_quality_at_report` | INTEGER | | |
| `budget_alignment_at_report` | INTEGER | | |
| `issue_skills_mismatch` | INTEGER | 0 | Boolean flag |
| `issue_client_quality` | INTEGER | 0 | |
| `issue_budget_wrong` | INTEGER | 0 | |
| `issue_score_too_high` | INTEGER | 0 | |
| `issue_score_too_low` | INTEGER | 0 | |
| `issue_other` | INTEGER | 0 | |
| `user_notes` | TEXT | | Free-form explanation |
| `app_version` | TEXT | | App version at report |

**Indexes:** (job_post_id, reported_at DESC)

### 8. rss_imports (V15, V16)

RSS feed batch import tracking.

| Column | Type | Default | Notes |
|--------|------|---------|-------|
| `id` | INTEGER | PK | |
| `batch_id` | TEXT | UNIQUE NOT NULL | Batch identifier |
| `feed_url` | TEXT | NOT NULL | RSS feed URL |
| `total_jobs` | INTEGER | 0 | Total in batch |
| `analyzed_count` | INTEGER | 0 | Successfully analyzed |
| `failed_count` | INTEGER | 0 | Failed analysis |
| `status` | TEXT | 'in_progress' | in_progress, completed, failed |
| `created_at` | TEXT | datetime('now') | |
| `completed_at` | TEXT | | |
| `import_method` | TEXT | 'rss' | rss, scrape (V16) |

**Indexes:** status

### 9. voice_profiles (V21, V22)

Calibrated writing style parameters.

| Column | Type | Default | Notes |
|--------|------|---------|-------|
| `id` | INTEGER | PK AUTOINCREMENT | |
| `user_id` | TEXT | 'default' | UNIQUE |
| `tone_score` | REAL | NOT NULL | 1-10 (friendly to formal) |
| `technical_depth` | REAL | NOT NULL | 1-10 |
| `avg_sentence_length` | REAL | NOT NULL | Words per sentence |
| `vocabulary_complexity` | REAL | NOT NULL | 0-1.0 |
| `structure_paragraphs_pct` | INTEGER | NOT NULL | 0-100 |
| `structure_bullets_pct` | INTEGER | NOT NULL | 0-100 |
| `common_phrases` | TEXT | '[]' | JSON array |
| `sample_count` | INTEGER | NOT NULL | Proposals analyzed |
| `calibration_source` | TEXT | NOT NULL | GoldenSet, QuickCalibration, Implicit |
| `created_at` | TEXT | datetime('now') | |
| `updated_at` | TEXT | datetime('now') | Auto-trigger |
| `length_preference` | REAL | 5.0 | 1-10 (brief to detailed) (V22) |

**Indexes:** user_id
**Triggers:** `voice_profiles_updated_at` — auto-update timestamp

### 10. golden_set_proposals (V20)

User's best past proposals for style analysis (3-5 samples, never leaves device).

| Column | Type | Default | Notes |
|--------|------|---------|-------|
| `id` | INTEGER | PK AUTOINCREMENT | |
| `content` | TEXT | NOT NULL | Full proposal text |
| `word_count` | INTEGER | NOT NULL | Pre-calculated |
| `source_filename` | TEXT | | Original filename |
| `created_at` | TEXT | datetime('now') | |

**Indexes:** created_at DESC

### 11. hook_strategies (V19, V28, V29)

Proposal hook strategies for generation.

| Column | Type | Default | Notes |
|--------|------|---------|-------|
| `id` | INTEGER | PK AUTOINCREMENT | |
| `name` | TEXT | NOT NULL UNIQUE | Strategy name |
| `description` | TEXT | NOT NULL | UI description |
| `examples_json` | TEXT | NOT NULL | JSON array (2-3 examples) |
| `best_for` | TEXT | NOT NULL | Use case description |
| `created_at` | TEXT | datetime('now') | |
| `status` | TEXT | 'active' | active, deprecated, retired (V28) |
| `remote_id` | TEXT | | Remote config ID (V28) |
| `ab_weight` | REAL | 0.0 | A/B test weight (V29) |

**Seed Data:** Social Proof, Contrarian, Immediate Value, Problem-Aware, Question-Based

**Indexes:** remote_id (UNIQUE)

### 12. safety_overrides (V7)

Tracks when users override AI detection threshold.

| Column | Type | Default | Notes |
|--------|------|---------|-------|
| `id` | INTEGER | PK AUTOINCREMENT | |
| `proposal_id` | INTEGER | NOT NULL | FK → proposals.id (CASCADE) |
| `timestamp` | TEXT | datetime('now') | |
| `ai_score` | REAL | NOT NULL | Detection % at override |
| `threshold_at_override` | REAL | NOT NULL | Threshold at time |
| `status` | TEXT | 'pending' | pending, successful, unsuccessful |
| `user_feedback` | TEXT | | User notes |

**Indexes:** (status, timestamp), proposal_id

### 13. encryption_metadata (V6)

Singleton row for recovery key storage.

| Column | Type | Default | Notes |
|--------|------|---------|-------|
| `id` | INTEGER | PK | CHECK id=1 (single row) |
| `recovery_key_encrypted` | TEXT | | AES-GCM encrypted |
| `recovery_key_hash` | TEXT | | Argon2id verification hash |
| `created_at` | TEXT | datetime('now') | |
| `updated_at` | TEXT | datetime('now') | |

### 14. settings (V2)

Application key-value settings.

| Column | Type | Default | Notes |
|--------|------|---------|-------|
| `key` | TEXT | PK | Setting identifier |
| `value` | TEXT | NOT NULL | Setting value (JSON for complex) |
| `updated_at` | TEXT | datetime('now') | Auto-trigger |

**Seed Values:** theme='dark', api_provider='anthropic', log_level='INFO', safety_threshold='180'

**Triggers:** `settings_updated_at` — auto-update timestamp

### 15. remote_config (V30)

Cached remote configuration for dynamic updates.

| Column | Type | Default | Notes |
|--------|------|---------|-------|
| `id` | INTEGER | PK | |
| `schema_version` | TEXT | NOT NULL | Version identifier |
| `config_json` | TEXT | NOT NULL | Full config JSON |
| `fetched_at` | TEXT | NOT NULL | Fetch timestamp |
| `signature` | TEXT | NOT NULL | HMAC-SHA256 signature |
| `source` | TEXT | 'remote' | remote, local_override |

## Migration History

| Migration | Tables/Changes | Epic |
|-----------|---------------|------|
| V1 | Create `proposals` | Epic 0 |
| V2 | Create `settings` with seed data | Epic 0 |
| V3 | Create `job_posts` | Epic 0 |
| V4 | Add `status` column to proposals | Epic 1 |
| V5 | Add `generation_params` to proposals | Epic 3 |
| V6 | Create `encryption_metadata` | Epic 2 |
| V7 | Create `safety_overrides` | Epic 3 |
| V8 | Create `proposal_revisions` | Epic 6 |
| V9 | Create `job_skills` | Epic 4a |
| V10 | Add `hidden_needs` to job_posts | Epic 4a |
| V11 | Create `user_skills` | Epic 4a |
| V12 | Create `job_scores` | Epic 4a |
| V13 | Add budget columns to job_posts | Epic 4a |
| V14 | Add `color_flag` to job_scores | Epic 4a |
| V15 | Create `rss_imports`, add source/batch to job_posts | Epic 4b |
| V16 | Add `import_method` to rss_imports | Epic 4b |
| V17 | Add denormalized scores to job_posts | Epic 4b |
| V18 | Create `scoring_feedback` | Epic 4b |
| V19 | Create `hook_strategies` with 5 seeds | Epic 5 |
| V20 | Create `golden_set_proposals` | Epic 5 |
| V21 | Create `voice_profiles` | Epic 5 |
| V22 | Add `length_preference` to voice_profiles | Epic 5 |
| V23 | Add revision_type/restored_from to revisions | Epic 6 |
| V24 | Add `archived_revisions` blob to proposals | Epic 6 |
| V25 | Track proposals_edited_count in settings | Epic 5 |
| V26 | Add composite index on proposals (id, created_at) | Epic 7 |
| V27 | Add outcome tracking columns to proposals | Epic 7 |
| V28 | Add status/remote_id to hook_strategies | Epic 10 |
| V29 | Add A/B testing columns to proposals + strategies | Epic 10 |
| V30 | Create `remote_config` | Epic 10 |

## Query Module Organization

The `src-tauri/src/db/queries/` directory contains 14 specialized modules:

| Module | Tables | Key Operations |
|--------|--------|---------------|
| `proposals.rs` | proposals | CRUD, outcome tracking, A/B context |
| `job_posts.rs` | job_posts | Create, analysis status, batch update |
| `job_skills.rs` | job_skills | Insert extracted, match against user |
| `scoring.rs` | job_scores, job_posts | Calculate, update, denormalize |
| `user_skills.rs` | user_skills | Add, remove, list |
| `voice_profile.rs` | voice_profiles | Upsert, get by user |
| `golden_set.rs` | golden_set_proposals | Upload, list, count |
| `hook_strategies.rs` | hook_strategies | Get active, A/B weights |
| `revisions.rs` | proposal_revisions | Create, list, restore |
| `safety_overrides.rs` | safety_overrides | Record, query for learning |
| `rss_imports.rs` | rss_imports | Create batch, update progress |
| `settings.rs` | settings | Get, set, list all |
| `remote_config.rs` | remote_config | Store, get latest |
| `mod.rs` | - | Module exports |
