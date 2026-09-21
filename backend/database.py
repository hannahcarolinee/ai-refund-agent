import sqlite3
from datetime import datetime, timedelta
import os

DB_PATH = os.path.join(os.path.dirname(__file__), "crm.db")

def get_connection():
    """Returns a SQLite connection with dict-like row access."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    """Initializes schema and seeds 15 targeted customer test profiles."""
    conn = get_connection()
    cursor = conn.cursor()

    # Drop old tables to guarantee clean state
    cursor.executescript("""
        DROP TABLE IF EXISTS refunds;
        DROP TABLE IF EXISTS order_items;
        DROP TABLE IF EXISTS orders;
        DROP TABLE IF EXISTS customers;

        CREATE TABLE customers (
            customer_id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            email TEXT NOT NULL,
            account_tier TEXT NOT NULL,       -- 'Standard' or 'VIP'
            fraud_risk_score REAL NOT NULL,   -- 0.00 to 1.00
            refunds_last_90_days INTEGER NOT NULL,
            is_flagged BOOLEAN DEFAULT 0
        );

        CREATE TABLE orders (
            order_id TEXT PRIMARY KEY,
            customer_id TEXT NOT NULL,
            order_date TEXT NOT NULL,
            delivery_date TEXT,
            status TEXT NOT NULL,             -- 'delivered', 'in_transit', 'lost_in_transit'
            total_amount REAL NOT NULL,
            payment_method TEXT NOT NULL,
            FOREIGN KEY (customer_id) REFERENCES customers(customer_id)
        );

        CREATE TABLE order_items (
            item_id TEXT PRIMARY KEY,
            order_id TEXT NOT NULL,
            product_name TEXT NOT NULL,
            category TEXT NOT NULL,           -- 'Apparel', 'Electronics', 'Footwear', 'Hygiene', 'Digital', etc.
            price REAL NOT NULL,
            is_final_sale BOOLEAN DEFAULT 0,
            FOREIGN KEY (order_id) REFERENCES orders(order_id)
        );

        CREATE TABLE refunds (
            refund_id TEXT PRIMARY KEY,
            order_id TEXT NOT NULL,
            item_id TEXT NOT NULL,
            amount REAL NOT NULL,
            status TEXT NOT NULL,             -- 'APPROVED', 'DENIED', 'ESCALATED'
            reason TEXT NOT NULL,
            created_at TEXT NOT NULL,
            FOREIGN KEY (order_id) REFERENCES orders(order_id)
        );
    """)

    # Dynamic date helper (relative to today)
    now = datetime.now()
    d = lambda days_ago: (now - timedelta(days=days_ago)).strftime("%Y-%m-%d")

    # 15 Specific Customer Profiles
    customers_data = [
        # (ID, Name, Email, Tier, Risk Score, Returns in 90d, Flagged)
        ("CUST-001", "Alice Johnson",   "alice@example.com",   "Standard", 0.05, 0, 0), # Clean Approval
        ("CUST-002", "Bob Smith",       "bob@example.com",     "Standard", 0.12, 1, 0), # Expired > 30 Days (44d ago)
        ("CUST-003", "Charlie Brown",   "charlie@example.com", "Standard", 0.88, 4, 1), # High Risk & Abuse Flag
        ("CUST-004", "Diana Prince",    "diana@example.com",   "VIP",      0.02, 0, 0), # Opened / 15% Restock Fee
        ("CUST-005", "Evan Wright",     "evan@example.com",    "Standard", 0.20, 0, 0), # Final Sale Clearance Item
        ("CUST-006", "Fiona Gallagher", "fiona@example.com",   "Standard", 0.15, 0, 0), # Hygiene Item (Opened)
        ("CUST-007", "George Clark",    "george@example.com",  "VIP",      0.08, 1, 0), # High Value Item ($899 > $500)
        ("CUST-008", "Hannah Abbott",   "hannah@example.com",  "Standard", 0.10, 0, 0), # Digital Software Key
        ("CUST-009", "Ian Malcolm",     "ian@example.com",     "Standard", 0.35, 0, 0), # Lost in Transit
        ("CUST-010", "Julia Roberts",   "julia@example.com",   "VIP",      0.04, 2, 0), # Policy Boundary (38 days)
        ("CUST-011", "Kevin Bacon",     "kevin@example.com",   "Standard", 0.95, 6, 1), # Banned / Habitual Abuser
        ("CUST-012", "Laura Croft",     "laura@example.com",   "VIP",      0.01, 0, 0), # Custom Engraved Item
        ("CUST-013", "Michael Scott",   "michael@example.com", "Standard", 0.22, 1, 0), # Missing / Invalid Order
        ("CUST-014", "Nina Simone",     "nina@example.com",    "Standard", 0.05, 0, 0), # Damaged on Arrival (DOA)
        ("CUST-015", "Oscar Martinez",  "oscar@example.com",   "VIP",      0.09, 0, 0), # Multi-Item Partial Return
    ]

    orders_data = [
        # (OrderID, CustID, OrderDate, DeliveryDate, Status, Total, Payment)
        ("ORD-1001", "CUST-001", d(12), d(8),  "delivered",       120.00, "credit_card"),
        ("ORD-1002", "CUST-002", d(50), d(44), "delivered",        85.00, "credit_card"),
        ("ORD-1003", "CUST-003", d(8),  d(5),  "delivered",       250.00, "paypal"),
        ("ORD-1004", "CUST-004", d(15), d(12), "delivered",       180.00, "credit_card"),
        ("ORD-1005", "CUST-005", d(20), d(16), "delivered",        95.00, "credit_card"),
        ("ORD-1006", "CUST-006", d(7),  d(3),  "delivered",        65.00, "debit_card"),
        ("ORD-1007", "CUST-007", d(14), d(10), "delivered",       899.00, "credit_card"),
        ("ORD-1008", "CUST-008", d(4),  d(4),  "delivered",        49.00, "paypal"),
        ("ORD-1009", "CUST-009", d(14), None,  "lost_in_transit", 110.00, "credit_card"),
        ("ORD-1010", "CUST-010", d(45), d(38), "delivered",       320.00, "credit_card"),
        ("ORD-1011", "CUST-011", d(10), d(6),  "delivered",        40.00, "debit_card"),
        ("ORD-1012", "CUST-012", d(18), d(14), "delivered",       150.00, "credit_card"),
        ("ORD-1013", "CUST-013", d(30), d(25), "delivered",        75.00, "credit_card"),
        ("ORD-1014", "CUST-014", d(3),  d(1),  "delivered",       140.00, "credit_card"),
        ("ORD-1015", "CUST-015", d(10), d(7),  "delivered",       210.00, "credit_card"),
    ]

    items_data = [
        # (ItemID, OrderID, Name, Category, Price, is_final_sale)
        ("ITEM-101", "ORD-1001", "Waterproof Winter Jacket", "Apparel",      120.00, 0),
        ("ITEM-102", "ORD-1002", "RGB Mechanical Keyboard",  "Electronics",   85.00, 0),
        ("ITEM-103", "ORD-1003", "Fitness Smart Watch",       "Electronics",  250.00, 0),
        ("ITEM-104", "ORD-1004", "Noise-Cancelling Earbuds", "Electronics",  180.00, 0),
        ("ITEM-105", "ORD-1005", "Clearance Trail Runners",   "Footwear",      95.00, 1), # Final Sale!
        ("ITEM-106", "ORD-1006", "Sonic Electric Toothbrush", "Hygiene",       65.00, 0), # Hygiene!
        ("ITEM-107", "ORD-1007", "34-inch Curved OLED Display","Electronics", 899.00, 0), # > $500!
        ("ITEM-108", "ORD-1008", "Antivirus Suite License",   "Digital",       49.00, 0), # Digital!
        ("ITEM-109", "ORD-1009", "Pro Road Running Shoes",    "Footwear",     110.00, 0), # Lost!
        ("ITEM-110", "ORD-1010", "Italian Leather Handbag",   "Accessories",  320.00, 0),
        ("ITEM-111", "ORD-1011", "Wireless Optical Mouse",    "Electronics",   40.00, 0),
        ("ITEM-112", "ORD-1012", "Monogrammed Leather Wallet","Personalized", 150.00, 0), # Custom!
        ("ITEM-113", "ORD-1013", "Desk Ergonomic Lamp",       "Home",          75.00, 0),
        ("ITEM-114", "ORD-1014", "Ceramic Dinnerware Set",    "Kitchen",      140.00, 0), # DOA!
        ("ITEM-115", "ORD-1015", "Merino Wool Sweater",       "Apparel",       90.00, 0), # Multi-item 1
        ("ITEM-116", "ORD-1015", "Cotton Canvas Chinos",      "Apparel",       70.00, 0), # Multi-item 2
        ("ITEM-117", "ORD-1015", "Leather Belt",              "Accessories",   50.00, 0), # Multi-item 3
    ]

    cursor.executemany("INSERT INTO customers VALUES (?,?,?,?,?,?,?)", customers_data)
    cursor.executemany("INSERT INTO orders VALUES (?,?,?,?,?,?,?)", orders_data)
    cursor.executemany("INSERT INTO order_items VALUES (?,?,?,?,?,?)", items_data)

    conn.commit()
    conn.close()
    print(f"✅ CRM Database initialized at '{DB_PATH}' with 15 customer profiles.")

if __name__ == "__main__":
    init_db()