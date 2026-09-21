from datetime import datetime
from typing import TypedDict, Literal

class AuditChecklist(TypedDict):
    window_valid: bool
    category_allowed: bool
    condition_allowed: bool
    fraud_check_passed: bool
    under_high_value_cap: bool

class PolicyEvaluationResult(TypedDict):
    eligible: bool
    decision: Literal["APPROVE", "APPROVE_WITH_FEE", "DENY", "ESCALATE"]
    refund_amount: float
    original_price: float
    deduction_fee: float
    store_credit_alternative: float
    violations: list[str]
    audit_checklist: AuditChecklist
    explanation: str

class PolicyEngine:
    POLICY_VERSION = "POL-2025-REV4"
    MAX_RETURN_WINDOW_DAYS = 30
    RESTOCKING_FEE_PERCENT = 0.15
    MAX_FRAUD_RISK_SCORE = 0.70
    MAX_RETURNS_LAST_90_DAYS = 3
    HIGH_VALUE_THRESHOLD = 500.00

    @classmethod
    def evaluate(
        cls,
        customer: dict,
        order: dict,
        item: dict,
        item_condition: str,  # 'unopened' | 'opened_like_new' | 'damaged'
        reason: str           # e.g., 'defective', 'not_needed', 'doa', 'lost'
    ) -> PolicyEvaluationResult:
        """
        Deterministically evaluates whether an item in an order can be refunded.
        Strictly enforces all clauses of POL-2025-REV4.
        """
        violations = []
        original_price = float(item["price"])
        item_condition = item_condition.lower().strip()
        reason = reason.lower().strip()

        # -------------------------------------------------------------
        # 1. FRAUD & ABUSE CHECKS (Section 4)
        # -------------------------------------------------------------
        fraud_risk = float(customer.get("fraud_risk_score", 0.0))
        returns_90d = int(customer.get("refunds_last_90_days", 0))
        is_flagged = bool(customer.get("is_flagged", 0))

        fraud_passed = True
        if fraud_risk >= cls.MAX_FRAUD_RISK_SCORE or is_flagged:
            violations.append(f"FRAUD_RISK_THRESHOLD: Customer risk score ({fraud_risk:.2f}) >= {cls.MAX_FRAUD_RISK_SCORE} (Sec 4.1)")
            fraud_passed = False

        if returns_90d >= cls.MAX_RETURNS_LAST_90_DAYS:
            violations.append(f"RETURN_FREQUENCY_LOCK: Account has {returns_90d} returns in 90 days, limit is {cls.MAX_RETURNS_LAST_90_DAYS} (Sec 4.2)")
            fraud_passed = False

        if not fraud_passed:
            return cls._build_result(
                eligible=False,
                decision="ESCALATE",
                original_price=original_price,
                refund_amount=0.0,
                deduction=0.0,
                violations=violations,
                checklist=AuditChecklist(
                    window_valid=True,
                    category_allowed=True,
                    condition_allowed=True,
                    fraud_check_passed=False,
                    under_high_value_cap=original_price <= cls.HIGH_VALUE_THRESHOLD
                ),
                explanation="Account flagged under Section 4 Fraud & Abuse Guardrails. Automated processing blocked. Case escalated to human supervisor."
            )

        # -------------------------------------------------------------
        # 2. HIGH VALUE CAP CHECK (Section 4.3)
        # -------------------------------------------------------------
        under_high_value_cap = original_price <= cls.HIGH_VALUE_THRESHOLD
        if not under_high_value_cap:
            violations.append(f"HIGH_VALUE_CAP: Item price (${original_price:.2f}) exceeds auto-approval limit of ${cls.HIGH_VALUE_THRESHOLD:.2f} (Sec 4.3)")
            return cls._build_result(
                eligible=False,
                decision="ESCALATE",
                original_price=original_price,
                refund_amount=0.0,
                deduction=0.0,
                violations=violations,
                checklist=AuditChecklist(
                    window_valid=True,
                    category_allowed=True,
                    condition_allowed=True,
                    fraud_check_passed=True,
                    under_high_value_cap=False
                ),
                explanation=f"Item value (${original_price:.2f}) exceeds the ${cls.HIGH_VALUE_THRESHOLD:.2f} threshold. Supervisor authorization required."
            )

        # -------------------------------------------------------------
        # 3. SPECIAL CIRCUMSTANCES: LOST IN TRANSIT (Section 5.1)
        # -------------------------------------------------------------
        if order.get("status") == "lost_in_transit" or reason == "lost":
            return cls._build_result(
                eligible=True,
                decision="APPROVE",
                original_price=original_price,
                refund_amount=original_price,
                deduction=0.0,
                violations=[],
                checklist=AuditChecklist(
                    window_valid=True,
                    category_allowed=True,
                    condition_allowed=True,
                    fraud_check_passed=True,
                    under_high_value_cap=True
                ),
                explanation="Package verified lost in transit under Section 5.1. 100% refund approved."
            )

        # -------------------------------------------------------------
        # 4. TIME WINDOW CHECK (Section 1)
        # -------------------------------------------------------------
        delivery_date_str = order.get("delivery_date")
        if not delivery_date_str:
            delivery_date_str = order.get("order_date")

        delivery_date = datetime.strptime(delivery_date_str, "%Y-%m-%d")
        days_elapsed = (datetime.now() - delivery_date).days
        window_valid = days_elapsed <= cls.MAX_RETURN_WINDOW_DAYS

        if not window_valid:
            violations.append(f"WINDOW_EXPIRED: Request made {days_elapsed} days after delivery. Maximum allowed is {cls.MAX_RETURN_WINDOW_DAYS} days (Sec 1.1)")
            return cls._build_result(
                eligible=False,
                decision="DENY",
                original_price=original_price,
                refund_amount=0.0,
                deduction=0.0,
                violations=violations,
                checklist=AuditChecklist(
                    window_valid=False,
                    category_allowed=True,
                    condition_allowed=True,
                    fraud_check_passed=True,
                    under_high_value_cap=True
                ),
                explanation=f"Refund request initiated {days_elapsed} days post-delivery, exceeding the strict 30-day window under Section 1.1."
            )

        # -------------------------------------------------------------
        # 5. CATEGORY EXCLUSIONS (Section 3)
        # -------------------------------------------------------------
        category = item.get("category", "").title()
        is_final_sale = bool(item.get("is_final_sale", 0))

        category_allowed = True
        if is_final_sale:
            violations.append("FINAL_SALE_ITEM: Clearance item discounted >=50% marked Final Sale (Sec 3.3)")
            category_allowed = False

        if category == "Digital":
            violations.append("DIGITAL_GOOD_EXCLUSION: Software licenses, keys, and digital downloads cannot be refunded (Sec 3.1)")
            category_allowed = False

        if category == "Personalized":
            violations.append("CUSTOM_GOOD_EXCLUSION: Monogrammed or personalized goods are non-refundable (Sec 3.4)")
            category_allowed = False

        if category == "Hygiene" and item_condition != "unopened":
            violations.append("HYGIENE_UNSEALED: Personal hygiene and health items cannot be refunded once packaging is opened (Sec 3.2)")
            category_allowed = False

        if not category_allowed:
            return cls._build_result(
                eligible=False,
                decision="DENY",
                original_price=original_price,
                refund_amount=0.0,
                deduction=0.0,
                violations=violations,
                checklist=AuditChecklist(
                    window_valid=True,
                    category_allowed=False,
                    condition_allowed=True,
                    fraud_check_passed=True,
                    under_high_value_cap=True
                ),
                explanation=f"Item is excluded from refunds under Section 3: {violations[0]}"
            )

        # -------------------------------------------------------------
        # 6. PRODUCT CONDITION & DEDUCTIONS (Section 2 & 5.2 DOA)
        # -------------------------------------------------------------
        # Check Damaged on Arrival (DOA) within 72 hours (3 days)
        if reason in ["doa", "damaged_on_arrival"] and days_elapsed <= 3:
            return cls._build_result(
                eligible=True,
                decision="APPROVE",
                original_price=original_price,
                refund_amount=original_price,
                deduction=0.0,
                violations=[],
                checklist=AuditChecklist(
                    window_valid=True,
                    category_allowed=True,
                    condition_allowed=True,
                    fraud_check_passed=True,
                    under_high_value_cap=True
                ),
                explanation="Damaged on Arrival (DOA) confirmed within 72 hours under Section 5.2. 100% full refund approved."
            )

        if item_condition in ["unopened", "sealed", "new"]:
            # 100% Refund
            return cls._build_result(
                eligible=True,
                decision="APPROVE",
                original_price=original_price,
                refund_amount=original_price,
                deduction=0.0,
                violations=[],
                checklist=AuditChecklist(
                    window_valid=True,
                    category_allowed=True,
                    condition_allowed=True,
                    fraud_check_passed=True,
                    under_high_value_cap=True
                ),
                explanation="Item is unopened and inside the 30-day window. 100% full refund approved (Sec 2.1)."
            )

        elif item_condition in ["opened", "opened_like_new", "like_new"]:
            # 15% Restocking Fee OR 100% Store Credit
            deduction = round(original_price * cls.RESTOCKING_FEE_PERCENT, 2)
            final_refund = round(original_price - deduction, 2)
            return cls._build_result(
                eligible=True,
                decision="APPROVE_WITH_FEE",
                original_price=original_price,
                refund_amount=final_refund,
                deduction=deduction,
                violations=[],
                checklist=AuditChecklist(
                    window_valid=True,
                    category_allowed=True,
                    condition_allowed=True,
                    fraud_check_passed=True,
                    under_high_value_cap=True
                ),
                explanation=f"Item is opened. Eligible for refund of ${final_refund:.2f} (15% restocking fee of ${deduction:.2f} deducted) OR 100% store credit of ${original_price:.2f} (Sec 2.2)."
            )

        else:
            # Damaged / Heavily used
            violations.append("DAMAGED_CONDITION: Item is damaged/heavily used and does not qualify as DOA within 72h (Sec 2.3)")
            return cls._build_result(
                eligible=False,
                decision="DENY",
                original_price=original_price,
                refund_amount=0.0,
                deduction=0.0,
                violations=violations,
                checklist=AuditChecklist(
                    window_valid=True,
                    category_allowed=True,
                    condition_allowed=False,
                    fraud_check_passed=True,
                    under_high_value_cap=True
                ),
                explanation="Item condition does not meet return standards under Section 2.3."
            )

    @staticmethod
    def _build_result(eligible, decision, original_price, refund_amount, deduction, violations, checklist, explanation) -> PolicyEvaluationResult:
        return {
            "eligible": eligible,
            "decision": decision,
            "original_price": original_price,
            "refund_amount": refund_amount,
            "deduction_fee": deduction,
            "store_credit_alternative": original_price if decision == "APPROVE_WITH_FEE" else 0.0,
            "violations": violations,
            "audit_checklist": checklist,
            "explanation": explanation
        }