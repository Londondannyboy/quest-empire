"use client";

import { useEffect, useRef, useCallback } from "react";
import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCenter,
  forceCollide,
  SimulationNodeDatum,
  SimulationLinkDatum,
} from "d3-force";

// Graph node types matching the 4-layer user repo
type ClusterType = "identity" | "current" | "needs" | "trinity";

interface GraphNode extends SimulationNodeDatum {
  id: string;
  label: string;
  cluster: ClusterType;
  value?: string;
  validated?: boolean;
}

interface GraphLink extends SimulationLinkDatum<GraphNode> {
  source: string | GraphNode;
  target: string | GraphNode;
}

interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

// Cluster configuration - positioned around the central voice orb
const CLUSTERS: Record<ClusterType, { label: string; color: string; angle: number }> = {
  identity: {
    label: "IDENTITY",
    color: "#3B82F6", // Blue
    angle: -45, // Top-left
  },
  current: {
    label: "CURRENT STATE",
    color: "#10B981", // Green
    angle: 45, // Top-right
  },
  needs: {
    label: "NEEDS",
    color: "#F97316", // Orange
    angle: 135, // Bottom-right
  },
  trinity: {
    label: "TRINITY",
    color: "#EC4899", // Pink
    angle: -135, // Bottom-left
  },
};

interface ZepGraphProps {
  nodes: GraphNode[];
  className?: string;
  onNodeClick?: (node: GraphNode) => void;
}

export function ZepGraph({ nodes, className = "", onNodeClick }: ZepGraphProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const simulationRef = useRef<ReturnType<typeof forceSimulation> | null>(null);
  const nodesRef = useRef<GraphNode[]>([]);
  const linksRef = useRef<GraphLink[]>([]);

  // Build graph data from nodes
  const buildGraphData = useCallback((inputNodes: GraphNode[]): GraphData => {
    // Add central "YOU" node
    const centerNode: GraphNode = {
      id: "center",
      label: "YOU",
      cluster: "identity",
      validated: true,
      fx: 0, // Fixed at center
      fy: 0,
    };

    const allNodes = [centerNode, ...inputNodes];

    // Create links from center to all nodes
    const links: GraphLink[] = inputNodes.map((node) => ({
      source: "center",
      target: node.id,
    }));

    return { nodes: allNodes, links };
  }, []);

  // Draw the graph
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const centerX = width / 2;
    const centerY = height / 2;

    // Clear
    ctx.clearRect(0, 0, width, height);

    // Draw cluster labels in background
    ctx.font = "bold 14px sans-serif";
    ctx.textAlign = "center";
    Object.entries(CLUSTERS).forEach(([, config]) => {
      const rad = (config.angle * Math.PI) / 180;
      const labelX = centerX + Math.cos(rad) * 280;
      const labelY = centerY + Math.sin(rad) * 200;
      ctx.fillStyle = config.color + "60";
      ctx.fillText(config.label, labelX, labelY);
    });

    // Draw links
    ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
    ctx.lineWidth = 1;
    linksRef.current.forEach((link) => {
      const source = link.source as GraphNode;
      const target = link.target as GraphNode;
      if (source.x && source.y && target.x && target.y) {
        ctx.beginPath();
        ctx.moveTo(centerX + source.x, centerY + source.y);
        ctx.lineTo(centerX + target.x, centerY + target.y);
        ctx.stroke();
      }
    });

    // Draw nodes
    nodesRef.current.forEach((node) => {
      if (node.x === undefined || node.y === undefined) return;

      const x = centerX + node.x;
      const y = centerY + node.y;
      const cluster = CLUSTERS[node.cluster];
      const radius = node.id === "center" ? 40 : 25;

      // Glow effect for center node
      if (node.id === "center") {
        const gradient = ctx.createRadialGradient(x, y, radius * 0.5, x, y, radius * 2);
        gradient.addColorStop(0, "rgba(99, 102, 241, 0.8)");
        gradient.addColorStop(1, "rgba(99, 102, 241, 0)");
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(x, y, radius * 2, 0, Math.PI * 2);
        ctx.fill();
      }

      // Node circle
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fillStyle = node.id === "center" ? "#6366f1" : cluster?.color || "#666";
      ctx.fill();

      // Border
      ctx.strokeStyle = node.validated ? "#ffffff" : "rgba(255,255,255,0.3)";
      ctx.lineWidth = node.validated ? 2 : 1;
      ctx.stroke();

      // Label
      ctx.fillStyle = "#ffffff";
      ctx.font = node.id === "center" ? "bold 14px sans-serif" : "11px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(node.label, x, y + radius + 15);
    });
  }, []);

  // Initialize/update simulation when nodes change
  useEffect(() => {
    if (!canvasRef.current) return;

    const { nodes: graphNodes, links: graphLinks } = buildGraphData(nodes);
    nodesRef.current = graphNodes;
    linksRef.current = graphLinks;

    // Stop existing simulation
    if (simulationRef.current) {
      simulationRef.current.stop();
    }

    // Create new simulation
    simulationRef.current = forceSimulation<GraphNode>(graphNodes)
      .force(
        "link",
        forceLink<GraphNode, GraphLink>(graphLinks)
          .id((d) => d.id)
          .distance(120)
      )
      .force("charge", forceManyBody().strength(-200))
      .force("center", forceCenter(0, 0))
      .force("collide", forceCollide(35))
      .on("tick", draw);

    // Apply cluster positioning force
    simulationRef.current.force("cluster", () => {
      graphNodes.forEach((node) => {
        if (node.id === "center") return;
        const cluster = CLUSTERS[node.cluster];
        if (!cluster) return;

        const rad = (cluster.angle * Math.PI) / 180;
        const targetX = Math.cos(rad) * 150;
        const targetY = Math.sin(rad) * 150;

        node.vx = (node.vx || 0) + (targetX - (node.x || 0)) * 0.02;
        node.vy = (node.vy || 0) + (targetY - (node.y || 0)) * 0.02;
      });
    });

    return () => {
      if (simulationRef.current) {
        simulationRef.current.stop();
      }
    };
  }, [nodes, buildGraphData, draw]);

  // Handle click
  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!onNodeClick || !canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left - canvasRef.current.width / 2;
    const y = e.clientY - rect.top - canvasRef.current.height / 2;

    const clickedNode = nodesRef.current.find((node) => {
      if (!node.x || !node.y) return false;
      const dx = node.x - x;
      const dy = node.y - y;
      return Math.sqrt(dx * dx + dy * dy) < 25;
    });

    if (clickedNode && clickedNode.id !== "center") {
      onNodeClick(clickedNode);
    }
  };

  return (
    <div className={`relative ${className}`}>
      <canvas
        ref={canvasRef}
        width={600}
        height={500}
        className="w-full h-full cursor-pointer"
        onClick={handleClick}
      />

      {/* Node count */}
      <div className="absolute top-2 right-2 bg-black/50 backdrop-blur px-3 py-1 rounded-lg">
        <span className="text-gray-400 text-xs">Nodes: </span>
        <span className="text-white font-semibold text-sm">{nodes.length}</span>
      </div>

      {/* Legend */}
      <div className="absolute bottom-2 left-2 bg-black/50 backdrop-blur px-3 py-2 rounded-lg">
        <div className="flex gap-3">
          {Object.entries(CLUSTERS).map(([key, config]) => (
            <div key={key} className="flex items-center gap-1">
              <div
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: config.color }}
              />
              <span className="text-white text-xs">{config.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Export types for use in parent components
export type { GraphNode, ClusterType };
