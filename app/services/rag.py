# app/rag.py
"""
RAG Engine for MFU AI Assistant (Google GenAI SDK v1)

- Retrieval: ChromaDB + sentence-transformers
- Generation: Gemini via google-genai (รองรับ gemini-2.0-*)
- ตอบไทย, ตรงคำถาม, ไม่เดานอก context
- แนะนำหัวข้อถัดไป (next_topics) 2–3 ข้อ
- รองรับ Multi-Agent Router แบบ lazy import (กัน circular import)
"""

import os
import re
from typing import List, Dict, Any, Optional, Tuple, Union

from sentence_transformers import SentenceTransformer, util
from chromadb import PersistentClient
from chromadb.config import Settings

import logging
from google import genai
from google.genai.types import HttpOptions, GenerateContentConfig

logger = logging.getLogger(__name__)


# ============================================================
# CONFIG
# ============================================================

EMBED_MODEL_NAME = os.getenv(
    "EMBED_MODEL_NAME",
    "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2",
)
CHROMA_PATH = os.getenv("CHROMA_DIR", "data/chroma")

MAX_DOC_CHARS = int(os.getenv("MAX_DOC_CHARS", "200000"))
CHUNK_SIZE = int(os.getenv("CHUNK_SIZE", "600"))
CHUNK_OVERLAP = int(os.getenv("CHUNK_OVERLAP", "150"))
MAX_CHUNKS_PER_DOC = int(os.getenv("MAX_CHUNKS_PER_DOC", "2000"))

# retrieval tuning
TOP_K_RETRIEVE = int(os.getenv("TOP_K_RETRIEVE", "10"))
RERANK_KEEP = int(os.getenv("RERANK_KEEP", "4"))
SIM_THRESHOLD = float(os.getenv("SIM_THRESHOLD", "0.32"))

# generation tuning
MAX_OUTPUT_TOKENS = int(os.getenv("MAX_NEW_TOKENS", "220"))
TEMPERATURE = float(os.getenv("TEMPERATURE", "0.2"))

# Follow-ups
ENABLE_FOLLOWUPS = os.getenv("ENABLE_FOLLOWUPS", "1") == "1"
FOLLOWUPS_MAX_TOKENS = int(os.getenv("FOLLOWUPS_MAX_TOKENS", "120"))

# Multi-Agent
ENABLE_MULTI_AGENT = os.getenv("ENABLE_MULTI_AGENT", "1") == "1"

# Gemini
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GEMINI_MODEL_NAME = os.getenv("GEMINI_MODEL_NAME", "gemini-2.0-flash")

if not GEMINI_API_KEY:
    raise RuntimeError("GEMINI_API_KEY is not set in .env")


# ============================================================
# INIT EMBEDDING + CHROMA
# ============================================================

print("[RAG] Loading embedding model:", EMBED_MODEL_NAME, flush=True)
logger.info(f"[RAG] Loading embedding model: {EMBED_MODEL_NAME}")
embedder = SentenceTransformer(EMBED_MODEL_NAME)

logger.info(f"[RAG] Init ChromaDB at: {CHROMA_PATH}")
chroma = PersistentClient(
    path=CHROMA_PATH,
    settings=Settings(anonymized_telemetry=False),
)
collection = chroma.get_or_create_collection(
    name="uni_docs",
    metadata={"hnsw:space": "cosine"},
)

# ============================================================
# INIT GEMINI CLIENT (v1)
# ============================================================

logger.info(f"[RAG] Init Gemini client, model: {GEMINI_MODEL_NAME}")
client = genai.Client(
    api_key=GEMINI_API_KEY,
    http_options=HttpOptions(api_version="v1"),
)

# cache router singleton (lazy)
_router = None


# ============================================================
# TEXT UTILS
# ============================================================

def _normalize(text: str) -> str:
    return " ".join(text.split())


def _truncate(text: str, limit: int = MAX_DOC_CHARS) -> str:
    return text if len(text) <= limit else text[:limit]


def _split(text: str) -> List[str]:
    """
    Paragraph-aware split:
    - รวมย่อหน้าให้ได้ chunk ~ CHUNK_SIZE
    - กัน chunk หลายหัวข้อปนกัน
    """
    text = _normalize(_truncate(text))
    if not text:
        return []

    paras = [p.strip() for p in text.split("\n") if p.strip()]
    chunks: List[str] = []
    buf = ""
    count = 0

    for p in paras:
        if not buf:
            buf = p
            continue

        if len(buf) + 1 + len(p) <= CHUNK_SIZE:
            buf += "\n" + p
        else:
            chunks.append(_normalize(buf))
            buf = p
            count += 1

        if count >= MAX_CHUNKS_PER_DOC:
            break

    if buf and len(chunks) < MAX_CHUNKS_PER_DOC:
        chunks.append(_normalize(buf))

    return chunks


