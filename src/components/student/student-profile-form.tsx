"use client";

import { useRouter } from "next/navigation";
import { type SubmitEvent, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type StudentProfileFormProps = {
  initialProfile?: {
    university: string;
    studyYear: number;
    bio: string | null;
  } | null;
};

export function StudentProfileForm({
  initialProfile,
}: StudentProfileFormProps) {
  const router = useRouter();

  const [isPending, setIsPending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();

    setIsPending(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    const formData = new FormData(event.currentTarget);

    const university = String(formData.get("university") ?? "");
    const studyYear = Number(formData.get("studyYear"));
    const bio = String(formData.get("bio") ?? "");

    try {
      const response = await fetch("/api/student-profile", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          university,
          studyYear,
          bio,
        }),
      });

      const result = (await response.json()) as {
        error?: string;
      };

      if (!response.ok) {
        setErrorMessage(
          result.error ?? "Profilul nu a putut fi salvat.",
        );
        return;
      }

      setSuccessMessage("Profilul a fost salvat.");
      router.refresh();
    } catch {
      setErrorMessage(
        "A apărut o eroare de conexiune. Încearcă din nou.",
      );
    } finally {
      setIsPending(false);
    }
  }

  return (
    <form className="space-y-6" onSubmit={handleSubmit}>
      <div className="space-y-2">
        <Label htmlFor="university">Universitate</Label>
        <Input
          id="university"
          name="university"
          defaultValue={initialProfile?.university}
          maxLength={120}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="studyYear">An de studiu</Label>
        <Input
          id="studyYear"
          name="studyYear"
          type="number"
          min={1}
          max={6}
          defaultValue={initialProfile?.studyYear}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="bio">Descriere</Label>
        <textarea
          id="bio"
          name="bio"
          defaultValue={initialProfile?.bio ?? ""}
          maxLength={1000}
          rows={6}
          className="flex w-full resize-y rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none transition placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
        />
        <p className="text-xs text-muted-foreground">
          Maximum 1000 de caractere.
        </p>
      </div>

      {errorMessage ? (
        <p role="alert" className="text-sm text-destructive">
          {errorMessage}
        </p>
      ) : null}

      {successMessage ? (
        <p role="status" className="text-sm text-foreground">
          {successMessage}
        </p>
      ) : null}

      <Button type="submit" disabled={isPending}>
        {isPending ? "Se salvează..." : "Salvează profilul"}
      </Button>
    </form>
  );
}
