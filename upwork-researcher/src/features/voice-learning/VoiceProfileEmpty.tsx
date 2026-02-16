import { FileText } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface VoiceProfileEmptyProps {
  onStartCalibration: () => void;
}

export function VoiceProfileEmpty({ onStartCalibration }: VoiceProfileEmptyProps) {
  return (
    <Card className="bg-[#1e1e1e] border-[#2a2a2a]">
      <CardContent className="pt-12 pb-12 text-center">
        <FileText className="w-16 h-16 text-[#a3a3a3] mx-auto mb-4" aria-hidden="true" />

        <h3 className="text-xl font-semibold text-[#fafafa] mb-2">No voice profile yet</h3>

        <p className="text-[#a3a3a3] mb-2 max-w-md mx-auto">
          Upload 3-5 of your best past proposals to calibrate your writing style.
        </p>

        <p className="text-sm text-[#a3a3a3] mb-6 max-w-md mx-auto">
          This helps the AI match your authentic voice when generating proposals.
        </p>

        <Button
          onClick={onStartCalibration}
          className="bg-[#f97316] hover:bg-[#ea580c] text-[#fafafa]"
        >
          Start Calibration
        </Button>
      </CardContent>
    </Card>
  );
}
