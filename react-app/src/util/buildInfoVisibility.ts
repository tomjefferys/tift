// Whether to show the engine build-info overlay (BuildInfo.tsx). This is aimed at people
// developing the engine/app itself, not game authors - so it's kept deliberately separate
// from `settings.ts`'s `enableDevMode`, which is a game-author-facing, in-game-toggled flag.
const BUILD_INFO_KEY = "TIFT_SHOW_BUILD_INFO";

// Visiting the app with `?debug` (or `?debug=1`) turns the overlay on; `?debug=0` turns it
// off. Either way the choice is remembered in localStorage so it survives reloads without
// the query param needing to be present every time, and the param is stripped from the URL
// so it doesn't linger in the address bar or get re-processed on a bookmarked link.
export function resolveShowBuildInfo(): boolean {
    const url = new URL(window.location.href);
    const params = url.searchParams;

    if (params.has("debug")) {
        const value = params.get("debug");
        const show = value !== "0" && value !== "false";
        window.localStorage.setItem(BUILD_INFO_KEY, show ? "true" : "false");

        params.delete("debug");
        window.history.replaceState(null, "", url.pathname + (params.toString() ? `?${params}` : "") + url.hash);

        return show;
    }

    return window.localStorage.getItem(BUILD_INFO_KEY) === "true";
}
