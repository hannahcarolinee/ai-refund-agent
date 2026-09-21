import asyncio
import json
from typing import AsyncGenerator
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from langchain_core.messages import HumanMessage, AIMessage

from agent import refund_agent_graph
from event_bus import event_bus
from crm_service import CRMService
from database import init_db

app = FastAPI(
    title="Apex Commerce AI Refund Support Agent",
    description="Autonomous refund evaluation agent powered by LangGraph and Gemini",
    version="1.0.0"
)

# Enable CORS for Next.js frontend (localhost:3000)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows local Next.js dev server
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory session message history store
# Maps session_id -> list of LangChain messages
session_memory: dict[str, list] = {}

# -------------------------------------------------------------
# Request / Response Schemas
# -------------------------------------------------------------
class ChatRequest(BaseModel):
    session_id: str
    customer_id: str
    message: str

def extract_text(content) -> str:
    """Safely extracts clean string text from strings or Gemini content blocks."""
    if isinstance(content, str):
        return content
    elif isinstance(content, list):
        texts = [item.get("text", "") for item in content if isinstance(item, dict) and "text" in item]
        return "\n".join(texts)
    return str(content)

# -------------------------------------------------------------
# Endpoints
# -------------------------------------------------------------

@app.get("/")
def root():
    return {"status": "online", "system": "Apex Commerce Agent Engine"}

@app.get("/api/customers")
def get_customers():
    """Returns all 15 customer profiles to populate the frontend demo dropdown."""
    return CRMService.get_all_customers()

@app.get("/api/customer/{customer_id}/orders")
def get_customer_orders(customer_id: str):
    """Returns orders and items for a specific customer."""
    orders = CRMService.get_customer_orders(customer_id)
    detailed_orders = [CRMService.get_order(o["order_id"]) for o in orders]
    return [o for o in detailed_orders if o]

@app.post("/api/reset-db")
def reset_database():
    """One-click reset of the SQLite database to initial state for easy demo re-runs."""
    init_db()
    session_memory.clear()
    return {"status": "success", "message": "Database and sessions reset to initial state."}

@app.get("/api/admin/history/{session_id}")
def get_session_history(session_id: str):
    """Returns buffered telemetry events for an active or past session."""
    return event_bus.get_history(session_id)

@app.get("/api/admin/stream/{session_id}")
async def admin_stream(session_id: str):
    """
    Server-Sent Events (SSE) endpoint.
    Streams real-time reasoning logs, tool calls, and policy audit updates
    directly to the Admin Observability Dashboard.
    """
    async def event_generator() -> AsyncGenerator[str, None]:
        queue = event_bus.subscribe(session_id)
        # Yield initial connection confirmation
        yield f"data: {json.dumps({'event_type': 'CONNECTED', 'session_id': session_id})}\n\n"
        
        try:
            while True:
                # Wait for next telemetry event from agent execution
                event = await queue.get()
                yield f"data: {json.dumps(event)}\n\n"
        except asyncio.CancelledError:
            pass
        finally:
            event_bus.unsubscribe(session_id, queue)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "Content-Type": "text/event-stream"
        }
    )

@app.post("/api/chat")
async def chat_endpoint(req: ChatRequest):
    """
    Processes customer messages through the LangGraph state machine.
    Maintains conversation context per session_id.
    """
    session_id = req.session_id
    customer_id = req.customer_id
    user_msg = req.message.strip()

    if not user_msg:
        raise HTTPException(status_code=400, detail="Message cannot be empty.")

    # Initialize or fetch session history
    if session_id not in session_memory:
        session_memory[session_id] = []

    # Append user message
    session_memory[session_id].append(HumanMessage(content=user_msg))

    initial_state = {
        "messages": session_memory[session_id],
        "customer_id": customer_id,
        "session_id": session_id
    }

    try:
        # Run graph
        final_state = await refund_agent_graph.ainvoke(initial_state)

        # Update session memory with graph execution messages
        session_memory[session_id] = final_state["messages"]

        # Extract agent response
        last_msg = final_state["messages"][-1]
        clean_reply = extract_text(last_msg.content)

        return {
            "session_id": session_id,
            "customer_id": customer_id,
            "reply": clean_reply
        }

    except Exception as e:
        # Log failure to admin event bus
        await event_bus.publish(session_id, "ERROR", {"error": str(e)})
        raise HTTPException(status_code=500, detail=f"Agent Error: {str(e)}")