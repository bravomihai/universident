import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/components/navigation/app-link.tsx", "src/components/navigation/use-app-router.ts"],
    rules: {
      "no-restricted-imports": ["error", {
        paths: [
          { name: "next/link", message: "Use @/components/navigation/app-link so return navigation is preserved." },
          { name: "next/navigation", importNames: ["useRouter"], message: "Use useRouter from @/components/navigation/use-app-router." },
        ],
      }],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
