---
status: ready-for-dev
assignedTo: ""
tasksCompleted: 0
totalTasks: 6
testsWritten: false
codeReviewCompleted: false
fileList: []
---

# Story 5.7: Quick Calibration Alternative (5 Questions)

## Story

As a freelancer,
I want to calibrate my voice by answering questions instead of uploading proposals,
So that I can start quickly without past examples.

## Acceptance Criteria

**AC-1: Quick Calibration Entry Point**

**Given** I'm on the Voice Calibration screen (from Settings → Voice Learning)
**When** I see the calibration options
**Then** I see two paths:
1. "Upload Past Proposals" (Golden Set - Story 5-3)
2. "Quick Calibration (No uploads needed)" ← this story

**And** clicking "Quick Calibration" starts the 5-question flow
**And** the UI indicates "Takes about 30 seconds"

**AC-2: 5-Question Questionnaire UI**

**Given** I click "Quick Calibration"
**When** the questionnaire starts
**Then** I answer 5 questions, one at a time:

```
┌─────────────────────────────────────────────┐
│ Quick Calibration                     1/5   │
├─────────────────────────────────────────────┤
│                                             │
│ How would you describe your writing tone?   │
│                                             │
│   ○ Formal (academic, traditional)          │
│   ○ Professional (business appropriate)     │
│   ○ Conversational (friendly but focused)   │
│   ○ Casual (relaxed, approachable)          │
│                                             │
│                              [Next →]       │
└─────────────────────────────────────────────┘
```

**And** each question has 3-4 radio button options
**And** progress indicator shows "1/5", "2/5", etc.
**And** "Next" button advances to next question
**And** "Back" button returns to previous question (disabled on Q1)
**And** questions are answered in order (no skipping)

**AC-3: Complete Question Set**

**Given** I'm completing Quick Calibration
**Then** I answer these 5 questions in order:

**Q1: Tone**
- Formal (academic, traditional)
- Professional (business appropriate)
- Conversational (friendly but focused)
- Casual (relaxed, approachable)

**Q2: Response Length**
- Brief (get to the point quickly)
- Moderate (balanced detail)
- Detailed (thorough explanations)

**Q3: Technical Depth**
- Simple (avoid jargon, plain language)
- Technical (industry terms when appropriate)
- Expert (deep technical detail)

**Q4: Structure Preference**
- Bullet points (scannable, organized)
- Paragraphs (flowing narrative)
- Mixed (bullets + paragraphs)

**Q5: Call-to-Action Style**
- Direct ("Let's schedule a call")
- Consultative ("I'd love to discuss your needs")
- Question-based ("Would you be open to chatting?")

**AC-4: Answer-to-Profile Mapping**

**Given** I complete all 5 questions
**When** answers are submitted
**Then** they map to VoiceProfile parameters:

| Question | Answer | tone_score | avg_sentence_length | technical_depth | structure |
|----------|--------|------------|---------------------|-----------------|-----------|
| Q1 Tone | Formal | 9 | - | - | - |
| Q1 Tone | Professional | 7 | - | - | - |
| Q1 Tone | Conversational | 5 | - | - | - |
| Q1 Tone | Casual | 3 | - | - | - |
| Q2 Length | Brief | - | 10 | - | - |
| Q2 Length | Moderate | - | 16 | - | - |
| Q2 Length | Detailed | - | 24 | - | - |
| Q3 Depth | Simple | - | - | 3 | - |
| Q3 Depth | Technical | - | - | 6 | - |
| Q3 Depth | Expert | - | - | 9 | - |
| Q4 Structure | Bullets | - | - | - | 80/20 |
| Q4 Structure | Paragraphs | - | - | - | 20/80 |
| Q4 Structure | Mixed | - | - | - | 50/50 |

**And** Q5 (Call-to-Action) is stored as metadata but doesn't map to a numeric field
**And** `calibration_source` is set to `QuickCalibration`
**And** `sample_count` is set to 0 (no actual proposals analyzed)
**And** `vocabulary_complexity` defaults to 8.0 (professional average)
**And** `common_phrases` defaults to empty array `[]`

**AC-5: Completion State**

**Given** I answer all 5 questions
**When** I click "Finish" on the last question
**Then** I see completion message:

