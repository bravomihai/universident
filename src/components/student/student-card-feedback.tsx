export type StudentCardFeedback = {
  type: "success" | "error";
  message: string;
};

type StudentCardFeedbackMessageProps = {
  feedback: StudentCardFeedback | null;
};

export function StudentCardFeedbackMessage({
  feedback,
}: StudentCardFeedbackMessageProps) {
  return (
    <div className="min-h-10">
      {feedback ? (
        <p
          role={feedback.type === "error" ? "alert" : "status"}
          aria-live={
            feedback.type === "success" ? "polite" : undefined
          }
          className={
            feedback.type === "error"
              ? "rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
              : "rounded-xl border bg-muted/30 px-3 py-2 text-sm text-foreground"
          }
        >
          {feedback.message}
        </p>
      ) : null}
    </div>
  );
}
