// Confirmed against BETTER_AUTH_URL in the production configuration.
// Keep this independent of request headers, localhost and preview origins.
export const PUBLIC_SITE_ORIGIN = "https://universident.ro";

type DeploymentEnvironment = {
  [key: string]: string | undefined;
  DEPLOYMENT_ENV?: string;
  BETTER_AUTH_URL?: string;
  VERCEL_ENV?: string;
};

export function isPublicDeployment(env: DeploymentEnvironment = process.env) {
  return env.DEPLOYMENT_ENV === "production" &&
    env.BETTER_AUTH_URL === PUBLIC_SITE_ORIGIN &&
    (!env.VERCEL_ENV || env.VERCEL_ENV === "production");
}

export function canonicalUrl(path: string) {
  if (!path.startsWith("/") || path.startsWith("//")) {
    throw new Error("Canonical paths must be local absolute paths.");
  }
  const url = new URL(path, PUBLIC_SITE_ORIGIN);
  if (url.origin !== PUBLIC_SITE_ORIGIN) throw new Error("Invalid canonical origin.");
  return url.toString();
}

export function mustNotIndexPath(pathname: string) {
  return /^\/(?:cont|pacienti|api|autentificare|inregistrare|parola-uitata|resetare-parola|verifica-email)(?:\/|$)/.test(pathname) ||
    /^\/studenti\/[^/]+\/programare(?:\/|$)/.test(pathname);
}

export function robotsHeader(pathname: string, host: string, env: DeploymentEnvironment = process.env) {
  if (!isPublicDeployment(env) || !["universident.ro", "universident.ro:443"].includes(host.toLowerCase())) {
    return "noindex, nofollow";
  }
  return mustNotIndexPath(pathname) ? "noindex, nofollow" : null;
}
