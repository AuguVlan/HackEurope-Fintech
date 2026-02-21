import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { PropsWithChildren } from "react";
import { cn } from "../../lib/cn";

interface DrawerProps extends PropsWithChildren {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
}

export function Drawer({
  open,
  onOpenChange,
  title,
  description,
  children,
}: DrawerProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[90] bg-slate-950/60 backdrop-blur-sm" />
        <Dialog.Content
          className={cn(
            "fixed right-0 top-0 z-[100] h-full w-full max-w-xl border-l border-white/15 bg-slate-950/95 p-5 shadow-2xl shadow-black/60 outline-none",
            "animate-in slide-in-from-right duration-300",
          )}
        >
          <header className="mb-4 flex items-start justify-between gap-4 border-b border-white/10 pb-4">
            <div>
              <Dialog.Title className="text-lg font-semibold text-slate-100">
                {title}
              </Dialog.Title>
              {description ? (
                <Dialog.Description className="text-sm text-slate-400">
                  {description}
                </Dialog.Description>
              ) : null}
            </div>
            <Dialog.Close className="rounded-xl p-2 text-slate-400 transition hover:bg-white/10 hover:text-slate-200">
              <X className="h-4 w-4" />
            </Dialog.Close>
          </header>
          <div className="h-[calc(100%-76px)] overflow-auto pr-1">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
