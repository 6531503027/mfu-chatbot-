import React, { useState } from "react";
import { Role } from "@/types/chat";
import Linkify from "./Linkify";

interface ChatBubbleProps {
    role: Role;
    text: string;
    ghost?: boolean;
    nextTopics?: string[];
    onTopicClick?: (topic: string) => void;
    question?: string; // The original question for feedback
    onFeedbackSubmit?: (isHelpful: boolean, comment?: string) => void;
}

export default function ChatBubble({
    role,
    text,
    ghost,
    nextTopics,
    onTopicClick,
    question,
    onFeedbackSubmit,
}: ChatBubbleProps) {
    const isUser = role === "user";
    const showNext = !ghost && !isUser && nextTopics && nextTopics.length > 0;

    // Feedback state
    const [feedbackGiven, setFeedbackGiven] = useState(false);
    const [showCommentBox, setShowCommentBox] = useState(false);
    const [comment, setComment] = useState("");

    const handleFeedback = (isHelpful: boolean) => {
        if (feedbackGiven) return;

        if (!isHelpful) {
            // Show comment box for negative feedback
            setShowCommentBox(true);
        } else {
            // Immediately submit positive feedback
            onFeedbackSubmit?.(true);
            setFeedbackGiven(true);
        }
    };

    const submitNegativeFeedback = () => {
        if (onFeedbackSubmit) {
            onFeedbackSubmit(false, comment);
            setFeedbackGiven(true);
            setShowCommentBox(false);
        }
    };

    return (
        <div
            className={
                "chat-row " + (isUser ? "chat-row--user" : "chat-row--bot")
            }
        >
            <div
                className={
                    "chat-bubble " +
                    (isUser ? "chat-bubble--user" : "chat-bubble--bot") +
                    (ghost ? " chat-bubble--ghost" : "")
                }
            >
                {!ghost && (
                    <div className="chat-bubble-sender">
                        {isUser ? "นักศึกษา" : "MFU AI Assistant"}
                    </div>
                )}

                <div className="chat-bubble-text">
                    <Linkify text={text} />
                </div>

                {/* Feedback buttons - only for bot non-ghost messages with callback */}
                {!ghost && !isUser && onFeedbackSubmit && !feedbackGiven && (
                    <div className="feedback-container">
                        <div className="feedback-prompt">คำตอบนี้ช่วยคุณได้หรือไม่?</div>
                        <div className="feedback-buttons">
                            <button
                                onClick={() => handleFeedback(true)}
                                className="feedback-btn feedback-btn--positive"
                                title="คำตอบนี้ช่วยได้"
                            >
                                ✅ ช่วยได้
                            </button>
                            <button
                                onClick={() => handleFeedback(false)}
                                className="feedback-btn feedback-btn--negative"
                                title="ยังไม่ตรงคำถาม"
                            >
                                ❌ ยังไม่ตรงคำถาม
                            </button>
                        </div>
                    </div>
                )}

                {/* Comment box for negative feedback */}
                {showCommentBox && !feedbackGiven && (
                    <div className="feedback-comment-box">
                        <textarea
                            className="feedback-textarea"
                            placeholder="บอกเราได้เลยว่าควรปรับปรุงอย่างไร..."
                            value={comment}
                            onChange={(e) => setComment(e.target.value)}
                            rows={3}
                        />
                        <div className="feedback-comment-actions">
                            <button
                                onClick={submitNegativeFeedback}
                                className="feedback-submit-btn"
                            >
                                ส่งความคิดเห็น
                            </button>
                            <button
                                onClick={() => {
                                    setShowCommentBox(false);
                                    setComment("");
                                }}
                                className="feedback-cancel-btn"
                            >
                                ยกเลิก
                            </button>
                        </div>
                    </div>
                )}

                {/* Thank you message */}
                {feedbackGiven && (
                    <div className="feedback-thanks">
                        ขอบคุณสำหรับความคิดเห็น! 🙏
                    </div>
                )}

                {showNext && (
                    <div className="next-topics-container">
                        <div className="next-topics-header">
                            💡 หัวข้อที่เกี่ยวข้อง
                        </div>
                        <div className="next-topics-grid">
                            {nextTopics!.map((t, i) => (
                                <button
                                    key={`${t}-${i}`}
                                    type="button"
                                    onClick={() => onTopicClick?.(t)}
                                    className="next-topic-card"
                                >
                                    <span className="next-topic-icon">›</span>
                                    <span className="next-topic-text">{t}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
