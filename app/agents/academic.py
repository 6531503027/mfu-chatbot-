# app/academic_agent.py
from app.services.rag import generate_answer


class AcademicAgent:
    """ตอบคำถามด้านการเรียน/ลงทะเบียน/ปฏิทินการศึกษา"""

    def answer(self, question: str) -> str:
        q = "คำถามด้านการเรียน/ลงทะเบียน/ปฏิทินการศึกษา: " + (question or "").strip()
        result = generate_answer(q)
        if isinstance(result, dict):
            return (result.get("answer") or "").strip()
        return str(result).strip()
