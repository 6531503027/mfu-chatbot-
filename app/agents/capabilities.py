from sqlalchemy.orm import Session
from app.models.sql import Document

class CapabilitiesAgent:
    """
    Agent สำหรับตอบคำถามว่า "ทำอะไรได้บ้าง" หรือ "มีความรู้อะไรบ้าง"
    โดยการดึงรายชื่อเอกสารที่มีในระบบมาแสดง
    """

    def answer(self, db: Session) -> str:
        # ดึงรายชื่อเอกสารทั้งหมด
        docs = db.query(Document).all()

        if not docs:
            return "ขณะนี้ระบบยังไม่มีข้อมูลเอกสารใดๆ ครับ"

        # สร้างรายการชื่อเอกสาร
        doc_list = []
        for d in docs:
            title = d.title.strip()
            if title:
                doc_list.append(f"- {title}")

        if not doc_list:
             return "ขณะนี้ระบบยังไม่มีข้อมูลเอกสารใดๆ ครับ"

        # Format คำตอบ
        text = "ตอนนี้ผมสามารถตอบคำถามจากเอกสารเหล่านี้ได้ครับ:\n\n"
        text += "\n".join(doc_list)
        text += "\n\nคุณสามารถถามรายละเอียดเกี่ยวกับหัวข้อเหล่านี้ได้เลยครับ"

        return text
