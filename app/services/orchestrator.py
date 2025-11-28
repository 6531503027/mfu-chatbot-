# app/orchestrator.py
from sqlalchemy.orm import Session

from app.services.rag import _get_router, generate_answer, embedder  # ใช้ของจาก rag.py
from app.models.sql import QuestionLog
from app.agents.faq import FaqAgent
from app.agents.answer_styler import AnswerStylerAgent
from app.agents.academic import AcademicAgent
from app.agents.regulation import RegulationAgent
from app.agents.studentlife import StudentLifeAgent
from app.agents.suggestion import SuggestionAgent
from app.agents.capabilities import CapabilitiesAgent

academic_agent = AcademicAgent()
reg_agent = RegulationAgent()
life_agent = StudentLifeAgent()

faq_agent = FaqAgent(embedder=embedder, threshold=0.85)
answer_agent = AnswerStylerAgent()
suggest_agent = SuggestionAgent(embedder=embedder)
cap_agent = CapabilitiesAgent()


def run_pipeline(question: str, db: Session):
    """Multi-agent pipeline หลักของระบบแชทบอท"""

    # 0) Router – ใช้ LLM จำแนก intent
    router = _get_router()
    if router:
        route_result = router.route(question)
        intent = route_result.intent
        meta = {
            "intent": intent,
            "route": route_result.route,
            "confidence": route_result.confidence,
        }
    else:
        intent = "general"
        meta = {"intent": "general", "route": "fallback", "confidence": 0.0}

    # 1) ลองหา FAQ ก่อน
    faq = faq_agent.find_best_faq(question, db)
    if faq:
        faq_agent.update_hit(faq, db)
        answer = faq.answer
        meta["source"] = "faq"
    else:
        # 2) เลือก agent ตาม intent
        meta["source"] = "rag"

        if intent == "academic":
            answer = academic_agent.answer(question)
        elif intent == "regulation":
            answer = reg_agent.answer(question)
        elif intent == "capabilities":
            answer = cap_agent.answer(db)
        elif intent in ("scholarship", "dorm", "contact", "general_rag"):
            answer = life_agent.answer(question)
        else:
            # default → เรียก RAG ตรง ๆ
            result = generate_answer(question)
            if isinstance(result, dict):
                answer = (result.get("answer") or "").strip()
                meta["rag_next_topics"] = result.get("next_topics", [])
            else:
                answer = str(result).strip()

        # 3) ถ้าคำถามเดียวกันถูกถามบ่อย → auto สร้าง FAQ
        try:
            count = (
                db.query(QuestionLog)
                .filter(QuestionLog.question == question)
                .count()
            )
            if count >= 5 and "ไม่พบข้อมูล" not in answer:
                faq_agent.register_faq(question, answer, db)
                meta["faq_auto_created"] = True
        except Exception as e:
            meta["faq_auto_error"] = str(e)

    # 4) แนะนำหัวข้อคำถามถัดไปจาก QuestionLog
    try:
        next_topics = suggest_agent.suggest_next_topics(question, db, limit=3)
    except Exception as e:
        print("[ORCH][WARN] SuggestionAgent failed:", e, flush=True)
        next_topics = []
    meta["next_topics"] = next_topics

    # 5) ปรับสไตล์คำตอบให้เหมือน ChatGPT
    answer = answer_agent.style(answer)

    return answer, meta
