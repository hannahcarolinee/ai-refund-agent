# Autonomous AI Customer Support Agent for E-Commerce Refunds

An autonomous customer support application that validates, processes, and denies e-commerce refund requests according to strict corporate policy rules using LLM orchestration and deterministic code guardrails.

The project explores how **LangGraph, FastAPI, Server-Sent Events (SSE), and Next.js** can be combined to build a trustworthy transactional AI agent with real-time administrative observability.

---

## Overview

Conversational AI can be unreliable when handling financial transactions such as refunds because LLM outputs are non-deterministic. Without strict guardrails, an agent could hallucinate approvals, make unauthorized concessions, or provide inconsistent policy decisions.

This project addresses that problem by separating **conversational intelligence from business rule enforcement**. The LLM handles intent understanding and tool orchestration, while all refund eligibility and transaction rules are enforced by deterministic Python code.

### Customer Experience

Users can:

* Access an embedded support drawer within a realistic e-commerce storefront
* Use task-oriented action pills such as **Return an order**, **Check refund status**, and **Track an order**
* Select recent orders from interactive cards retrieved from the CRM
* Request returns using natural language or browser-based voice interaction
* Receive structured decision cards for approvals, denials, and restocking fee options

### Admin Experience

Support engineers and administrators can:

* Monitor agent execution in real time through a dedicated `/admin` operations console
* Inspect LangGraph state transitions
* View tool inputs and outputs as JSON
* Monitor a real-time policy audit checklist
* Observe policy failures and escalation conditions as they occur

---



## Key Features

### E-Commerce Support Drawer

The support experience is embedded directly into an e-commerce storefront rather than presented as a generic full-screen chatbot.

* Task-oriented action pills reduce the need for open-ended prompting
* Recent orders are presented as interactive selection cards
* Customers can initiate return requests using natural language
* Refund decisions are presented through structured result cards

### Deterministic Policy Enforcement

Refund requests are evaluated against the `POL-2025-REV4` policy using code-level business rules.

#### 30-Day Return Window

The system compares the delivery timestamp with the current date. Requests submitted beyond 30 days are automatically denied.

#### Product Condition

* Factory-sealed products receive a 100% refund
* Opened or like-new products receive either:

  * A 15% restocking fee deduction, or
  * 100% store credit

#### Category Exclusions

The following products are non-refundable:

* Digital goods
* Opened personal hygiene products
* Clearance items marked as Final Sale

#### Fraud & Abuse Limits

Accounts are automatically locked from processing and escalated to a human supervisor when:

* Fraud risk score is `>= 0.70`, or
* The customer has made `>= 3` refunds within the previous 90 days

#### High-Value Refunds

Single-item refunds exceeding `$500.00` require supervisor escalation.

---

## Real-Time Admin Telemetry

The `/admin` console provides a separate operations interface for monitoring the agent without exposing internal telemetry to customers.

It displays:

* Live LangGraph node execution
* Tool inputs and outputs
* Policy audit results
* Refund decision state
* Real-time event updates through SSE
* A five-point policy audit covering:

  * Delivery Window
  * Category
  * Condition
  * Fraud Score
  * High-Value Cap

---

## Native Voice Pipeline

The support drawer includes browser-native voice capabilities without requiring a paid voice API.

### Speech-to-Text

The microphone button uses the browser's **Web Speech API** to convert spoken customer requests into text.

### Text-to-Speech

Agent responses and refund decisions can be automatically read aloud using the browser's native speech synthesis API.

---

## Idempotent Mock CRM

The application uses a SQLite database containing 15 customer profiles and their order histories.

The seeded data covers scenarios including:

* Successful refunds
* Expired return windows
* Fraud and abuse locks
* Final-sale exclusions
* Damaged products
* Restocking fee scenarios

The CRM layer uses verification checks and database constraints to prevent the same order or item from being refunded twice.

---

## Tech Stack

### Backend & AI

* Python 3.10+
* FastAPI
* LangGraph
* LangChain
* Google Gemini / Groq
* SQLite 3

### Frontend

* Next.js 14
* React 18
* TypeScript
* Tailwind CSS
* Lucide React

### Real-Time & Voice

* Server-Sent Events (SSE)
* FastAPI `asyncio.Queue`
* Web Speech API
* `webkitSpeechRecognition`
* `speechSynthesis`

