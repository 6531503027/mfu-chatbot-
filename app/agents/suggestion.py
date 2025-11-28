# app/suggestion_agent.py
from typing import List
from sqlalchemy.orm import Session
from sqlalchemy import func
from sentence_transformers import SentenceTransformer, util

from app.models.sql import QuestionLog


class SuggestionAgent:
    def __init__(self, embedder: SentenceTransformer):
        self.embedder = embedder

    def suggest_next_topics(self, question: str, db: Session, limit: int = 3) -> List[str]:
        """แนะนำหัวข้อคำถามถัดไปจาก QuestionLog โดยใช้ semantic similarity"""
        q = (question or "").strip()
        if not q:
            return []

        # เอาคำถามยอดนิยม 200 อันดับก่อน
        rows = (
            db.query(QuestionLog.question, func.count(QuestionLog.id).label("cnt"))
            .group_by(QuestionLog.question)
            .order_by(func.count(QuestionLog.id).desc())
            .limit(200)
            .all()
        )

        pool = [text for (text, cnt) in rows if (text or "").strip()]
        if not pool:
            return []

        # สร้าง vector
        q_vec = self.embedder.encode(q)
        pool_vecs = self.embedder.encode(pool)

        # คำนวณ cosine similarity
        scores = util.cos_sim(q_vec, pool_vecs)[0].tolist()
        scored = list(zip(scores, pool))  # (score, question_text)

        # เอา top similarity ที่ไม่ใช่คำถามเดิม และไม่ซ้ำกัน
        scored.sort(key=lambda x: x[0], reverse=True)
        out: List[str] = []
        for score, text in scored:
            t = text.strip()
            if not t or t == q:
                continue
            if t in out:
                continue
            out.append(t)
            if len(out) >= limit:
                break

        return out
