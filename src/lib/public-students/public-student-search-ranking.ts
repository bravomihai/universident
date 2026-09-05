export type PublicStudentSearchCandidate<T> = {
  studentProfileId: string;
  studentName: string;
  profileRefreshedAt: Date | null;
  locationKey: string;
  firstAvailableAt: Date;
  tieBreaker: string;
  value: T;
};

export type RankedPublicStudent<T> = {
  value: T;
  firstAvailableAt: Date;
  locationCount: number;
};

function candidateComesFirst<T>(
  candidate: PublicStudentSearchCandidate<T>,
  current: PublicStudentSearchCandidate<T>,
) {
  const timeDifference =
    candidate.firstAvailableAt.getTime() - current.firstAvailableAt.getTime();
  if (timeDifference !== 0) return timeDifference < 0;
  return candidate.tieBreaker.localeCompare(current.tieBreaker, "ro") < 0;
}

export function rankUniquePublicStudents<T>(
  candidates: PublicStudentSearchCandidate<T>[],
): RankedPublicStudent<T>[] {
  const byStudent = new Map<
    string,
    {
      earliest: PublicStudentSearchCandidate<T>;
      locationKeys: Set<string>;
    }
  >();

  for (const candidate of candidates) {
    const current = byStudent.get(candidate.studentProfileId);
    if (!current) {
      byStudent.set(candidate.studentProfileId, {
        earliest: candidate,
        locationKeys: new Set([candidate.locationKey]),
      });
      continue;
    }

    current.locationKeys.add(candidate.locationKey);
    if (candidateComesFirst(candidate, current.earliest)) {
      current.earliest = candidate;
    }
  }

  return [...byStudent.entries()]
    .sort(([firstId, first], [secondId, second]) => {
      const firstRefresh = first.earliest.profileRefreshedAt;
      const secondRefresh = second.earliest.profileRefreshedAt;

      if (firstRefresh && !secondRefresh) return -1;
      if (!firstRefresh && secondRefresh) return 1;
      if (firstRefresh && secondRefresh) {
        const refreshDifference =
          secondRefresh.getTime() - firstRefresh.getTime();
        if (refreshDifference !== 0) return refreshDifference;
      }

      const timeDifference =
        first.earliest.firstAvailableAt.getTime() -
        second.earliest.firstAvailableAt.getTime();
      if (timeDifference !== 0) return timeDifference;
      return (
        first.earliest.studentName.localeCompare(
          second.earliest.studentName,
          "ro",
        ) || firstId.localeCompare(secondId)
      );
    })
    .map(([, entry]) => ({
      value: entry.earliest.value,
      firstAvailableAt: entry.earliest.firstAvailableAt,
      locationCount: entry.locationKeys.size,
    }));
}
