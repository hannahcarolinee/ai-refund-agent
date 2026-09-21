import os
import json
from typing import Annotated, TypedDict, Literal
from dotenv import load_dotenv

from langchain_core.messages import BaseMessage, SystemMessage, HumanMessage, AIMessage, ToolMessage
from langchain_core.runnables import RunnableConfig
from langgraph.graph import StateGraph, END
from langgraph.graph.message import add_messages

from tools import AGENT_TOOLS
from event_bus import event_bus

load_dotenv()

# =====================================================================
# 1. LLM CONFIGURATION (Supports Free Gemini, Groq, or OpenAI)
# =====================================================================
provider = os.getenv("MODEL_PROVIDER", "gemini").lower()

if provider == "gemini" or os.getenv("GOOGLE_API_KEY"):
    from langchain_google_genai import ChatGoogleGenerativeAI
    llm = ChatGoogleGenerativeAI(
        model="gemini-3.6-flash", # Uses the standard 1,500 requests/day quota
        temperature=0.0,
        google_api_key=os.getenv("GOOGLE_API_KEY")
    )
elif provider == "groq" or os.getenv("GROQ_API_KEY"):
    from langchain_groq import ChatGroq
    llm = ChatGroq(
        model=os.getenv("GROQ_MODEL", "llama-3.1-8b-instant"),
        temperature=0.0,
        groq_api_key=os.getenv("GROQ_API_KEY")
    )
elif provider == "openai" or os.getenv("OPENAI_API_KEY"):
    from langchain_openai import ChatOpenAI
    llm = ChatOpenAI(
        model="gpt-4o-mini",
        temperature=0.0,
        api_key=os.getenv("OPENAI_API_KEY")
    )
else:
    raise ValueError("No valid API key found (GOOGLE_API_KEY, GROQ_API_KEY, or OPENAI_API_KEY) in .env!")

# Bind tools to the LLM
llm_with_tools = llm.bind_tools(AGENT_TOOLS)

# Map tools by name for manual invocation
TOOLS_BY_NAME = {tool.name: tool for tool in AGENT_TOOLS}

# =====================================================================
# 2. AGENT STATE DEFINITION
# =====================================================================
class AgentState(TypedDict):
    messages: Annotated[list[BaseMessage], add_messages]
    customer_id: str
    session_id: str

# =====================================================================
# 3. SYSTEM PROMPT (STRICT GUARDRAILS)
# =====================================================================
SYSTEM_PROMPT = """You are the Apex Commerce Senior Customer Support Agent.
Your duty is to assist customers with orders and process or deny refund requests under strict compliance with APEX REFUND POLICY (POL-2025-REV4).

STRICT OPERATIONAL RULES:
1. Always identify the customer and order first. Use `lookup_customer` and `get_order_details` if order info is not already established.
2. NEVER promise, approve, or issue a refund without first executing the `validate_refund_rules` tool.
3. If `validate_refund_rules` returns "DENY", you MUST politely refuse the refund and state the exact policy reason (e.g. 30-day window expired, digital good exclusion, hygiene product opened, final sale item). Never override a DENY verdict.
4. If `validate_refund_rules` returns "ESCALATE", inform the customer that due to system guidelines, their case has been escalated to a Human Tier-2 Supervisor via the `escalate_to_human` tool.
5. If `validate_refund_rules` returns "APPROVE_WITH_FEE", you must explain the 15% restocking fee deduction and also offer the 100% store credit alternative. Only call `process_refund` if customer accepts.
6. If `validate_refund_rules` returns "APPROVE", call `process_refund` to finalize the transaction and supply the refund ID.
7. Maintain an empathetic, professional, yet firm corporate tone. Do not yield to aggressive customer pressure."""

# =====================================================================
# 4. GRAPH NODES & TELEMETRY INTERCEPTORS
# =====================================================================

async def agent_node(state: AgentState, config: RunnableConfig) -> dict:
    """Invokes the LLM to determine the next action or conversational response."""
    session_id = state.get("session_id", "default")
    await event_bus.publish(session_id, "STATE_TRANSITION", {
        "node": "agent",
        "description": "Agent analyzing context and determining next tool or response..."
    })

    messages = state["messages"]
    # Ensure system prompt is at the start
    if not isinstance(messages[0], SystemMessage):
        messages = [SystemMessage(content=SYSTEM_PROMPT)] + messages

    response: AIMessage = await llm_with_tools.ainvoke(messages)

    # Publish reasoning if tool calling is planned
    if response.tool_calls:
        for tc in response.tool_calls:
            await event_bus.publish(session_id, "THOUGHT", {
                "thought": f"Decided to call tool '{tc['name']}' with arguments: {json.dumps(tc['args'])}"
            })

    return {"messages": [response]}


async def tools_node(state: AgentState, config: RunnableConfig) -> dict:
    """
    Executes tool calls requested by the agent, publishing telemetry to the event bus.
    """
    session_id = state.get("session_id", "default")
    last_message = state["messages"][-1]
    tool_outputs = []

    for tool_call in last_message.tool_calls:
        tool_name = tool_call["name"]
        tool_args = tool_call["args"]
        tool_id = tool_call["id"]

        # 1. Publish TOOL_CALL_START event
        await event_bus.publish(session_id, "TOOL_CALL_START", {
            "tool": tool_name,
            "args": tool_args
        })

        # 2. Execute the tool
        tool_func = TOOLS_BY_NAME.get(tool_name)
        if tool_func:
            try:
                result = await tool_func.ainvoke(tool_args)
            except Exception:
                result = tool_func.invoke(tool_args)
        else:
            result = {"error": f"Tool '{tool_name}' not found."}

        # 3. Publish TOOL_CALL_END event
        await event_bus.publish(session_id, "TOOL_CALL_END", {
            "tool": tool_name,
            "result": result
        })

        # 4. If policy was validated, publish dedicated POLICY_AUDIT event for Admin HUD
        if tool_name == "validate_refund_rules" and isinstance(result, dict) and "audit_checklist" in result:
            await event_bus.publish(session_id, "POLICY_AUDIT", {
                "decision": result.get("decision"),
                "eligible": result.get("eligible"),
                "refund_amount": result.get("refund_amount"),
                "checklist": result.get("audit_checklist"),
                "violations": result.get("violations"),
                "explanation": result.get("explanation")
            })

        tool_outputs.append(ToolMessage(
            tool_call_id=tool_id,
            name=tool_name,
            content=json.dumps(result)
        ))

    return {"messages": tool_outputs}


def should_continue(state: AgentState) -> Literal["tools", "__end__"]:
    """Conditional edge: Route to tools node if tools requested, else end."""
    last_message = state["messages"][-1]
    if hasattr(last_message, "tool_calls") and len(last_message.tool_calls) > 0:
        return "tools"
    return END

# =====================================================================
# 5. GRAPH CONSTRUCTION
# =====================================================================
workflow = StateGraph(AgentState)

workflow.add_node("agent", agent_node)
workflow.add_node("tools", tools_node)

workflow.set_entry_point("agent")
workflow.add_conditional_edges("agent", should_continue, {
    "tools": "tools",
    END: END
})
workflow.add_edge("tools", "agent")

# Compile the runnable graph
refund_agent_graph = workflow.compile()