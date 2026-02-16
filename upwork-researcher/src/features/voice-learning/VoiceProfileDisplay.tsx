import { useNavigate } from "react-router-dom";

import {
  mapToneScore,
  mapSentenceLength,
  mapStructurePreference,
  mapTechnicalDepth,
} from "./profileMappers";
import { useVoiceProfile } from "./useVoiceProfile";
import { VoiceProfileEmpty } from "./VoiceProfileEmpty";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function VoiceProfileDisplay() {
  const { profile, loading, error, refetch } = useVoiceProfile();
  const navigate = useNavigate();

  if (loading) {
    return <VoiceProfileSkeleton />;
  }

  if (error) {
    return (
      <Card className="bg-[#1e1e1e] border-[#2a2a2a]">
        <CardContent className="pt-6">
          <p className="text-red-500">Failed to load voice profile: {error}</p>
        </CardContent>
      </Card>
    );
  }

  if (!profile) {
    return <VoiceProfileEmpty onStartCalibration={() => navigate("/calibration")} />;
  }

  const tone = mapToneScore(profile.tone_score);
  const length = mapSentenceLength(profile.avg_sentence_length);
  const structure = mapStructurePreference(profile.structure_preference);
  const technical = mapTechnicalDepth(profile.technical_depth);

  // Show top 3 phrases only
  const displayPhrases = profile.common_phrases.slice(0, 3);

  return (
    <Card className="bg-[#1e1e1e] border-[#2a2a2a]">
      <CardHeader>
        <CardTitle className="text-[#fafafa]">Your Writing Style</CardTitle>
        <CardDescription className="text-[#a3a3a3]">
          Based on {profile.sample_count} past proposal{profile.sample_count !== 1 ? "s" : ""}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4" role="list" aria-label="Voice profile metrics">
        {/* Tone */}
        <div
          className="flex items-start gap-3"
          role="listitem"
          aria-label={`Tone: ${tone.label}, ${tone.description}`}
        >
          <span className="text-2xl" aria-hidden="true">
            {tone.emoji}
          </span>
          <div>
            <p className="text-[#fafafa] font-medium">Tone: {tone.label}</p>
            <p className="text-[#a3a3a3] text-sm">{tone.description}</p>
          </div>
        </div>

        {/* Sentence Length */}
        <div
          className="flex items-start gap-3"
          role="listitem"
          aria-label={`Length: ${length.label}, ${length.description}`}
        >
          <span className="text-2xl" aria-hidden="true">
            {length.emoji}
          </span>
          <div>
            <p className="text-[#fafafa] font-medium">Length: {length.label}</p>
            <p className="text-[#a3a3a3] text-sm">{length.description}</p>
          </div>
        </div>

        {/* Structure */}
        <div
          className="flex items-start gap-3"
          role="listitem"
          aria-label={`Structure: ${structure.label}, ${structure.description}`}
        >
          <span className="text-2xl" aria-hidden="true">
            {structure.emoji}
          </span>
          <div>
            <p className="text-[#fafafa] font-medium">Structure: {structure.label}</p>
            <p className="text-[#a3a3a3] text-sm">{structure.description}</p>
          </div>
        </div>

        {/* Technical Depth */}
        <div
          className="flex items-start gap-3"
          role="listitem"
          aria-label={`Technical Depth: ${technical.label}, ${technical.description}`}
        >
          <span className="text-2xl" aria-hidden="true">
            {technical.emoji}
          </span>
          <div>
            <p className="text-[#fafafa] font-medium">Technical Depth: {technical.label}</p>
            <p className="text-[#a3a3a3] text-sm">{technical.description}</p>
          </div>
        </div>

        {/* Common Phrases */}
        {displayPhrases.length > 0 && (
          <>
            <div className="border-t border-[#2a2a2a] my-4" />
            <div>
              <p className="text-[#fafafa] font-medium mb-2">Common phrases you use:</p>
              <ul className="space-y-1 text-[#a3a3a3] text-sm">
                {displayPhrases.map((phrase) => (
                  <li key={phrase}>• &quot;{phrase}&quot;</li>
                ))}
              </ul>
            </div>
          </>
        )}

        {/* Recalibrate Button */}
        <div className="pt-4">
          <Button onClick={() => navigate("/calibration")} variant="outline" className="w-full">
            Recalibrate Voice
          </Button>
        </div>

        {/* Privacy Message */}
        <div className="pt-2 text-center">
          <p className="text-xs text-[#a3a3a3]">
            🔒 Your proposals stay on your device. Only style patterns are used for generation.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function VoiceProfileSkeleton() {
  return (
    <Card className="bg-[#1e1e1e] border-[#2a2a2a]">
      <CardHeader>
        <Skeleton className="h-6 w-48 bg-[#2a2a2a]" />
        <Skeleton className="h-4 w-32 bg-[#2a2a2a]" />
      </CardHeader>
      <CardContent className="space-y-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-start gap-3">
            <Skeleton className="h-6 w-6 rounded bg-[#2a2a2a]" />
            <div className="flex-1">
              <Skeleton className="h-5 w-32 mb-1 bg-[#2a2a2a]" />
              <Skeleton className="h-4 w-48 bg-[#2a2a2a]" />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
