from crm_service import CRMService
from policy_engine import PolicyEngine

def test_scenarios():
    print("==================================================")
    print("      RUNNING DETERMINISTIC POLICY TESTS          ")
    print("==================================================")

    # 1. TEST SCENARIO 1: Alice Johnson (Clean Happy Path)
    alice = CRMService.get_customer("CUST-001")
    ord_alice = CRMService.get_order("ORD-1001")
    item_alice = ord_alice["items"][0]
    res1 = PolicyEngine.evaluate(alice, ord_alice, item_alice, item_condition="unopened", reason="not_needed")
    print("\n[Scenario 1: Alice - Clean Refund]")
    print(f"Decision: {res1['decision']} | Eligible: {res1['eligible']} | Refund: ${res1['refund_amount']}")
    assert res1["decision"] == "APPROVE"
    assert res1["refund_amount"] == 120.00
    print("✅ Passed: Alice approved for 100% refund.")

    # 2. TEST SCENARIO 2: Bob Smith (Expired > 30 Days)
    bob = CRMService.get_customer("CUST-002")
    ord_bob = CRMService.get_order("ORD-1002")
    item_bob = ord_bob["items"][0]
    res2 = PolicyEngine.evaluate(bob, ord_bob, item_bob, item_condition="unopened", reason="defective")
    print("\n[Scenario 2: Bob - Window Expired (44 Days)]")
    print(f"Decision: {res2['decision']} | Eligible: {res2['eligible']} | Violations: {res2['violations']}")
    assert res2["decision"] == "DENY"
    assert "WINDOW_EXPIRED" in res2["violations"][0]
    print("✅ Passed: Bob denied due to 30-day window cutoff.")

    # 3. TEST SCENARIO 3: Charlie Brown (High Risk & Frequency Abuse)
    charlie = CRMService.get_customer("CUST-003")
    ord_charlie = CRMService.get_order("ORD-1003")
    item_charlie = ord_charlie["items"][0]
    res3 = PolicyEngine.evaluate(charlie, ord_charlie, item_charlie, item_condition="unopened", reason="changed_mind")
    print("\n[Scenario 3: Charlie - High Risk Score & Abuse Lock]")
    print(f"Decision: {res3['decision']} | Eligible: {res3['eligible']} | Violations: {res3['violations']}")
    assert res3["decision"] == "ESCALATE"
    print("✅ Passed: Charlie escalated to supervisor due to fraud limits.")

    # 4. TEST SCENARIO 4: Diana Prince (Opened Box - 15% Restocking Fee)
    diana = CRMService.get_customer("CUST-004")
    ord_diana = CRMService.get_order("ORD-1004")
    item_diana = ord_diana["items"][0]
    res4 = PolicyEngine.evaluate(diana, ord_diana, item_diana, item_condition="opened_like_new", reason="not_fitting")
    print("\n[Scenario 4: Diana - Opened Item Restock Fee]")
    print(f"Decision: {res4['decision']} | Fee: ${res4['deduction_fee']} | Refund: ${res4['refund_amount']} | Credit Alt: ${res4['store_credit_alternative']}")
    assert res4["decision"] == "APPROVE_WITH_FEE"
    assert res4["refund_amount"] == 153.00 # $180 - $27 (15%)
    print("✅ Passed: Diana approved with 15% restocking deduction.")

    # 5. TEST SCENARIO 5: Evan Wright (Final Sale Clearance Item)
    evan = CRMService.get_customer("CUST-005")
    ord_evan = CRMService.get_order("ORD-1005")
    item_evan = ord_evan["items"][0]
    res5 = PolicyEngine.evaluate(evan, ord_evan, item_evan, item_condition="unopened", reason="too_small")
    print("\n[Scenario 5: Evan - Final Sale Exclusion]")
    print(f"Decision: {res5['decision']} | Violations: {res5['violations']}")
    assert res5["decision"] == "DENY"
    print("✅ Passed: Evan denied under Section 3.3 Final Sale exclusion.")

    print("\n==================================================")
    print("       ALL 5 POLICY TEST SUITES PASSED!           ")
    print("==================================================")

if __name__ == "__main__":
    test_scenarios()