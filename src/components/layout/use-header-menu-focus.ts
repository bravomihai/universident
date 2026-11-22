"use client";

import { useRef, type ComponentProps } from "react";

import type { DropdownMenuContent } from "@/components/ui/dropdown-menu";

type MenuContentProps = ComponentProps<typeof DropdownMenuContent>;

export function useHeaderMenuFocus() {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const openedContextMenu = useRef(false);

  const onPointerDownOutside: MenuContentProps["onPointerDownOutside"] = (event) => {
    const { button, ctrlKey } = event.detail.originalEvent;
    openedContextMenu.current = button === 2 || (button === 0 && ctrlKey);
  };

  const onCloseAutoFocus: MenuContentProps["onCloseAutoFocus"] = (event) => {
    event.preventDefault();
    if (!openedContextMenu.current) {
      triggerRef.current?.focus({ preventScroll: true });
    }
    openedContextMenu.current = false;
  };

  return { triggerRef, onPointerDownOutside, onCloseAutoFocus };
}
