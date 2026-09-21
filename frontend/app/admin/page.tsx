"use client";

import { useState, useEffect, useRef } from "react";
import {
  Activity,
  Terminal,
  ShieldCheck,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  Clock,
  Cpu,
  Wrench,
  Layers,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  UserCheck,
} from "lucide-react";

interface TelemetryEvent {
  session_id: string;
  event_type:
    | "STATE_TRANSITION"
    | "THOUGHT"
    | "TOOL_CALL_START"
    | "TOOL_CALL_END"
    | "POLICY_AUDIT"
    | "CONNECTED"
    | "ERROR";
  timestamp: string;
  data: any;
}

interface PolicyAudit {
  decision: "APPROVE" | "APPROVE_WITH_FEE" | "DENY" | "ESCALATE";
  eligible: boolean;
  refund_amount: number;
  checklist: {
    window_valid: boolean;
    category_allowed: boolean;
    condition_allowed: boolean;
    fraud_check_passed: boolean;
    under_high_value_cap: boolean;
  };
  violations: string[];
  explanation: string;
}

export default function AdminConsole() {
  const [sessionId, setSessionId] = useState<string>("demo");
  const [activeSessionInput, setActiveSessionInput] =
    useState<string>("sess_cust-001_demo");
  const [events, setEvents] = useState<TelemetryEvent[]>([]);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [activeNode, setActiveNode] = useState<string>("IDLE");
  const [latestAudit, setLatestAudit] = useState<PolicyAudit | null>(null);
  const [expandedCards, setExpandedCards] = useState<Record<number, boolean>>(
    {},
  );

  const eventSourceRef = useRef<EventSource | null>(null);
  const logEndRef = useRef<HTMLDivElement>(null);

  // Connect to SSE Stream
  useEffect(() => {
    connectToStream(sessionId);
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, [sessionId]);

  // Auto-scroll logs
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [events]);

  function connectToStream(targetSession: string) {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    setEvents([]);
    setLatestAudit(null);
    setActiveNode("CONNECTING");

    // 1. Fetch historical logs for session if already exists
    fetch(`http://127.0.0.1:8000/api/admin/history/${targetSession}`)
      .then((res) => res.json())
      .then((history: TelemetryEvent[]) => {
        if (Array.isArray(history) && history.length > 0) {
          setEvents(history);
          const lastAudit = [...history]
            .reverse()
            .find((e) => e.event_type === "POLICY_AUDIT");
          if (lastAudit) setLatestAudit(lastAudit.data);
        }
      })
      .catch((err) => console.error("Error fetching session history:", err));

    // 2. Open Live Server-Sent Events (SSE) stream
    const es = new EventSource(
      `http://127.0.0.1:8000/api/admin/stream/${targetSession}`,
    );
    eventSourceRef.current = es;

    es.onopen = () => {
      setIsConnected(true);
      setActiveNode("LISTENING");
    };

    es.onmessage = (messageEvent) => {
      try {
        const payload: TelemetryEvent = JSON.parse(messageEvent.data);
        setEvents((prev) => [...prev, payload]);

        // Update real-time HUD widgets
        if (payload.event_type === "STATE_TRANSITION") {
          setActiveNode(payload.data.node?.toUpperCase() || "PROCESSING");
        } else if (payload.event_type === "POLICY_AUDIT") {
          setLatestAudit(payload.data);
        }
      } catch (err) {
        console.error("Failed to parse SSE frame:", err);
      }
    };

    es.onerror = () => {
      setIsConnected(false);
      setActiveNode("DISCONNECTED");
    };
  }

  const toggleExpand = (index: number) => {
    setExpandedCards((prev) => ({ ...prev, [index]: !prev[index] }));
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans p-4 lg:p-6 flex flex-col gap-6">
      {/* Top Telemetry HUD Bar */}
      <div className="flex flex-wrap items-center justify-between bg-zinc-900 border border-zinc-800 p-4 rounded-xl shadow-lg gap-4">
        <div className="flex items-center space-x-3">
          <div className="bg-emerald-500/10 border border-emerald-500/30 p-2 rounded-lg text-emerald-400">
            <Activity className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h1 className="font-mono font-bold text-base text-zinc-100 tracking-tight flex items-center gap-2">
              AGENT TELEMETRY OBSERVABILITY CONSOLE
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800 font-mono">
                LIVE
              </span>
            </h1>
            <p className="text-xs text-zinc-400">
              Real-time LangGraph State Machine & Deterministic Policy Telemetry
            </p>
          </div>
        </div>

        {/* Session Switcher Input */}
        <div className="flex items-center space-x-2">
          <span className="text-xs text-zinc-400 font-mono">
            Tracking Session:
          </span>
          <div className="flex items-center bg-zinc-950 border border-zinc-700 rounded-lg overflow-hidden">
            <input
              type="text"
              value={activeSessionInput}
              onChange={(e) => setActiveSessionInput(e.target.value)}
              className="bg-transparent px-3 py-1.5 text-xs font-mono text-zinc-200 focus:outline-none w-48"
              placeholder="session_id..."
            />
            <button
              onClick={() => setSessionId(activeSessionInput)}
              className="bg-zinc-800 hover:bg-zinc-700 px-3 py-1.5 text-xs font-mono text-zinc-200 border-l border-zinc-700 transition"
            >
              Attach
            </button>
          </div>
          <button
            onClick={() => connectToStream(sessionId)}
            className="p-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-zinc-300 border border-zinc-700 transition"
            title="Reconnect Stream"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main Grid: Policy HUD (Left) & Real-Time Reasoning Log (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1">
        {/* Left Col: Policy Compliance Checklist & State HUD */}
        <div className="flex flex-col gap-6">
          {/* Active Node Card */}
          <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-xl shadow-sm">
            <div className="flex items-center justify-between mb-3 text-xs font-mono text-zinc-400">
              <span className="flex items-center gap-1.5">
                <Cpu className="w-4 h-4 text-blue-400" /> ACTIVE LANGGRAPH NODE
              </span>
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-bold ${isConnected ? "bg-emerald-950 text-emerald-400 border border-emerald-800" : "bg-red-950 text-red-400 border border-red-800"}`}
              >
                {isConnected ? "STREAM ACTIVE" : "DISCONNECTED"}
              </span>
            </div>
            <div className="bg-zinc-950 p-3 rounded-lg border border-zinc-800 flex items-center justify-between">
              <span className="font-mono text-lg font-bold text-emerald-400 tracking-wider">
                {activeNode}
              </span>
              <span className="text-xs text-zinc-500 font-mono">
                {events.length} Telemetry Frames
              </span>
            </div>
          </div>

          {/* Real-time Policy Audit HUD */}
          <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-xl shadow-sm flex-1 flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2 text-zinc-200 font-mono text-xs font-bold uppercase tracking-wider">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>Policy Audit Verdict (POL-2025-REV4)</span>
              </div>
              {latestAudit && (
                <span
                  className={`text-[11px] font-bold px-2.5 py-1 rounded-md font-mono ${
                    latestAudit.decision === "APPROVE"
                      ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                      : latestAudit.decision === "APPROVE_WITH_FEE"
                        ? "bg-amber-500/20 text-amber-400 border border-amber-500/40"
                        : latestAudit.decision === "ESCALATE"
                          ? "bg-purple-500/20 text-purple-400 border border-purple-500/40"
                          : "bg-red-500/20 text-red-400 border border-red-500/40"
                  }`}
                >
                  {latestAudit.decision}
                </span>
              )}
            </div>

            {latestAudit ? (
              <div className="space-y-4 text-xs font-mono">
                {/* Visual Checklist */}
                <div className="space-y-2 bg-zinc-950 p-3 rounded-lg border border-zinc-800/80">
                  <div className="flex items-center justify-between py-1 border-b border-zinc-800/60">
                    <span className="text-zinc-400">
                      1. Delivery Window ≤ 30 Days:
                    </span>
                    {latestAudit.checklist.window_valid ? (
                      <span className="text-emerald-400 flex items-center gap-1 font-bold">
                        <CheckCircle2 className="w-3.5 h-3.5" /> PASS
                      </span>
                    ) : (
                      <span className="text-red-400 flex items-center gap-1 font-bold">
                        <XCircle className="w-3.5 h-3.5" /> FAIL
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between py-1 border-b border-zinc-800/60">
                    <span className="text-zinc-400">
                      2. Category Eligibility (Sec 3):
                    </span>
                    {latestAudit.checklist.category_allowed ? (
                      <span className="text-emerald-400 flex items-center gap-1 font-bold">
                        <CheckCircle2 className="w-3.5 h-3.5" /> PASS
                      </span>
                    ) : (
                      <span className="text-red-400 flex items-center gap-1 font-bold">
                        <XCircle className="w-3.5 h-3.5" /> EXCLUDED
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between py-1 border-b border-zinc-800/60">
                    <span className="text-zinc-400">
                      3. Condition & Tag Check (Sec 2):
                    </span>
                    {latestAudit.checklist.condition_allowed ? (
                      <span className="text-emerald-400 flex items-center gap-1 font-bold">
                        <CheckCircle2 className="w-3.5 h-3.5" /> ACCEPTED
                      </span>
                    ) : (
                      <span className="text-amber-400 flex items-center gap-1 font-bold">
                        <ShieldAlert className="w-3.5 h-3.5" /> FEE / RESTOCK
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between py-1 border-b border-zinc-800/60">
                    <span className="text-zinc-400">
                      4. Fraud Risk Score &lt; 0.70:
                    </span>
                    {latestAudit.checklist.fraud_check_passed ? (
                      <span className="text-emerald-400 flex items-center gap-1 font-bold">
                        <CheckCircle2 className="w-3.5 h-3.5" /> PASS
                      </span>
                    ) : (
                      <span className="text-red-400 flex items-center gap-1 font-bold">
                        <XCircle className="w-3.5 h-3.5" /> RISK LOCK
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between py-1">
                    <span className="text-zinc-400">
                      5. Under High-Value Cap ($500):
                    </span>
                    {latestAudit.checklist.under_high_value_cap ? (
                      <span className="text-emerald-400 flex items-center gap-1 font-bold">
                        <CheckCircle2 className="w-3.5 h-3.5" /> PASS
                      </span>
                    ) : (
                      <span className="text-purple-400 flex items-center gap-1 font-bold">
                        <Clock className="w-3.5 h-3.5" /> ESCALATE
                      </span>
                    )}
                  </div>
                </div>

                {/* Amount & Explanation */}
                <div className="bg-zinc-950 p-3 rounded-lg border border-zinc-800/80 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Approved Refund:</span>
                    <span className="text-zinc-100 font-bold">
                      ${latestAudit.refund_amount.toFixed(2)}
                    </span>
                  </div>
                  {latestAudit.violations.length > 0 && (
                    <div className="text-red-400 text-[11px] pt-1">
                      <strong>Policy Violations:</strong>
                      <ul className="list-disc list-inside mt-1">
                        {latestAudit.violations.map((v, i) => (
                          <li key={i}>{v}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <p className="text-zinc-400 text-[11px] leading-relaxed pt-1 border-t border-zinc-800">
                    <strong>Engine Note:</strong> {latestAudit.explanation}
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-zinc-600 border border-dashed border-zinc-800 rounded-lg p-6 text-center">
                <ShieldCheck className="w-8 h-8 mb-2 stroke-1 text-zinc-700" />
                <p className="text-xs font-mono">
                  No policy evaluation events triggered yet for this session.
                </p>
                <p className="text-[11px] text-zinc-500 mt-1">
                  Submit a refund request on the customer portal to inspect live
                  telemetry.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Right Col: Real-Time Reasoning Log & Tool Inspector */}
        <div className="lg:col-span-2 bg-zinc-900 border border-zinc-800 rounded-xl p-5 shadow-sm flex flex-col h-[750px] overflow-hidden">
          <div className="flex items-center justify-between pb-3 border-b border-zinc-800 text-xs font-mono text-zinc-400">
            <span className="flex items-center gap-2">
              <Terminal className="w-4 h-4 text-emerald-400" /> LIVE AGENT
              REASONING TRACE & TOOL LOGS
            </span>
            <span className="text-[11px] text-zinc-500">
              Auto-streaming via Server-Sent Events
            </span>
          </div>

          {/* Trace Stream Cards */}
          <div className="flex-1 overflow-y-auto pt-4 space-y-3 pr-1 font-mono text-xs">
            {events.length === 0 ? (
              <div className="h-full flex items-center justify-center text-zinc-600">
                <p>Waiting for agent events on session {sessionId}...</p>
              </div>
            ) : (
              events.map((evt, idx) => {
                const isExpanded = !!expandedCards[idx];
                return (
                  <div
                    key={idx}
                    className={`rounded-lg border p-3 transition ${
                      evt.event_type === "TOOL_CALL_START"
                        ? "bg-blue-950/20 border-blue-800/40 text-blue-300"
                        : evt.event_type === "TOOL_CALL_END"
                          ? "bg-emerald-950/20 border-emerald-800/40 text-emerald-300"
                          : evt.event_type === "POLICY_AUDIT"
                            ? "bg-amber-950/20 border-amber-800/40 text-amber-300"
                            : evt.event_type === "THOUGHT"
                              ? "bg-zinc-800/40 border-zinc-700/50 text-zinc-300"
                              : "bg-zinc-950 border-zinc-800 text-zinc-400"
                    }`}
                  >
                    <div
                      className="flex items-center justify-between cursor-pointer select-none"
                      onClick={() => toggleExpand(idx)}
                    >
                      <div className="flex items-center space-x-2">
                        {evt.event_type === "TOOL_CALL_START" && (
                          <Wrench className="w-3.5 h-3.5 text-blue-400" />
                        )}
                        {evt.event_type === "TOOL_CALL_END" && (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        )}
                        {evt.event_type === "POLICY_AUDIT" && (
                          <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                        )}
                        {evt.event_type === "THOUGHT" && (
                          <Terminal className="w-3.5 h-3.5 text-zinc-400" />
                        )}
                        {evt.event_type === "STATE_TRANSITION" && (
                          <Layers className="w-3.5 h-3.5 text-purple-400" />
                        )}

                        <span className="font-bold text-[11px] tracking-wide">
                          [{evt.event_type}]
                        </span>

                        <span className="text-zinc-300 truncate max-w-sm">
                          {evt.event_type === "TOOL_CALL_START" &&
                            `Invoked tool: ${evt.data.tool}`}
                          {evt.event_type === "TOOL_CALL_END" &&
                            `Returned from: ${evt.data.tool}`}
                          {evt.event_type === "THOUGHT" && evt.data.thought}
                          {evt.event_type === "STATE_TRANSITION" &&
                            `Transitioning to node: ${evt.data.node}`}
                          {evt.event_type === "POLICY_AUDIT" &&
                            `Verdict: ${evt.data.decision}`}
                        </span>
                      </div>

                      <div className="flex items-center space-x-2 text-zinc-500 text-[10px]">
                        <span>
                          {new Date(evt.timestamp).toLocaleTimeString()}
                        </span>
                        {isExpanded ? (
                          <ChevronDown className="w-3.5 h-3.5" />
                        ) : (
                          <ChevronRight className="w-3.5 h-3.5" />
                        )}
                      </div>
                    </div>

                    {/* Expandable JSON Payload */}
                    {isExpanded && (
                      <div className="mt-3 pt-2 border-t border-zinc-800/80 bg-zinc-950 p-3 rounded text-[11px] text-zinc-300 overflow-x-auto">
                        <pre className="whitespace-pre-wrap font-mono">
                          {JSON.stringify(evt.data, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                );
              })
            )}
            <div ref={logEndRef} />
          </div>
        </div>
      </div>
    </div>
  );
}
