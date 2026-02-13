// Voice Learning feature exports
export { VoiceProfileDisplay } from './VoiceProfileDisplay';
export { VoiceProfileEmpty } from './VoiceProfileEmpty';
export { useVoiceProfile } from './useVoiceProfile';
export { GoldenSetUpload } from './components/GoldenSetUpload';
export type { GoldenSetUploadProps } from './components/GoldenSetUpload';
export { QuickCalibration } from './QuickCalibration';
export { VoiceCalibrationOptions } from './VoiceCalibrationOptions';
export type { VoiceCalibrationOptionsProps } from './VoiceCalibrationOptions';
export type { QuickCalibrationAnswers } from './types';
export { QUICK_CALIBRATION_QUESTIONS } from './quickCalibrationQuestions';
export type { QuickCalibrationQuestion, QuickCalibrationOption } from './quickCalibrationQuestions';
export {
  mapToneScore,
  mapSentenceLength,
  mapStructurePreference,
  mapTechnicalDepth
} from './profileMappers';
export type { VoiceProfile, MappedMetric, VoiceLearningProgress } from './types';
export { getVoiceLearningStatus } from './types';
export { VoiceLearningTimeline } from './VoiceLearningTimeline';
export { VoiceLearningProgress } from './VoiceLearningProgress';
export type { VoiceLearningProgressProps } from './VoiceLearningProgress';
export { useProposalsEditedCount } from './useProposalsEditedCount';
