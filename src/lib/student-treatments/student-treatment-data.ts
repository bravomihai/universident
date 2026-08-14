export const studentTreatmentSelect = {
  id: true,
  treatmentId: true,
  description: true,
  durationMinutes: true,
  createdAt: true,
  updatedAt: true,
  treatment: {
    select: { id: true, name: true, slug: true, description: true },
  },
} as const;