```
┌─────────────────────────────────────────────┐
│ ✓ Voice Calibrated!                         │
├─────────────────────────────────────────────┤
│                                             │
│ Your writing style preferences are saved.   │
│                                             │
│ For better accuracy, you can upload 3-5     │
│ past proposals anytime from Settings.       │
│                                             │
│              [Start Writing]                │
└─────────────────────────────────────────────┘
```

**And** profile is persisted via Story 5-5b (save_voice_profile)
**And** "Start Writing" navigates to main proposal generation screen
**And** Voice Profile Display (Story 5-5) shows "Based on Quick Calibration"

**AC-6: Edit Quick Calibration Answers**

**Given** I've completed Quick Calibration
**When** I view Voice Profile (Story 5-5)
**Then** I see "Recalibrate" button
**And** clicking it offers choice: "Quick Calibration" or "Upload Proposals"
**And** selecting Quick Calibration re-starts the 5-question flow
**And** previous answers are pre-selected (edit mode)
**And** completing overwrites existing profile

**AC-7: Accessibility**

**Given** I'm using keyboard-only navigation
**Then** I can Tab between radio options and buttons
**And** Arrow keys navigate within radio group
**And** Enter/Space selects radio option
**And** screen reader announces question text and current selection
**And** focus is trapped within the modal during questionnaire

## Tasks/Subtasks

- [ ] Task 1: Create question data model and mapping (AC-3, AC-4)
  - [ ] Subtask 1.1: Create `src/features/voice-learning/quickCalibrationQuestions.ts`
  - [ ] Subtask 1.2: Define Question interface with id, text, options
  - [ ] Subtask 1.3: Define all 5 questions with option labels and descriptions
  - [ ] Subtask 1.4: Create mapAnswersToProfile() function
  - [ ] Subtask 1.5: Add unit tests for mapping logic

- [ ] Task 2: Create QuickCalibration component (AC-1, AC-2, AC-5)
  - [ ] Subtask 2.1: Create `src/features/voice-learning/QuickCalibration.tsx`
  - [ ] Subtask 2.2: Implement single-question view with radio buttons
  - [ ] Subtask 2.3: Add progress indicator (1/5, 2/5, etc.)
  - [ ] Subtask 2.4: Implement Next/Back navigation between questions
  - [ ] Subtask 2.5: Show completion screen after Q5
  - [ ] Subtask 2.6: Style with dark theme colors per UX spec

- [ ] Task 3: Create Tauri command for quick calibration (AC-4)
  - [ ] Subtask 3.1: Create `quick_calibrate` command in commands/voice.rs
  - [ ] Subtask 3.2: Accept QuickCalibrationAnswers struct
  - [ ] Subtask 3.3: Map answers to VoiceProfile
  - [ ] Subtask 3.4: Save profile via save_voice_profile (Story 5-5b)
  - [ ] Subtask 3.5: Return success with created profile

- [ ] Task 4: Integrate with calibration entry flow (AC-1, AC-6)
  - [ ] Subtask 4.1: Add "Quick Calibration" option to Voice Learning settings
  - [ ] Subtask 4.2: Show choice dialog when "Recalibrate" is clicked
  - [ ] Subtask 4.3: Pre-populate answers in edit mode (if existing quick calibration)
  - [ ] Subtask 4.4: Navigate to main screen after completion

- [ ] Task 5: Add accessibility features (AC-7)
  - [ ] Subtask 5.1: Add proper ARIA labels to radio buttons
  - [ ] Subtask 5.2: Implement keyboard navigation (Tab, Arrow, Enter)
  - [ ] Subtask 5.3: Add focus trap to questionnaire
  - [ ] Subtask 5.4: Add screen reader announcements for questions

- [ ] Task 6: Add tests (AC-1 through AC-7)
  - [ ] Subtask 6.1: Test question progression (1→2→3→4→5)
  - [ ] Subtask 6.2: Test back navigation
  - [ ] Subtask 6.3: Test answer mapping produces correct VoiceProfile
  - [ ] Subtask 6.4: Test profile is saved after completion
  - [ ] Subtask 6.5: Test completion screen displays
  - [ ] Subtask 6.6: Test edit mode pre-populates answers
  - [ ] Subtask 6.7: Test keyboard navigation
  - [ ] Subtask 6.8: Test accessibility attributes

