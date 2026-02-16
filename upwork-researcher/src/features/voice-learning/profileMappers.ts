import type { MappedMetric } from "./types";

export function mapToneScore(score: number): MappedMetric {
  let label: string;
  let description: string;

  if (score <= 3) {
    label = "Very Casual";
    description = `${Math.round(score * 10)}% informal language`;
  } else if (score <= 5) {
    label = "Conversational";
    description = `${Math.round(score * 10)}% conversational tone`;
  } else if (score <= 7) {
    label = "Professional";
    description = `${Math.round(score * 10)}% formal language`;
  } else if (score <= 9) {
    label = "Formal";
    description = `${Math.round(score * 10)}% highly formal`;
  } else {
    label = "Academic";
    description = `${Math.round(score * 10)}% academic language`;
  }

  return { label, description, emoji: "📝" };
}

export function mapSentenceLength(length: number): MappedMetric {
  let label: string;

  if (length < 10) {
    label = "Very Concise";
  } else if (length < 15) {
    label = "Concise";
  } else if (length <= 20) {
    label = "Moderate";
  } else if (length <= 25) {
    label = "Detailed";
  } else {
    label = "Very Detailed";
  }

  return {
    label,
    description: `Average ${Math.round(length)} words per sentence`,
    emoji: "📏",
  };
}

export function mapStructurePreference(preference: {
  paragraphs_pct: number;
  bullets_pct: number;
}): MappedMetric {
  let label: string;

  if (preference.bullets_pct > 60) {
    label = "Bullet-Heavy";
  } else if (preference.bullets_pct >= 40) {
    label = "Mixed";
  } else {
    label = "Paragraph-Heavy";
  }

  return {
    label,
    description: `${preference.paragraphs_pct}% paragraphs, ${preference.bullets_pct}% bullet points`,
    emoji: "📐",
  };
}

export function mapTechnicalDepth(depth: number): MappedMetric {
  let label: string;

  if (depth <= 3) {
    label = "Beginner";
  } else if (depth <= 5) {
    label = "Intermediate";
  } else if (depth <= 7) {
    label = "Advanced";
  } else {
    label = "Expert";
  }

  return {
    label,
    description: `${Math.round(depth * 10)}% technical terminology`,
    emoji: "🎓",
  };
}
