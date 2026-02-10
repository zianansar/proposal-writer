// Quick Calibration question definitions for Story 5.7

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
