"use client";

import { ImagePlus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  type ChangeEvent,
  type SubmitEvent,
  useEffect,
  useRef,
  useState,
} from "react";

import { PublicStudentAvatar } from "@/components/public-students/public-student-avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const maximumImageBytes = 2 * 1024 * 1024;
const acceptedImageTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

type StudentProfileImageFormProps = {
  name: string;
  hasProfile: boolean;
  initialImageUrl: string | null;
};

type ImageResponse = {
  error?: string;
  imageUrl?: string | null;
};

export function StudentProfileImageForm({
  name,
  hasProfile,
  initialImageUrl,
}: StudentProfileImageFormProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [currentImageUrl, setCurrentImageUrl] = useState(initialImageUrl);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  function resetSelection() {
    setSelectedFile(null);
    setPreviewUrl(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  function selectImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0] ?? null;
    setErrorMessage(null);
    setStatusMessage(null);

    if (!file) {
      resetSelection();
      return;
    }

    if (!acceptedImageTypes.has(file.type)) {
      resetSelection();
      setErrorMessage("Folosește o imagine JPEG, PNG sau WebP.");
      return;
    }

    if (file.size > maximumImageBytes) {
      resetSelection();
      setErrorMessage("Imaginea poate avea cel mult 2 MB.");
      return;
    }

    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  }

  async function uploadImage(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedFile || !hasProfile || isPending) return;

    setIsPending(true);
    setErrorMessage(null);
    setStatusMessage(null);

    const formData = new FormData();
    formData.set("image", selectedFile);

    try {
      const response = await fetch("/api/student-profile/image", {
        method: "PUT",
        body: formData,
      });
      const result = (await response.json()) as ImageResponse;

      if (!response.ok || !result.imageUrl) {
        setErrorMessage(
          result.error ?? "Fotografia nu a putut fi salvată.",
        );
        return;
      }

      setCurrentImageUrl(result.imageUrl);
      resetSelection();
      setStatusMessage("Fotografia de profil a fost salvată.");
      router.refresh();
    } catch {
      setErrorMessage(
        "A apărut o eroare de conexiune. Încearcă din nou.",
      );
    } finally {
      setIsPending(false);
    }
  }

  async function deleteImage() {
    if (!currentImageUrl || isPending) return;

    setIsPending(true);
    setErrorMessage(null);
    setStatusMessage(null);

    try {
      const response = await fetch("/api/student-profile/image", {
        method: "DELETE",
      });
      const result = (await response.json()) as ImageResponse;

      if (!response.ok) {
        setErrorMessage(
          result.error ?? "Fotografia nu a putut fi ștearsă.",
        );
        return;
      }

      setCurrentImageUrl(null);
      resetSelection();
      setStatusMessage(
        "Fotografia a fost ștearsă. Profilul folosește din nou inițialele.",
      );
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
    <form className="space-y-4" onSubmit={uploadImage}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <PublicStudentAvatar
          name={name}
          imageUrl={previewUrl ?? currentImageUrl}
          className="size-24 text-2xl"
        />

        <div className="min-w-0 flex-1 space-y-2">
          <Label htmlFor="student-profile-image">Alege fotografia</Label>
          <Input
            ref={inputRef}
            id="student-profile-image"
            name="image"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            disabled={!hasProfile || isPending}
            onChange={selectImage}
          />
          <p className="text-xs text-muted-foreground">
            JPEG, PNG sau WebP, între 64 și 4096 px, maximum 2 MB.
          </p>
          {!hasProfile ? (
            <p className="text-xs text-muted-foreground">
              Salvează informațiile profesionale înainte de fotografie.
            </p>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          type="submit"
          disabled={!selectedFile || !hasProfile || isPending}
        >
          <ImagePlus aria-hidden="true" />
          {isPending ? "Se salvează..." : "Salvează fotografia"}
        </Button>

        {currentImageUrl ? (
          <Button
            type="button"
            variant="outline"
            disabled={isPending}
            onClick={() => void deleteImage()}
          >
            <Trash2 aria-hidden="true" />
            Șterge fotografia
          </Button>
        ) : null}
      </div>

      {errorMessage ? (
        <p role="alert" className="text-sm text-destructive">
          {errorMessage}
        </p>
      ) : null}

      {statusMessage ? (
        <p role="status" className="text-sm text-foreground">
          {statusMessage}
        </p>
      ) : null}
    </form>
  );
}
