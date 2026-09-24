# Contextual back navigation

Use `Link` from `src/components/navigation/app-link.tsx` for application links and `useRouter` from `src/components/navigation/use-app-router.ts` for imperative client navigation. ESLint prevents bypassing them. Pages render `<BackLink />`; they never specify a return URL or label.

The common link stages the source context in `onNavigate`, only when Next.js will navigate in the current tab. The root `NavigationProvider` attaches that context to the destination's browser history entry after the route commits, preserving all Next.js history fields. The URL remains unchanged. No return context is written to query parameters, cookies, local storage, API requests or server sessions.

`BackLink` renders the previous step and derives its Romanian label centrally. Without context it always renders `Înapoi la pagina principală`, linking to `/`. This also applies to bookmarks, pasted links and new tabs. Refresh and browser Back/Forward preserve each history entry's context. Two visits to the same URL may have different origins without overwriting one another. Search filters and anchors remain part of the return destination; unsaved form state is not serialized.

Available `navigation` modes:

- `forward` (default): add the current page. Visiting an ancestor consumes the intervening steps, preventing loops.
- `replace`: switch peer views or finish a form while retaining the parent. `router.replace` uses this mode.
- `back`: consume the trail. Used by `BackLink`.
- `reset` or `none`: clear the return context. Home and the account dashboard always reset.

Cancelled clicks, prefetches, downloads and modified/new-tab clicks do not stage navigation. Browser history traversal clears pending navigation. Auth pages and API endpoints cannot become return destinations. Only internal paths and allowed UI filters enter the bounded eight-step trail; tokens, message text and unknown query values are excluded. Return context never grants authorization.

Old `inapoi` and `sursa` parameters are removed from local URLs without interpreting them. Source-specific public profile return logic has been removed. New routes participate automatically; optional Romanian labels are defined centrally in `return-navigation.ts`.
