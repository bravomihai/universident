import Link from "next/link";
import { headers } from "next/headers";
import { Button } from "@/components/ui/button";
import { auth } from "@/lib/auth";
import { studentJoinDestination } from "@/lib/auth/student-signup";

export async function StudentJoinLink() {
  const session = await auth.api.getSession({ headers: await headers() });
  const destination = studentJoinDestination(session?.user.role);

  return (
    <Button asChild size="lg" className="home-primary-action">
      <Link href={destination.href}>{destination.label} <span aria-hidden="true">&gt;</span></Link>
    </Button>
  );
}
