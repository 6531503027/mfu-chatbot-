# app/agents/regulation_agent.py
from app.services.rag import generate_answer

class RegulationAgent:
    def answer(self, question: str) -> str:
        # เพิ่ม prefix เพื่อโฟกัส intent ด้านกฎ/ระเบียบ
        q = "คำถามด้านระเบียบ/กฎ/แต่งกาย/วินัยนักศึกษา: " + question.strip()

        result = generate_answer(q)

        # generate_answer() อาจคืน dict หรือ str
        if isinstance(result, dict):
            return result.get("answer", "").strip()
        return str(result).strip()
