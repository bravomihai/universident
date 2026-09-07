import { appointmentReviewIsAllowed } from "./appointment-presentation";

export type AppointmentActionMode = "all" | "cancel-only";

export function appointmentActionAvailability({
  status, role, startsAt, endsAt, reviewedByActor, mode = "all",
}: {
  status: string;
  role: "PATIENT" | "STUDENT";
  startsAt: string;
  endsAt: string;
  reviewedByActor: boolean;
  mode?: AppointmentActionMode;
}, now = new Date()) {
  const beforeStart = new Date(startsAt) > now;
  const ended = new Date(endsAt) <= now;
  const all = mode === "all";
  return {
    patientCanCancel: role === "PATIENT" && beforeStart && ["PENDING", "CONFIRMED"].includes(status),
    studentCanCancel: role === "STUDENT" && beforeStart && status === "CONFIRMED",
    studentPending: all && role === "STUDENT" && beforeStart && status === "PENDING",
    studentCanFinish: all && role === "STUDENT" && ended && status === "CONFIRMED",
    reviewNeeded: all && appointmentReviewIsAllowed(status, role) && !reviewedByActor,
  };
}
