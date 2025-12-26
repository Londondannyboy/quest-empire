"use client";

import { useState } from "react";

export interface ConsentCardProps {
  themeColor: string;
  consentType: string;
  description: string;
  status: "inProgress" | "executing" | "complete";
  respond?: (response: string) => void;
}

export function ConsentCard({
  themeColor,
  consentType,
  description,
  status,
  respond,
}: ConsentCardProps) {
  const [decision, setDecision] = useState<"granted" | "denied" | null>(null);

  const handleGrant = () => {
    setDecision("granted");
    respond?.(`User granted consent for: ${consentType}`);
  };

  const handleDeny = () => {
    setDecision("denied");
    respond?.(`User denied consent for: ${consentType}`);
  };

  const getTitle = () => {
    switch (consentType) {
      case "linkedin_scrape":
        return "LinkedIn Enrichment";
      case "human_review":
        return "Human Review";
      default:
        return "Consent Required";
    }
  };

  const getIcon = () => {
    switch (consentType) {
      case "linkedin_scrape":
        return "🔗";
      case "human_review":
        return "👤";
      default:
        return "✋";
    }
  };

  return (
    <div
      style={{ backgroundColor: themeColor }}
      className="rounded-2xl shadow-xl max-w-md w-full mt-6"
    >
      <div className="bg-white/20 backdrop-blur-md p-8 w-full rounded-2xl">
        {decision === "granted" ? (
          <div className="text-center">
            <div className="text-7xl mb-4">✅</div>
            <h2 className="text-2xl font-bold text-white mb-2">
              Consent Granted
            </h2>
            <p className="text-white/90">
              Thank you! Proceeding with {getTitle().toLowerCase()}...
            </p>
          </div>
        ) : decision === "denied" ? (
          <div className="text-center">
            <div className="text-7xl mb-4">❌</div>
            <h2 className="text-2xl font-bold text-white mb-2">
              Consent Denied
            </h2>
            <p className="text-white/90">
              No problem. We'll continue without {getTitle().toLowerCase()}.
            </p>
          </div>
        ) : (
          <>
            <div className="text-center mb-6">
              <div className="text-7xl mb-4">{getIcon()}</div>
              <h2 className="text-2xl font-bold text-white mb-2">
                {getTitle()}
              </h2>
              <p className="text-white/90">{description}</p>
            </div>

            {status === "executing" && (
              <div className="flex gap-3">
                <button
                  onClick={handleGrant}
                  className="flex-1 px-6 py-4 rounded-xl bg-white text-black font-bold
                    shadow-lg hover:shadow-xl transition-all
                    hover:scale-105 active:scale-95"
                >
                  ✅ Yes, I consent
                </button>
                <button
                  onClick={handleDeny}
                  className="flex-1 px-6 py-4 rounded-xl bg-black/20 text-white font-bold
                    border-2 border-white/30 shadow-lg
                    transition-all hover:scale-105 active:scale-95
                    hover:bg-black/30"
                >
                  ❌ No thanks
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