## Dev Notes

### Architecture Requirements

**FR-16: Golden Set Calibration (Alternative Path)**
- Quick Calibration provides same output format as Golden Set
- Less accurate but immediate (Cold Start mitigation)
- User can upgrade to Golden Set later for better accuracy

**UX-8: Progressive Trust Building**
- Clear messaging that Golden Set is more accurate
- "Takes about 30 seconds" sets expectations
- Suggestion to upload proposals later

**AR-12: React Stack**
- React 19 functional components
- shadcn/ui RadioGroup for options
- Custom hooks for state management

### Question Definitions

```typescript
// src/features/voice-learning/quickCalibrationQuestions.ts

export interface QuickCalibrationOption {
  value: string;
  label: string;
  description: string;
}

export interface QuickCalibrationQuestion {
  id: string;
  text: string;
  options: QuickCalibrationOption[];
}

export const QUICK_CALIBRATION_QUESTIONS: QuickCalibrationQuestion[] = [
  {
    id: 'tone',
    text: 'How would you describe your writing tone?',
    options: [
      { value: 'formal', label: 'Formal', description: 'Academic, traditional' },
      { value: 'professional', label: 'Professional', description: 'Business appropriate' },
      { value: 'conversational', label: 'Conversational', description: 'Friendly but focused' },
      { value: 'casual', label: 'Casual', description: 'Relaxed, approachable' },
    ],
  },
  {
    id: 'length',
    text: 'How detailed are your typical responses?',
    options: [
      { value: 'brief', label: 'Brief', description: 'Get to the point quickly' },
      { value: 'moderate', label: 'Moderate', description: 'Balanced detail' },
      { value: 'detailed', label: 'Detailed', description: 'Thorough explanations' },
    ],
  },
  {
    id: 'technicalDepth',
    text: 'How technical is your writing style?',
    options: [
      { value: 'simple', label: 'Simple', description: 'Avoid jargon, plain language' },
      { value: 'technical', label: 'Technical', description: 'Industry terms when appropriate' },
      { value: 'expert', label: 'Expert', description: 'Deep technical detail' },
    ],
  },
  {
    id: 'structure',
    text: 'How do you prefer to structure your proposals?',
    options: [
      { value: 'bullets', label: 'Bullet Points', description: 'Scannable, organized' },
      { value: 'paragraphs', label: 'Paragraphs', description: 'Flowing narrative' },
      { value: 'mixed', label: 'Mixed', description: 'Bullets + paragraphs' },
    ],
  },
  {
    id: 'callToAction',
    text: 'How do you typically close your proposals?',
    options: [
      { value: 'direct', label: 'Direct', description: '"Let\'s schedule a call"' },
      { value: 'consultative', label: 'Consultative', description: '"I\'d love to discuss your needs"' },
      { value: 'question', label: 'Question-based', description: '"Would you be open to chatting?"' },
    ],
  },
];
```

### Answer Mapping Logic

```typescript
// src/features/voice-learning/quickCalibrationMapper.ts

import type { VoiceProfile } from './types';

export interface QuickCalibrationAnswers {
  tone: 'formal' | 'professional' | 'conversational' | 'casual';
  length: 'brief' | 'moderate' | 'detailed';
  technicalDepth: 'simple' | 'technical' | 'expert';
  structure: 'bullets' | 'paragraphs' | 'mixed';
  callToAction: 'direct' | 'consultative' | 'question';
}

const TONE_SCORES: Record<string, number> = {
  formal: 9,
  professional: 7,
  conversational: 5,
  casual: 3,
};

const LENGTH_TO_SENTENCE_LENGTH: Record<string, number> = {
  brief: 10,
  moderate: 16,
  detailed: 24,
};

const DEPTH_SCORES: Record<string, number> = {
  simple: 3,
  technical: 6,
  expert: 9,
};

const STRUCTURE_PREFS: Record<string, { paragraphs_pct: number; bullets_pct: number }> = {
  bullets: { paragraphs_pct: 20, bullets_pct: 80 },
  paragraphs: { paragraphs_pct: 80, bullets_pct: 20 },
  mixed: { paragraphs_pct: 50, bullets_pct: 50 },
};

export function mapAnswersToProfile(answers: QuickCalibrationAnswers): VoiceProfile {
  return {
    tone_score: TONE_SCORES[answers.tone],
    avg_sentence_length: LENGTH_TO_SENTENCE_LENGTH[answers.length],
    vocabulary_complexity: 8.0, // Default professional average
    structure_preference: STRUCTURE_PREFS[answers.structure],
    technical_depth: DEPTH_SCORES[answers.technicalDepth],
    common_phrases: [], // Empty for quick calibration
    sample_count: 0, // No actual proposals analyzed
    calibration_source: 'QuickCalibration',
  };
}
```

