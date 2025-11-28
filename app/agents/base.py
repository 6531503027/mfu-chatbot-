# app/agents.py
"""
Multi-Agent components for MFU RAG (Gemini + Chroma)
"""

from __future__ import annotations
from dataclasses import dataclass
from typing import List, Optional, Dict, Any, Tuple, Protocol

from sentence_transformers import util


# ---------- Shared Types ----------

@dataclass
class AgentState:
    question: str
    rewritten: str = ""
    intent: str = "general"
    intent_keywords: List[str] = None
    contexts: List[str] = None
    answer: str = ""
    followups: str = ""
    debug: Dict[str, Any] = None

    def __post_init__(self):
        if self.intent_keywords is None:
            self.intent_keywords = []
        if self.contexts is None:
            self.contexts = []
        if self.debug is None:
            self.debug = {}


class Agent(Protocol):
    name: str
    def run(self, state: AgentState) -> AgentState: ...


# ---------- Gemini helper injected from rag.py/router.py ----------

class GeminiCaller(Protocol):
    def __call__(self, prompt: str, max_tokens: int) -> str: ...


# ---------- Agents ----------

class QueryRewriterAgent:
    name = "QueryRewriterAgent"

    def __init__(self, call_gemini: GeminiCaller):
        self.call_gemini = call_gemini

    def run(self, state: AgentState) -> AgentState:
        prompt = f"""
คุณเป็นผู้ช่วยปรับคำถามของนักศึกษา MFU
จงเขียนคำถามใหม่ให้ “ชัดเจนและเป็นทางการขึ้น”
- ตัดคำฟุ่มเฟือย/ภาษาพูด
- คงความหมายเดิม
- 1 ประโยคสั้น ๆ

คำถามเดิม: {state.question}

คำถามใหม่:
"""
        rewritten = self.call_gemini(prompt, max_tokens=60).strip()
        state.rewritten = rewritten if rewritten else state.question
        state.debug["rewritten"] = state.rewritten
        return state


class IntentClassifierAgent:
    name = "IntentClassifierAgent"

    def __init__(self, call_gemini: GeminiCaller):
        self.call_gemini = call_gemini

    def run(self, state: AgentState) -> AgentState:
        prompt = f"""
จัดประเภท intent ของคำถามนักศึกษา MFU ให้เลือก 1 หมวดเท่านั้น:
- dress_code
- registration_calendar
- scholarship
- dormitory
- academics
- fees
- activities
- administration
- general

คำถาม: {state.rewritten or state.question}

ตอบเป็นหมวดเดียว (ตัวพิมพ์เล็ก):
"""
        intent = self.call_gemini(prompt, max_tokens=20).strip().lower()
        if intent not in {
            "dress_code","registration_calendar","scholarship","dormitory",
            "academics","fees","activities","administration","general"
        }:
            intent = "general"
        state.intent = intent

        # keyword boost พื้นฐานตาม intent
        mapping = {
            "dress_code": ["ระเบียบ", "แต่งกาย", "เครื่องแบบ"],
            "registration_calendar": ["ปฏิทิน", "ลงทะเบียน", "เพิ่มถอน"],
            "scholarship": ["ทุน", "scholarship", "กยศ"],
            "dormitory": ["หอพัก", "หอใน", "หอนอก"],
            "fees": ["ค่าเทอม", "ค่าธรรมเนียม"],
            "activities": ["กิจกรรม", "ชมรม", "อีเวนต์"],
            "administration": ["สำนัก", "งานทะเบียน", "กองกิจการ"],
        }
        state.intent_keywords = mapping.get(intent, [])
        state.debug["intent"] = state.intent
        state.debug["intent_keywords"] = state.intent_keywords
        return state


class RetrieverAgent:
    name = "RetrieverAgent"

    def __init__(self, collection, embedder, top_k=10, keep=4, threshold=0.32):
        self.collection = collection
        self.embedder = embedder
        self.top_k = top_k
        self.keep = keep
        self.threshold = threshold

    def run(self, state: AgentState) -> AgentState:
        q = state.rewritten or state.question
        if state.intent_keywords:
            q = q + " " + " ".join(state.intent_keywords)

        total = self.collection.count()
        if total == 0:
            state.contexts = []
            return state

        k = min(self.top_k, total)
        q_emb = self.embedder.encode([q])[0].tolist()
        res = self.collection.query(query_embeddings=[q_emb], n_results=k)
        docs = (res.get("documents") or [[]])[0] or []
        if not docs:
            state.contexts = []
            return state

        # rerank
        q_vec = self.embedder.encode(q)
        doc_vecs = self.embedder.encode(docs)
        scores = util.cos_sim(q_vec, doc_vecs)[0].tolist()
        scored = sorted(zip(scores, docs), key=lambda x: x[0], reverse=True)
        filtered = [d for s, d in scored if s >= self.threshold][: self.keep]

        state.contexts = filtered
        state.debug["contexts_count"] = len(filtered)
        return state


