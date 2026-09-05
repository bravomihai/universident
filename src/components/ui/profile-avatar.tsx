"use client";

import Image from "next/image";
import { useState } from "react";

import { cn } from "@/lib/utils";

type ProfileAvatarProps = {
  name: string;
  imageUrl?: string | null;
  className?: string;
};

function initialsForName(name: string) {
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toLocaleUpperCase("ro-RO"))
    .join("");

  return initials || "U";
}

export function ProfileAvatar({
  name,
  imageUrl,
  className,
}: ProfileAvatarProps) {
  const [failedImageUrl, setFailedImageUrl] = useState<string | null>(null);

  return (
    <span
      className={cn(
        "relative inline-flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-full border bg-muted text-base font-semibold",
        className,
      )}
      aria-hidden="true"
    >
      {imageUrl && failedImageUrl !== imageUrl ? (
        <Image
          src={imageUrl}
          alt=""
          fill
          sizes="80px"
          unoptimized
          className="object-cover"
          onError={() => setFailedImageUrl(imageUrl)}
        />
      ) : (
        initialsForName(name)
      )}
    </span>
  );
}
