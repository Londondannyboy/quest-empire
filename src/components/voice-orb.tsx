"use client";

import { useState, useEffect, useCallback } from "react";
import { VoiceProvider, useVoice } from "@humeai/voice-react";

interface VoiceOrbProps {
  userId?: string;
  onTranscript?: (text: string, role: "user" | "assistant") => void;
}

function VoiceControls({
  accessToken,
  configId,
  onTranscript,
}: {
  accessToken: string;
  configId: string;
  onTranscript?: (text: string, role: "user" | "assistant") => void;
}) {
  const { status, connect, disconnect, isMuted, mute, unmute, messages } =
    useVoice();

  const isConnected = status.value === "connected";
  const isConnecting = status.value === "connecting";

  // Forward transcripts to parent
  useEffect(() => {
    if (!onTranscript) return;
    for (const msg of messages) {
      if (msg.type === "user_message" || msg.type === "assistant_message") {
        const content = (msg as { message?: { content?: string } }).message
          ?.content;
        if (content) {
          onTranscript(
            content,
            msg.type === "user_message" ? "user" : "assistant"
          );
        }
      }
    }
  }, [messages, onTranscript]);

  const handleConnect = useCallback(async () => {
    try {
      await connect({
        auth: { type: "accessToken", value: accessToken },
        configId,
      });
    } catch (e) {
      console.error("Voice connect error:", e);
    }
  }, [connect, accessToken, configId]);

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Voice Orb */}
      <button
        onClick={isConnected ? disconnect : handleConnect}
        disabled={isConnecting}
        className={`w-32 h-32 rounded-full flex items-center justify-center transition-all duration-300 cursor-pointer
          ${
            isConnected
              ? "bg-gradient-to-r from-green-500 to-emerald-500 shadow-lg shadow-green-500/50 animate-pulse"
              : isConnecting
              ? "bg-gradient-to-r from-yellow-500 to-orange-500 animate-pulse"
              : "bg-gradient-to-r from-indigo-500 to-purple-500 hover:scale-110"
          }`}
      >
        <span className="text-4xl">
          {isConnected ? "🎙️" : isConnecting ? "⏳" : "🎤"}
        </span>
      </button>

      {/* Status */}
      <p className="text-white/80 text-sm">
        {isConnecting && "Connecting..."}
        {isConnected && (isMuted ? "Muted - Tap to unmute" : "Listening...")}
        {status.value === "disconnected" && "Tap to start voice"}
      </p>

      {/* Mute button when connected */}
      {isConnected && (
        <button
          onClick={() => (isMuted ? unmute() : mute())}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all
            ${
              isMuted
                ? "bg-yellow-500/80 text-white"
                : "bg-white/20 text-white hover:bg-white/30"
            }`}
        >
          {isMuted ? "🔇 Unmute" : "🎤 Mute"}
        </button>
      )}
    </div>
  );
}

export function VoiceOrb({ userId, onTranscript }: VoiceOrbProps) {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [configId, setConfigId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchToken() {
      try {
        const response = await fetch("/api/voice/access-token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ user_id: userId }),
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();

        if (data.error) {
          throw new Error(data.error);
        }

        setAccessToken(data.accessToken);
        setConfigId(data.configId || "");
      } catch (err) {
        console.error("Voice token error:", err);
        setError(err instanceof Error ? err.message : "Failed to init voice");
      } finally {
        setLoading(false);
      }
    }

    fetchToken();
  }, [userId]);

  if (loading) {
    return (
      <div className="flex flex-col items-center gap-4">
        <div className="w-32 h-32 rounded-full bg-gray-700 animate-pulse" />
        <p className="text-white/60 text-sm">Loading voice...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center gap-4">
        <div className="w-32 h-32 rounded-full bg-red-500/30 flex items-center justify-center">
          <span className="text-4xl">❌</span>
        </div>
        <p className="text-red-400 text-sm">{error}</p>
      </div>
    );
  }

  if (!accessToken || !configId) {
    return (
      <div className="flex flex-col items-center gap-4">
        <div className="w-32 h-32 rounded-full bg-yellow-500/30 flex items-center justify-center">
          <span className="text-4xl">⚠️</span>
        </div>
        <p className="text-yellow-400 text-sm">Voice not configured</p>
      </div>
    );
  }

  return (
    <VoiceProvider>
      <VoiceControls
        accessToken={accessToken}
        configId={configId}
        onTranscript={onTranscript}
      />
    </VoiceProvider>
  );
}
