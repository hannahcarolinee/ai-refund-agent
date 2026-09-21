"use client";

import { useState, useEffect, useRef } from "react";
import {
  fetchCustomers,
  fetchCustomerOrders,
  sendChatMessage,
  resetBackendDatabase,
  Customer,
  Order,
  OrderItem,
} from "@/lib/api";
import {
  ShoppingBag,
  Package,
  RotateCcw,
  CreditCard,
  Send,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ChevronRight,
  User,
  X,
  MessageSquare,
  Search,
  ShoppingCart,
  ShieldCheck,
  ArrowRight,
  Clock,
  Sparkles,
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
  cardDetails?: any;
}

export default function StorefrontPage() {
  // Data States
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(
    null,
  );
  const [orders, setOrders] = useState<Order[]>([]);
  const [sessionId, setSessionId] = useState<string>("demo");
  // Drawer States
  const [isDrawerOpen, setIsDrawerOpen] = useState(true); // Opened by default as requested
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [hasStartedChat, setHasStartedChat] = useState(false);

  // Voice States
  const [isRecording, setIsRecording] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load initial mock customers
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

  // Handle switching customers
  async function handleCustomerChange(customer: Customer) {
    setSelectedCustomer(customer);
    const newSession = `sess_${customer.customer_id.toLowerCase()}_${Date.now().toString().slice(-4)}`;
    setSessionId(newSession);
    setHasStartedChat(false);
    setInput("");

    try {
      const custOrders = await fetchCustomerOrders(customer.customer_id);
      setOrders(custOrders);
    } catch (e) {
      console.error("Failed to fetch customer orders:", e);
    }

    // Reset support drawer welcome state
    setMessages([]);
  }

  // Scroll messages to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  // Handle User Action: Return an Order (Action Pill)
  function handlePillReturnOrder() {
    setHasStartedChat(true);
    const time = new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });

    // Add user intent
    const userMsg: Message = {
      role: "user",
      content: "I'd like to return an order.",
      timestamp: time,
    };

    // Agent displays order selection cards directly
    const agentMsg: Message = {
      role: "assistant",
      content:
        "Sure, I can help with that! Which of your recent orders would you like to return?",
      timestamp: time,
      type: "order_picker",
    };

    setMessages([userMsg, agentMsg]);
  }

  // Handle User Action: Selecting a specific order card
  async function handleSelectOrderForReturn(order: Order) {
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

      // Determine if the backend approved, denied, or fee-adjusted the refund
      let messageType:
        | "text"
        | "approval_card"
        | "denial_card"
        | "restock_card" = "text";
      const replyLower = res.reply.toLowerCase();

      if (
        replyLower.includes("approved") ||
        replyLower.includes("confirmation id") ||
        replyLower.includes("ref-")
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
        cardDetails: {
          item: item?.product_name,
          price: item?.price,
          orderId: order.order_id,
          deliveryDate: order.delivery_date,
        },
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

    setHasStartedChat(true);
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

  // Speech Recognition (STT)
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
    <div className="min-h-screen flex flex-col relative bg-slate-50">
      {/* ------------------------------------------------------------- */}
      {/* E-COMMERCE STOREFRONT HEADER                                  */}
      {/* ------------------------------------------------------------- */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-8">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-lg tracking-tight">
                A
              </div>
              <span className="font-bold text-slate-900 text-lg tracking-tight">
                Apex Store
              </span>
            </div>

            <nav className="hidden md:flex items-center space-x-6 text-sm font-medium text-slate-600">
              <span className="text-slate-900 font-semibold cursor-pointer">
                Purchases & Orders
              </span>
              <span className="hover:text-slate-900 cursor-pointer transition">
                Products
              </span>
              <span className="hover:text-slate-900 cursor-pointer transition">
                Track Shipment
              </span>
            </nav>
          </div>

          <div className="flex items-center space-x-4">
            {/* Demo Customer Profile Switcher (Tucked into Account dropdown) */}
            <div className="flex items-center space-x-2 bg-slate-100 hover:bg-slate-200/70 border border-slate-200 rounded-full py-1.5 px-3 transition">
              <User className="w-4 h-4 text-slate-600" />
              <select
                className="bg-transparent text-xs font-semibold text-slate-800 focus:outline-none cursor-pointer"
                value={selectedCustomer?.customer_id || ""}
                onChange={(e) => {
                  const cust = customers.find(
                    (c) => c.customer_id === e.target.value,
                  );
                  if (cust) handleCustomerChange(cust);
                }}
              >
                {customers.map((c) => (
                  <option key={c.customer_id} value={c.customer_id}>
                    {c.name} ({c.customer_id})
                  </option>
                ))}
              </select>
            </div>

            <div className="relative cursor-pointer p-2 text-slate-700 hover:text-slate-900">
              <ShoppingCart className="w-5 h-5" />
              <span className="absolute top-1 right-1 w-4 h-4 bg-blue-600 text-white rounded-full text-[10px] font-bold flex items-center justify-center">
                1
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* ------------------------------------------------------------- */}
      {/* E-COMMERCE ACCOUNT ORDERS BACKDROP                            */}
      {/* ------------------------------------------------------------- */}
      <main className="max-w-6xl w-full mx-auto px-4 py-8 flex-1">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Your Orders</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Logged in as{" "}
              <strong className="text-slate-700">
                {selectedCustomer?.name}
              </strong>{" "}
              • Account Tier:{" "}
              <span className="font-semibold text-blue-600">
                {selectedCustomer?.account_tier}
              </span>
            </p>
          </div>
        </div>

        {/* Order History Grid */}
        <div className="space-y-4">
          {orders.map((order) => (
            <div
              key={order.order_id}
              className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 transition hover:border-slate-300"
            >
              <div className="flex flex-wrap items-center justify-between pb-4 border-b border-slate-100 text-xs text-slate-500 gap-4">
                <div className="flex items-center space-x-6">
                  <div>
                    <span className="block text-[11px] font-medium uppercase text-slate-400">
                      Order Placed
                    </span>
                    <span className="font-medium text-slate-800">
                      {order.order_date}
                    </span>
                  </div>
                  <div>
                    <span className="block text-[11px] font-medium uppercase text-slate-400">
                      Total
                    </span>
                    <span className="font-medium text-slate-800">
                      ${order.total_amount.toFixed(2)}
                    </span>
                  </div>
                  <div>
                    <span className="block text-[11px] font-medium uppercase text-slate-400">
                      Status
                    </span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 capitalize">
                      {order.status.replace("_", " ")}
                    </span>
                  </div>
                </div>
                <div className="font-mono text-slate-600 font-medium">
                  #{order.order_id}
                </div>
              </div>

              {/* Items List */}
              <div className="pt-4 divide-y divide-slate-100">
                {order.items.map((item) => (
                  <div
                    key={item.item_id}
                    className="py-3 first:pt-0 last:pb-0 flex items-center justify-between"
                  >
                    <div className="flex items-center space-x-4">
                      <div className="w-12 h-12 bg-slate-100 rounded-lg border border-slate-200 flex items-center justify-center text-slate-600">
                        <Package className="w-6 h-6" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-sm text-slate-900">
                          {item.product_name}
                        </h4>
                        <p className="text-xs text-slate-500">
                          Category: {item.category} • SKU: {item.item_id}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="font-bold text-sm text-slate-900">
                        ${item.price.toFixed(2)}
                      </span>
                      <button
                        onClick={() => {
                          setIsDrawerOpen(true);
                          handleSelectOrderForReturn(order);
                        }}
                        className="block mt-1 text-xs font-semibold text-blue-600 hover:text-blue-700"
                      >
                        Request Return →
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </main>

      {/* ------------------------------------------------------------- */}
      {/* FLOATING TRIGGER BUTTON (When Drawer is Minimized)           */}
      {/* ------------------------------------------------------------- */}
      {!isDrawerOpen && (
        <button
          onClick={() => setIsDrawerOpen(true)}
          className="fixed bottom-6 right-6 bg-slate-900 hover:bg-slate-800 text-white rounded-full px-5 py-3.5 shadow-xl flex items-center space-x-2.5 transition transform hover:scale-105 z-30"
        >
          <MessageSquare className="w-4 h-4 text-emerald-400" />
          <span className="font-semibold text-sm">Help & Support</span>
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
        </button>
      )}

      {/* ------------------------------------------------------------- */}
      {/* DESKTOP SUPPORT DRAWER (Docked Bottom-Right)                  */}
      {/* ------------------------------------------------------------- */}
      {isDrawerOpen && (
        <aside className="fixed bottom-6 right-6 w-full max-w-[420px] h-[620px] bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden z-40 transition animate-in fade-in slide-in-from-bottom-5">
          {/* Support Header */}
          <div className="bg-slate-900 text-white p-4 flex items-center justify-between shrink-0">
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-bold text-sm leading-tight flex items-center gap-1.5">
                  Apex Support Agent
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                </h3>
                <p className="text-[11px] text-slate-400">
                  Verified Policy Engine • Online
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsDrawerOpen(false)}
              className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition"
              title="Close Support"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Drawer Body */}
          <div className="flex-1 p-4 overflow-y-auto space-y-4 text-sm bg-slate-50/50">
            {/* STATE 2: Welcome Screen with Action Pills (Zero Cognitive Load) */}
            {!hasStartedChat ? (
              <div className="space-y-4 pt-2">
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-1">
                  <h4 className="font-bold text-slate-900 text-base">
                    Hi {selectedCustomer?.name.split(" ")[0]}! 👋
                  </h4>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    I can assist you with returns, automated refunds, and order
                    tracking under our Apex Return Policy.
                  </p>
                </div>

                <div className="space-y-2">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block px-1">
                    How can I help you today?
                  </span>

                  {/* Primary Task-Oriented Action Pill */}
                  <button
                    onClick={handlePillReturnOrder}
                    className="w-full text-left p-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs flex items-center justify-between shadow-sm transition group"
                  >
                    <span className="flex items-center gap-2">
                      <RotateCcw className="w-4 h-4 text-blue-200" />
                      Return an order
                    </span>
                    <ChevronRight className="w-4 h-4 text-blue-200 group-hover:translate-x-0.5 transition" />
                  </button>

                  <button
                    onClick={() =>
                      handleSend("I want to check the status of my refund.")
                    }
                    className="w-full text-left p-3 rounded-xl bg-white hover:bg-slate-100/80 border border-slate-200 text-slate-800 font-medium text-xs flex items-center justify-between transition"
                  >
                    <span className="flex items-center gap-2">
                      <CreditCard className="w-4 h-4 text-slate-500" />
                      Check refund status
                    </span>
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  </button>

                  <button
                    onClick={() => handleSend("Can you track my order status?")}
                    className="w-full text-left p-3 rounded-xl bg-white hover:bg-slate-100/80 border border-slate-200 text-slate-800 font-medium text-xs flex items-center justify-between transition"
                  >
                    <span className="flex items-center gap-2">
                      <Package className="w-4 h-4 text-slate-500" />
                      Track an order
                    </span>
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  </button>
                </div>
              </div>
            ) : (
              /* STATE 3: Progressive Interactive Conversation Flow */
              <div className="space-y-4">
                {messages.map((msg, index) => (
                  <div
                    key={index}
                    className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}
                  >
                    {/* Standard Text Bubble */}
                    <div
                      className={`max-w-[85%] rounded-2xl px-4 py-3 text-xs leading-relaxed shadow-sm ${msg.role === "user" ? "bg-blue-600 text-white rounded-tr-none" : "bg-white text-slate-800 border border-slate-200 rounded-tl-none"}`}
                    >
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                      <span
                        className={`block text-[9px] mt-1 ${msg.role === "user" ? "text-blue-200 text-right" : "text-slate-400"}`}
                      >
                        {msg.timestamp}
                      </span>
                    </div>

                    {/* INTERACTIVE RICH CARDS */}
                    {msg.role === "assistant" && (
                      <div className="w-full max-w-[92%] mt-2 space-y-2">
                        {/* 1. ORDER PICKER CARDS */}
                        {msg.type === "order_picker" && (
                          <div className="space-y-2 pt-1">
                            {orders.map((ord) => (
                              <div
                                key={ord.order_id}
                                className="bg-white border border-slate-200 hover:border-blue-500 rounded-xl p-3 text-xs transition shadow-sm flex items-center justify-between gap-3"
                              >
                                <div>
                                  <div className="flex items-center space-x-2">
                                    <strong className="text-slate-900 font-semibold">
                                      {ord.items[0]?.product_name}
                                    </strong>
                                  </div>
                                  <p className="text-slate-500 text-[11px] mt-0.5">
                                    #{ord.order_id} • Delivered:{" "}
                                    {ord.delivery_date || "In transit"}
                                  </p>
                                  <span className="font-bold text-slate-900 text-xs mt-1 block">
                                    ${ord.total_amount.toFixed(2)}
                                  </span>
                                </div>
                                <button
                                  onClick={() =>
                                    handleSelectOrderForReturn(ord)
                                  }
                                  className="bg-slate-900 hover:bg-blue-600 text-white font-semibold text-[11px] px-3 py-1.5 rounded-lg transition shrink-0"
                                >
                                  Select
                                </button>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* 2. SUCCESSFUL REFUND RESULT CARD */}
                        {msg.type === "approval_card" && (
                          <div className="bg-white border-2 border-emerald-500/80 rounded-xl p-4 shadow-sm text-xs space-y-3">
                            <div className="flex items-center space-x-2 text-emerald-600 font-bold">
                              <CheckCircle2 className="w-4 h-4" />
                              <span>Refund Approved</span>
                            </div>

                            <div className="space-y-1.5 border-y border-slate-100 py-2.5 text-slate-600 text-[11px]">
                              <div className="flex justify-between">
                                <span>Item:</span>
                                <strong className="text-slate-900">
                                  {msg.orderData?.items[0]?.product_name ||
                                    "Purchased Item"}
                                </strong>
                              </div>
                              <div className="flex justify-between">
                                <span>Order ID:</span>
                                <span className="font-mono text-slate-800">
                                  #{msg.orderData?.order_id || "ORD-1001"}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span>Refund Amount:</span>
                                <strong className="text-emerald-600 text-sm font-bold">
                                  $
                                  {msg.orderData?.total_amount.toFixed(2) ||
                                    "120.00"}
                                </strong>
                              </div>
                              <div className="flex justify-between">
                                <span>Payment Method:</span>
                                <span className="capitalize">
                                  {msg.orderData?.payment_method.replace(
                                    "_",
                                    " ",
                                  ) || "Original Card"}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span>Expected Arrival:</span>
                                <span className="font-medium text-slate-800">
                                  3–5 Business Days
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center justify-between text-[11px] text-slate-500 pt-0.5">
                              <span>✓ Policy Validated (Section 1.1)</span>
                              <span className="font-mono font-bold text-slate-700">
                                100% REFUND
                              </span>
                            </div>
                          </div>
                        )}

                        {/* 3. POLICY DENIAL RESULT CARD (Non-Dead End) */}
                        {msg.type === "denial_card" && (
                          <div className="bg-white border-2 border-red-500/80 rounded-xl p-4 shadow-sm text-xs space-y-3">
                            <div className="flex items-center space-x-2 text-red-600 font-bold">
                              <XCircle className="w-4 h-4" />
                              <span>Refund Ineligible</span>
                            </div>

                            <div className="space-y-1.5 border-y border-slate-100 py-2.5 text-slate-600 text-[11px]">
                              <div className="flex justify-between">
                                <span>Policy Window:</span>
                                <span>30 Days Post-Delivery</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Your Delivery Date:</span>
                                <span className="text-slate-800">
                                  {msg.orderData?.delivery_date ||
                                    "44 Days Ago"}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span>Status:</span>
                                <strong className="text-red-600 font-bold">
                                  Window Expired (POL Sec 1.1)
                                </strong>
                              </div>
                            </div>

                            {/* Constructive Alternatives */}
                            <div className="space-y-1.5 pt-1">
                              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">
                                Alternative Options:
                              </span>
                              <div className="flex flex-wrap gap-1.5">
                                <button
                                  onClick={() =>
                                    handleSend(
                                      "Can I speak with a human support agent about an exception?",
                                    )
                                  }
                                  className="text-[11px] px-2.5 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
                                >
                                  Contact Support
                                </button>
                                <button
                                  onClick={() =>
                                    handleSend(
                                      "What are the full details of the 30-day refund policy?",
                                    )
                                  }
                                  className="text-[11px] px-2.5 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
                                >
                                  View Policy
                                </button>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* 4. RESTOCKING FEE / STORE CREDIT CHOICE CARD */}
                        {msg.type === "restock_card" && (
                          <div className="bg-white border-2 border-amber-500/80 rounded-xl p-4 shadow-sm text-xs space-y-3">
                            <div className="flex items-center space-x-2 text-amber-600 font-bold">
                              <AlertTriangle className="w-4 h-4" />
                              <span>Opened Condition Option (Sec 2.2)</span>
                            </div>
                            <p className="text-[11px] text-slate-600">
                              Opened items are eligible for refund minus a 15%
                              restocking fee OR 100% store credit:
                            </p>
                            <div className="grid grid-cols-2 gap-2 pt-1">
                              <button
                                onClick={() =>
                                  handleSend(
                                    "I accept the refund with the 15% restocking fee deduction.",
                                  )
                                }
                                className="p-2.5 rounded-lg border border-slate-200 hover:border-blue-500 text-left bg-slate-50 hover:bg-blue-50/50 transition"
                              >
                                <strong className="block text-slate-900 font-semibold text-[11px]">
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
                                className="p-2.5 rounded-lg border border-slate-200 hover:border-emerald-500 text-left bg-slate-50 hover:bg-emerald-50/50 transition"
                              >
                                <strong className="block text-emerald-700 font-semibold text-[11px]">
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
                ))}

                {/* Validation Checkpoint Stepper Indicator */}
                {isLoading && (
                  <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm text-xs space-y-1.5 animate-pulse max-w-[85%]">
                    <div className="flex items-center space-x-2 text-blue-600 font-medium text-[11px]">
                      <Clock className="w-3.5 h-3.5 animate-spin" />
                      <span>Checking policy eligibility...</span>
                    </div>
                    <div className="text-[10px] text-slate-400 space-y-0.5">
                      <div>● Order timeline verified</div>
                      <div>● Exclusions checked</div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {/* Persistent Composer (Natural Language + Voice) */}
          <div className="p-3 border-t border-slate-200 bg-white flex flex-col gap-2">
            <div className="flex items-center justify-between px-1 text-[11px] text-slate-400">
              <span>Apex Natural Language Engine</span>
              <button
                onClick={() => setVoiceEnabled(!voiceEnabled)}
                className="flex items-center space-x-1 hover:text-slate-700 transition"
                title="Voice read aloud toggle"
              >
                {voiceEnabled ? (
                  <>
                    <Volume2 className="w-3 h-3 text-blue-600" />
                    <span className="text-blue-600 font-medium">
                      Voice Audio: ON
                    </span>
                  </>
                ) : (
                  <>
                    <VolumeX className="w-3 h-3 text-slate-400" />
                    <span>Voice Audio: OFF</span>
                  </>
                )}
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend();
              }}
              className="flex items-center space-x-2"
            >
              {/* Voice Mic Toggle Button */}
              <button
                type="button"
                onClick={toggleSpeech}
                className={`p-2 rounded-lg border transition ${
                  isRecording
                    ? "bg-red-500 text-white border-red-600 animate-pulse"
                    : "bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200"
                }`}
                title="Speak to Agent"
              >
                {isRecording ? (
                  <MicOff className="w-4 h-4" />
                ) : (
                  <Mic className="w-4 h-4" />
                )}
              </button>

              {/* Text Input */}
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={
                  isRecording
                    ? "Listening to your voice..."
                    : "Type a message..."
                }
                disabled={isLoading}
                className="flex-1 bg-slate-100 border border-slate-200 text-slate-900 text-xs rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none disabled:opacity-50"
              />

              {/* Send Button */}
              <button
                type="submit"
                disabled={isLoading || !input.trim()}
                className="bg-slate-900 hover:bg-blue-600 disabled:opacity-40 text-white px-3 py-2 rounded-lg transition flex items-center justify-center text-xs font-semibold"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>
        </aside>
      )}
    </div>
  );
}