class AnswerAgent:
    name = "AnswerAgent"

    def __init__(self, call_gemini: GeminiCaller, max_tokens=220):
        self.call_gemini = call_gemini
        self.max_tokens = max_tokens

    def run(self, state: AgentState) -> AgentState:
        if not state.contexts:
            state.answer = "ไม่พบข้อมูลในระบบ กรุณาติดต่อเจ้าหน้าที่มหาวิทยาลัย"
            return state

        context_text = "\n\n---\n\n".join(state.contexts)
        system = (
            "คุณเป็นผู้ช่วยนักศึกษามหาวิทยาลัยแม่ฟ้าหลวง (MFU)\n"
            "ตอบคำถามให้ตรงที่สุด โดยใช้เฉพาะข้อมูลใน CONTEXT เท่านั้น\n"
            "\n"
            "กฎสำคัญ:\n"
            "1. ห้ามเดาหรือเพิ่มข้อมูลนอก CONTEXT\n"
            "2. ถ้ามีหลายหัวข้อ ให้จัดเป็นข้อ ๆ (ใช้ - หรือ 1. 2. 3.)\n"
            "3. สรุปแต่ละหัวข้อสั้น ๆ ไม่ซ้ำซ้อน\n"
            "4. ถ้า CONTEXT ไม่ได้ตอบคำถาม ให้ตอบ: \"ไม่พบข้อมูลในระบบ กรุณาติดต่อเจ้าหน้าที่มหาวิทยาลัย\"\n"
            "\n"
            "รูปแบบคำตอบ:\n"
            "- ถ้ามีหัวข้อเดียว: ตอบสั้น ๆ 1-2 ประโยค\n"
            "- ถ้ามีหลายหัวข้อ: จัดเป็นข้อ ๆ\n"
        )
        prompt = f"""{system}

[CONTEXT]
{context_text}

[คำถาม]
{state.rewritten or state.question}

[คำตอบ]
"""
        ans = self.call_gemini(prompt, max_tokens=self.max_tokens).strip()

        if not ans or "ไม่พบข้อมูลในระบบ" in ans:
            ans = "ไม่พบข้อมูลในระบบ กรุณาติดต่อเจ้าหน้าที่มหาวิทยาลัย"

        state.answer = ans
        return state


class FollowupAgent:
    name = "FollowupAgent"

    def __init__(self, call_gemini: GeminiCaller, max_tokens=120):
        self.call_gemini = call_gemini
        self.max_tokens = max_tokens

    def run(self, state: AgentState) -> AgentState:
        if not state.contexts or not state.answer:
            return state

        context_text = "\n\n---\n\n".join(state.contexts)
        prompt = f"""
คุณเป็นผู้ช่วยแนะนำคำถามต่อเนื่องสำหรับนักศึกษา MFU
สร้างคำถามถัดไป 2–3 ข้อที่เกี่ยวข้องกับ CONTEXT เท่านั้น
สั้น ๆ เป็น bullet

[CONTEXT]
{context_text}

[คำถามเดิม]
{state.rewritten or state.question}

[คำตอบเดิม]
{state.answer}

[คำถามถัดไป]
- 
"""
        fup = self.call_gemini(prompt, max_tokens=self.max_tokens).strip()
        state.followups = fup
        return state


class MemoryAgent:
    """
    ตัวอย่าง skeleton: เอาไว้ log FAQ / คำถามบ่อย
    (คุณค่อยผูก DB จริงใน router ได้)
    """
    name = "MemoryAgent"

    def __init__(self, save_fn=None):
        self.save_fn = save_fn

    def run(self, state: AgentState) -> AgentState:
        if self.save_fn:
            try:
                self.save_fn(
                    question=state.question,
                    rewritten=state.rewritten,
                    intent=state.intent,
                    answer=state.answer
                )
            except Exception as e:
                state.debug["memory_error"] = str(e)
        return state
