import uuid
from datetime import datetime
from database import get_connection

class CRMService:
    @staticmethod
    def get_all_customers() -> list[dict]:
        """Returns all 15 customer profiles for the frontend dropdown switcher."""
        conn = get_connection()
        rows = conn.execute("""
            SELECT customer_id, name, email, account_tier, fraud_risk_score, refunds_last_90_days, is_flagged 
            FROM customers 
            ORDER BY customer_id ASC
        """).fetchall()
        conn.close()
        return [dict(r) for r in rows]

    @staticmethod
    def get_customer(identifier: str) -> dict | None:
        """Lookup customer by either customer_id or email."""
        conn = get_connection()
        row = conn.execute(
            "SELECT * FROM customers WHERE customer_id = ? OR LOWER(email) = LOWER(?)", 
            (identifier.strip(), identifier.strip())
        ).fetchone()
        conn.close()
        return dict(row) if row else None

    @staticmethod
    def get_customer_orders(customer_id: str) -> list[dict]:
        """Retrieves all orders associated with a customer."""
        conn = get_connection()
        rows = conn.execute("SELECT * FROM orders WHERE customer_id = ?", (customer_id,)).fetchall()
        conn.close()
        return [dict(r) for r in rows]

    @staticmethod
    def get_order(order_id: str) -> dict | None:
        """Retrieves an order and all of its line items."""
        conn = get_connection()
        order_row = conn.execute("SELECT * FROM orders WHERE order_id = ?", (order_id.strip(),)).fetchone()
        if not order_row:
            conn.close()
            return None

        order = dict(order_row)
        items = conn.execute("SELECT * FROM order_items WHERE order_id = ?", (order_id.strip(),)).fetchall()
        order["items"] = [dict(i) for i in items]
        conn.close()
        return order

    @staticmethod
    def record_refund(order_id: str, item_id: str, amount: float, reason: str, status: str = "APPROVED") -> dict:
        """
        Idempotently records a refund.
        Prevents double-refund attacks on the same item.
        """
        conn = get_connection()
        cursor = conn.cursor()

        # Check if already refunded
        existing = cursor.execute(
            "SELECT * FROM refunds WHERE order_id = ? AND item_id = ? AND status = 'APPROVED'", 
            (order_id, item_id)
        ).fetchone()

        if existing:
            conn.close()
            return {
                "success": False,
                "error": "DUPLICATE_REFUND",
                "message": f"Item {item_id} in Order {order_id} has already been refunded under {existing['refund_id']}."
            }

        refund_id = f"REF-{uuid.uuid4().hex[:8].upper()}"
        now_str = datetime.now().isoformat()

        cursor.execute(
            "INSERT INTO refunds VALUES (?, ?, ?, ?, ?, ?, ?)",
            (refund_id, order_id, item_id, amount, status, reason, now_str)
        )
        conn.commit()
        conn.close()
        
        return {
            "success": True,
            "refund_id": refund_id,
            "status": status,
            "amount": amount,
            "timestamp": now_str
        }