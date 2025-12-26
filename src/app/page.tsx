"use client";

import dynamic from "next/dynamic";
import { ProfileCard } from "@/components/profile";
import { ConsentCard } from "@/components/consent";
import { WeatherCard } from "@/components/weather";
import { AgentState } from "@/lib/types";
import {
  useCoAgent,
  useCopilotChat,
  useFrontendTool,
  useHumanInTheLoop,
  useRenderToolCall,
} from "@copilotkit/react-core";
import { CopilotKitCSSProperties, CopilotSidebar } from "@copilotkit/react-ui";
import { useState, useCallback } from "react";

// Lazy load VoiceOrb to avoid SSR issues with Hume
const VoiceOrb = dynamic(
  () => import("@/components/voice-orb").then((mod) => mod.VoiceOrb),
  {
    ssr: false,
    loading: () => (
      <div className="w-32 h-32 rounded-full bg-gray-700 animate-pulse" />
    ),
  }
);

export default function QuestPage() {
  const [themeColor, setThemeColor] = useState("#6366f1");

  // Frontend tool to change theme
  useFrontendTool({
    name: "setThemeColor",
    parameters: [
      {
        name: "themeColor",
        description: "The theme color to set. Make sure to pick nice colors.",
        required: true,
      },
    ],
    handler({ themeColor }) {
      setThemeColor(themeColor);
    },
  });

  return (
    <main
      style={
        { "--copilot-kit-primary-color": themeColor } as CopilotKitCSSProperties
      }
    >
      <CopilotSidebar
        disableSystemMessage={true}
        clickOutsideToClose={false}
        labels={{
          title: "Quest Career Assistant",
          initial:
            "👋 Hi! I'm Quest, your career assistant. What role are you looking for?",
        }}
        suggestions={[
          {
            title: "Find Jobs",
            message: "I'm looking for Fractional CMO roles in London.",
          },
          {
            title: "Update Profile",
            message: "My name is John and I have 10 years experience in marketing.",
          },
          {
            title: "Check Profile",
            message: "What do you know about me so far?",
          },
          {
            title: "Search Jobs",
            message: "Search for interim CTO positions in remote.",
          },
        ]}
      >
        <QuestContent themeColor={themeColor} />
      </CopilotSidebar>
    </main>
  );
}

function QuestContent({ themeColor }: { themeColor: string }) {
  // Shared state with the Quest agent
  const { state, setState } = useCoAgent<AgentState>({
    name: "my_agent",
    initialState: {
      user_id: "anonymous",
      profile: {
        name: null,
        role: null,
        company: null,
        location: null,
        skills: [],
        day_rate: null,
        availability: null,
        work_style: null,
      },
      jobs_shown: 0,
      consents: {},
      stage: "onboarding",
    },
  });

  // Get chat functions to send voice transcripts to agent
  const { appendMessage } = useCopilotChat();

  // Handle voice transcripts - send user speech to CopilotKit
  const handleVoiceTranscript = useCallback(
    (text: string, role: "user" | "assistant") => {
      if (role === "user" && text.trim()) {
        // Send user's speech to the CopilotKit agent
        appendMessage({ content: text, role: "user" });
      }
    },
    [appendMessage]
  );

  // Generative UI for weather (demo)
  useRenderToolCall(
    {
      name: "get_weather",
      description: "Get the weather for a given location.",
      parameters: [{ name: "location", type: "string", required: true }],
      render: ({ args }) => {
        return <WeatherCard location={args.location} themeColor={themeColor} />;
      },
    },
    [themeColor]
  );

  // HITL for LinkedIn consent
  useHumanInTheLoop(
    {
      name: "request_linkedin_consent",
      description: "Request consent to enrich profile from LinkedIn.",
      render: ({ respond, status }) => {
        return (
          <ConsentCard
            themeColor={themeColor}
            consentType="linkedin_scrape"
            description="May I look up your LinkedIn profile to enrich your career data?"
            status={status}
            respond={respond}
          />
        );
      },
    },
    [themeColor]
  );

  // HITL for Human Review consent
  useHumanInTheLoop(
    {
      name: "request_human_review",
      description: "Request consent for human review of profile.",
      render: ({ respond, status }) => {
        return (
          <ConsentCard
            themeColor={themeColor}
            consentType="human_review"
            description="Would you like a Quest career expert to review your profile and help find opportunities?"
            status={status}
            respond={respond}
          />
        );
      },
    },
    [themeColor]
  );

  return (
    <div
      style={{ backgroundColor: themeColor }}
      className="h-screen flex justify-center items-center flex-col gap-8 transition-colors duration-300"
    >
      {/* Voice Orb - Central interaction point */}
      <VoiceOrb
        userId={state?.user_id}
        onTranscript={handleVoiceTranscript}
      />

      {/* Profile Card */}
      <ProfileCard state={state} setState={setState} />
    </div>
  );
}
