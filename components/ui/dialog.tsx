"use client";
import * as D from "@radix-ui/react-dialog";
import { X } from "lucide-react";
export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  wide = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <D.Portal>
        <D.Overlay className="modal-overlay" />
        <D.Content
          className={`modal ${wide ? "modal-wide" : ""}`}
          onOpenAutoFocus={undefined}
        >
          <div className="modal-heading">
            <div>
              <D.Title>{title}</D.Title>
              <D.Description className={description ? "muted" : "sr-only"}>
                {description || title}
              </D.Description>
            </div>
            <D.Close className="icon-button" aria-label="Close dialog">
              <X size={20} />
            </D.Close>
          </div>
          {children}
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}
