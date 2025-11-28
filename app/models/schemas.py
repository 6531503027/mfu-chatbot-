from pydantic import BaseModel, Field
from datetime import datetime
from typing import List, Optional


# ===========================
# CHAT
# ===========================

class ChatRequest(BaseModel):
    question: str
    user_id: Optional[str] = None


class ChatResponse(BaseModel):
    answer: str
    next_topics: List[str] = Field(default_factory=list)


# ===========================
# DOCUMENTS
# ===========================

class DocumentBase(BaseModel):
    title: str
    content: str


class DocumentCreate(DocumentBase):
    updated_by: str


class DocumentUpdate(DocumentBase):
    updated_by: str


class DocumentRevisionOut(BaseModel):
    id: int
    content: str
    updated_by: str
    updated_at: datetime

    model_config = {"from_attributes": True}


class DocumentOut(BaseModel):
    id: int
    title: str
    current_content: str
    created_at: datetime
    updated_at: datetime
    revisions: List[DocumentRevisionOut]

    model_config = {"from_attributes": True}


# ===========================
# Question Logs
# ===========================

class QuestionLogOut(BaseModel):
    id: int
    question: str
    intent: Optional[str] = None
    route: Optional[str] = None
    confidence: Optional[float] = None
    created_at: datetime

    model_config = {"from_attributes": True}


# ===========================
# ANSWER FEEDBACK
# ===========================

class FeedbackCreate(BaseModel):
    question: str
    answer: str
    is_helpful: bool
    comment: Optional[str] = None


class FeedbackOut(BaseModel):
    id: int
    question: str
    answer: str
    is_helpful: bool
    comment: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}
