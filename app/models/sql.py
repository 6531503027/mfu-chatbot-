# app/models.py
from datetime import datetime
from sqlalchemy import (
    Column,
    Integer,
    String,
    Text,
    DateTime,
    ForeignKey,
    Boolean,
)
from sqlalchemy.orm import declarative_base, relationship

Base = declarative_base()


# =====================================================
# DOCUMENT + REVISION (สำหรับ RAG)
# =====================================================

class Document(Base):
    __tablename__ = "documents"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False, index=True)
    current_content = Column(Text, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )

    # cascade delete → ลบ revision ทั้งหมดอัตโนมัติ
    revisions = relationship(
        "DocumentRevision",
        back_populates="document",
        cascade="all, delete-orphan",
    )


class DocumentRevision(Base):
    __tablename__ = "document_revisions"

    id = Column(Integer, primary_key=True, index=True)

    document_id = Column(
        Integer,
        ForeignKey("documents.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    content = Column(Text, nullable=True)
    updated_by = Column(String(100), nullable=False)

    updated_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    document = relationship("Document", back_populates="revisions")


# =====================================================
# QUESTION LOG (สำหรับ multi-agent และ training ภายหลัง)
# =====================================================

class QuestionLog(Base):
    __tablename__ = "question_logs"

    id = Column(Integer, primary_key=True, index=True)
    question = Column(Text, nullable=False, index=True)

    # multi-agent route
    intent = Column(String(100), nullable=True)
    route = Column(String(50), nullable=True)
    confidence = Column(String(20), nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


# =====================================================
# FAQ (ใช้กับ FAQ Agent + semantic matching)
# =====================================================

class FaqEntry(Base):
    __tablename__ = "faq_entries"

    id = Column(Integer, primary_key=True, index=True)

    # คำถามต้อง unique เพราะใช้เป็นฐานความรู้แรกสุด
    question = Column(Text, nullable=False, unique=True, index=True)
    answer = Column(Text, nullable=False)

    # JSON string ของ embedding (list of float)
    question_embedding = Column(Text, nullable=True)

    # จำนวนครั้งที่ถูกใช้ (เพื่อจัดลำดับ FAQ ยอดนิยม)
    hits = Column(Integer, default=0, nullable=False)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    last_used_at = Column(DateTime, default=datetime.utcnow, nullable=False)


# =====================================================
# ANSWER FEEDBACK (ใช้เก็บ feedback จากผู้ใช้)
# =====================================================

class AnswerFeedback(Base):
    __tablename__ = "answer_feedback"

    id = Column(Integer, primary_key=True, index=True)

    question = Column(Text, nullable=False)
    answer = Column(Text, nullable=False)

    # True = helpful (✅), False = not helpful (❌)
    is_helpful = Column(Boolean, nullable=False)

    # Comment from user (optional, especially for negative feedback)
    comment = Column(Text, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