---

## Architecture

The application uses an asynchronous architecture connecting the customer storefront, AI agent, policy engine, CRM, and administration console.

```text
Customer Action
(Chat / Voice)
      ↓
E-Commerce Storefront
      ↓
FastAPI Backend
      ↓
LangGraph State Machine
      ↓
Deterministic Policy Engine
      ↓
SQLite CRM Database
      ↓
Async Event Bus
      ↓
SSE Stream
      ↓
Admin Observability Console
```

### Request Flow

1. The customer selects an order or submits a refund request.
2. The FastAPI backend forwards the conversation state to the LangGraph workflow.
3. The LLM identifies the customer's intent and invokes the appropriate tool.
4. The deterministic policy engine evaluates the refund against the formal policy.
5. Approved transactions are written to the SQLite refund ledger.
6. Agent events, tool calls, and policy audit results are published through the event bus.
7. The customer receives a structured refund decision.
8. The Admin Console receives the same execution telemetry through SSE.

---

## Core System Concepts

### Deterministic Code Guardrails

The LLM does not directly determine whether money should be refunded. Instead, refund decisions pass through deterministic business rules implemented in Python.

This creates a separation between:

```text
LLM
Intent + Tool Orchestration
        ↓
Deterministic Policy Engine
Business Rule Enforcement
        ↓
Refund Transaction
```

### LangGraph State Machine

The agent workflow uses LangGraph to define explicit state transitions, conditional routing, and tool execution.

### Real-Time Observability

FastAPI publishes agent execution events through an asynchronous event bus and Server-Sent Events, allowing the React admin console to update without repeatedly polling the backend.

### Progressive Disclosure UX

The customer interface progressively reveals information through:

* Action pills
* Order selection cards
* Policy explanations
* Decision receipt cards
* Restocking fee choices

This keeps a potentially complex refund workflow focused and understandable.

### Idempotent Transactions

Refund processing includes verification and database constraints to prevent duplicate refunds when the same request is submitted more than once.

---

## Getting Started

### Prerequisites

Make sure you have the following installed:

* Python 3.10+
* Node.js 18+
* npm
* A Google Gemini API key, or an OpenAI / Groq API key

---

## Installation

### 1. Clone the Repository

```bash
git clone <your-repository-url>
cd ai-refund-agent
```

---

### 2. Backend Setup

Navigate to the backend directory:

```bash
cd backend
```

Create a virtual environment:

#### Windows PowerShell

```powershell
python -m venv venv
.\venv\Scripts\Activate.ps1
```

#### macOS / Linux

```bash
python3 -m venv venv
source venv/bin/activate
```

Install the dependencies:

```bash
pip install -r requirements.txt
```

---

### 3. Configure Environment Variables

Create a `.env` file inside the `backend/` directory:

```env
GOOGLE_API_KEY=your_gemini_api_key_here
MODEL_PROVIDER=gemini
```

Do not commit API keys, private credentials, or other secrets to the repository.

---

### 4. Initialize the Database

Seed the SQLite CRM database:

```bash
python database.py
```

---

### 5. Start the Backend

Run the FastAPI server:

```bash
uvicorn main:app --reload --port 8000
```

The backend will be available at:

```text
http://127.0.0.1:8000
```

---

### 6. Start the Frontend

Open a second terminal and navigate to the frontend:

```bash
cd frontend
```

Install dependencies:

```bash
npm install
```

Start the Next.js development server:

```bash
npm run dev
```

The customer storefront will be available at:

```text
http://localhost:3000
```

The admin console is available at:

```text
http://localhost:3000/admin
```

---

## Testing the Core Scenarios

Open two browser tabs:

**Customer Storefront**

```text
http://localhost:3000
```

**Admin Console**

```text
http://localhost:3000/admin
```

### 1. Standard Refund Approval

**Customer:** Alice Johnson
**Customer ID:** `CUST-001`
**Order:** `ORD-1001`

1. Click **Return an order**.
2. Select the Waterproof Winter Jacket.
3. Submit the return request.
4. The system evaluates the order against all policy rules.
5. A refund approval card is displayed with a confirmation ID.
6. The Admin Console shows the completed policy audit.

### 2. Return Window Violation

