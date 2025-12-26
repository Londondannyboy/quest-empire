// State of the agent, make sure this aligns with your agent's state.
export type ProfileData = {
  name: string | null;
  role: string | null;
  company: string | null;
  location: string | null;
  skills: string[];
  day_rate: string | null;
  availability: string | null;
  work_style: string | null;
}

export type AgentState = {
  user_id: string;
  profile: ProfileData;
  jobs_shown: number;
  consents: Record<string, boolean>;
  stage: string; // onboarding, enrichment, trinity
}