# ============================================================
# VECTOR STORE API
# ============================================================

def add_or_update_doc_to_vector(doc_id: str, content: str, metadata: dict):
    if not content:
        return

    chunks = _split(content)
    if not chunks:
        logger.warning(f"[RAG] No chunks for doc {doc_id}")
        return

    try:
        collection.delete(where={"doc_id": doc_id})
    except Exception:
        pass

    ids, docs, metas = [], [], []
    for i, ch in enumerate(chunks):
        ids.append(f"{doc_id}::{i}")
        docs.append(ch)
        m = dict(metadata or {})
        m["doc_id"] = doc_id
        m["chunk_index"] = i
        metas.append(m)

    embeds = embedder.encode(docs, show_progress_bar=False).tolist()

    collection.upsert(
        ids=ids,
        embeddings=embeds,
        documents=docs,
        metadatas=metas,
    )

    logger.info(f"[RAG] Stored {len(chunks)} chunks for doc {doc_id}")


def delete_doc_from_vector(doc_id: str):
    try:
        collection.delete(where={"doc_id": doc_id})
        logger.info(f"[RAG] Vector deleted for {doc_id}")
    except Exception:
        pass


# ============================================================
# RETRIEVE + RERANK
# ============================================================

def retrieve_context(query: str, k: int = TOP_K_RETRIEVE) -> List[str]:
    q = query.strip()
    if not q:
        return []

    try:
        total = collection.count()
    except Exception:
        total = 0

    if total == 0:
        return []

    k = min(k, total)

    q_emb = embedder.encode([q])[0].tolist()
    res = collection.query(query_embeddings=[q_emb], n_results=k)

    docs = (res.get("documents") or [[]])[0]
    if not docs:
        return []

    q_vec = embedder.encode(q)
    doc_vecs = embedder.encode(docs)
    scores = util.cos_sim(q_vec, doc_vecs)[0].tolist()

    scored = list(zip(scores, docs))
    scored.sort(key=lambda x: x[0], reverse=True)

    filtered = [d for s, d in scored if s >= SIM_THRESHOLD][:RERANK_KEEP]
    return filtered


# ============================================================
# GEMINI HELPERS (NO systemInstruction)
# ============================================================

def call_gemini(prompt: str, max_tokens: int) -> str:
    resp = client.models.generate_content(
        model=GEMINI_MODEL_NAME,
        contents=prompt,
        config=GenerateContentConfig(
            temperature=TEMPERATURE,
            max_output_tokens=max_tokens,
        ),
    )
    return (resp.text or "").strip()


def _build_answer_prompt(context_text: str, query: str) -> str:
    return f"""
คุณเป็นผู้ช่วยนักศึกษามหาวิทยาลัยแม่ฟ้าหลวง (MFU)
ตอบคำถามให้ "ตรงประเด็นที่สุด" โดยใช้เฉพาะข้อมูลใน CONTEXT เท่านั้น

กฎสำคัญ:
1. ห้ามเดาหรือเติมข้อมูลนอก CONTEXT
2. ถ้ามีหลายหัวข้อ ให้จัดเป็นข้อ ๆ (ใช้ - หรือ 1. 2. 3.)
3. สรุปแต่ละหัวข้อสั้น ๆ ไม่ซ้ำซ้อน
4. ถ้า CONTEXT ไม่ได้ตอบคำถาม ให้ตอบ: "ไม่พบข้อมูลในระบบ กรุณาติดต่อเจ้าหน้าที่มหาวิทยาลัย"

รูปแบบคำตอบ:
- ถ้ามีหัวข้อเดียว: ตอบประโยค
- ถ้ามีหลายหัวข้อ: จัดเป็นข้อ ๆ แต่ละข้อขึ้นบรรทัดใหม่

ตัวอย่าง:
- หัวข้อที่ 1: สรุป
- หัวข้อที่ 2: สรุป
- หัวข้อที่ 3: สรุป

[CONTEXT]
{context_text}

[คำถาม]
{query}

[คำตอบ]
""".strip()


