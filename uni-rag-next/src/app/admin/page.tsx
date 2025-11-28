"use client";

import { useEffect, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";

/**
 * ให้ตรงกับ DocumentOut ของ backend:
 * id: int
 * title: str
 * current_content: Optional[str]
 * created_at: datetime
 * updated_at: datetime
 */
interface DocumentModel {
  id: number;
  title: string;
  current_content?: string | null;
  created_at: string;
  updated_at: string;
}

interface FeedbackModel {
  id: number;
  question: string;
  answer: string;
  is_helpful: boolean;
  comment?: string | null;
  created_at: string;
}

export default function AdminPage() {
  // ---------------------------
  // STATE
  // ---------------------------
  const [adminToken, setAdminToken] = useState("");
  const [docTitle, setDocTitle] = useState("");
  const [docContent, setDocContent] = useState("");
  const [docUpdatedBy, setDocUpdatedBy] = useState("admin01");

  const [editingId, setEditingId] = useState<number | null>(null);

  const [status, setStatus] = useState<string | null>(null);

  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfStatus, setPdfStatus] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const [docs, setDocs] = useState<DocumentModel[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);

  // Tab and filter state
  const [activeTab, setActiveTab] = useState<"documents" | "upload" | "feedback" | "settings" | "statistics">("documents");
  const [searchQuery, setSearchQuery] = useState("");

  // Statistics state
  const [stats, setStats] = useState<any>(null);
  const [topQuestions, setTopQuestions] = useState<any[]>([]);
  const [intents, setIntents] = useState<any[]>([]);
  const [loadingStats, setLoadingStats] = useState(false);

  // Document preview modal state
  const [previewDoc, setPreviewDoc] = useState<DocumentModel | null>(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [loadingPreviewId, setLoadingPreviewId] = useState<number | null>(null);

  // Delete confirmation state
  const [deletingId, setDeletingId] = useState<number | null>(null);

  // Feedback state
  const [feedbackList, setFeedbackList] = useState<FeedbackModel[]>([]);
  const [loadingFeedback, setLoadingFeedback] = useState(false);

  // ---------------------------
  // HELPERS
  // ---------------------------

  function formatDate(dt: string) {
    if (!dt) return "-";
    const d = new Date(dt);
    if (Number.isNaN(d.getTime())) return dt;
    return d.toLocaleString("th-TH", {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

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

  function getErrorMessage(err: unknown): string {
    if (err instanceof Error) return err.message;
    if (typeof err === "string") return err;
    return "Unknown error";
  }

  // ---------------------------
  // INIT LOAD TOKEN
  // ---------------------------

  useEffect(() => {
    const stored =
      typeof window !== "undefined"
        ? window.localStorage.getItem("uni_admin_token")
        : null;
    if (stored) setAdminToken(stored);
  }, []);

  useEffect(() => {
    if (adminToken) {
      loadDocs();
    }
  }, [adminToken]);

  // Auto-refresh feedback when tab is active
  useEffect(() => {
    if (activeTab === "feedback" && adminToken) {
      loadFeedback(); // Load immediately
      const interval = setInterval(() => {
        loadFeedback();
      }, 10000); // Refresh every 10 seconds

      return () => clearInterval(interval);
    }
  }, [activeTab, adminToken]);

  // ---------------------------
  // LOAD DOCS
  // ---------------------------

  async function loadDocs() {
    if (!adminToken) return;
    setLoadingDocs(true);
    setStatus(null);

    try {
      const res = await fetch(`${API_BASE}/admin/documents/list`, {
        headers: { "X-API-Key": adminToken },
      });

      if (!res.ok) {
        throw new Error(await readError(res));
      }

      const data: DocumentModel[] = await res.json();
      setDocs(data);
      setStatus(`📄 โหลดเอกสารล่าสุด ${data.length} รายการ`);
    } catch (err) {
      setStatus("❌ โหลดรายการเอกสารไม่สำเร็จ: " + getErrorMessage(err));
    } finally {
      setLoadingDocs(false);
    }
  }

  // Load feedback
  async function loadFeedback() {
    if (!adminToken) return;
    setLoadingFeedback(true);

    try {
      const res = await fetch(`${API_BASE}/admin/feedback?limit=100`, {
        headers: { "X-API-Key": adminToken },
      });

      if (res.ok) {
        const data: FeedbackModel[] = await res.json();
        setFeedbackList(data);
      }
    } catch (err) {
      console.error("Failed to load feedback:", err);
    } finally {
      setLoadingFeedback(false);
    }
  }

  // Load statistics
  async function loadStats() {
    if (!adminToken) return;
    setLoadingStats(true);

    try {
      const [summaryRes, questionsRes, intentsRes] = await Promise.all([
        fetch(`${API_BASE}/admin/stats/summary`, {
          headers: { "X-API-Key": adminToken },
        }),
        fetch(`${API_BASE}/admin/stats/top-questions?limit=10`, {
          headers: { "X-API-Key": adminToken },
        }),
        fetch(`${API_BASE}/admin/stats/intents`, {
          headers: { "X-API-Key": adminToken },
        }),
      ]);

      if (summaryRes.ok) {
        setStats(await summaryRes.json());
      }
      if (questionsRes.ok) {
        setTopQuestions(await questionsRes.json());
      }
      if (intentsRes.ok) {
        setIntents(await intentsRes.json());
      }
    } catch (err) {
      console.error("Failed to load stats:", err);
    } finally {
      setLoadingStats(false);
    }
  }

  // ---------------------------
  // SAVE TOKEN
  // ---------------------------

  function handleSaveToken() {
    const trimmed = adminToken.trim();
    if (!trimmed) {
      setStatus("⚠ กรุณากรอก Token");
      return;
    }
    if (typeof window !== "undefined") {
      window.localStorage.setItem("uni_admin_token", trimmed);
    }
    setAdminToken(trimmed);
    setStatus("✅ บันทึก Admin Token แล้ว");
    loadDocs();
  }

  // ---------------------------
  // SAVE TEXT (สร้างใหม่ / แก้ไข)
  // ---------------------------

  async function handleSaveText() {
    if (!adminToken) {
      setStatus("❌ กรุณาตั้งค่า Token");
      return;
    }

    if (!docTitle.trim() || !docContent.trim()) {
      setStatus("⚠ กรุณากรอกข้อมูลให้ครบ");
      return;
    }

    const isEditing = editingId !== null;
    const url = isEditing
      ? `${API_BASE}/admin/documents/${editingId}`
      : `${API_BASE}/admin/documents`;
    const method = isEditing ? "PUT" : "POST";

    setStatus("⏳ กำลังบันทึก...");

    try {
      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": adminToken,
        },
        body: JSON.stringify({
          title: docTitle.trim(),
          content: docContent.trim(),
          updated_by: docUpdatedBy.trim(),
        }),
      });

      if (!res.ok) {
        throw new Error(await readError(res));
      }

      const data: DocumentModel = await res.json();

      if (isEditing) {
        // แก้ไขเอกสารเดิม
        setStatus(`✅ อัปเดตสำเร็จ (id=${data.id})`);
        // คง editingId เดิมไว้ เผื่ออยากแก้ซ้ำ
      } else {
        // สร้างเอกสารใหม่ → ให้สร้างได้เรื่อย ๆ
        setStatus(`✅ เพิ่มข้อมูลใหม่แล้ว (id=${data.id})`);
        // กลับสู่โหมด "สร้างใหม่" (ไม่อยู่ในโหมดแก้ไข)
        setEditingId(null);
        // เคลียร์ฟอร์มเตรียมสร้างเอกสารใหม่
        setDocTitle("");
        setDocContent("");
      }

      // รีโหลดรายการเอกสาร
      loadDocs();
    } catch (err) {
      setStatus("❌ บันทึกไม่สำเร็จ: " + getErrorMessage(err));
    }
  }

  // ---------------------------
  // LOAD SINGLE DOCUMENT (เข้าโหมดแก้ไข)
  // ---------------------------

  async function handleSelectDoc(id: number) {
    if (!adminToken) return;

    try {
      const res = await fetch(`${API_BASE}/admin/documents/${id}`, {
        headers: { "X-API-Key": adminToken },
      });

      if (!res.ok) {
        throw new Error(await readError(res));
      }

      const data: DocumentModel = await res.json();

      setEditingId(data.id);
      setDocTitle(data.title);
      setDocContent(data.current_content || "");
      setActiveTab("upload");
      setStatus(`✏️ โหมดแก้ไขเอกสาร (id=${data.id})`);
    } catch (err) {
      setStatus("❌ อ่านเอกสารไม่สำเร็จ: " + getErrorMessage(err));
    }
  }

  // ---------------------------
  // PREVIEW DOCUMENT
  // ---------------------------

  async function handlePreviewDoc(id: number) {
    if (!adminToken) return;
    setLoadingPreviewId(id);

    try {
      const res = await fetch(`${API_BASE}/admin/documents/${id}`, {
        headers: { "X-API-Key": adminToken },
      });

      if (!res.ok) {
        throw new Error(await readError(res));
      }

      const data: DocumentModel = await res.json();
      setPreviewDoc(data);
      setShowPreviewModal(true);
    } catch (err) {
      setStatus("❌ อ่านเอกสารไม่สำเร็จ: " + getErrorMessage(err));
    } finally {
      setLoadingPreviewId(null);
    }
  }

  // ---------------------------
  // DELETE DOCUMENT
  // ---------------------------

  // ---------------------------
  // DELETE DOCUMENT
  // ---------------------------

  function handleDeleteDoc(id: number) {
    setDeletingId(id);
  }

  async function confirmDelete() {
    if (!adminToken || deletingId === null) return;

    try {
      const res = await fetch(`${API_BASE}/admin/documents/${deletingId}`, {
        method: "DELETE",
        headers: { "X-API-Key": adminToken },
      });

      if (!res.ok) {
        throw new Error(await readError(res));
      }

      setStatus("✅ ลบสำเร็จ");
      if (editingId === deletingId) clearForm();
      loadDocs();
    } catch (err) {
      setStatus("❌ ลบไม่สำเร็จ: " + getErrorMessage(err));
    } finally {
      setDeletingId(null);
    }
  }

  // ---------------------------
  // UPLOAD PDF
  // ---------------------------

  async function handleUploadPdf() {
    if (!adminToken) {
      setPdfStatus("❌ กรุณาตั้งค่า Token");
      return;
    }
    if (!pdfFile) {
      setPdfStatus("⚠ กรุณาเลือกไฟล์ PDF");
      return;
    }

    setPdfStatus("⏳ กำลังอัปโหลด...");

    const formData = new FormData();
    formData.append("file", pdfFile);

    try {
      const res = await fetch(`${API_BASE}/admin/upload_pdf`, {
        method: "POST",
        headers: { "X-API-Key": adminToken },
        body: formData,
      });

      if (!res.ok) {
        throw new Error(await readError(res));
      }

      const data: { id: number; chars: number } = await res.json();
      setPdfStatus(`✅ สำเร็จ (id=${data.id}, ${data.chars} ตัวอักษร)`);

      setPdfFile(null);
      loadDocs();
    } catch (err) {
      setPdfStatus("❌ อัปโหลดล้มเหลว: " + getErrorMessage(err));
    }
  }

  function clearForm() {
    setEditingId(null);
    setDocTitle("");
    setDocContent("");
    setStatus("โหมดเพิ่มเนื้อหาใหม่");
  }

  // ---------------------------
  // DRAG AND DROP HANDLERS
  // ---------------------------

  function handleDragEnter(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const file = files[0];
      if (file.type === "application/pdf") {
        setPdfFile(file);
        setPdfStatus(null);
      } else {
        setPdfStatus("⚠ กรุณาเลือกไฟล์ PDF เท่านั้น");
      }
    }
  }

  // Filter documents
  const filteredDocs = docs.filter((d) =>
    d.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const pdfDocs = filteredDocs.filter((d) => d.title.startsWith("[PDF]"));
  const textDocs = filteredDocs.filter((d) => !d.title.startsWith("[PDF]"));

  // ---------------------------
  // UI
  // ---------------------------

  return (
    <div className="admin-root" style={{ padding: "1.5rem" }}>
      <h1 className="page-title">
        หน้าจัดการเนื้อหา (Admin)
      </h1>

      {/* ---------------- TAB NAVIGATION ---------------- */}
      <div className="admin-tabs">
        <button
          className={`admin-tab ${activeTab === "documents" ? "active" : ""}`}
          onClick={() => setActiveTab("documents")}
        >
          📄 เอกสารทั้งหมด
          <span className="badge badge--count">{docs.length}</span>
        </button>
        <button
          className={`admin-tab ${activeTab === "upload" ? "active" : ""}`}
          onClick={() => setActiveTab("upload")}
        >
          ➕ เพิ่มเนื้อหา
        </button>
        <button
          className={`admin-tab ${activeTab === "feedback" ? "active" : ""}`}
          onClick={() => {
            setActiveTab("feedback");
            loadFeedback();
          }}
        >
          💬 Feedback
        </button>
        <button
          className={`admin-tab ${activeTab === "settings" ? "active" : ""}`}
          onClick={() => setActiveTab("settings")}
        >
          ⚙️ ตั้งค่า
        </button>
        <button
          className={`admin-tab ${activeTab === "statistics" ? "active" : ""}`}
          onClick={() => {
            setActiveTab("statistics");
            loadStats();
          }}
        >
          📊 สถิติ
        </button>
      </div>

      {/* ---------------- SETTINGS TAB ---------------- */}
      {activeTab === "settings" && (
        <section className="panel">
          <div className="panel-header">ตั้งค่า Admin Token</div>
          <div className="panel-body">
            <input
              className="field-input"
              value={adminToken}
              onChange={(e) => setAdminToken(e.target.value)}
              placeholder="ค่าเดียวกับ ADMIN_TOKEN ใน backend"
            />
            <button onClick={handleSaveToken} className="admin-save-btn">
              บันทึก Token
            </button>
          </div>
        </section>
      )}

      {/* ---------------- UPLOAD TAB ---------------- */}
      {activeTab === "upload" && (
        <>
          {/* TEXT FORM */}
          <section className="panel upload-panel">
            <div className="panel-header">
              📝 เพิ่ม / แก้ไขเนื้อหา (Text){" "}
              {editingId && (
                <span className="editing-badge">แก้ไข ID: {editingId}</span>
              )}
            </div>
            <div className="panel-body">
              <div className="form-group">
                <label className="form-label">ชื่อเรื่อง</label>
                <input
                  className="field-input"
                  placeholder="กรอกชื่อเอกสาร..."
                  value={docTitle}
                  onChange={(e) => setDocTitle(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">เนื้อหา</label>
                <textarea
                  className="field-textarea upload-textarea"
                  placeholder="กรอกเนื้อหาเอกสาร..."
                  value={docContent}
                  onChange={(e) => setDocContent(e.target.value)}
                  rows={12}
                />
                <div className="char-count">
                  {docContent.length.toLocaleString()} ตัวอักษร
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">ผู้แก้ไข</label>
                <input
                  className="field-input"
                  value={docUpdatedBy}
                  onChange={(e) => setDocUpdatedBy(e.target.value)}
                  placeholder="ชื่อผู้แก้ไข เช่น admin01"
                />
              </div>

              <div className="admin-form-actions">
                <button onClick={handleSaveText} className="admin-save-btn">
                  {editingId ? "💾 อัปเดตเอกสาร" : "✨ สร้างเอกสารใหม่"}
                </button>
                <button onClick={clearForm} className="admin-secondary-btn">
                  🗑️ ล้างฟอร์ม
                </button>
              </div>
            </div>
          </section>

          {/* PDF UPLOAD */}
          <section className="panel upload-panel">
            <div className="panel-header">📄 อัปโหลด PDF</div>
            <div className="panel-body">
              <div
                className={`pdf-drop-zone ${isDragging ? "dragging" : ""} ${pdfFile ? "has-file" : ""}`}
                onDragEnter={handleDragEnter}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                {pdfFile ? (
                  <div className="pdf-file-info">
                    <div className="pdf-icon">📕</div>
                    <div className="pdf-details">
                      <div className="pdf-filename">{pdfFile.name}</div>
                      <div className="pdf-filesize">
                        {(pdfFile.size / 1024 / 1024).toFixed(2)} MB
                      </div>
                    </div>
                    <button
                      className="pdf-remove-btn"
                      onClick={() => {
                        setPdfFile(null);
                        setPdfStatus(null);
                      }}
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="drop-zone-icon">📎</div>
                    <div className="drop-zone-text">
                      ลากไฟล์ PDF มาวางที่นี่
                    </div>
                    <div className="drop-zone-or">หรือ</div>
                    <label className="drop-zone-browse">
                      เลือกไฟล์
                      <input
                        type="file"
                        accept="application/pdf"
                        onChange={(e) => {
                          setPdfFile(e.target.files?.[0] || null);
                          setPdfStatus(null);
                        }}
                        style={{ display: "none" }}
                      />
                    </label>
                  </>
                )}
              </div>

              {pdfFile && (
                <button onClick={handleUploadPdf} className="admin-save-btn" style={{ marginTop: 16 }}>
                  📤 อัปโหลด PDF
                </button>
              )}

              {pdfStatus && <div className="admin-status">{pdfStatus}</div>}
            </div>
          </section>
        </>
      )}

      {/* ---------------- DOCUMENTS TAB ---------------- */}
      {activeTab === "documents" && (
        <>
          {/* Filter Bar */}
          <div className="filter-bar">
            <input
              type="text"
              className="filter-input"
              placeholder="🔍 ค้นหาเอกสาร..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Text Documents */}
          {textDocs.length > 0 && (
            <section className="panel" style={{ marginBottom: 24 }}>
              <div className="panel-header">
                📝 เอกสารข้อความ
                <span className="badge badge--text">{textDocs.length}</span>
              </div>
              <div className="panel-body">
                {loadingDocs ? (
                  <div>⏳ กำลังโหลด...</div>
                ) : (
                  <table className="docs-table">
                    <thead>
                      <tr>
                        <th style={{ width: 60 }}>ID</th>
                        <th>ชื่อเรื่อง</th>
                        <th style={{ width: 180 }}>ปรับปรุงล่าสุด</th>
                        <th style={{ width: 150 }}>จัดการ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {textDocs.map((d) => (
                        <tr key={d.id}>
                          <td>{d.id}</td>
                          <td>
                            <div style={{ display: "flex", alignItems: "center" }}>
                              <span className="doc-icon doc-icon--text">T</span>
                              {d.title}
                            </div>
                          </td>
                          <td>{formatDate(d.updated_at)}</td>
                          <td>
                            <button
                              onClick={() => handlePreviewDoc(d.id)}
                              className="table-btn table-btn-primary"
                              disabled={loadingPreviewId === d.id}
                            >
                              {loadingPreviewId === d.id ? "⏳..." : "👁️ ดู"}
                            </button>
                            <button
                              onClick={() => handleSelectDoc(d.id)}
                              className="table-btn"
                            >
                              ✏️ แก้ไข
                            </button>
                            <button
                              onClick={() => handleDeleteDoc(d.id)}
                              className="table-btn table-btn-danger"
                            >
                              🗑️ ลบ
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </section>
          )}

          {/* PDF Documents */}
          {pdfDocs.length > 0 && (
            <section className="panel">
              <div className="panel-header">
                📕 เอกสาร PDF
                <span className="badge badge--pdf">{pdfDocs.length}</span>
              </div>
              <div className="panel-body">
                {loadingDocs ? (
                  <div>⏳ กำลังโหลด...</div>
                ) : (
                  <table className="docs-table">
                    <thead>
                      <tr>
                        <th style={{ width: 60 }}>ID</th>
                        <th>ชื่อเรื่อง</th>
                        <th style={{ width: 180 }}>ปรับปรุงล่าสุด</th>
                        <th style={{ width: 150 }}>จัดการ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pdfDocs.map((d) => (
                        <tr key={d.id}>
                          <td>{d.id}</td>
                          <td>
                            <div style={{ display: "flex", alignItems: "center" }}>
                              <span className="doc-icon doc-icon--pdf">PDF</span>
                              {d.title.replace("[PDF] ", "")}
                            </div>
                          </td>
                          <td>{formatDate(d.updated_at)}</td>
                          <td>
                            <button
                              onClick={() => handlePreviewDoc(d.id)}
                              className="table-btn table-btn-primary"
                              disabled={loadingPreviewId === d.id}
                            >
                              {loadingPreviewId === d.id ? "⏳..." : "👁️ ดู"}
                            </button>
                            <button
                              onClick={() => handleDeleteDoc(d.id)}
                              className="table-btn table-btn-danger"
                            >
                              🗑️ ลบ
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </section>
          )}

          {filteredDocs.length === 0 && !loadingDocs && (
            <section className="panel">
              <div className="panel-body">
                {searchQuery ? "ไม่พบเอกสารที่ตรงกับการค้นหา" : "ยังไม่มีเอกสาร"}
              </div>
            </section>
          )}
        </>
      )}

      {/* ---------------- FEEDBACK TAB ---------------- */}
      {activeTab === "feedback" && (
        <section className="panel">
          <div className="panel-header">
            💬 User Feedback
            <button
              onClick={loadFeedback}
              className="admin-secondary-btn"
              style={{ marginLeft: "auto", padding: "6px 12px", fontSize: "12px" }}
              disabled={loadingFeedback}
            >
              {loadingFeedback ? "⏳ กำลังโหลด..." : "🔄 รีเฟรช"}
            </button>
          </div>
          <div className="panel-body">
            {loadingFeedback ? (
              <div>⏳ กำลังโหลด...</div>
            ) : feedbackList.length === 0 ? (
              <div>ยังไม่มี Feedback</div>
            ) : (
              <table className="docs-table">
                <thead>
                  <tr>
                    <th style={{ width: 60 }}>ID</th>
                    <th style={{ width: 100 }}>ประเมิน</th>
                    <th>ความเห็น</th>
                    <th style={{ width: 180 }}>วันที่</th>
                  </tr>
                </thead>
                <tbody>
                  {feedbackList.map((f) => (
                    <tr key={f.id}>
                      <td>{f.id}</td>
                      <td>
                        <span className={f.is_helpful ? "badge badge--success" : "badge badge--danger"}>
                          {f.is_helpful ? "✅ ชอบ" : "❌ ไม่ชอบ"}
                        </span>
                      </td>
                      <td>
                        {f.comment ? (
                          <div style={{ fontSize: "13px", color: "#374151" }}>
                            {f.comment}
                          </div>
                        ) : (
                          <span style={{ color: "#D1D5DB", fontStyle: "italic" }}>ไม่มีความเห็น</span>
                        )}
                      </td>
                      <td>{formatDate(f.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>
      )}

      {/* ---------------- STATISTICS TAB ---------------- */}
      {activeTab === "statistics" && (
        <>
          {loadingStats ? (
            <div className="panel">
              <div className="panel-body">⏳ กำลังโหลดสถิติ...</div>
            </div>
          ) : (
            <>
              {/* Summary Cards */}
              {stats && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 24 }}>
                  <div className="stat-card">
                    <div className="stat-card-value">{stats.total_questions}</div>
                    <div className="stat-card-label">คำถามทั้งหมด</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-card-value">{stats.total_documents}</div>
                    <div className="stat-card-label">เอกสารในระบบ</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-card-value">{stats.total_feedback}</div>
                    <div className="stat-card-label">Feedback ทั้งหมด</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-card-value">{stats.feedback_rate}%</div>
                    <div className="stat-card-label">อัตราความพึงพอใจ</div>
                  </div>
                </div>
              )}

              {/* Top Questions */}
              {topQuestions.length > 0 && (
                <section className="panel" style={{ marginBottom: 24 }}>
                  <div className="panel-header">🔥 คำถามยอดนิยม Top 10</div>
                  <div className="panel-body">
                    <table className="docs-table">
                      <thead>
                        <tr>
                          <th style={{ width: 60 }}>#</th>
                          <th>คำถาม</th>
                          <th style={{ width: 100 }}>จำนวนครั้ง</th>
                        </tr>
                      </thead>
                      <tbody>
                        {topQuestions.map((q: any, idx: number) => (
                          <tr key={idx}>
                            <td>{idx + 1}</td>
                            <td>{q.question}</td>
                            <td><span className="badge badge--count">{q.count}</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}

              {/* Intent Distribution */}
              {intents.length > 0 && (
                <section className="panel">
                  <div className="panel-header">🎯 การกระจายตาม Intent</div>
                  <div className="panel-body">
                    <div style={{ display: "grid", gap: 12 }}>
                      {intents.map((intent: any, idx: number) => (
                        <div key={idx} className="intent-bar">
                          <div className="intent-bar-label">{intent.intent}</div>
                          <div className="intent-bar-container">
                            <div
                              className="intent-bar-fill"
                              style={{ width: `${(intent.count / Math.max(...intents.map((i: any) => i.count))) * 100}%` }}
                            />
                            <span className="intent-bar-count">{intent.count}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </section>
              )}
            </>
          )}
        </>
      )}

      {status && (
        <div className="admin-status" style={{ marginTop: 20 }}>
          {status}
        </div>
      )}

      {/* ---------------- DELETE CONFIRMATION MODAL ---------------- */}
      {deletingId !== null && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: "400px" }}>
            <div className="modal-header" style={{ borderBottom: "none", paddingBottom: 0 }}>
              <h3 style={{ color: "#EF4444", margin: 0 }}>⚠️ ยืนยันการลบ</h3>
            </div>
            <div className="modal-body" style={{ textAlign: "center", padding: "24px 0" }}>
              <p>คุณแน่ใจหรือไม่ที่จะลบเอกสารนี้?</p>
              <p style={{ fontSize: "12px", color: "#6B7280" }}>
                การกระทำนี้ไม่สามารถย้อนกลับได้
              </p>
            </div>
            <div className="modal-footer" style={{ justifyContent: "center", gap: "12px", borderTop: "none" }}>
              <button
                className="admin-secondary-btn"
                onClick={() => setDeletingId(null)}
              >
                ยกเลิก
              </button>
              <button
                className="admin-save-btn"
                style={{ background: "#EF4444", border: "none" }}
                onClick={confirmDelete}
              >
                ยืนยันลบ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------------- PREVIEW MODAL ---------------- */}
      {showPreviewModal && previewDoc && (
        <div className="modal-overlay" onClick={() => setShowPreviewModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">
                {previewDoc.title.startsWith("[PDF]") ? (
                  <>
                    <span className="doc-icon doc-icon--pdf">PDF</span>
                    {previewDoc.title.replace("[PDF] ", "")}
                  </>
                ) : (
                  <>
                    <span className="doc-icon doc-icon--text">T</span>
                    {previewDoc.title}
                  </>
                )}
              </div>
              <button
                className="modal-close-btn" // Note: Ensure this class exists or use inline style if needed. Previous code had modal-close-btn
                onClick={() => setShowPreviewModal(false)}
                style={{ background: "none", border: "none", fontSize: "18px", cursor: "pointer" }}
              >
                ✕
              </button>
            </div>
            <div className="modal-body">
              <div className="modal-meta">
                <div className="modal-meta-item">
                  <strong>ID:</strong> {previewDoc.id}
                </div>
                <div className="modal-meta-item">
                  <strong>สร้างเมื่อ:</strong> {formatDate(previewDoc.created_at)}
                </div>
                <div className="modal-meta-item">
                  <strong>แก้ไขล่าสุด:</strong> {formatDate(previewDoc.updated_at)}
                </div>
              </div>
              <div className="modal-content-preview">
                <div className="preview-label">เนื้อหา:</div>
                <div className="preview-text">
                  {previewDoc.current_content || "(ไม่มีเนื้อหา)"}
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button
                onClick={() => {
                  setShowPreviewModal(false);
                  handleSelectDoc(previewDoc.id);
                }}
                className="admin-save-btn"
              >
                ✏️ แก้ไขเอกสาร
              </button>
              <button
                onClick={() => setShowPreviewModal(false)}
                className="admin-secondary-btn"
              >
                ปิด
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
