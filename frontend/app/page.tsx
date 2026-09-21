"use client";

import { useState, useEffect, useRef } from "react";
import {
  fetchCustomers,
  fetchCustomerOrders,
  sendChatMessage,
  resetBackendDatabase,
  Customer,
  Order,
} from "@/lib/api";
import {
  MessageSquare,
  RotateCcw,
  CreditCard,
  Package,
  Send,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ChevronRight,
  RefreshCw,
} from "lucide-react";

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  type?:
    | "text"
    | "order_picker"
    | "approval_card"
    | "denial_card"
    | "restock_card";
  orderData?: Order;
}

// -------------------------------------------------------------
// MARKDOWN TEXT PARSER (Zero Dependencies)
// Converts **bold**, ### headers, and bullet points into styled JSX
// -------------------------------------------------------------
function FormattedText({ text }: { text: string }) {
  const lines = text.split("\n");

  return (
    <div className="space-y-1.5 leading-relaxed">
      {lines.map((line, idx) => {
        if (!line.trim()) return <div key={idx} className="h-1" />;

        // Headers (### Heading)
        if (line.startsWith("### ")) {
          return (
            <h4
              key={idx}
              className="font-bold text-slate-900 mt-2 mb-1 text-xs uppercase tracking-wide"
            >
              {line.replace("### ", "")}
            </h4>
          );
        }

        // Bullet Lists (- or *)
        const isBullet =
          line.trim().startsWith("- ") || line.trim().startsWith("* ");
        const cleanLine = isBullet ? line.trim().substring(2) : line;

        // Parse **bold** markers
        const parts = cleanLine.split(/(\*\*.*?\*\*)/g);

        const renderedLine = parts.map((part, pIdx) => {
          if (part.startsWith("**") && part.endsWith("**")) {
            return (
              <strong key={pIdx} className="font-bold text-slate-900">
                {part.slice(2, -2)}
              </strong>
            );
          }
          return part;
        });

        if (isBullet) {
          return (
            <div key={idx} className="flex items-start space-x-2 pl-1">
              <span className="text-violet-500 font-bold">•</span>
              <span>{renderedLine}</span>
            </div>
          );
        }

        return <p key={idx}>{renderedLine}</p>;
      })}
    </div>
  );
}

