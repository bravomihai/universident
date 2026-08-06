import { cn } from "@/lib/utils";

type PublicStudentAvatarProps = {
  name: string;
  image: string | null;
  className?: string;
};

function initialsForName(name: string) {
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toLocaleUpperCase("ro-RO"))
    .join("");

  return initials || "S";
}

export function PublicStudentAvatar({
  name,
  image,
  className,
}: PublicStudentAvatarProps) {
  return (
    <span
      className={cn(
        "relative inline-flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-full border bg-muted text-base font-semibold",
        className,
      )}
      aria-hidden="true"
    >
      {initialsForName(name)}
      {image ? (
        // The provider URL is already stored as the user's public profile image.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={image}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          className="absolute inset-0 size-full object-cover"
        />
      ) : null}
    </span>
  );
}
