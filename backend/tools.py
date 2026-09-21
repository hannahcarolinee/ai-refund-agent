from langchain_core.tools import tool
from crm_service import CRMService
from policy_engine import PolicyEngine

@tool
def lookup_customer(identifier: str) -> dict:
    """
    Looks up a customer profile in the CRM database by either their Customer ID (e.g. 'CUST-001')
    or their email address (e.g. 'alice@example.com').
    Returns account tier, fraud risk score, and recent refund history.
    """
    customer = CRMService.get_customer(identifier)
    if not customer:
        return {"error": f"Customer '{identifier}' was not found in the CRM system."}
    return customer

@tool
def get_order_details(order_id: str) -> dict:
    """
    Retrieves complete order information including delivery date, status, line items, 
    SKU prices, and returnable categories for a given Order ID (e.g. 'ORD-1001').
    """
    order = CRMService.get_order(order_id)
    if not order:
        return {"error": f"Order '{order_id}' was not found in the database."}
    return order

@tool
def validate_refund_rules(
    customer_id: str,
    order_id: str,
    item_id: str,
    item_condition: str,
    reason: str
) -> dict:
    """
    Validates a refund request against the strict Apex Commerce Policy (POL-2025-REV4).
    Calculates time window, checks exclusions (hygiene, digital, final sale), evaluates 
    fraud risk, and determines eligible refund amount or restocking fees.
    
    Parameters:
    - customer_id: Customer ID (e.g., 'CUST-001')
    - order_id: Order ID (e.g., 'ORD-1001')
    - item_id: Item ID to refund (e.g., 'ITEM-101')
    - item_condition: 'unopened', 'opened_like_new', or 'damaged'
    - reason: Customer reason ('not_needed', 'defective', 'doa', 'lost', etc.)
    """
    customer = CRMService.get_customer(customer_id)
    if not customer:
        return {"error": f"Customer '{customer_id}' not found."}

    order = CRMService.get_order(order_id)
    if not order:
        return {"error": f"Order '{order_id}' not found."}

    # Find the specific item in the order
    item = next((i for i in order.get("items", []) if i["item_id"] == item_id), None)
    if not item:
        # If there's only 1 item in the order, default to it
        if len(order.get("items", [])) == 1:
            item = order["items"][0]
        else:
            available_items = [f"{i['item_id']} ({i['product_name']})" for i in order.get("items", [])]
            return {
                "error": f"Item '{item_id}' not found in order '{order_id}'.",
                "available_items": available_items
            }

    # Execute deterministic code-level check
    result = PolicyEngine.evaluate(
        customer=customer,
        order=order,
        item=item,
        item_condition=item_condition,
        reason=reason
    )
    result["item_name"] = item["product_name"]
    result["item_id"] = item["item_id"]
    return result

@tool
def process_refund(
    order_id: str, 
    item_id: str, 
    amount: float, 
    reason: str
) -> dict:
    """
    Executes and records an approved refund in the database.
    This tool is idempotent and guarantees an item cannot be refunded twice.
    Only call this tool AFTER validate_refund_rules returned 'APPROVE' or 'APPROVE_WITH_FEE'.
    """
    return CRMService.record_refund(
        order_id=order_id,
        item_id=item_id,
        amount=amount,
        reason=reason,
        status="APPROVED"
    )

@tool
def escalate_to_human(
    customer_id: str, 
    order_id: str, 
    reason: str
) -> dict:
    """
    Escalates a support inquiry or policy edge case to a human supervisor.
    Call this when fraud risk is high, return frequency is exceeded, or item price exceeds $500.
    """
    return {
        "status": "ESCALATED",
        "ticket_id": f"TICK-{customer_id[:4]}-REV",
        "customer_id": customer_id,
        "order_id": order_id,
        "reason": reason,
        "message": "Inquiry successfully escalated to a Human Tier-2 Support Specialist."
    }

# Export list of tools for LangGraph
AGENT_TOOLS = [
    lookup_customer,
    get_order_details,
    validate_refund_rules,
    process_refund,
    escalate_to_human
]