**Customer:** Bob Smith
**Customer ID:** `CUST-002`
**Order:** `ORD-1002`

This order was delivered 44 days ago.

1. Switch to Bob Smith.
2. Request a return for `ORD-1002`.
3. The policy engine detects that the 30-day return window has expired.
4. The customer receives a refund-ineligible card.
5. The Admin Console records `WINDOW_EXPIRED`.
6. The refund transaction is not executed.

### 3. Fraud & Abuse Lock

**Customer:** Charlie Brown
**Customer ID:** `CUST-003`

Charlie has:

* Fraud risk score: `0.88`
* Previous refunds: `4`

1. Switch to Charlie Brown.
2. Request a return.
3. The policy engine detects the account-level abuse threshold.
4. The request is escalated to a human supervisor.
5. The Admin Console displays the corresponding risk lock.

### 4. Voice Interaction & Restocking Fee

**Customer:** Diana Prince
**Customer ID:** `CUST-004`
**Order:** `ORD-1004`

1. Switch to Diana Prince.
2. Enable **Voice Audio**.
3. Click the microphone button.
4. Say:

> "I opened my earbuds from order 1004, but I'd like to return them."

5. The agent evaluates the product condition.
6. The policy engine applies the 15% restocking fee.
7. The customer receives an interactive choice between the refund and store credit options.
8. The response can also be read aloud using browser speech synthesis.

---

## Project Structure

```text
ai-refund-agent/
│
├── backend/
│   ├── main.py
│   ├── agent.py
│   ├── policy_engine.py
│   ├── tools.py
│   ├── database.py
│   ├── crm_service.py
│   ├── event_bus.py
│   ├── policy_document.txt
│   └── requirements.txt
│
└── frontend/
    ├── app/
    │   ├── layout.tsx
    │   ├── globals.css
    │   ├── page.tsx
    │   └── admin/
    │       └── page.tsx
    │
    ├── lib/
    │   └── api.ts
    │
    ├── package.json
    └── tailwind.config.ts
```

### Backend

| File                  | Purpose                                        |
| --------------------- | ---------------------------------------------- |
| `main.py`             | FastAPI server, REST routes, and SSE streaming |
| `agent.py`            | LangGraph state machine and agent workflow     |
| `policy_engine.py`    | Deterministic refund policy engine             |
| `tools.py`            | LangChain tools and validated tool inputs      |
| `database.py`         | SQLite schema and seed data                    |
| `crm_service.py`      | CRM queries and refund ledger                  |
| `event_bus.py`        | Asynchronous event broadcasting                |
| `policy_document.txt` | Formal refund policy specification             |

### Frontend

| File             | Purpose                                  |
| ---------------- | ---------------------------------------- |
| `page.tsx`       | E-commerce storefront and support drawer |
| `admin/page.tsx` | Real-time admin telemetry console        |
| `api.ts`         | API functions and TypeScript interfaces  |
| `globals.css`    | Global application styling               |

---

## What I Learned

Building this project provided practical experience with:

* Designing agent workflows using **LangGraph**
* Implementing deterministic business rules around LLM-based systems
* Building REST APIs and SSE streams with **FastAPI**
* Managing asynchronous agent execution and real-time events
* Integrating LLM tools with structured inputs and outputs
* Building an e-commerce support experience with **Next.js and React**
* Implementing browser-native speech recognition and synthesis
* Designing idempotent database operations for financial transactions
* Building an administrative observability interface for AI workflows

---

## Future Improvements

* **Human-in-the-Loop Approval:** Add a supervisor review interface for escalated refund requests.
* **Return Shipping Labels:** Generate simulated carrier QR codes or printable return labels after approval.
* **Multi-Language Support:** Provide localized support and policy responses.
* **Policy FAQ Search:** Add hybrid keyword and semantic search for questions outside the standard refund workflow.
* **Persistent Observability:** Store agent execution traces for historical debugging and analysis.
* **Production Database:** Replace the mock SQLite CRM with a production-grade database and transactional infrastructure.

---

## Disclaimer

This project was created for educational and portfolio purposes to demonstrate AI agent orchestration, deterministic business rules, and transactional workflow design.

It is not intended for real-world financial transactions without appropriate security reviews, testing, monitoring, and safeguards.
