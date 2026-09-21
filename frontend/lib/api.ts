const BACKEND_URL = "http://127.0.0.1:8000";

export interface Customer {
  customer_id: string;
  name: string;
  email: string;
  account_tier: string;
  fraud_risk_score: number;
  refunds_last_90_days: number;
  is_flagged: boolean;
}

export interface OrderItem {
  item_id: string;
  product_name: string;
  category: string;
  price: number;
  is_final_sale: boolean;
}

export interface Order {
  order_id: string;
  order_date: string;
  delivery_date: string | null;
  status: string;
  total_amount: number;
  payment_method: string;
  items: OrderItem[];
}

export async function fetchCustomers(): Promise<Customer[]> {
  const res = await fetch(`${BACKEND_URL}/api/customers`);
  if (!res.ok) throw new Error("Failed to fetch customers");
  return res.json();
}

export async function fetchCustomerOrders(
  customerId: string,
): Promise<Order[]> {
  const res = await fetch(`${BACKEND_URL}/api/customer/${customerId}/orders`);
  if (!res.ok) throw new Error("Failed to fetch orders");
  return res.json();
}

export async function sendChatMessage(
  sessionId: string,
  customerId: string,
  message: string,
): Promise<{ reply: string }> {
  const res = await fetch(`${BACKEND_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      session_id: sessionId,
      customer_id: customerId,
      message,
    }),
  });
  if (!res.ok) throw new Error("Chat request failed");
  return res.json();
}

export async function resetBackendDatabase(): Promise<void> {
  await fetch(`${BACKEND_URL}/api/reset-db`, { method: "POST" });
}
