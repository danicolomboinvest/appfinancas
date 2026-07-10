"use client";

import Link from "next/link";
import { LogOut } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { MORE_NAV_SECTIONS, ADMIN_NAV_SECTION } from "./nav-sections";

/** Bottom sheet com as seções que não têm tab própria na barra inferior (mobile). */
export function MoreSheet({
  open,
  onClose,
  isAdmin,
  userEmail,
  onLogout,
}: {
  open: boolean;
  onClose: () => void;
  isAdmin: boolean;
  userEmail?: string;
  onLogout: () => void;
}) {
  const sections = isAdmin ? [...MORE_NAV_SECTIONS, ADMIN_NAV_SECTION] : MORE_NAV_SECTIONS;

  return (
    <Modal open={open} onClose={onClose} title="Mais">
      <div className="flex flex-col gap-0.5">
        {sections.map((section) => {
          const Icon = section.icon;
          return (
            <Link
              key={section.basePath}
              href={section.href}
              onClick={onClose}
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-ink transition-colors hover:bg-surface-2"
            >
              <Icon size={18} strokeWidth={1.75} className="text-ink-muted" />
              {section.label}
            </Link>
          );
        })}
      </div>

      <div className="mt-3 border-t border-border pt-3">
        {userEmail && <p className="mb-2 truncate px-3 text-xs text-ink-faint">{userEmail}</p>}
        <button
          type="button"
          onClick={() => {
            onClose();
            onLogout();
          }}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-ink-muted transition-colors hover:bg-danger-soft hover:text-danger"
        >
          <LogOut size={18} strokeWidth={1.75} />
          Sair
        </button>
      </div>
    </Modal>
  );
}
