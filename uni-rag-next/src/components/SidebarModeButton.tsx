import React from "react";

interface SidebarModeButtonProps {
    label: string;
    icon: string;
    active?: boolean;
    onClick: () => void;
}

export default function SidebarModeButton({
    label,
    icon,
    active,
    onClick,
}: SidebarModeButtonProps) {
    return (
        <button
            type="button"
            onClick={onClick}
            title="คลิกเพื่อเริ่มแชทใหม่"
            className={
                "sidebar-mode-btn" + (active ? " sidebar-mode-btn--active" : "")
            }
        >
            <span className="sidebar-mode-icon">{icon}</span>
            <span>{label}</span>
        </button>
    );
}