export default function CustomerSupportPortal() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(
    null,
  );
  const [orders, setOrders] = useState<Order[]>([]);
  const [sessionId] = useState<string>("demo");

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);

  // Voice States
  const [isRecording, setIsRecording] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load customer profiles on start
  useEffect(() => {
    async function init() {
      try {
        const data = await fetchCustomers();
        setCustomers(data);
        if (data.length > 0) {
          handleCustomerChange(data[0]); // Default to Alice (CUST-001)
        }
      } catch (e) {
        console.error("Failed to load customers:", e);
      }
    }
    init();
  }, []);

  // Handle switching customer account
  async function handleCustomerChange(customer: Customer) {
    setSelectedCustomer(customer);
    setHasStarted(false);
    setInput("");
    setMessages([]);

    try {
      const custOrders = await fetchCustomerOrders(customer.customer_id);
      setOrders(custOrders);
    } catch (e) {
      console.error("Failed to fetch customer orders:", e);
    }
  }

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  // Handle Action Pill: Return an order
  function handlePillReturnOrder() {
    setHasStarted(true);
    const time = new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });

    const userMsg: Message = {
      role: "user",
      content: "I'd like to return an order.",
      timestamp: time,
    };

    const agentMsg: Message = {
      role: "assistant",
      content:
        "I can help with that! Which of your recent orders would you like to return?",
      timestamp: time,
      type: "order_picker",
    };

    setMessages([userMsg, agentMsg]);
  }

  // Handle selecting an order card
  async function handleSelectOrder(order: Order) {
    const item = order.items[0];
    const time = new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });

    const userMsg: Message = {
      role: "user",
      content: `I would like to return order ${order.order_id} (${item?.product_name || "item"}). It is unopened.`,
      timestamp: time,
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);

    try {
      if (!selectedCustomer) return;
      const res = await sendChatMessage(
        sessionId,
        selectedCustomer.customer_id,
        userMsg.content,
      );

      let messageType:
        | "text"
        | "approval_card"
        | "denial_card"
        | "restock_card" = "text";
      const replyLower = res.reply.toLowerCase();

      if (
        replyLower.includes("approved") ||
        replyLower.includes("ref-") ||
        replyLower.includes("confirmation id")
      ) {
        messageType = "approval_card";
      } else if (
        replyLower.includes("denied") ||
        replyLower.includes("outside") ||
        replyLower.includes("ineligible") ||
        replyLower.includes("cannot")
      ) {
        messageType = "denial_card";
      } else if (
        replyLower.includes("restocking fee") ||
        replyLower.includes("store credit")
      ) {
        messageType = "restock_card";
      }

      const agentMsg: Message = {
        role: "assistant",
        content: res.reply,
        timestamp: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
        type: messageType,
        orderData: order,
      };

      setMessages((prev) => [...prev, agentMsg]);

      // Voice Audio Synthesis
      if (
        voiceEnabled &&
        typeof window !== "undefined" &&
        "speechSynthesis" in window
      ) {
        window.speechSynthesis.cancel();
        const speechText = res.reply.replace(/[*_#`]/g, "");
        const utterance = new SpeechSynthesisUtterance(speechText);
        utterance.rate = 1.05;
        window.speechSynthesis.speak(utterance);
      }
    } catch (err) {
      console.error("Chat error:", err);
    } finally {
      setIsLoading(false);
    }
  }

  // Handle Natural Language Composer Send
  async function handleSend(customText?: string) {
    const textToSend = customText || input;
    if (!textToSend.trim() || !selectedCustomer || isLoading) return;

    setHasStarted(true);
    const time = new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });

    const userMsg: Message = {
      role: "user",
      content: textToSend,
      timestamp: time,
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!customText) setInput("");
    setIsLoading(true);

    try {
      const res = await sendChatMessage(
        sessionId,
        selectedCustomer.customer_id,
        textToSend,
      );

      let messageType:
        | "text"
        | "approval_card"
        | "denial_card"
        | "restock_card" = "text";
      const replyLower = res.reply.toLowerCase();

      if (replyLower.includes("approved") || replyLower.includes("ref-")) {
        messageType = "approval_card";
      } else if (
        replyLower.includes("denied") ||
        replyLower.includes("outside") ||
        replyLower.includes("cannot")
      ) {
        messageType = "denial_card";
      } else if (
        replyLower.includes("restocking fee") ||
        replyLower.includes("store credit")
      ) {
        messageType = "restock_card";
      }

      const agentMsg: Message = {
        role: "assistant",
        content: res.reply,
        timestamp: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
        type: messageType,
        orderData: orders[0],
      };

      setMessages((prev) => [...prev, agentMsg]);

      if (
        voiceEnabled &&
        typeof window !== "undefined" &&
        "speechSynthesis" in window
      ) {
        window.speechSynthesis.cancel();
        const speechText = res.reply.replace(/[*_#`]/g, "");
        const utterance = new SpeechSynthesisUtterance(speechText);
        utterance.rate = 1.05;
        window.speechSynthesis.speak(utterance);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }

  // Speech-to-Text Recognition
  function toggleSpeech() {
    if (
      typeof window === "undefined" ||
      !("webkitSpeechRecognition" in window || "SpeechRecognition" in window)
    ) {
      alert(
        "Speech recognition is not supported in this browser. Please use Chrome or Edge.",
      );
      return;
    }

    if (isRecording) {
      setIsRecording(false);
      return;
    }

    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.onstart = () => setIsRecording(true);
    recognition.onresult = (e: any) => {
      const transcript = e.results[0][0].transcript;
      setInput(transcript);
      setIsRecording(false);
      handleSend(transcript);
    };
    recognition.onerror = () => setIsRecording(false);
    recognition.onend = () => setIsRecording(false);
    recognition.start();
  }

  return (
    <div className="flex h-screen bg-[#f8f9fd] text-slate-800 font-sans overflow-hidden">
      {/* ------------------------------------------------------------- */}
      {/* LEFT SIDEBAR                                                  */}
      {/* ------------------------------------------------------------- */}
      <aside className="w-60 bg-white border-r border-slate-200/70 flex flex-col justify-between p-5 shrink-0 shadow-sm">
        <div className="space-y-8">
          {/* Custom Brand Logo */}
          <div className="flex items-center space-x-3 px-1">
            <img
              src="/logo.svg"
              alt="Apex Store Logo"
              className="w-8 h-8 rounded-lg object-contain shrink-0"
              onError={(e) => {
                // Fallback gradient mark if logo.png is not yet added
                (e.target as HTMLElement).style.display = "none";
                (e.target as HTMLElement).nextElementSibling?.classList.remove(
                  "hidden",
                );
              }}
            />
            {/* Fallback Icon */}
            <div className="hidden w-8 h-8 rounded-lg bg-gradient-to-tr from-violet-600 to-indigo-500 flex items-center justify-center text-white font-bold text-xs shrink-0">
              A
            </div>

            <div>
              <h1 className="font-bold text-sm tracking-tight text-slate-900 leading-tight">
                Apex Store
              </h1>
              <span className="text-[10px] font-medium text-slate-400">
                Support Desk
              </span>
            </div>
          </div>

          {/* Clean Navigation Item */}
          <nav className="space-y-1 text-xs font-semibold">
            <div className="flex items-center space-x-2.5 px-3 py-2.5 rounded-xl bg-violet-50 text-violet-700">
              <MessageSquare className="w-4 h-4" />
              <span>Live Support</span>
            </div>
          </nav>
        </div>

        {/* Consumer-Facing Account Switcher Widget */}
        <div className="pt-4 space-y-2">
          {/* Consumer-Facing Account */}
          <div className="pt-4 border-t border-slate-100">
            <div className="bg-slate-50 border border-slate-200/70 rounded-xl p-2.5 flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-full bg-violet-600 text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-sm">
                {selectedCustomer?.name?.charAt(0) || "U"}
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-slate-800 truncate">
                  {selectedCustomer?.name || "User"}
                </p>
                <p className="text-[10px] text-slate-400 truncate">
                  {selectedCustomer?.email ||
                    `${selectedCustomer?.account_tier} Member`}
                </p>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* ------------------------------------------------------------- */}
      {/* MAIN CHAT CANVAS                                             */}
      {/* ------------------------------------------------------------- */}
      <main className="flex-1 flex flex-col bg-white overflow-hidden">
        {/* Chat Header */}
        <header className="h-14 border-b border-slate-100 px-6 flex items-center justify-between bg-white shrink-0">
          <div className="flex items-center space-x-2.5">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
            <div>
              <h2 className="font-bold text-xs text-slate-900 tracking-tight flex items-center gap-1.5">
                Aura{" "}
                <span className="font-normal text-slate-400">
                  • Apex Concierge
                </span>
              </h2>
            </div>
          </div>

          {/* Voice Audio Toggle */}
          <button
            onClick={() => setVoiceEnabled(!voiceEnabled)}
            className={`flex items-center space-x-1.5 px-3 py-1 rounded-full text-[11px] font-medium transition ${
              voiceEnabled
                ? "bg-violet-50 text-violet-700 border border-violet-200"
                : "bg-slate-50 text-slate-500 border border-slate-200 hover:bg-slate-100"
            }`}
            title="Read responses aloud"
          >
            {voiceEnabled ? (
              <Volume2 className="w-3.5 h-3.5" />
            ) : (
              <VolumeX className="w-3.5 h-3.5" />
            )}
            <span>{voiceEnabled ? "Voice: ON" : "Voice: OFF"}</span>
          </button>
        </header>

        {/* Message Stream */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6 bg-[#fafbfe]">
          {/* Welcome State: Action Pills */}
          {!hasStarted && (
            <div className="max-w-md mx-auto pt-8 space-y-5 text-center">
              <div>
                <h3 className="text-lg font-bold text-slate-900 tracking-tight">
                  Hi {selectedCustomer?.name.split(" ")[0]} 👋
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  I'm Aura, your Apex assistant. How can I help you with your
                  orders today?
                </p>
              </div>

              <div className="space-y-2 pt-2">
                <button
                  onClick={handlePillReturnOrder}
                  className="w-full p-3 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-medium text-xs flex items-center justify-between shadow-sm transition"
                >
                  <span className="flex items-center gap-2">
                    <RotateCcw className="w-4 h-4 text-violet-200" />
                    Return an order
                  </span>
                  <ChevronRight className="w-4 h-4 text-violet-200" />
                </button>

                <button
                  onClick={() =>
                    handleSend("I want to check the status of my refund.")
                  }
                  className="w-full p-3 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-medium text-xs flex items-center justify-between transition shadow-sm"
                >
                  <span className="flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-slate-400" />
                    Check refund status
                  </span>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </button>

                <button
                  onClick={() => handleSend("Can you track my order shipment?")}
                  className="w-full p-3 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-medium text-xs flex items-center justify-between transition shadow-sm"
                >
                  <span className="flex items-center gap-2">
                    <Package className="w-4 h-4 text-slate-400" />
                    Track an order
                  </span>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </button>
              </div>
            </div>
          )}

          {/* Conversation History */}
          {messages.map((msg, index) => (
            <div
              key={index}
              className={`flex items-start space-x-3 ${msg.role === "user" ? "flex-row-reverse space-x-reverse" : ""}`}
            >
              {/* Avatar */}
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs font-bold ${
                  msg.role === "user"
                    ? "bg-slate-900 text-white"
                    : "bg-violet-100 text-violet-700"
                }`}
              >
                {msg.role === "user" ? selectedCustomer?.name.charAt(0) : "A"}
              </div>

              {/* Message Content with Markdown Parsing */}
              <div
                className={`max-w-[75%] space-y-1.5 ${msg.role === "user" ? "items-end" : "items-start"}`}
              >
                <div
                  className={`rounded-2xl px-4 py-2.5 text-xs leading-relaxed ${
                    msg.role === "user"
                      ? "bg-violet-600 text-white rounded-tr-none"
                      : "bg-white text-slate-800 border border-slate-200/80 rounded-tl-none shadow-sm"
                  }`}
                >
                  {msg.role === "assistant" ? (
                    <FormattedText text={msg.content} />
                  ) : (
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  )}
                </div>

                <span
                  className={`block text-[10px] text-slate-400 px-1 ${msg.role === "user" ? "text-right" : ""}`}
                >
                  {msg.timestamp}
                </span>

                {/* --------------------------------------------------- */}
                {/* INTERACTIVE CARDS INLINE                            */}
                {/* --------------------------------------------------- */}
                {msg.role === "assistant" && (
                  <div className="w-full max-w-md pt-1 space-y-2">
                    {/* 1. ORDER PICKER */}
                    {msg.type === "order_picker" && (
                      <div className="space-y-2">
                        {orders.map((ord) => (
                          <div
                            key={ord.order_id}
                            className="bg-white border border-slate-200 hover:border-violet-400 rounded-xl p-3 text-xs transition shadow-sm flex items-center justify-between gap-3"
                          >
                            <div>
                              <strong className="text-slate-900 font-semibold">
                                {ord.items[0]?.product_name}
                              </strong>
                              <p className="text-slate-500 text-[11px] mt-0.5">
                                #{ord.order_id} • Delivered:{" "}
                                {ord.delivery_date || "In transit"}
                              </p>
                              <span className="font-bold text-slate-900 text-xs mt-1 block">
                                ${ord.total_amount.toFixed(2)}
                              </span>
                            </div>
                            <button
                              onClick={() => handleSelectOrder(ord)}
                              className="bg-violet-600 hover:bg-violet-700 text-white font-semibold text-[11px] px-3 py-1.5 rounded-lg transition shrink-0"
                            >
                              Select
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* 2. REFUND APPROVED RECEIPT CARD */}
                    {msg.type === "approval_card" && (
                      <div className="bg-white border-2 border-emerald-500/70 rounded-xl p-4 shadow-sm text-xs space-y-2.5">
                        <div className="flex items-center space-x-2 text-emerald-600 font-bold">
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Refund Approved</span>
                        </div>

                        <div className="space-y-1.5 border-y border-slate-100 py-2 text-slate-600 text-[11px]">
                          <div className="flex justify-between">
                            <span>Item:</span>
                            <strong className="text-slate-900">
                              {msg.orderData?.items[0]?.product_name}
                            </strong>
                          </div>
                          <div className="flex justify-between">
                            <span>Order ID:</span>
                            <span className="font-mono text-slate-800">
                              #{msg.orderData?.order_id}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span>Refund Amount:</span>
                            <strong className="text-emerald-600 text-sm font-bold">
                              ${msg.orderData?.total_amount.toFixed(2)}
                            </strong>
                          </div>
                          <div className="flex justify-between">
                            <span>Refund Method:</span>
                            <span className="capitalize">
                              {msg.orderData?.payment_method.replace("_", " ")}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span>Expected Arrival:</span>
                            <span className="font-medium text-slate-800">
                              3–5 Business Days
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-[11px] text-slate-400">
                          <span>Verified (POL-2025 Sec 1.1)</span>
                          <span className="font-bold text-slate-700">
                            100% REFUND
                          </span>
                        </div>
                      </div>
                    )}

                    {/* 3. POLICY DENIED CARD */}
                    {msg.type === "denial_card" && (
                      <div className="bg-white border-2 border-red-500/70 rounded-xl p-4 shadow-sm text-xs space-y-2.5">
                        <div className="flex items-center space-x-2 text-red-600 font-bold">
                          <XCircle className="w-4 h-4" />
                          <span>Refund Ineligible</span>
                        </div>

                        <div className="space-y-1.5 border-y border-slate-100 py-2 text-slate-600 text-[11px]">
                          <div className="flex justify-between">
                            <span>Policy Window:</span>
                            <span>30 Days Post-Delivery</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Delivery Date:</span>
                            <span className="text-slate-800">
                              {msg.orderData?.delivery_date}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span>Status:</span>
                            <strong className="text-red-600">
                              Window Expired (Sec 1.1)
                            </strong>
                          </div>
                        </div>

                        <div className="pt-1 flex gap-2">
                          <button
                            onClick={() =>
                              handleSend(
                                "Can I speak with a human support agent?",
                              )
                            }
                            className="text-[11px] px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition font-medium"
                          >
                            Contact Support
                          </button>
                        </div>
                      </div>
                    )}

                    {/* 4. RESTOCKING FEE CHOICE CARD */}
                    {msg.type === "restock_card" && (
                      <div className="bg-white border-2 border-amber-500/70 rounded-xl p-4 shadow-sm text-xs space-y-2.5">
                        <div className="flex items-center space-x-2 text-amber-600 font-bold">
                          <AlertTriangle className="w-4 h-4" />
                          <span>Opened Condition (Sec 2.2)</span>
                        </div>
                        <p className="text-[11px] text-slate-600">
                          Opened items qualify for an 85% refund (15% restocking
                          deduction) or 100% store credit:
                        </p>
                        <div className="grid grid-cols-2 gap-2 pt-1">
                          <button
                            onClick={() =>
                              handleSend(
                                "I accept the refund with the 15% restocking fee deduction.",
                              )
                            }
                            className="p-2 rounded-xl border border-slate-200 hover:border-violet-500 text-left bg-slate-50 hover:bg-violet-50/50 transition"
                          >
                            <strong className="block text-slate-900 text-[11px]">
                              85% Refund
                            </strong>
                            <span className="text-[10px] text-slate-500">
                              15% fee deducted
                            </span>
                          </button>
                          <button
                            onClick={() =>
                              handleSend(
                                "I would prefer 100% store credit instead.",
                              )
                            }
                            className="p-2 rounded-xl border border-slate-200 hover:border-emerald-500 text-left bg-slate-50 hover:bg-emerald-50/50 transition"
                          >
                            <strong className="block text-emerald-700 text-[11px]">
                              100% Credit
                            </strong>
                            <span className="text-[10px] text-slate-500">
                              No deduction
                            </span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* Loading Indicator */}
          {isLoading && (
            <div className="flex items-center space-x-2.5 text-xs text-slate-400 pl-11">
              <div className="w-3.5 h-3.5 border-2 border-violet-600 border-t-transparent rounded-full animate-spin"></div>
              <span>Aura is evaluating policy rules...</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Minimal Composer Bar */}
        <div className="p-4 bg-white border-t border-slate-100">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="max-w-3xl mx-auto flex items-center bg-slate-50 border border-slate-200/80 rounded-2xl px-3 py-1.5 focus-within:ring-2 focus-within:ring-violet-500/20 focus-within:border-violet-500 transition"
          >
            {/* Mic Toggle Button */}
            <button
              type="button"
              onClick={toggleSpeech}
              className={`p-2 rounded-xl transition ${
                isRecording
                  ? "bg-red-500 text-white animate-pulse"
                  : "text-slate-400 hover:text-slate-600"
              }`}
              title="Speak"
            >
              {isRecording ? (
                <MicOff className="w-4 h-4" />
              ) : (
                <Mic className="w-4 h-4" />
              )}
            </button>

            {/* Input Field */}
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={
                isRecording
                  ? "Listening to your voice..."
                  : "Ask Aura a question or request a return..."
              }
              disabled={isLoading}
              className="flex-1 bg-transparent px-3 text-xs text-slate-800 placeholder-slate-400 focus:outline-none disabled:opacity-50"
            />

            {/* Send Button */}
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="w-7 h-7 rounded-xl bg-violet-600 hover:bg-violet-700 disabled:opacity-30 text-white flex items-center justify-center transition shrink-0 shadow-sm"
            >
              <Send className="w-3 h-3" />
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
