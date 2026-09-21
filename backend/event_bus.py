import asyncio
from datetime import datetime
from typing import AsyncGenerator
import json

class EventBus:
    """
    In-memory async Pub/Sub event bus for live streaming agent reasoning,
    tool invocations, and policy audit results to the Admin Dashboard.
    """
    def __init__(self):
        # Maps session_id -> list of asyncio.Queue instances
        self._subscribers: dict[str, list[asyncio.Queue]] = {}
        # Stores recent trace history per session so newly opened admin tabs can see prior logs
        self._history: dict[str, list[dict]] = {}

    def subscribe(self, session_id: str) -> asyncio.Queue:
        """Subscribes an Admin SSE connection to events for a specific session."""
        queue = asyncio.Queue()
        if session_id not in self._subscribers:
            self._subscribers[session_id] = []
        self._subscribers[session_id].append(queue)
        return queue

    def unsubscribe(self, session_id: str, queue: asyncio.Queue):
        """Safely removes disconnected SSE clients to prevent memory leaks."""
        if session_id in self._subscribers:
            if queue in self._subscribers[session_id]:
                self._subscribers[session_id].remove(queue)
            if not self._subscribers[session_id]:
                del self._subscribers[session_id]

    async def publish(self, session_id: str, event_type: str, data: dict):
        """
        Publishes a structured telemetry event to all active Admin listeners.
        Event Types:
        - 'STATE_TRANSITION': Current LangGraph node execution
        - 'THOUGHT': LLM reasoning/scratchpad text
        - 'TOOL_CALL_START': Tool invoked with arguments
        - 'TOOL_CALL_END': Tool output received
        - 'POLICY_AUDIT': Visual checklist status update
        """
        event = {
            "session_id": session_id,
            "event_type": event_type,
            "timestamp": datetime.now().isoformat(),
            "data": data
        }

        # Save to history (keep last 50 events per session)
        if session_id not in self._history:
            self._history[session_id] = []
        self._history[session_id].append(event)
        if len(self._history[session_id]) > 50:
            self._history[session_id].pop(0)

        # Broadcast to all active admin queues
        if session_id in self._subscribers:
            for queue in self._subscribers[session_id]:
                await queue.put(event)

    def get_history(self, session_id: str) -> list[dict]:
        """Returns buffered event history for freshly loaded admin consoles."""
        return self._history.get(session_id, [])

# Global singleton event bus instance
event_bus = EventBus()