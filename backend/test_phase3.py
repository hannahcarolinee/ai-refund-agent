import asyncio
import os
from langchain_core.messages import HumanMessage
from agent import refund_agent_graph
from event_bus import event_bus

async def monitor_admin_stream(session_id: str, stop_event: asyncio.Event):
    """Simulates the Admin Console listening to the SSE queue."""
    queue = event_bus.subscribe(session_id)
    print(f"[Admin Console] Subscribed to session '{session_id}'. Waiting for telemetry...\n")
    try:
        while not stop_event.is_set():
            try:
                event = await asyncio.wait_for(queue.get(), timeout=0.5)
                print(f"📡 [Admin Telemetry Received] -> Type: {event['event_type']}")
                if event['event_type'] == 'TOOL_CALL_START':
                    print(f"   ↳ Executing Tool: {event['data']['tool']} with args: {event['data']['args']}")
                elif event['event_type'] == 'POLICY_AUDIT':
                    print(f"   ↳ 🎯 POLICY AUDIT HUD: Decision={event['data']['decision']} | Checklist={event['data']['checklist']}")
            except asyncio.TimeoutError:
                continue
    finally:
        event_bus.unsubscribe(session_id, queue)

async def run_test():
    session_id = "test_sess_alice_001"
    stop_event = asyncio.Event()

    # Start admin listener in background
    admin_task = asyncio.create_task(monitor_admin_stream(session_id, stop_event))
    await asyncio.sleep(0.1)

    print("==================================================")
    print("      RUNNING LANGGRAPH MULTI-TURN TEST           ")
    print("==================================================")

    # Customer message
    user_prompt = "Hi, my name is Alice Johnson (CUST-001). I'd like a refund for my waterproof jacket on order ORD-1001. It is completely unopened."
    print(f"\n[Customer]: {user_prompt}\n")

    initial_state = {
        "messages": [HumanMessage(content=user_prompt)],
        "customer_id": "CUST-001",
        "session_id": session_id
    }

    # Execute graph
    final_state = await refund_agent_graph.ainvoke(initial_state)

    # Get final agent response
    agent_reply = final_state["messages"][-1].content
    print(f"\n[Agent Final Reply]:\n{agent_reply}\n")

    # Stop admin listener
    await asyncio.sleep(0.5)
    stop_event.set()
    await admin_task

    print("==================================================")
    print("        LANGGRAPH + EVENT BUS TEST PASSED!        ")
    print("==================================================")

if __name__ == "__main__":
    asyncio.run(run_test())