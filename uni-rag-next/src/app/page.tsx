"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Message, StoredConversation, ApiChatResponse } from "@/types/chat";
import SidebarModeButton from "@/components/SidebarModeButton";
import ChatBubble from "@/components/ChatBubble";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";

const STORAGE_KEY = "uni_rag_conversations_v1";

const SUGGESTIONS = [
  {
    label: "ระเบียบการแต่งกาย",
    prompt:
      "ช่วยอธิบายระเบียบการแต่งกายของนักศึกษามหาวิทยาลัยแม่ฟ้าหลวงแบบเข้าใจง่ายให้หน่อย",
  },
  {
    label: "กำหนดการลงทะเบียนเรียน",
    prompt:
      "ปฏิทินการศึกษาและกำหนดการลงทะเบียนเรียนของมหาวิทยาลัยแม่ฟ้าหลวง ภาคการศึกษาล่าสุดเป็นอย่างไร",
  },
  {
    label: "ทุนการศึกษา",
    prompt:
      "มหาวิทยาลัยแม่ฟ้าหลวงมีทุนการศึกษาแบบใดบ้าง และมีเงื่อนไขการสมัครอย่างไร",
  },
  {
    label: "หอพักนักศึกษา",
    prompt:
      "ข้อมูลเกี่ยวกับหอพักนักศึกษาที่มหาวิทยาลัยแม่ฟ้าหลวง เช่น ประเภทหอพัก การสมัคร และกฎระเบียบมีอะไรบ้าง",
  },
];

