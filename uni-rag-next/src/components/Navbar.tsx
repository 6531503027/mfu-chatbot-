"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Navbar() {
    const pathname = usePathname();
    const isAdmin = pathname?.startsWith("/admin");

    if (isAdmin) {
        return (
            <header className="global-topbar admin-topbar">
                <div className="global-topbar-inner">
                    <div className="global-topbar-left">
                        <div className="topbar-logo-circle admin-logo">Admin</div>
                        <div className="topbar-text">
                            <div className="topbar-title">ระบบจัดการ (Admin Dashboard)</div>
                            <div className="topbar-subtitle">
                                MFU AI Assistant · Knowledge Management
                            </div>
                        </div>
                    </div>

                    <nav className="global-topbar-nav">
                        <Link href="/" className="topbar-nav-link">
                            ← กลับหน้าหลัก (Student View)
                        </Link>
                    </nav>
                </div>
            </header>
        );
    }

    // Student View
    return (
        <header className="global-topbar">
            <div className="global-topbar-inner">
                <div className="global-topbar-left">
                    <div className="topbar-logo-circle">MFU</div>
                    <div className="topbar-text">
                        <div className="topbar-title">
                            ระบบผู้ช่วย AI มหาวิทยาลัยแม่ฟ้าหลวง
                        </div>
                        <div className="topbar-subtitle">
                            Multi-Agent AI Service for Students · RAG Chatbot
                        </div>
                    </div>
                </div>

                {/* No Admin Link for Students */}
                <nav className="global-topbar-nav">
                    {/* Optional: Add other student links here if needed */}
                </nav>
            </div>
        </header>
    );
}
