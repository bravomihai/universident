import { ProfileImageForm } from "@/components/account/profile-image-form";

type StudentProfileImageFormProps = {
  name: string;
  hasProfile: boolean;
  initialImageUrl: string | null;
};

export function StudentProfileImageForm({
  name,
  hasProfile,
  initialImageUrl,
}: StudentProfileImageFormProps) {
  return (
    <ProfileImageForm
      name={name}
      initialImageUrl={initialImageUrl}
      uploadUrl="/api/student-profile/image"
      canUpload={hasProfile}
      unavailableMessage="Salvează informațiile profesionale înainte de fotografie."
    />
  );
}
