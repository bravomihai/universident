export const studentTreatmentSelect = {
  id: true,
  treatmentId: true,
  description: true,
  durationMinutes: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  treatment: {
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
    },
  },
  treatmentLocations: {
    where: {
      deletedAt: null,
      studentLocation: {
        deletedAt: null,
      },
    },
    orderBy: {
      createdAt: "asc",
    },
    select: {
      id: true,
      studentLocationId: true,
      isActive: true,
      studentLocation: {
        select: {
          id: true,
          name: true,
          address: true,
          isActive: true,
          city: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
        },
      },
    },
  },
} as const;
