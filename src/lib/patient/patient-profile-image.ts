type PatientProfileImageReference = {
  id: string;
  updatedAt: Date;
};

export function patientProfileImageUrl(
  image: PatientProfileImageReference | null | undefined,
) {
  if (!image) return null;

  return `/api/patient-profile-images/${encodeURIComponent(image.id)}?v=${image.updatedAt.getTime()}`;
}
