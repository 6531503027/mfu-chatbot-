# app/agents/router.py
from dataclasses import dataclass
from typing import List
from google import genai
from google.genai.types import HttpOptions, GenerateContentConfig
import os
import json
import re

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
ROUTER_MODEL = os.getenv("ROUTER_MODEL_NAME") or os.getenv(
    "GEMINI_MODEL_NAME", "gemini-2.0-flash"
)

if not GEMINI_API_KEY:
    raise RuntimeError("GEMINI_API_KEY is not set in .env")

client = genai.Client(
    api_key=GEMINI_API_KEY,
    http_options=HttpOptions(api_version="v1"),
)

ALLOWED_INTENTS: List[str] = [
    "academic",
    "regulation",
    "scholarship",
    "dorm",
    "contact",
    "general_rag",
    "capabilities",
    "unknown",
]


@dataclass
class RouteResult:
    intent: str
    route: str
    confidence: float


class RouterAgent:
    """Router ตัวหลัก ใช้ Gemini จำแนก intent ของคำถามนักศึกษา MFU"""

    def __init__(self, model: str = ROUTER_MODEL):
        self.model = model

    def _build_prompt(self, question: str) -> str:
        return f"""คุณคือตัวช่วยแยกประเภทคำถามของนักศึกษามหาวิทยาลัยแม่ฟ้าหลวง ให้ตอบเป็น JSON เท่านั้น

คำถาม: "{question.strip()}"

ให้เลือก intent ที่ใกล้เคียงที่สุดจากรายการนี้:
- academic: คำถามเกี่ยวกับการเรียน รายวิชา ลงทะเบียน เกรด ปฏิทินการศึกษา
- regulation: ระเบียบมหาวิทยาลัย การแต่งกาย วินัยนักศึกษา กฎข้อบังคับ
- scholarship: ทุนการศึกษา ทุนช่วยเหลือ ค่าธรรมเนียม การผ่อนผัน
- dorm: หอพัก การเข้าพัก ระเบียบหอพัก ค่าหอ
- contact: ช่องทางติดต่อหน่วยงาน เบอร์โทร อีเมล สำนักงาน
- general_rag: คำถามทั่วไปเกี่ยวกับมหาวิทยาลัย/ชีวิตนักศึกษา ที่ควรใช้ฐานความรู้ RAG
- capabilities: คำถามว่าทำอะไรได้บ้าง มีความรู้อะไรบ้าง หรือให้แนะนำหัวข้อ
- unknown: ถ้าไม่เข้าใจหรือไม่อยู่ในรายการ

ตอบกลับเป็น JSON รูปแบบ:
{{"intent": "academic", "confidence": 0.92}}

ห้ามใส่คำอธิบายอื่นเพิ่มเติม""".strip()

    def route(self, question: str) -> RouteResult:
        intent = "unknown"
        conf = 0.0

        q = (question or "").strip()
        if not q:
            return RouteResult(intent=intent, route="unknown", confidence=conf)

        try:
            prompt = self._build_prompt(q)
            resp = client.models.generate_content(
                model=self.model,
                contents=prompt,
                config=GenerateContentConfig(
                    temperature=0.0,
                    max_output_tokens=128,
                ),
            )
            text = getattr(resp, "text", "") or ""
            text = text.strip()

            # ตัด ```json ... ``` ถ้ามี
            if text.startswith("```"):
                text = re.sub(r"^```[a-zA-Z]*", "", text)
                text = re.sub(r"```$", "", text).strip()

            # ดึง JSON แรก
            m = re.search(r"\{.*\}", text, re.S)
            data = json.loads(m.group()) if m else {}

            raw_intent = str(data.get("intent", "unknown")).strip().lower()
            raw_conf = data.get("confidence", 0.0)

            # validate intent
            if raw_intent in ALLOWED_INTENTS:
                intent = raw_intent
            else:
                intent = "unknown"

            # parse confidence
            try:
                conf = float(raw_conf)
            except Exception:
                conf = 0.0

            conf = max(0.0, min(conf, 1.0))

        except Exception as e:
            print("[RouterAgent][WARN] route failed:", e, flush=True)

        # map intent -> route
        if intent in ["academic", "regulation", "scholarship", "dorm", "contact", "general_rag"]:
            route = "rag"
        elif intent == "capabilities":
            route = "local"
        else:
            route = "unknown"

        return RouteResult(intent=intent, route=route, confidence=conf)


router = RouterAgent()
