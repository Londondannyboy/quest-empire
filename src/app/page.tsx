"use client";

import dynamic from "next/dynamic";
import { ProfileCard } from "@/components/profile";
import { ConsentCard } from "@/components/consent";
import { WeatherCard } from "@/components/weather";
import { ZepGraph, GraphNode, ClusterType } from "@/components/zep-graph";
import { AuthModal } from "@/components/auth-modal";
import { AgentState } from "@/lib/types";
import {
  useCoAgent,
  useCopilotChat,
  useFrontendTool,
  useHumanInTheLoop,
  useRenderToolCall,
} from "@copilotkit/react-core";
import { CopilotKitCSSProperties, CopilotSidebar } from "@copilotkit/react-ui";
import { TextMessage, Role } from "@copilotkit/runtime-client-gql";
import { useState, useCallback, useMemo, useEffect } from "react";

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

// Convert agent state to graph nodes
function stateToGraphNodes(state: AgentState | null): GraphNode[] {
  if (!state?.profile) return [];

  const nodes: GraphNode[] = [];
  const profile = state.profile;

  // Identity cluster
  if (profile.name) {
    nodes.push({ id: "name", label: profile.name, cluster: "identity", validated: true });
  }
  if (profile.role) {
    nodes.push({ id: "role", label: profile.role, cluster: "identity", validated: true });
  }
  if (profile.company) {
    nodes.push({ id: "company", label: profile.company, cluster: "identity", validated: true });
  }

  // Current state cluster
  if (profile.location) {
    nodes.push({ id: "location", label: profile.location, cluster: "current", validated: true });
  }
  if (profile.day_rate) {
    nodes.push({ id: "day_rate", label: profile.day_rate, cluster: "current", validated: true });
  }
  if (profile.work_style) {
    nodes.push({ id: "work_style", label: profile.work_style, cluster: "current", validated: true });
  }
  if (profile.availability) {
    nodes.push({ id: "availability", label: profile.availability, cluster: "current", validated: true });
  }

  // Skills as identity nodes
  profile.skills.forEach((skill, i) => {
    nodes.push({ id: `skill_${i}`, label: skill, cluster: "identity", validated: true });
  });

  // Jobs shown indicator
  if (state.jobs_shown > 0) {
    nodes.push({ id: "jobs", label: `${state.jobs_shown} Jobs`, cluster: "needs", validated: true });
  }

  return nodes;
}

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

  // Handle auth state changes - update agent's user_id
  const handleAuthChange = useCallback(
    (user: { id: string; email: string; name: string | null } | null) => {
      if (user) {
        setState({
          ...state,
          user_id: user.id,
          profile: {
            ...state.profile,
            name: user.name || state.profile.name,
          },
        });
        console.log("🔐 User logged in:", user.id);
      } else {
        setState({
          ...state,
          user_id: "anonymous",
        });
        console.log("🔓 User logged out");
      }
    },
    [setState, state]
  );

  // Handle voice transcripts - send user speech to CopilotKit
  const handleVoiceTranscript = useCallback(
    (text: string, role: "user" | "assistant") => {
      if (role === "user" && text.trim()) {
        // Send user's speech to the CopilotKit agent using TextMessage
        appendMessage(new TextMessage({ content: text, role: Role.User }));
      }
    },
    [appendMessage]
  );

  // Debug: log state changes
  useEffect(() => {
    console.log("🔄 Agent state updated:", JSON.stringify(state, null, 2));
  }, [state]);

  // Convert state to graph nodes
  const graphNodes = useMemo(() => {
    const nodes = stateToGraphNodes(state);
    console.log("📊 Graph nodes:", nodes.length, nodes);
    return nodes;
  }, [state]);

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
      className="h-screen flex justify-center items-center transition-colors duration-300 relative overflow-hidden"
    >
      {/* Auth Modal - Top right */}
      <AuthModal onAuthChange={handleAuthChange} />

      {/* Zep Graph - Full screen background */}
      <div className="absolute inset-0 flex items-center justify-center">
        <ZepGraph nodes={graphNodes} className="w-full h-full max-w-4xl" />
      </div>

      {/* Voice Orb - Positioned at center, overlapping the graph "YOU" node */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
        <VoiceOrb
          userId={state?.user_id}
          profile={state?.profile}
          onTranscript={handleVoiceTranscript}
        />
      </div>

      {/* Profile Card - Bottom overlay */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 w-full max-w-xl px-4">
        <ProfileCard state={state} setState={setState} />
      </div>
    </div>
  );
}
