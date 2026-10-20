import { useSyncExternalStore } from "react";

export type Route = { name: "list" } | { name: "exam"; id: string } | { name: "missing" };

export const LIST_HREF = "#/";

export function examHref(examId: string): string {
  return `#/${examId}`;
}

export function routeFromHash(hash: string): Route {
  if (hash === "" || hash === "#" || hash === "#/") {
    return { name: "list" };
  }
  const match = /^#\/([A-Za-z0-9-]+)\/?$/.exec(hash);
  return match ? { name: "exam", id: match[1] } : { name: "missing" };
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
}

export function useHash(): string {
  return useSyncExternalStore(subscribe, () => window.location.hash);
}
