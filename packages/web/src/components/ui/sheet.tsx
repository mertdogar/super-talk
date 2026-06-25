import * as DialogPrimitive from "@radix-ui/react-dialog";
import { DialogOverlay, DialogPortal } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export const Sheet = DialogPrimitive.Root;

/** A Radix Dialog anchored as a slide-over (left by default, e.g. the mobile nav drawer). */
export function SheetContent({
  className,
  children,
  side = "left",
  title = "Navigation",
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  side?: "left" | "right";
  title?: string;
}): React.JSX.Element {
  return (
    <DialogPortal>
      <DialogOverlay className="z-40" />
      <DialogPrimitive.Content
        className={cn(
          "fixed inset-y-0 z-50 flex h-full w-64 flex-col shadow-xl outline-none duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out",
          side === "right"
            ? "right-0 data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right"
            : "left-0 data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left",
          className,
        )}
        {...props}
      >
        <DialogPrimitive.Title className="sr-only">{title}</DialogPrimitive.Title>
        {children}
      </DialogPrimitive.Content>
    </DialogPortal>
  );
}
