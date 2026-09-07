import Image from "next/image";
import Link from "next/link";

import { headerNeutralControlClassName } from "@/components/layout/header-action-styles";
import { brandAssets } from "@/lib/branding/brand-assets";
import { cn } from "@/lib/utils";

export function SiteBrand() {
  return (
    <Link
      href="/"
      aria-label="Universident — pagina principală"
      className={cn(
        headerNeutralControlClassName,
        "-ml-2 inline-flex min-w-0 shrink items-center px-2",
      )}
    >
      <span className="relative block aspect-[5/1] w-44 max-w-full sm:w-52">
        <Image
          src={brandAssets.light.header}
          alt=""
          aria-hidden="true"
          fill
          sizes="(min-width: 640px) 208px, 176px"
          loading="eager"
          className="object-contain dark:hidden"
        />
        <Image
          src={brandAssets.dark.header}
          alt=""
          aria-hidden="true"
          fill
          sizes="(min-width: 640px) 208px, 176px"
          loading="eager"
          className="hidden object-contain dark:block"
        />
      </span>
    </Link>
  );
}
