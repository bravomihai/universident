import { NavigationLink } from "@/components/ui/navigation-link";
import { getSeoSearchCombinations } from "@/lib/seo/public-data";

export async function PublicSearchLinks() {
  const combinations = await getSeoSearchCombinations();
  if (!combinations.length) return null;
  return (
    <nav aria-labelledby="available-searches-title" className="space-y-4">
      <h2 id="available-searches-title" className="text-xl font-semibold">Tratamente disponibile în orașe</h2>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {combinations.map((entry) => (
          <li key={entry.href}>
            <NavigationLink href={entry.href} prefetch={false} className="h-auto w-full justify-between whitespace-normal text-sm">
              {entry.treatment.name} în {entry.city.name}
            </NavigationLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
