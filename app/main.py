# app/main.py

from typing import List, Optional, Tuple, Any, Dict, Union

from fastapi import (
    FastAPI,
    Depends,
    HTTPException,
    Header,
    Request,
    UploadFile,
    File,
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from sqlalchemy import func
from dotenv import load_dotenv
from pypdf import PdfReader
import os
import io
import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)

from app.core.database import SessionLocal, engine
from app.models.sql import Base, Document, DocumentRevision, QuestionLog, AnswerFeedback
from app.models.schemas import (
    ChatRequest,
    ChatResponse,
    DocumentCreate,
    DocumentUpdate,
    DocumentOut,
    FeedbackCreate,
    FeedbackOut,
)

# ✅ Multi-Agent pipeline (ตัว Router หลัก)
from app.services.orchestrator import run_pipeline

# ✅ RAG vector functions (ยังใช้ตอน admin upload)
from app.services.rag import (
    add_or_update_doc_to_vector,
    delete_doc_from_vector,
)

# โหลด .env
load_dotenv()

MAX_PDF_CHARS = int(os.getenv("MAX_PDF_CHARS", "300000"))

# DB INIT
Base.metadata.create_all(bind=engine)

app = FastAPI(title="University RAG Chatbot (Multi-Agent + Gemini)")

# CORS
# CORS
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000,http://localhost:5173").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

ADMIN_TOKEN = os.getenv("ADMIN_TOKEN", "very-secret-admin-key")


# ============================================================
# DEPENDENCIES
# ============================================================

def verify_admin(
    request: Request,
    x_api_key: Optional[str] = Header(default=None),
) -> bool:
    """
    ตรวจสิทธิ์ admin ด้วย header: X-API-Key
    - อนุญาต OPTIONS (preflight) เสมอ เพื่อไม่ให้ CORS พัง
    """
    if request.method == "OPTIONS":
        return True
    if x_api_key is None or x_api_key != ADMIN_TOKEN:
        raise HTTPException(status_code=403, detail="Not authorized as admin")
    return True


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ============================================================
# CHAT ENDPOINT (Multi-Agent Router + Log)
# ============================================================

@app.post("/chat", response_model=ChatResponse)
def chat(req: ChatRequest, db: Session = Depends(get_db)):
    """✅ Multi-Agent entrypoint

    - run_pipeline(question, db) → คืน (answer, meta)
    - meta มี intent / route / confidence / next_topics ได้
    - เก็บคำถามลง QuestionLog เพื่อดู Top FAQ
    """  # noqa: D401
    question = (req.question or "").strip()
    if not question:
        raise HTTPException(status_code=400, detail="Question is empty")

    # รองรับ user_id แบบ optional
    user_id = getattr(req, "user_id", None) or "guest"

    try:
        answer, meta = run_pipeline(question, db)
    except Exception as e:
        logger.error(f"[CHAT] run_pipeline failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Multi-agent pipeline error")

    # เก็บ log ลง DB (ไม่ให้ chat ล่มถ้า log fail)
    try:
        log = QuestionLog(
            user_id=user_id,
            question=question,
            intent=meta.get("intent"),
            route=meta.get("route"),
            confidence=str(meta.get("confidence")),
        )
        db.add(log)
        db.commit()
    except Exception as e:
        logger.warning(f"[CHAT] Cannot write QuestionLog: {e}")
        db.rollback()

    next_topics = meta.get("next_topics") or []

    return ChatResponse(
        answer=answer,
        next_topics=next_topics,
    )



# ============================================================
# ADMIN: DOCUMENT CRUD
# ============================================================

@app.post("/admin/documents", response_model=DocumentOut)
def create_document(
    doc: DocumentCreate,
    db: Session = Depends(get_db),
    _admin_ok: bool = Depends(verify_admin),
):
    """
    Admin สร้าง document manual → DB + revision + vector
    """
    if not doc.content.strip():
        raise HTTPException(status_code=400, detail="Empty content")

    db_doc = Document(title=doc.title, current_content=doc.content)
    db.add(db_doc)
    db.commit()
    db.refresh(db_doc)

    # revision แรก
    rev = DocumentRevision(
        document_id=db_doc.id,
        content=doc.content,
        updated_by=doc.updated_by,
    )
    db.add(rev)
    db.commit()

    # ส่งเข้า vector
    add_or_update_doc_to_vector(
        doc_id=str(db_doc.id),
        content=doc.content,
        metadata={"title": db_doc.title, "source": "manual"},
    )

    db.refresh(db_doc)
    return db_doc


