import * as DialogPrimitive from "@radix-ui/react-dialog";
import { DialogOverlay, DialogPortal } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export const Sheet = DialogPrimitive.Root;

/** A Radix Dialog anchored as a left slide-over (mobile nav drawer). */
export function SheetContent({
  className,
  children,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content>): React.JSX.Element {
  return (
    <DialogPortal>
      <DialogOverlay className="z-40" />
      <DialogPrimitive.Content
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex h-full w-64 flex-col shadow-xl outline-none duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left",
          className,
        )}
        {...props}
      >
        <DialogPrimitive.Title className="sr-only">Navigation</DialogPrimitive.Title>
        {children}
      </DialogPrimitive.Content>
    </DialogPortal>
  );
}
