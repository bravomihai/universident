"use client";

import { useRouter } from "next/navigation";
import { type SubmitEvent, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type UniversityOption = {
  slug: string;
  shortName: string;
  fullName: string;
};

type StudentProfileFormProps = {
  initialName: string;
  initialProfile?: {
    universitySlug: string | null;
    studyYear: number;
    bio: string | null;
  } | null;
  universities: UniversityOption[];
};

export function StudentProfileForm({
  initialName,
  initialProfile,
  universities,
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

    const name = String(formData.get("name") ?? "");
    const universitySlug = String(formData.get("universitySlug") ?? "");
    const studyYear = Number(formData.get("studyYear"));
    const bio = String(formData.get("bio") ?? "");

    try {
      const response = await fetch("/api/student-profile", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          universitySlug,
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
        <Label htmlFor="student-name">Nume</Label>
        <Input
          id="student-name"
          name="name"
          autoComplete="name"
          defaultValue={initialName}
          minLength={2}
          maxLength={100}
          required
        />
        <p className="text-xs text-muted-foreground">
          Numele apare pe profilul profesional și în programările viitoare.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="university">Universitate</Label>
        <Select
          name="universitySlug"
          defaultValue={initialProfile?.universitySlug ?? undefined}
          required
        >
          <SelectTrigger id="university" className="w-full">
            <SelectValue placeholder="Alege universitatea" />
          </SelectTrigger>
          <SelectContent>
            {universities.map((university) => (
              <SelectItem
                key={university.slug}
                value={university.slug}
                title={university.fullName}
              >
                {university.shortName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          Sunt afișate universitățile din România care au program de Medicină
          Dentară în nomenclatorul curent.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="studyYear">An de studiu</Label>
        <Select
          name="studyYear"
          defaultValue={
            initialProfile?.studyYear
              ? String(initialProfile.studyYear)
              : undefined
          }
          required
        >
          <SelectTrigger id="studyYear" className="w-full">
            <SelectValue placeholder="Alege anul de studiu" />
          </SelectTrigger>
          <SelectContent>
            {Array.from({ length: 6 }, (_, index) => index + 1).map((year) => (
              <SelectItem key={year} value={String(year)}>
                Anul {year}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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
