import type { ReactNode } from "react";

import { Label } from "@/components/ui/label";

type AuthFormFieldProps = {
  htmlFor: string;
  label: ReactNode;
  children: ReactNode;
};

export function AuthFormField({
  htmlFor,
  label,
  children,
}: AuthFormFieldProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  );
}