### QuickCalibration Component

```tsx
// src/features/voice-learning/QuickCalibration.tsx

import { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { CheckCircle } from 'lucide-react';
import {
  QUICK_CALIBRATION_QUESTIONS,
  type QuickCalibrationQuestion,
} from './quickCalibrationQuestions';
import { mapAnswersToProfile, type QuickCalibrationAnswers } from './quickCalibrationMapper';

interface QuickCalibrationProps {
  existingAnswers?: Partial<QuickCalibrationAnswers>;
  onComplete: () => void;
}

export function QuickCalibration({ existingAnswers, onComplete }: QuickCalibrationProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState<Partial<QuickCalibrationAnswers>>(existingAnswers || {});
  const [isComplete, setIsComplete] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const navigate = useNavigate();

  const totalSteps = QUICK_CALIBRATION_QUESTIONS.length;
  const currentQuestion = QUICK_CALIBRATION_QUESTIONS[currentStep];
  const currentAnswer = answers[currentQuestion.id as keyof QuickCalibrationAnswers];

  const handleAnswerChange = (value: string) => {
    setAnswers(prev => ({
      ...prev,
      [currentQuestion.id]: value,
    }));
  };

  const handleNext = async () => {
    if (currentStep < totalSteps - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      // Final step - save profile
      setIsSaving(true);
      try {
        const profile = mapAnswersToProfile(answers as QuickCalibrationAnswers);
        await invoke('save_voice_profile', { profile });
        setIsComplete(true);
      } catch (err) {
        console.error('Failed to save profile:', err);
      } finally {
        setIsSaving(false);
      }
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleStartWriting = () => {
    onComplete();
    navigate('/');
  };

  if (isComplete) {
    return (
      <Card className="bg-[#1e1e1e] border-[#2a2a2a] max-w-md mx-auto">
        <CardContent className="pt-8 pb-8 text-center">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-[#fafafa] mb-2">
            Voice Calibrated!
          </h3>
          <p className="text-[#a3a3a3] mb-4">
            Your writing style preferences are saved.
          </p>
          <p className="text-sm text-[#a3a3a3] mb-6">
            For better accuracy, you can upload 3-5 past proposals anytime from Settings.
          </p>
          <Button
            onClick={handleStartWriting}
            className="bg-[#f97316] hover:bg-[#ea580c] text-white"
          >
            Start Writing
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-[#1e1e1e] border-[#2a2a2a] max-w-md mx-auto">
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle className="text-[#fafafa]">Quick Calibration</CardTitle>
          <span className="text-[#a3a3a3] text-sm">
            {currentStep + 1}/{totalSteps}
          </span>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        <p className="text-[#fafafa] font-medium">{currentQuestion.text}</p>

        <RadioGroup
          value={currentAnswer || ''}
          onValueChange={handleAnswerChange}
          className="space-y-3"
        >
          {currentQuestion.options.map(option => (
            <div
              key={option.value}
              className="flex items-start space-x-3 p-3 rounded-lg border border-[#2a2a2a] hover:border-[#3a3a3a] cursor-pointer"
            >
              <RadioGroupItem
                value={option.value}
                id={option.value}
                className="mt-0.5"
              />
              <Label htmlFor={option.value} className="cursor-pointer flex-1">
                <span className="text-[#fafafa] font-medium">{option.label}</span>
                <span className="text-[#a3a3a3] text-sm block">
                  {option.description}
                </span>
              </Label>
            </div>
          ))}
        </RadioGroup>

        <div className="flex justify-between pt-4">
          <Button
            variant="outline"
            onClick={handleBack}
            disabled={currentStep === 0}
          >
            Back
          </Button>
          <Button
            onClick={handleNext}
            disabled={!currentAnswer || isSaving}
            className="bg-[#f97316] hover:bg-[#ea580c] text-white"
          >
            {currentStep === totalSteps - 1
              ? isSaving
                ? 'Saving...'
                : 'Finish'
              : 'Next'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
```

