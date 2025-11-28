# app/studentlife_agent.py
from app.services.rag import generate_answer


class StudentLifeAgent:
    """ตอบคำถามเกี่ยวกับทุนการศึกษา หอพัก และบริการนักศึกษา"""

    def answer(self, question: str) -> str:
        q = "คำถามด้านทุนการศึกษา/หอพัก/บริการนักศึกษา: " + (question or "").strip()
        result = generate_answer(q)
        if isinstance(result, dict):
            return (result.get("answer") or "").strip()
        return str(result).strip()