function createEmptyConversation(): StoredConversation {
  const now = new Date().toISOString();
  return {
    id: `conv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    title: "แชทใหม่",
    createdAt: now,
    updatedAt: now,
    messages: [
      {
        id: `welcome_${Date.now()}`,
        role: "bot",
        text: "สวัสดีครับ ผมเป็นผู้ช่วย AI สำหรับนักศึกษา มหาวิทยาลัยแม่ฟ้าหลวง (MFU)\n\nผมสามารถช่วยตอบคำถามเกี่ยวกับ:\n- ระเบียบการเรียนและการลงทะเบียน\n- ข้อมูลหอพักและทุนการศึกษา\n- กฎระเบียบและการแต่งกาย\n- ข้อมูลทั่วไปของมหาวิทยาลัย\n\nมีอะไรให้ผมช่วยไหมครับ?",
        createdAt: now,
      },
    ],
  };
}

export default function StudentPage() {
  const [conversations, setConversations] = useState<StoredConversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  // Typing animation state
  const [typingMessageId, setTypingMessageId] = useState<string | null>(null);
  const [displayedText, setDisplayedText] = useState<string>("");

  // Mobile Menu State
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Contact Admin Modal State
  const [showContactModal, setShowContactModal] = useState(false);

  // Delete Conversation Modal State
  const [deletingConversationId, setDeletingConversationId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // ---------------------------
  // LOAD FROM LOCAL STORAGE
  // ---------------------------
  useEffect(() => {
    setHydrated(true);
    if (typeof window === "undefined") return;

    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as {
          conversations?: StoredConversation[];
          activeId?: string | null;
        };

        if (Array.isArray(parsed.conversations) && parsed.conversations.length) {
          setConversations(parsed.conversations);
          const firstId = parsed.conversations[0].id;
          const active =
            parsed.activeId &&
              parsed.conversations.some((c) => c.id === parsed.activeId)
              ? parsed.activeId
              : firstId;
          setActiveId(active);
          return;
        }
      }
    } catch {
      // ignore
    }

    // ยังไม่เคยมีอะไรเลย → สร้างห้องใหม่พร้อม Welcome Message
    const initConv = createEmptyConversation();
    setConversations([initConv]);
    setActiveId(initConv.id);
  }, []);

  // ---------------------------
  // SYNC TO LOCAL STORAGE
  // ---------------------------
  useEffect(() => {
    if (!hydrated || typeof window === "undefined") return;
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ conversations, activeId })
      );
    } catch {
      // ignore
    }
  }, [conversations, activeId, hydrated]);

  // ---------------------------
  // DERIVED STATE
  // ---------------------------

  const activeConversation = useMemo(() => {
    if (!conversations.length) return null;
    const found =
      (activeId && conversations.find((c) => c.id === activeId)) ||
      conversations[0];
    return found || null;
  }, [conversations, activeId]);

  const visibleMessages: Message[] = useMemo(
    () => activeConversation?.messages ?? [],
    [activeConversation]
  );

  // แสดงเฉพาะห้องที่มีข้อความจากผู้ใช้แล้ว → เหมือน GPT
  const sortedConversations = useMemo(() => {
    const withUserMsg = conversations.filter((c) =>
      c.messages.some((m) => m.role === "user")
    );
    const convs = [...withUserMsg];
    convs.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    return convs;
  }, [conversations]);

  // auto scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [visibleMessages, isLoading]);

  // ---------------------------
  // HELPERS
  // ---------------------------

  async function readError(res: Response): Promise<string> {
    try {
      const text = await res.text();
      if (!text) return res.statusText;
      try {
        const json = JSON.parse(text);
        if (json?.detail) return String(json.detail);
        return text;
      } catch {
        return text;
      }
    } catch {
      return res.statusText;
    }
  }

  async function callApi<T>(path: string, body: unknown): Promise<T> {
    const res = await fetch(`${API_BASE}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      throw new Error(await readError(res));
    }
    return (await res.json()) as T;
  }

  function getErrorMessage(err: unknown): string {
    if (err instanceof Error) return err.message;
    if (typeof err === "string") return err;
    return "ไม่ทราบสาเหตุ";
  }

  // ---------------------------
  // TYPING ANIMATION
  // ---------------------------
  function startTypingAnimation(messageId: string, fullText: string) {
    setTypingMessageId(messageId);
    setDisplayedText("");

    const words = fullText.split(" ");
    let currentIndex = 0;

    const interval = setInterval(() => {
      if (currentIndex < words.length) {
        setDisplayedText((prev) => {
          const newText = currentIndex === 0
            ? words[currentIndex]
            : prev + " " + words[currentIndex];
          return newText;
        });
        currentIndex++;
      } else {
        clearInterval(interval);
        setTypingMessageId(null);
        setDisplayedText("");
      }
    }, 50); // 50ms per word
  }

  // ---------------------------
  // FEEDBACK SUBMISSION
  // ---------------------------
  async function handleFeedbackSubmit(
    question: string,
    answer: string,
    isHelpful: boolean,
    comment?: string
  ) {
    try {
      await fetch(`${API_BASE}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, answer, is_helpful: isHelpful, comment }),
      });
      // Silently succeed - no need to show confirmation
    } catch (err) {
      console.error("Failed to submit feedback:", err);
      // Silently fail - don't disrupt user experience
    }
  }

  // ---------------------------
  // NEW CHAT / SELECT / DELETE
  // ---------------------------

  // คลิกปุ่มโหมด Chat เพื่อเริ่มแชทใหม่
  function handleNewChat() {
    const conv = createEmptyConversation();
    setConversations((prev) => [conv, ...prev]);
    setActiveId(conv.id);
    setInput("");
  }

  function ensureActiveConversation(): string {
    // ถ้ามีห้อง active อยู่แล้ว ใช้อันเดิม
    if (activeConversation) return activeConversation.id;

    // ยังไม่มีเลย → สร้างห้องใหม่อัตโนมัติ (เหมือน GPT)
    const conv = createEmptyConversation();
    setConversations((prev) => [conv, ...prev]);
    setActiveId(conv.id);
    return conv.id;
  }

  function handleSelectConversation(id: string) {
    setActiveId(id);
    setInput("");
  }

  function handleDeleteConversation(id: string) {
    setDeletingConversationId(id);
  }

  function confirmDeleteConversation() {
    if (!deletingConversationId) return;

    setConversations((prev) => {
      const remaining = prev.filter((c) => c.id !== deletingConversationId);
      if (activeId === deletingConversationId) {
        if (remaining.length === 0) {
          setActiveId(null);
        } else {
          const sorted = [...remaining].sort((a, b) =>
            b.updatedAt.localeCompare(a.updatedAt)
          );
          setActiveId(sorted[0].id);
        }
      }
      return remaining;
    });

    setDeletingConversationId(null);
  }

  // ---------------------------
  // SEND MESSAGE
  // ---------------------------

  async function handleSend(customText?: string) {
    const text = (customText ?? input).trim();
    if (!text || isLoading) return;

    const currentId = ensureActiveConversation();
    const nowIso = new Date().toISOString();

    const userMsg: Message = {
      id: `${Date.now()}_user`,
      role: "user",
      text,
      createdAt: nowIso,
    };

    // เพิ่มข้อความผู้ใช้ + ตั้ง title จากข้อความแรก
    setConversations((prev) =>
      prev.map((c) =>
        c.id === currentId
          ? {
            ...c,
            title: c.title === "แชทใหม่" ? text.slice(0, 40) : c.title,
            updatedAt: nowIso,
            messages: [...c.messages, userMsg],
          }
          : c
      )
    );

    setInput("");
    setIsLoading(true);

    try {
      const data = await callApi<ApiChatResponse>("/chat", {
        question: text,
        user_id: "web",
      });

      const botMsg: Message = {
        id: `${Date.now()}_bot`,
        role: "bot",
        text: data.answer,
        createdAt: new Date().toISOString(),
        nextTopics: data.next_topics || [],
      };

      setConversations((prev) =>
        prev.map((c) =>
          c.id === currentId
            ? {
              ...c,
              updatedAt: new Date().toISOString(),
              messages: [...c.messages, botMsg],
            }
            : c
        )
      );

      // Trigger typing animation
      startTypingAnimation(botMsg.id, data.answer);
    } catch (err) {
      const botMsg: Message = {
        id: `${Date.now()}_error`,
        role: "bot",
        text: "❌ เกิดข้อผิดพลาด: " + getErrorMessage(err),
        createdAt: new Date().toISOString(),
      };

      setConversations((prev) =>
        prev.map((c) =>
          c.id === currentId
            ? {
              ...c,
              updatedAt: new Date().toISOString(),
              messages: [...c.messages, botMsg],
            }
            : c
        )
      );
    } finally {
      setIsLoading(false);
    }
  }

  // skeleton ตอนยังไม่ hydrate
  if (!hydrated) {
    return (
      <div className="layout">
        <main className="main">
          <div className="panel">
            <div className="panel-body">กำลังโหลด...</div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="layout">
      {/* Mobile Overlay */}
      {isMobileMenuOpen && (
        <div
          className="sidebar-overlay"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`sidebar ${isMobileMenuOpen ? "mobile-open" : ""}`}>
        <div className="sidebar-section">
          <div className="sidebar-section-title">โหมดการทำงาน</div>
          <SidebarModeButton
            label="Chat – ถามตอบข้อมูลมหาวิทยาลัย"
            icon="💬"
            active
            onClick={handleNewChat}  // 👈 คลิกเพื่อเริ่มแชทใหม่
          />
        </div>

        <div className="sidebar-section">
          <div className="sidebar-section-title">ประวัติการสนทนา</div>

          <div className="sidebar-history">
            {sortedConversations.length === 0 ? (
              <div className="sidebar-history-empty">
                ยังไม่มีประวัติการสนทนา เริ่มแชทใหม่ได้โดยการพิมพ์คำถามด้านขวา
                หรือคลิกปุ่มด้านบน
              </div>
            ) : (
              sortedConversations.map((c) => {
                const lastUser = [...c.messages]
                  .reverse()
                  .find((m) => m.role === "user");
                const snippet = lastUser?.text || "ยังไม่มีข้อความจากผู้ใช้";
                const isActive = c.id === activeId;

                return (
                  <div
                    key={c.id}
                    className={
                      "sidebar-history-item" +
                      (isActive ? " sidebar-history-item--active" : "")
                    }
                    onClick={() => handleSelectConversation(c.id)}
                  >
                    <div className="sidebar-history-main">
                      <div className="sidebar-history-title">
                        {c.title || "แชทใหม่"}
                      </div>
                      <div className="sidebar-history-snippet">
                        {snippet}
                      </div>
                    </div>
                    <button
                      type="button"
                      className="sidebar-history-delete"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteConversation(c.id);
                      }}
                    >
                      ✕
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="sidebar-section">
          <div className="sidebar-section-title">คำถามแนะนำ</div>
          <div className="sidebar-suggestions">
            {SUGGESTIONS.map((s) => (
              <button
                key={s.label}
                className="sidebar-suggestion-btn"
                onClick={() => setInput(s.prompt)}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <div className="sidebar-footer">
          ระบบนี้ตอบจากข้อมูลทางการของมหาวิทยาลัยแม่ฟ้าหลวง
          (PDF/เอกสารที่อัปโหลด)
        </div>
      </aside>

      {/* Main Chat */}
      <main className="main">
        <div className="main-header">
          <div>
            <div className="main-header-title">
              ผู้ช่วย AI สำหรับนักศึกษา MFU
            </div>
            <div className="main-header-subtitle">
              ถาม–ตอบข้อมูลมหาวิทยาลัยแม่ฟ้าหลวง
            </div>
            <div className="language-badge">
              🌐 รองรับคำถามภาษาอังกฤษ (คำตอบเป็นภาษาไทย)
            </div>
          </div>

          {/* Mobile Menu Toggle */}
          <button
            className="mobile-menu-toggle"
            onClick={() => setIsMobileMenuOpen(true)}
            style={{
              display: "none", // Hidden on desktop via CSS, but we'll use inline style for now to be safe or rely on CSS class
              background: "none",
              border: "none",
              fontSize: "24px",
              cursor: "pointer",
              padding: "8px",
            }}
          >
            ☰
          </button>

          <div style={{ textAlign: "right" }}>
            <button
              className="contact-admin-btn"
              onClick={() => setShowContactModal(true)}
              title="ติดต่อแอดมิน"
            >
              📞 ติดต่อแอดมิน
            </button>
            <div className="system-status">
              {isLoading ? (
                <>
                  <span className="system-status-dot" />
                  กำลังประมวลผลคำตอบ...
                </>
              ) : (
                <span className="system-status-ready">พร้อมใช้งาน</span>
              )}
            </div>
          </div>
        </div>

        <section className="panel">
          <div className="panel-header">พื้นที่สนทนา (Student Chat)</div>

          <div className="panel-body">
            <div className="chat-messages">
              {visibleMessages.length === 0 && !isLoading && (
                <div className="chat-empty">
                  ยังไม่มีข้อความ ลองพิมพ์คำถาม เช่น “กำหนดการลงทะเบียนเรียนเมื่อไหร่”
                </div>
              )}

              {visibleMessages.map((m, idx) => {
                // Find the user question before this bot message for feedback context
                const userQuestion = m.role === "bot" && idx > 0
                  ? visibleMessages.slice(0, idx).reverse().find(msg => msg.role === "user")?.text
                  : undefined;

                // Check if this message is currently being typed
                const isTyping = typingMessageId === m.id;
                const textToShow = isTyping ? displayedText : m.text;

                return (
                  <ChatBubble
                    key={m.id}
                    role={m.role}
                    text={textToShow}
                    nextTopics={isTyping ? [] : m.nextTopics} // Hide topics while typing
                    onTopicClick={(topic) => handleSend(topic)}
                    question={userQuestion}
                    onFeedbackSubmit={
                      m.role === "bot" && userQuestion && !isTyping
                        ? (isHelpful, comment) =>
                          handleFeedbackSubmit(userQuestion, m.text, isHelpful, comment)
                        : undefined
                    }
                  />
                );
              })}

              {isLoading && (
                <ChatBubble role="bot" text="กำลังพิมพ์คำตอบ..." ghost />
              )}

              <div ref={messagesEndRef} />
            </div>
          </div>

          <div className="chat-input-area">
            <div className="chat-input-row">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder="พิมพ์คำถามที่นี่..."
                className="chat-textarea"
              />
              <button
                onClick={() => handleSend()}
                disabled={isLoading || !input.trim()}
                className="chat-send-btn"
              >
                ส่ง
              </button>
            </div>

            <div className="chat-input-hint">
              กด <b>Shift + Enter</b> เพื่อขึ้นบรรทัดใหม่
            </div>
          </div>
        </section>
      </main>

      {/* Contact Admin Modal */}
      {showContactModal && (
        <div className="modal-overlay" onClick={() => setShowContactModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "450px" }}>
            <div className="modal-header">
              <div className="modal-title">📞 ติดต่อแอดมิน</div>
              <button
                onClick={() => setShowContactModal(false)}
                style={{ background: "none", border: "none", fontSize: "18px", cursor: "pointer", color: "#fff" }}
              >
                ✕
              </button>
            </div>
            <div className="modal-body" style={{ padding: "24px" }}>
              <p style={{ marginBottom: "16px", fontSize: "14px", color: "#6B7280" }}>
                หากคุณพบปัญหาในการใช้งานระบบ หรือต้องการความช่วยเหลือ กรุณาติดต่อทีมงาน:
              </p>
              <div style={{ background: "#F9FAFB", padding: "16px", borderRadius: "8px", marginBottom: "12px" }}>
                <div style={{ marginBottom: "12px" }}>
                  <strong>📧 อีเมล:</strong>
                  <div style={{ marginTop: "4px", color: "#4B5563" }}>support@mfu.ac.th</div>
                </div>
                <div style={{ marginBottom: "12px" }}>
                  <strong>📱 โทรศัพท์:</strong>
                  <div style={{ marginTop: "4px", color: "#4B5563" }}>053-916000</div>
                </div>
                <div>
                  <strong>🕐 เวลาทำการ:</strong>
                  <div style={{ marginTop: "4px", color: "#4B5563" }}>จันทร์-ศุกร์ 08:30-16:30 น.</div>
                </div>
              </div>
              <p style={{ fontSize: "12px", color: "#9CA3AF", marginTop: "16px" }}>
                💡 เคล็ดลับ: ลองรีเฟรชหน้าเว็บ หรือเริ่มแชทใหม่อาจช่วยแก้ปัญหาได้
              </p>
            </div>
            <div className="modal-footer">
              <button
                onClick={() => setShowContactModal(false)}
                className="admin-secondary-btn"
                style={{ width: "100%" }}
              >
                ปิด
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Conversation Confirmation Modal */}
      {deletingConversationId !== null && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: "400px" }}>
            <div className="modal-header" style={{ borderBottom: "none", paddingBottom: 0 }}>
              <h3 style={{ color: "#EF4444", margin: 0 }}>⚠️ ยืนยันการลบ</h3>
            </div>
            <div className="modal-body" style={{ textAlign: "center", padding: "24px 0" }}>
              <p>ต้องการลบห้องสนทนานี้หรือไม่?</p>
              <p style={{ fontSize: "12px", color: "#6B7280" }}>
                การกระทำนี้ไม่สามารถย้อนกลับได้
              </p>
            </div>
            <div className="modal-footer" style={{ justifyContent: "center", gap: "12px", borderTop: "none" }}>
              <button
                className="admin-secondary-btn"
                onClick={() => setDeletingConversationId(null)}
              >
                ยกเลิก
              </button>
              <button
                className="admin-save-btn"
                style={{ background: "#EF4444", border: "none" }}
                onClick={confirmDeleteConversation}
              >
                ยืนยันลบ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