### Tauri Command

```rust
// commands/voice.rs (add to existing file from Story 5-4)

use serde::Deserialize;

#[derive(Debug, Deserialize)]
pub struct QuickCalibrationAnswers {
    pub tone: String,           // formal, professional, conversational, casual
    pub length: String,         // brief, moderate, detailed
    pub technical_depth: String, // simple, technical, expert
    pub structure: String,      // bullets, paragraphs, mixed
    pub call_to_action: String, // direct, consultative, question
}

#[command]
pub async fn quick_calibrate(
    answers: QuickCalibrationAnswers,
    state: State<'_, AppState>
) -> Result<VoiceProfile, AppError> {
    // Map answers to numeric values
    let tone_score = match answers.tone.as_str() {
        "formal" => 9.0,
        "professional" => 7.0,
        "conversational" => 5.0,
        "casual" => 3.0,
        _ => 7.0, // default professional
    };

    let avg_sentence_length = match answers.length.as_str() {
        "brief" => 10.0,
        "moderate" => 16.0,
        "detailed" => 24.0,
        _ => 16.0,
    };

    let technical_depth = match answers.technical_depth.as_str() {
        "simple" => 3.0,
        "technical" => 6.0,
        "expert" => 9.0,
        _ => 6.0,
    };

    let structure_preference = match answers.structure.as_str() {
        "bullets" => StructurePreference { paragraphs_pct: 20, bullets_pct: 80 },
        "paragraphs" => StructurePreference { paragraphs_pct: 80, bullets_pct: 20 },
        "mixed" => StructurePreference { paragraphs_pct: 50, bullets_pct: 50 },
        _ => StructurePreference { paragraphs_pct: 50, bullets_pct: 50 },
    };

    let profile = VoiceProfile {
        tone_score: tone_score as f32,
        avg_sentence_length: avg_sentence_length as f32,
        vocabulary_complexity: 8.0, // Default professional average
        structure_preference,
        technical_depth: technical_depth as f32,
        common_phrases: vec![],
        sample_count: 0,
        calibration_source: CalibrationSource::QuickCalibration,
    };

    // Persist to database (Story 5-5b)
    let db = state.db.lock().await;
    let row = VoiceProfileRow::from_voice_profile(&profile, "default");
    db.save_voice_profile(&row)?;

    Ok(profile)
}
```

### File Structure

```
upwork-researcher/
  src-tauri/
    src/
      commands/
        voice.rs                    # Add quick_calibrate command
  src/
    features/
      voice-learning/
        QuickCalibration.tsx        # NEW: Main questionnaire component
        QuickCalibration.test.tsx   # NEW: Component tests
        quickCalibrationQuestions.ts # NEW: Question definitions
        quickCalibrationMapper.ts   # NEW: Answer-to-profile mapping
        quickCalibrationMapper.test.ts # NEW: Mapper unit tests
        index.ts                    # Add exports
```

### Integration Points

**With Story 5-3 (Golden Set Upload UI):**
- Both paths accessible from same entry point
- User chooses between Quick Calibration and Golden Set
- Quick Calibration suggests upgrading to Golden Set for better accuracy

**With Story 5-5b (Persist Voice Profile):**
- Uses `save_voice_profile` command to persist
- Sets `calibration_source: 'QuickCalibration'`

**With Story 5-5 (Voice Profile Display):**
- Displays "Based on Quick Calibration" when source is QuickCalibration
- Shows "Recalibrate" button to re-enter flow

**With Story 5-8 (Voice-Informed Generation):**
- Generated profile used identically to Golden Set profile
- Same VoiceProfile structure, different source

### Voice Profile Display Modifications (Story 5-5)

Update Story 5-5's display to handle Quick Calibration source:

