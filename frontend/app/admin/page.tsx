"use client";

import { useState, useEffect, useRef } from "react";
import {
  Activity,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Clock,
  Cpu,
  Wrench,
  Layers,
  Database,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Terminal,
  ArrowRight,
  Check,
  AlertTriangle,
} from "lucide-react";
import { Customer, fetchCustomers } from "@/lib/api";

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

const SCENARIO_LABELS: Record<string, string> = {
  "CUST-001": "Standard Approved Refund (Unopened, 8d)",
  "CUST-002": "30-Day Window Violation (Delivered 44d ago)",
  "CUST-003": "Fraud Risk Lock (Score 0.88, 4 returns in 90d)",
  "CUST-004": "Restocking Fee Deduction (Opened earbuds)",
  "CUST-005": "Category Exclusion (Final Sale Clearance)",
  "CUST-006": "Category Exclusion (Opened Hygiene Item)",
  "CUST-007": "High-Value Order Cap (Display > $500)",
  "CUST-008": "Digital Goods Non-Refundable License",
  "CUST-009": "Carrier Lost in Transit Package",
  "CUST-010": "Boundary Negotiation Test (38d ago)",
  "CUST-011": "Account Ban / Habitual Abuser",
  "CUST-012": "Personalized Monogrammed Merchandise",
  "CUST-013": "Invalid / Missing Order Number Prompt",
  "CUST-014": "Damaged on Arrival Full Refund (< 72h)",
  "CUST-015": "Multi-item Order Partial Refund",
};

