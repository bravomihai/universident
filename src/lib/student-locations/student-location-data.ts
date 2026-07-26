export const studentLocationSelect = {
  id: true,
  cityId: true,
  routeKey: true,
  name: true,
  address: true,
  details: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  city: {
    select: {
      id: true,
      name: true,
      slug: true,
    },
  },
} as const;
