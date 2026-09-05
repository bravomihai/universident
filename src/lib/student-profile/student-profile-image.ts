export type StudentProfileImageReference = {
  id: string;
  updatedAt: Date;
};

export function studentProfileImageUrl(
  image: StudentProfileImageReference | null | undefined,
) {
  if (!image) return null;

  return `/api/student-profile-images/${encodeURIComponent(image.id)}?v=${image.updatedAt.getTime()}`;
}