@app.put("/admin/documents/{doc_id}", response_model=DocumentOut)
def update_document(
    doc_id: int,
    doc: DocumentUpdate,
    db: Session = Depends(get_db),
    _admin_ok: bool = Depends(verify_admin),
):
    """
    Admin update doc → DB + revision + vector update
    """
    db_doc = db.query(Document).filter(Document.id == doc_id).first()
    if not db_doc:
        raise HTTPException(status_code=404, detail="Document not found")

    if not doc.content.strip():
        raise HTTPException(status_code=400, detail="Empty content")

    db_doc.title = doc.title
    db_doc.current_content = doc.content
    db.commit()

    rev = DocumentRevision(
        document_id=db_doc.id,
        content=doc.content,
        updated_by=doc.updated_by,
    )
    db.add(rev)
    db.commit()

    add_or_update_doc_to_vector(
        doc_id=str(db_doc.id),
        content=doc.content,
        metadata={"title": db_doc.title, "source": "manual"},
    )

    db.refresh(db_doc)
    return db_doc


@app.delete("/admin/documents/{doc_id}")
def delete_document(
    doc_id: int,
    db: Session = Depends(get_db),
    _admin_ok: bool = Depends(verify_admin),
):
    """
    Admin delete doc → DB cascade revisions + vector delete
    """
    db_doc = db.query(Document).filter(Document.id == doc_id).first()
    if not db_doc:
        raise HTTPException(status_code=404, detail="Document not found")

    db.delete(db_doc)
    db.commit()

    delete_doc_from_vector(str(doc_id))

    return {"message": "deleted"}


# ============================================================
# PDF UTILS
# ============================================================

def extract_text_from_pdf_bytes(
    pdf_bytes: bytes,
    max_chars: int = MAX_PDF_CHARS
) -> Tuple[str, int]:
    """
    ดึงข้อความจาก PDF โดย:
    - อ่านทีละหน้า
    - จำกัดจำนวนตัวอักษร (max_chars)
    - คืน (text, page_count)
    """
    reader = PdfReader(io.BytesIO(pdf_bytes))
    page_count = len(reader.pages)

    texts: List[str] = []
    total_chars = 0

    for page in reader.pages:
        try:
            page_text = page.extract_text() or ""
        except Exception:
            page_text = ""

        page_text = page_text.strip()
        if not page_text:
            continue

        remaining = max_chars - total_chars
        if remaining <= 0:
            break

        if len(page_text) > remaining:
            page_text = page_text[:remaining]

        texts.append(page_text)
        total_chars += len(page_text)

        if total_chars >= max_chars:
            break

    full_text = "\n\n".join(texts)
    return full_text, page_count


# ============================================================
# ADMIN: PDF UPLOAD → DOC + VECTOR
# ============================================================

@app.post("/admin/upload_pdf")
async def upload_pdf(
    request: Request,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    _admin_ok: bool = Depends(verify_admin),
):
    """
    Admin upload PDF:
      - extract text
      - create Document + revision
      - upsert vector
    """
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="File must be PDF")

    pdf_bytes = await file.read()
    if not pdf_bytes:
        raise HTTPException(status_code=400, detail="Empty file")

    try:
        text, page_count = extract_text_from_pdf_bytes(
            pdf_bytes, max_chars=MAX_PDF_CHARS
        )
    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot read PDF: {e}",
        )

    if not text.strip():
        raise HTTPException(
            status_code=400,
            detail="No extractable text found in PDF",
        )

    base_title = os.path.splitext(file.filename or "Uploaded PDF")[0]
    title = f"[PDF] {base_title}"

    db_doc = Document(title=title, current_content=text)
    db.add(db_doc)
    db.commit()
    db.refresh(db_doc)

    rev = DocumentRevision(
        document_id=db_doc.id,
        content=text,
        updated_by="admin_pdf_upload",
    )
    db.add(rev)
    db.commit()

    add_or_update_doc_to_vector(
        doc_id=str(db_doc.id),
        content=text,
        metadata={
            "title": db_doc.title,
            "source": "pdf",
            "filename": file.filename,
        },
    )

    return {
        "id": db_doc.id,
        "title": db_doc.title,
        "filename": file.filename,
        "pages": page_count,
        "chars": len(text),
    }


# ============================================================
# ADMIN: LIST / GET DOCUMENTS
# ============================================================

@app.get("/admin/documents/list", response_model=List[DocumentOut])
def list_documents(
    db: Session = Depends(get_db),
    _admin_ok: bool = Depends(verify_admin),
):
    docs = (
        db.query(Document)
        .order_by(Document.id.desc())
        .limit(50)
        .all()
    )
    return docs