export default function ModernAdminConsole() {
  const [activeTab, setActiveTab] = useState<"telemetry" | "crm">("telemetry");
  const [sessionId] = useState<string>("demo");
  const [events, setEvents] = useState<TelemetryEvent[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [activeNode, setActiveNode] = useState<string>("IDLE");
  const [latestAudit, setLatestAudit] = useState<PolicyAudit | null>(null);
  const [expandedCards, setExpandedCards] = useState<Record<number, boolean>>(
    {},
  );

  const eventSourceRef = useRef<EventSource | null>(null);
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchCustomers()
      .then((data) => setCustomers(data))
      .catch((err) => console.error("Error loading CRM customers:", err));
  }, []);

  useEffect(() => {
    connectToStream(sessionId);
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, [sessionId]);

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
      .catch((err) => console.error("Error fetching history:", err));

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
    <div className="min-h-screen bg-[#f8f9fd] text-slate-800 font-sans p-6 lg:p-8 flex flex-col gap-6">
      {/* ------------------------------------------------------------- */}
      {/* HEADER: Shared Brand System, Tabs, Status                    */}
      {/* ------------------------------------------------------------- */}
      <header className="bg-white border border-slate-200/80 rounded-2xl p-4 lg:px-6 shadow-sm flex flex-wrap items-center justify-between gap-4">
        {/* Logo & Brand Identity */}
        <div className="flex items-center space-x-3">
          <img
            src="/logo.svg"
            alt="Apex Logo"
            className="w-9 h-9 rounded-xl object-contain shrink-0"
            onError={(e) => {
              (e.target as HTMLElement).style.display = "none";
              (e.target as HTMLElement).nextElementSibling?.classList.remove(
                "hidden",
              );
            }}
          />
          <div className="hidden w-9 h-9 rounded-xl bg-gradient-to-tr from-violet-600 to-indigo-500 flex items-center justify-center text-white font-bold text-xs shrink-0 shadow-sm shadow-violet-200">
            A
          </div>

          <div>
            <h1 className="font-bold text-sm text-slate-900 tracking-tight flex items-center gap-2">
              Apex Operations Console
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-violet-50 text-violet-700 border border-violet-200">
                Live Telemetry
              </span>
            </h1>
            <p className="text-xs text-slate-500">
              Autonomous Refund Agent Telemetry & Policy Auditing
            </p>
          </div>
        </div>

        {/* View Switcher Pills */}
        <div className="flex items-center space-x-1.5 bg-slate-100 p-1 rounded-xl">
          <button
            onClick={() => setActiveTab("telemetry")}
            className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeTab === "telemetry"
                ? "bg-white text-violet-700 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Activity className="w-3.5 h-3.5 text-violet-600" />
            <span>Agent Telemetry</span>
          </button>

          <button
            onClick={() => setActiveTab("crm")}
            className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeTab === "crm"
                ? "bg-white text-violet-700 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Database className="w-3.5 h-3.5 text-indigo-500" />
            <span>CRM Database (15)</span>
          </button>
        </div>

        {/* Connection Indicator */}
        <div className="flex items-center space-x-3 text-xs">
          <div className="flex items-center space-x-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5">
            <span
              className={`w-2 h-2 rounded-full ${isConnected ? "bg-emerald-500 animate-pulse" : "bg-red-500"}`}
            ></span>
            <span className="text-slate-600 text-[11px] font-medium font-mono">
              {isConnected ? "STREAM ACTIVE" : "OFFLINE"}
            </span>
          </div>

          <button
            onClick={() => connectToStream(sessionId)}
            className="p-2 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl border border-slate-200 transition"
            title="Reconnect Stream"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      {/* ------------------------------------------------------------- */}
      {/* TAB 1: AGENT TELEMETRY & POLICY AUDIT VIEW                    */}
      {/* ------------------------------------------------------------- */}
      {activeTab === "telemetry" && (
        <div className="flex flex-col gap-6 flex-1">
          {/* Visual State Stepper Bar */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm flex items-center justify-between">
            <div className="flex items-center space-x-3 text-xs font-medium">
              <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                Pipeline:
              </span>

              <div className="flex items-center space-x-2">
                <span
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold ${
                    activeNode === "AGENT"
                      ? "bg-violet-600 text-white shadow-sm"
                      : "bg-slate-100 text-slate-600"
                  }`}
                >
                  1. Intent Analysis
                </span>
                <ArrowRight className="w-3 h-3 text-slate-300" />
                <span
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold ${
                    activeNode === "TOOLS"
                      ? "bg-violet-600 text-white shadow-sm"
                      : "bg-slate-100 text-slate-600"
                  }`}
                >
                  2. Tool Verification
                </span>
                <ArrowRight className="w-3 h-3 text-slate-300" />
                <span
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold ${
                    latestAudit
                      ? "bg-emerald-600 text-white shadow-sm"
                      : "bg-slate-100 text-slate-600"
                  }`}
                >
                  3. Policy Verdict
                </span>
              </div>
            </div>

            <span className="text-xs font-mono text-slate-400">
              State:{" "}
              <strong className="text-violet-700 font-bold">
                {activeNode}
              </strong>
            </span>
          </div>

          {/* Main Grid: Policy HUD (Left) & Tool Execution Feed (Right) */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1">
            {/* Left: Policy Compliance Audit Scorecard */}
            <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
                  <div className="flex items-center space-x-2 text-slate-900 font-bold text-xs">
                    <ShieldCheck className="w-4 h-4 text-violet-600" />
                    <span>Policy Audit HUD (POL-2025-REV4)</span>
                  </div>
                  {latestAudit && (
                    <span
                      className={`text-[11px] font-bold px-2.5 py-1 rounded-lg font-mono ${
                        latestAudit.decision === "APPROVE"
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          : latestAudit.decision === "APPROVE_WITH_FEE"
                            ? "bg-amber-50 text-amber-700 border border-amber-200"
                            : latestAudit.decision === "ESCALATE"
                              ? "bg-purple-50 text-purple-700 border border-purple-200"
                              : "bg-red-50 text-red-700 border border-red-200"
                      }`}
                    >
                      {latestAudit.decision}
                    </span>
                  )}
                </div>

                {latestAudit ? (
                  <div className="space-y-4 text-xs">
                    {/* Visual 5-Clause Audit Card */}
                    <div className="space-y-2 bg-slate-50 p-3.5 rounded-xl border border-slate-200/80">
                      <div className="flex items-center justify-between py-1 border-b border-slate-200/60">
                        <span className="text-slate-600">
                          1. Delivery Window ≤ 30d:
                        </span>
                        {latestAudit.checklist.window_valid ? (
                          <span className="text-emerald-600 flex items-center gap-1 font-bold">
                            <CheckCircle2 className="w-3.5 h-3.5" /> PASS
                          </span>
                        ) : (
                          <span className="text-red-600 flex items-center gap-1 font-bold">
                            <XCircle className="w-3.5 h-3.5" /> EXPIRED
                          </span>
                        )}
                      </div>

                      <div className="flex items-center justify-between py-1 border-b border-slate-200/60">
                        <span className="text-slate-600">
                          2. Category Exclusions (Sec 3):
                        </span>
                        {latestAudit.checklist.category_allowed ? (
                          <span className="text-emerald-600 flex items-center gap-1 font-bold">
                            <CheckCircle2 className="w-3.5 h-3.5" /> PASS
                          </span>
                        ) : (
                          <span className="text-red-600 flex items-center gap-1 font-bold">
                            <XCircle className="w-3.5 h-3.5" /> EXCLUDED
                          </span>
                        )}
                      </div>

                      <div className="flex items-center justify-between py-1 border-b border-slate-200/60">
                        <span className="text-slate-600">
                          3. Condition Deductions (Sec 2):
                        </span>
                        {latestAudit.checklist.condition_allowed ? (
                          <span className="text-emerald-600 flex items-center gap-1 font-bold">
                            <CheckCircle2 className="w-3.5 h-3.5" /> 100%
                          </span>
                        ) : (
                          <span className="text-amber-600 flex items-center gap-1 font-bold">
                            <AlertTriangle className="w-3.5 h-3.5" /> 15% FEE
                          </span>
                        )}
                      </div>

                      <div className="flex items-center justify-between py-1 border-b border-slate-200/60">
                        <span className="text-slate-600">
                          4. Fraud Risk Score &lt; 0.70:
                        </span>
                        {latestAudit.checklist.fraud_check_passed ? (
                          <span className="text-emerald-600 flex items-center gap-1 font-bold">
                            <CheckCircle2 className="w-3.5 h-3.5" /> PASS
                          </span>
                        ) : (
                          <span className="text-red-600 flex items-center gap-1 font-bold">
                            <XCircle className="w-3.5 h-3.5" /> ABUSE LOCK
                          </span>
                        )}
                      </div>

                      <div className="flex items-center justify-between py-1">
                        <span className="text-slate-600">
                          5. Under High-Value Limit ($500):
                        </span>
                        {latestAudit.checklist.under_high_value_cap ? (
                          <span className="text-emerald-600 flex items-center gap-1 font-bold">
                            <CheckCircle2 className="w-3.5 h-3.5" /> PASS
                          </span>
                        ) : (
                          <span className="text-purple-600 flex items-center gap-1 font-bold">
                            <Clock className="w-3.5 h-3.5" /> ESCALATE
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Transaction Note */}
                    <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80 space-y-1.5">
                      <div className="flex justify-between font-medium">
                        <span className="text-slate-500">
                          Processed Amount:
                        </span>
                        <strong className="text-slate-900">
                          ${latestAudit.refund_amount.toFixed(2)}
                        </strong>
                      </div>
                      <p className="text-[11px] text-slate-500 pt-1 border-t border-slate-200/60 leading-relaxed">
                        {latestAudit.explanation}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="h-64 flex flex-col items-center justify-center text-slate-400 border border-dashed border-slate-200 rounded-xl p-6 text-center">
                    <ShieldCheck className="w-8 h-8 mb-2 text-slate-300" />
                    <p className="text-xs font-medium text-slate-600">
                      No active audit events
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Submit an order request on the customer chat to trigger
                      verification.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Right: Live Reasoning & Tool Execution Feed */}
            <div className="lg:col-span-2 bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm flex flex-col h-[680px] overflow-hidden">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 text-xs font-semibold text-slate-700">
                <span className="flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-violet-600" />
                  Live Agent Reasoning Trace & Tool Payloads
                </span>
                <span className="text-[11px] text-slate-400 font-mono font-normal">
                  {events.length} Telemetry Packets
                </span>
              </div>

              {/* Feed Stream */}
              <div className="flex-1 overflow-y-auto pt-4 space-y-2.5 pr-1 text-xs">
                {events.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-slate-400">
                    <p>Waiting for agent events...</p>
                  </div>
                ) : (
                  events.map((evt, idx) => {
                    const isExpanded = !!expandedCards[idx];
                    return (
                      <div
                        key={idx}
                        className={`rounded-xl border p-3 transition shadow-xs ${
                          evt.event_type === "TOOL_CALL_START"
                            ? "bg-violet-50/50 border-violet-200/80 text-violet-900"
                            : evt.event_type === "TOOL_CALL_END"
                              ? "bg-emerald-50/50 border-emerald-200/80 text-emerald-900"
                              : evt.event_type === "POLICY_AUDIT"
                                ? "bg-amber-50/50 border-amber-200/80 text-amber-900"
                                : evt.event_type === "THOUGHT"
                                  ? "bg-slate-50 border-slate-200/80 text-slate-700"
                                  : "bg-white border-slate-200/80 text-slate-600"
                        }`}
                      >
                        <div
                          className="flex items-center justify-between cursor-pointer select-none"
                          onClick={() => toggleExpand(idx)}
                        >
                          <div className="flex items-center space-x-2">
                            {evt.event_type === "TOOL_CALL_START" && (
                              <Wrench className="w-3.5 h-3.5 text-violet-600" />
                            )}
                            {evt.event_type === "TOOL_CALL_END" && (
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            )}
                            {evt.event_type === "POLICY_AUDIT" && (
                              <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
                            )}
                            {evt.event_type === "THOUGHT" && (
                              <Terminal className="w-3.5 h-3.5 text-slate-400" />
                            )}
                            {evt.event_type === "STATE_TRANSITION" && (
                              <Layers className="w-3.5 h-3.5 text-indigo-500" />
                            )}

                            <span className="font-bold text-[11px] font-mono tracking-tight">
                              [{evt.event_type}]
                            </span>

                            <span className="truncate max-w-sm text-[11px]">
                              {evt.event_type === "TOOL_CALL_START" &&
                                `Invoked: ${evt.data.tool}`}
                              {evt.event_type === "TOOL_CALL_END" &&
                                `Returned from: ${evt.data.tool}`}
                              {evt.event_type === "THOUGHT" && evt.data.thought}
                              {evt.event_type === "STATE_TRANSITION" &&
                                `Transition: ${evt.data.node}`}
                              {evt.event_type === "POLICY_AUDIT" &&
                                `Verdict: ${evt.data.decision}`}
                            </span>
                          </div>

                          <div className="flex items-center space-x-2 text-slate-400 text-[10px]">
                            <span>
                              {new Date(evt.timestamp).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                                second: "2-digit",
                              })}
                            </span>
                            {isExpanded ? (
                              <ChevronDown className="w-3.5 h-3.5" />
                            ) : (
                              <ChevronRight className="w-3.5 h-3.5" />
                            )}
                          </div>
                        </div>

                        {/* Expandable JSON Payload Drawer */}
                        {isExpanded && (
                          <div className="mt-2.5 pt-2 border-t border-slate-200/60 bg-white p-3 rounded-lg text-[11px] font-mono text-slate-700 overflow-x-auto border">
                            <pre className="whitespace-pre-wrap">
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
      )}

      {/* ------------------------------------------------------------- */}
      {/* TAB 2: CRM CUSTOMER DATABASE TABLE (15 Profiles)              */}
      {/* ------------------------------------------------------------- */}
      {activeTab === "crm" && (
        <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm flex flex-col gap-4">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div>
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Database className="w-4 h-4 text-violet-600" />
                Relational Mock CRM Database (15 Test Profiles)
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Pre-seeded in SQLite with specific edge-case attributes for
                deterministic policy validation
              </p>
            </div>
            <span className="text-xs font-semibold px-3 py-1 bg-slate-100 text-slate-700 rounded-lg">
              {customers.length} Profiles Loaded
            </span>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 font-semibold text-[11px] uppercase tracking-wider">
                <tr>
                  <th className="p-3">Customer</th>
                  <th className="p-3">Account Tier</th>
                  <th className="p-3">Risk Score</th>
                  <th className="p-3">90d Returns</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {customers.map((c) => {
                  const risk = c.fraud_risk_score;
                  return (
                    <tr
                      key={c.customer_id}
                      className="hover:bg-slate-50/70 transition"
                    >
                      <td className="p-3">
                        <div className="flex items-center space-x-2.5">
                          <div className="w-7 h-7 rounded-full bg-violet-100 text-violet-700 font-bold text-xs flex items-center justify-center">
                            {c.name.charAt(0)}
                          </div>
                          <div>
                            <strong className="text-slate-900 block font-semibold">
                              {c.name}
                            </strong>
                            <span className="text-slate-400 text-[10px] font-mono">
                              {c.customer_id} • {c.email}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            c.account_tier === "VIP"
                              ? "bg-amber-50 text-amber-700 border border-amber-200"
                              : "bg-slate-100 text-slate-700"
                          }`}
                        >
                          {c.account_tier}
                        </span>
                      </td>
                      <td className="p-3 font-mono">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            risk >= 0.7
                              ? "bg-red-50 text-red-700 border border-red-200"
                              : risk >= 0.3
                                ? "bg-amber-50 text-amber-700 border border-amber-200"
                                : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          }`}
                        >
                          {risk.toFixed(2)}
                        </span>
                      </td>
                      <td className="p-3 font-mono text-slate-600">
                        {c.refunds_last_90_days}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
