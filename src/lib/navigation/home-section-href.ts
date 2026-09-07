export function homeSectionHref(pathname: string | null, sectionId: string) {
  const fragment = `#${encodeURIComponent(sectionId)}`;
  return pathname === "/" ? fragment : `/${fragment}`;
}