def _build_followups_prompt(context_text: str, query: str, answer: str) -> str:
    return f"""
คุณคือผู้ช่วยแนะนำคำถามต่อเนื่องสำหรับนักศึกษา MFU
จากคำถามและคำตอบด้านล่าง ให้เสนอ "คำถามถัดไป" ที่เกี่ยวข้อง 2–3 ข้อ
เป็นภาษาไทย สั้น ๆ เกี่ยวกับ CONTEXT เท่านั้น ห้ามนอกบริบท
ให้ตอบเป็น list บรรทัดละ 1 ข้อ เริ่มด้วย "- "

[CONTEXT]
{context_text}

[คำถามเดิม]
{query}

[คำตอบเดิม]
{answer}

[คำถามถัดไป]
- 
""".strip()


def _parse_followups(text: str) -> List[str]:
    if not text:
        return []
    lines = []
    for ln in text.splitlines():
        ln = ln.strip()
        if not ln:
            continue
        ln = re.sub(r"^[-•\d\.\)\s]+", "", ln).strip()
        if ln:
            lines.append(ln)
    # เอาแค่ 3 ข้อพอ
    return lines[:3]


# ============================================================
# MULTI-AGENT ROUTER (lazy)
# ============================================================

def _get_router():
    """Lazy-load RouterAgent เพื่อกัน circular import

    ถ้าโหลดไม่ได้ (เช่น ตอนรัน migrate) จะคืน None
    """
    global _router
    if _router is not None:
        return _router

    try:
        from app.agents.router import router as router_instance
        _router = router_instance
        _router = router_instance
        logger.info("[RAG] RouterAgent loaded.")
    except Exception as e:
        logger.warning(f"[RAG] RouterAgent not available: {e}")
        _router = None

    return _router



# ============================================================
# GENERATE ANSWER (export)
# ============================================================

def generate_answer(question: str) -> Dict[str, Any]:
    """
    คืนค่าแบบ dict เพื่อให้ main.py ใช้ได้:
      { "answer": str, "next_topics": List[str] }
    """
    query = (question or "").strip()
    if not query:
        return {"answer": "กรุณาพิมพ์คำถามก่อนนะครับ", "next_topics": []}

    # 0) Multi-agent first (ถ้ามี)
    if ENABLE_MULTI_AGENT:
        router = _get_router()
        if router:
            try:
                routed = router.route(query)
                # คาดว่า router.route คืน dict แบบเดียวกัน
                if isinstance(routed, dict) and "answer" in routed:
                    return {
                        "answer": str(routed.get("answer", "")).strip()
                                   or "ไม่พบข้อมูลในระบบ กรุณาติดต่อเจ้าหน้าที่มหาวิทยาลัย",
                        "next_topics": routed.get("next_topics") or [],
                    }
            except Exception as e:
                logger.warning(f"[RAG] Router failed, fallback RAG: {e}")

    # 1) Normal RAG
    contexts = retrieve_context(query, k=TOP_K_RETRIEVE)
    if not contexts:
        return {
            "answer": "ไม่พบข้อมูลในระบบ กรุณาติดต่อเจ้าหน้าที่มหาวิทยาลัย",
            "next_topics": [],
        }

    context_text = "\n\n---\n\n".join(contexts)
    prompt = _build_answer_prompt(context_text, query)

    try:
        answer = call_gemini(prompt, MAX_OUTPUT_TOKENS)
    except Exception as e:
        logger.error(f"[RAG] Gemini generate failed: {e}")
        return {"answer": "ระบบไม่สามารถสร้างคำตอบได้ในขณะนี้ครับ", "next_topics": []}

    if not answer:
        return {"answer": "ระบบไม่สามารถสร้างคำตอบได้ในขณะนี้ครับ", "next_topics": []}

    if "ไม่พบข้อมูลในระบบ" in answer:
        return {
            "answer": "ไม่พบข้อมูลในระบบ กรุณาติดต่อเจ้าหน้าที่มหาวิทยาลัย",
            "next_topics": [],
        }

    # 2) Follow-ups → next_topics (optional)
    next_topics: List[str] = []
    if ENABLE_FOLLOWUPS:
        try:
            fup_prompt = _build_followups_prompt(context_text, query, answer)
            fup_text = call_gemini(fup_prompt, FOLLOWUPS_MAX_TOKENS)
            next_topics = _parse_followups(fup_text)
        except Exception as e:
            logger.warning(f"[RAG] Followups failed: {e}")

    return {"answer": answer.strip(), "next_topics": next_topics}

