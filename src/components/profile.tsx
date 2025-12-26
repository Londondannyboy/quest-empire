"use client";

import { AgentState, ProfileData } from "@/lib/types";

export interface ProfileCardProps {
  state: AgentState;
  setState: (state: AgentState) => void;
}

export function ProfileCard({ state, setState }: ProfileCardProps) {
  const profile = state?.profile || {};

  return (
    <div className="bg-white/20 backdrop-blur-md p-8 rounded-2xl shadow-xl max-w-2xl w-full">
      <h1 className="text-4xl font-bold text-white mb-2 text-center">
        Quest Profile
      </h1>
      <p className="text-gray-200 text-center italic mb-6">
        {state?.stage === "onboarding"
          ? "Tell me about yourself and what role you're looking for..."
          : state?.stage === "enrichment"
          ? "Enriching your profile..."
          : "Your career journey awaits"}
      </p>
      <hr className="border-white/20 my-6" />

      {/* Profile Fields */}
      <div className="flex flex-col gap-4">
        {profile.name && (
          <ProfileField label="Name" value={profile.name} />
        )}
        {profile.role && (
          <ProfileField label="Target Role" value={profile.role} />
        )}
        {profile.location && (
          <ProfileField label="Location" value={profile.location} />
        )}
        {profile.company && (
          <ProfileField label="Current Company" value={profile.company} />
        )}
        {profile.day_rate && (
          <ProfileField label="Day Rate" value={profile.day_rate} />
        )}
        {profile.work_style && (
          <ProfileField label="Work Style" value={profile.work_style} />
        )}
        {profile.skills && profile.skills.length > 0 && (
          <div className="flex flex-col gap-1">
            <span className="text-white/70 text-sm">Skills</span>
            <div className="flex flex-wrap gap-2">
              {profile.skills.map((skill, i) => (
                <span
                  key={i}
                  className="bg-white/30 text-white px-3 py-1 rounded-full text-sm"
                >
                  {skill}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Jobs Counter */}
        {state?.jobs_shown > 0 && (
          <div className="mt-4 p-4 bg-green-500/30 rounded-xl">
            <span className="text-white font-semibold">
              🎯 {state.jobs_shown} matching jobs found!
            </span>
          </div>
        )}

        {/* Empty State */}
        {!profile.name && !profile.role && !profile.location && (
          <div className="text-white/60 text-center py-8">
            <p className="text-2xl mb-2">👋</p>
            <p>Start by telling Quest what role you're looking for...</p>
          </div>
        )}
      </div>
    </div>
  );
}

function ProfileField({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-white/70 text-sm">{label}</span>
      <span className="text-white font-medium text-lg">{value}</span>
    </div>
  );
}
