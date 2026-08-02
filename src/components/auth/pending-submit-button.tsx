import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";

type PendingSubmitButtonProps = {
  isPending: boolean;
  pendingText: ReactNode;
  children: ReactNode;
};

export function PendingSubmitButton({
  isPending,
  pendingText,
  children,
}: PendingSubmitButtonProps) {
  return (
    <Button
      type="submit"
      className="w-full"
      disabled={isPending}
    >
      {isPending ? pendingText : children}
    </Button>
  );
}