@app.get("/admin/documents/{doc_id}", response_model=DocumentOut)
def get_document(
    doc_id: int,
    db: Session = Depends(get_db),
    _admin_ok: bool = Depends(verify_admin),
):
    doc = db.query(Document).filter(Document.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    return doc


# ============================================================
# ADMIN: TOP FAQ QUESTIONS
# ============================================================

@app.get("/admin/questions/top")
def top_questions(
    db: Session = Depends(get_db),
    _admin_ok: bool = Depends(verify_admin),
    limit: int = 20,
):
    """
    คืนคำถามที่ถูกถามบ่อยที่สุดแบบ grouped
    """
    rows = (
        db.query(
            QuestionLog.question,
            func.count(QuestionLog.id).label("cnt")
        )
        .group_by(QuestionLog.question)
        .order_by(func.count(QuestionLog.id).desc())
        .limit(limit)
        .all()
    )

    return [{"question": q, "count": c} for q, c in rows]


# ============================================================
# STATIC FRONTEND (ถ้ามี)
# ============================================================

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
STATIC_DIR = os.path.join(BASE_DIR, "static")

if os.path.isdir(STATIC_DIR):
    app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

    @app.get("/", response_class=FileResponse)
    def read_index():
        index_path = os.path.join(STATIC_DIR, "index.html")
        if not os.path.exists(index_path):
            raise HTTPException(status_code=404, detail="index.html not found")
        return FileResponse(index_path)
else:

    @app.get("/")
    def root():
        return {
            "status": "ok",
            "message": "Backend is running. Frontend use http://localhost:3000",
        }


# ============================================================
# FEEDBACK ENDPOINTS
# ============================================================

@app.post("/feedback")
def submit_feedback(
    feedback: FeedbackCreate,
    db: Session = Depends(get_db),
):
    """
    Submit user feedback on an answer (no auth required)
    """
    new_feedback = AnswerFeedback(
        question=feedback.question,
        answer=feedback.answer,
        is_helpful=feedback.is_helpful,
        comment=feedback.comment,
    )
    db.add(new_feedback)
    db.commit()
    db.refresh(new_feedback)

    return {"message": "Feedback received", "id": new_feedback.id}


@app.get("/admin/feedback", response_model=List[FeedbackOut])
def get_feedback(
    db: Session = Depends(get_db),
    _admin_ok: bool = Depends(verify_admin),
    limit: int = 50,
):
    """
    Get all feedback (admin only)
    """
    feedback_list = (
        db.query(AnswerFeedback)
        .order_by(AnswerFeedback.created_at.desc())
        .limit(limit)
        .all()
    )
    return feedback_list


# ============================================================
# STATISTICS ENDPOINTS (Admin)
# ============================================================

@app.get("/admin/stats/summary")
def get_stats_summary(
    db: Session = Depends(get_db),
    _admin_ok: bool = Depends(verify_admin),
):
    """
    Get overall statistics summary
    """
    total_questions = db.query(QuestionLog).count()
    total_docs = db.query(Document).count()
    total_feedback = db.query(AnswerFeedback).count()
    helpful_feedback = db.query(AnswerFeedback).filter(AnswerFeedback.is_helpful == True).count()

    return {
        "total_questions": total_questions,
        "total_documents": total_docs,
        "total_feedback": total_feedback,
        "helpful_feedback": helpful_feedback,
        "feedback_rate": round(helpful_feedback / total_feedback * 100, 1) if total_feedback > 0 else 0,
    }


@app.get("/admin/stats/top-questions")
def get_top_questions(
    db: Session = Depends(get_db),
    _admin_ok: bool = Depends(verify_admin),
    limit: int = 10,
):
    """
    Get top N most asked questions
    """
    from sqlalchemy import func

    results = (
        db.query(
            QuestionLog.question,
            func.count(QuestionLog.question).label("count")
        )
        .group_by(QuestionLog.question)
        .order_by(func.count(QuestionLog.question).desc())
        .limit(limit)
        .all()
    )

    return [{"question": q, "count": c} for q, c in results]


@app.get("/admin/stats/intents")
def get_intent_stats(
    db: Session = Depends(get_db),
    _admin_ok: bool = Depends(verify_admin),
):
    """
    Get question count grouped by intent
    """
    from sqlalchemy import func

    results = (
        db.query(
            QuestionLog.intent,
            func.count(QuestionLog.intent).label("count")
        )
        .filter(QuestionLog.intent.isnot(None))
        .group_by(QuestionLog.intent)
        .order_by(func.count(QuestionLog.intent).desc())
        .all()
    )

    return [{"intent": i or "unknown", "count": c} for i, c in results]


# ============================================================
# HEALTH CHECK
# ============================================================

@app.get("/health")
def health_check():
    return {"status": "ok"}
