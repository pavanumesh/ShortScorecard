export interface Question {
  QID: string;
  Section: string;
  Question: string;
  Tooltip: string;
  Scale0: string;
  Scale1: string;
  Scale2: string;
  Scale3: string;
  Scale4: string;
  AllowNA: string;
  Weight: number;
}

export interface Answer {
  qid: string;
  score: number | "N/A" | undefined;
  notes: string;
}

export interface Response {
  timestamp: string;
  respondentId: string;
  community: string;
  section: string;
  qid: string;
  score: number | string;
  notes: string;
  weight: number;
  weightedScore: number | string;
  totalScore: number;
}

export interface SectionScore {
  section: string;
  average: number;
  count: number;
}
/** One row from the "Community Information" sheet. Keys match sheet headers (e.g. Question, Answer). */
export type CommunityInfoItem = Record<string, unknown>;