```tsx
// In VoiceProfileDisplay.tsx, update header:

<CardDescription className="text-[#a3a3a3]">
  {profile.calibration_source === 'QuickCalibration'
    ? 'Based on Quick Calibration'
    : `Based on ${profile.sample_count} past proposal${profile.sample_count !== 1 ? 's' : ''}`}
</CardDescription>

// For Quick Calibration, don't show common phrases section
// (it will be empty)
```

### Testing Requirements

**Unit Tests (quickCalibrationMapper.ts):**

1. **Mapping Tests:**
   - Test tone='formal' → tone_score=9
   - Test tone='casual' → tone_score=3
   - Test length='brief' → avg_sentence_length=10
   - Test length='detailed' → avg_sentence_length=24
   - Test technicalDepth='expert' → technical_depth=9
   - Test structure='bullets' → 80/20 split
   - Test structure='paragraphs' → 20/80 split
   - Test calibration_source is 'QuickCalibration'
   - Test sample_count is 0
   - Test common_phrases is empty

2. **Default Value Tests:**
   - Test vocabulary_complexity defaults to 8.0
   - Test unknown values fall back to sensible defaults

**Component Tests (QuickCalibration.tsx):**

1. **Navigation Tests:**
   - Test renders first question on mount
   - Test Next advances to Q2, Q3, Q4, Q5
   - Test Back returns to previous question
   - Test Back is disabled on Q1
   - Test progress indicator updates correctly

2. **Answer Selection Tests:**
   - Test clicking radio selects answer
   - Test answer persists when navigating back/forward
   - Test Next is disabled until answer selected

3. **Completion Tests:**
   - Test completion screen shows after Q5
   - Test profile is saved via Tauri command
   - Test "Start Writing" navigates to home

4. **Edit Mode Tests:**
   - Test existing answers pre-populate
   - Test can change answers and re-save

5. **Accessibility Tests:**
   - Test keyboard navigation (Tab, Arrow, Enter)
   - Test ARIA labels present
   - Test focus management

**Integration Tests:**

1. **Full Flow Test:**
   - Start quick calibration
   - Answer all 5 questions
   - Verify profile saved with correct values
   - Verify can load profile via get_voice_profile

2. **Edit Flow Test:**
   - Complete quick calibration
   - Re-enter quick calibration
   - Verify previous answers shown
   - Change answers, re-save
   - Verify profile updated

### Scope Boundaries

**In Scope for Story 5-7:**
- 5-question questionnaire UI
- Answer-to-VoiceProfile mapping
- Quick calibration Tauri command
- Integration with voice profile persistence
- Progress indicator and navigation
- Completion screen with upgrade suggestion

**Out of Scope (Other Stories):**
- Golden Set upload (Story 5-3)
- Golden Set analysis (Story 5-4)
- Voice profile database persistence (Story 5-5b)
- Voice profile display (Story 5-5)
- Using voice profile in generation (Story 5-8)

### Dependencies

**Depends On:**
- **Story 5-5b: Persist Voice Profile** (uses save_voice_profile command)

**Depended On By:**
- **Story 5-8: Voice-Informed Generation** (uses resulting profile)

**Parallel With:**
- Story 5-3, 5-4 (alternative calibration path, no dependencies)

### UX Considerations

**Cold Start Mitigation:**
- Users without past proposals can still calibrate immediately
- "Takes about 30 seconds" sets expectations
- No friction to get started

**Upgrade Path:**
- Clear messaging that Golden Set is more accurate
- "Upload proposals later for better accuracy" suggestion
- Easy to recalibrate when user has past work

**Question Design:**
- Plain language, no jargon
- Descriptions help user understand each option
- 3-4 options per question (not overwhelming)
- One question at a time (focused attention)

### References

- [Source: epics-stories.md#Story 5.7: Quick Calibration Alternative]
- [Source: epics.md#Epic 5 Quick Calibration Alternative]
- [Source: epics.md#Round 3 What If Scenarios — alternative for users without past work]
- [Story 5-3: Golden Set Upload UI — alternative calibration path]
- [Story 5-5b: Persist Voice Profile — persistence layer]
- [Story 5-5: Voice Profile Display — displays calibration result]
