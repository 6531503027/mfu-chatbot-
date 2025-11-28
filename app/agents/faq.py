# app/agents/faq_agent.py
import json
from typing import Optional
from sqlalchemy.orm import Session
from sentence_transformers import SentenceTransformer, util

from app.models.sql import FaqEntry


class FaqAgent:
    """
    ใช้สำหรับ:
    - หา FAQ ที่คล้ายกับคำถาม (semantic match)
    - บันทึกคำถามที่ถามบ่อย พร้อม embedding
    """

    def __init__(self, embedder: SentenceTransformer, threshold: float = 0.85):
        self.embedder = embedder
        self.threshold = threshold

    # ------------------------------------------------------------
    # ใช้ตอน Multi-Agent Router → ตรวจว่าเป็น FAQ หรือไม่
    # ------------------------------------------------------------
    def find_best_faq(self, question: str, db: Session) -> Optional[FaqEntry]:
        faqs = db.query(FaqEntry).all()
        if not faqs:
            return None

        q_vec = self.embedder.encode(question)

        best = None
        best_score = 0.0

        for f in faqs:
            if not f.question_embedding:
                continue

            try:
                v = json.loads(f.question_embedding)
            except:
                continue

            score = float(util.cos_sim(q_vec, v).item())  # ← FIXED

            if score > best_score:
                best_score = score
                best = f

        if best and best_score >= self.threshold:
            return best
        return None

    # ------------------------------------------------------------
    # บันทึกคำถามใหม่เป็น FAQ (ต้องกรองก่อน)
    # ------------------------------------------------------------
    def register_faq(self, question: str, answer: str, db: Session):
        """
        บันทึกเฉพาะคำถามที่:
        - มีคำตอบจริง (ไม่ใช่ "ไม่พบข้อมูล")
        - ยาวพอ
        - ไม่มีอยู่แล้วในฐานข้อมูล
        """
        if len(question) < 8:
            return
        if "ไม่พบข้อมูล" in answer:
            return

        existing = db.query(FaqEntry).filter(FaqEntry.question == question).first()
        if existing:
            return

        vec = self.embedder.encode(question).tolist()

        new_faq = FaqEntry(
            question=question,
            answer=answer,
            question_embedding=json.dumps(vec),
            hits=1,
        )

        db.add(new_faq)
        db.commit()

    # ------------------------------------------------------------
    # ใช้ตอนตอบ FAQ → นับสถิติความนิยม
    # ------------------------------------------------------------
    def update_hit(self, faq: FaqEntry, db: Session):
        faq.hits += 1
        db.commit()

    # ------------------------------------------------------------
    # ใช้ใน Router → คืนคำตอบหรือ None
    # ------------------------------------------------------------
    def answer_or_none(self, question: str, db: Session) -> Optional[str]:
        best = self.find_best_faq(question, db)
        if best:
            self.update_hit(best, db)
            return best.answer
        return None
