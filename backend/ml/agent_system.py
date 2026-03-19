"""
agent_system.py
─────────────────────────────────────────────────────────────
Stage 13: Agentic AI – Rule-based + LLM-driven action engine
─────────────────────────────────────────────────────────────
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Dict, List, Optional

import pandas as pd

logger = logging.getLogger(__name__)


@dataclass
class AgentAction:
    customer_id: str
    action_type: str
    priority: str          # "Critical" | "High" | "Medium" | "Low"
    trigger_reason: str
    recommended_offer: str
    estimated_impact: str
    churn_probability: float


OFFER_MAP = {
    "Critical": {
        "offer": "50% cashback on next recharge + Free data for 7 days",
        "impact": "Estimated 35-45% churn reduction",
    },
    "High": {
        "offer": "25% bonus on next recharge + Loyalty points",
        "impact": "Estimated 20-30% churn reduction",
    },
    "Medium": {
        "offer": "Personalised recharge plan + Weekend double data",
        "impact": "Estimated 10-20% churn reduction",
    },
    "Low": {
        "offer": "Monthly newsletter + Small loyalty reward",
        "impact": "Estimated 5-10% churn reduction",
    },
}


class AgentSystem:
    def __init__(self, rag_pipeline=None):
        self.rag = rag_pipeline
        self.actions: List[AgentAction] = []

    def evaluate(self, df: pd.DataFrame) -> List[AgentAction]:
        """Apply rule-based triggers to generate agent actions."""
        self.actions = []

        for _, row in df.iterrows():
            churn_prob = float(row.get("churn_probability", row.get("churn", 0)))
            risk = _get_risk_level(churn_prob)

            if churn_prob < 0.3:
                continue  # No action for low risk

            reasons = _derive_reasons(row)
            offer_info = OFFER_MAP.get(risk, OFFER_MAP["Low"])

            self.actions.append(
                AgentAction(
                    customer_id=str(row["Customer_id"]),
                    action_type=_action_type(risk),
                    priority=risk,
                    trigger_reason="; ".join(reasons),
                    recommended_offer=offer_info["offer"],
                    estimated_impact=offer_info["impact"],
                    churn_probability=round(churn_prob, 4),
                )
            )

        logger.info(f"Agent generated {len(self.actions)} actions")
        return self.actions

    def get_summary(self) -> Dict:
        if not self.actions:
            return {}
        counts = {}
        for a in self.actions:
            counts[a.priority] = counts.get(a.priority, 0) + 1
        total_at_risk = len(self.actions)
        critical = counts.get("Critical", 0)
        return {
            "total_actions": total_at_risk,
            "critical": critical,
            "high": counts.get("High", 0),
            "medium": counts.get("Medium", 0),
            "low": counts.get("Low", 0),
            "retention_campaigns_triggered": critical,
            "personalized_offers_queued": total_at_risk - critical,
        }

    def to_records(self, limit: int = 100) -> List[Dict]:
        sorted_actions = sorted(
            self.actions, key=lambda x: x.churn_probability, reverse=True
        )
        return [
            {
                "customer_id": a.customer_id,
                "action_type": a.action_type,
                "priority": a.priority,
                "trigger_reason": a.trigger_reason,
                "recommended_offer": a.recommended_offer,
                "estimated_impact": a.estimated_impact,
                "churn_probability": a.churn_probability,
            }
            for a in sorted_actions[:limit]
        ]


# ─── Helpers ───────────────────────────────────────────────

def _get_risk_level(prob: float) -> str:
    if prob >= 0.8:
        return "Critical"
    if prob >= 0.6:
        return "High"
    if prob >= 0.4:
        return "Medium"
    return "Low"


def _action_type(risk: str) -> str:
    return {
        "Critical": "Immediate Retention Campaign",
        "High": "Targeted Offer Dispatch",
        "Medium": "Personalised Engagement",
        "Low": "Loyalty Nudge",
    }.get(risk, "Monitor")


def _derive_reasons(row) -> List[str]:
    reasons = []
    if float(row.get("days_since_last_recharge", 0)) > 45:
        reasons.append("No recharge for 45+ days")
    if float(row.get("recharge_frequency", 99)) < 3:
        reasons.append("Low recharge frequency")
    if float(row.get("engagement_score", 1)) < 0.3:
        reasons.append("Low engagement score")
    if float(row.get("recharge_ratio", 1)) < 0.2:
        reasons.append("Declining recharge trend")
    if float(row.get("active_days_30d", 30)) < 5:
        reasons.append("Very few active days")
    if not reasons:
        reasons.append("High churn probability from ML model")
    return reasons
