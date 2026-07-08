"use client";

/* ------------------------------------------------------------------
   Theme (light / dark / system). The <html data-theme="…"> attribute is
   the single switch — globals.css remaps every design token under
   [data-theme="dark"]. An inline script in layout.tsx applies the saved
   choice BEFORE first paint (no flash); this provider takes over after
   hydration and keeps the attribute + localStorage in sync.
   ------------------------------------------------------------------ */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

export type ThemePreference = "light" | "dark" | "system";

const THEME_KEY = "janvaani.theme";

function systemTheme(): "light" | "dark" {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function apply(pref: ThemePreference) {
  const resolved = pref === "system" ? systemTheme() : pref;
  document.documentElement.dataset.theme = resolved;
}

type ThemeValue = {
  preference: ThemePreference;
  resolved: "light" | "dark";
  setPreference: (p: ThemePreference) => void;
};

const ThemeContext = createContext<ThemeValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>("system");
  const [resolved, setResolved] = useState<"light" | "dark">("light");

  useEffect(() => {
    const saved = localStorage.getItem(THEME_KEY) as ThemePreference | null;
    const pref = saved === "light" || saved === "dark" || saved === "system" ? saved : "system";
    setPreferenceState(pref);
    apply(pref);
    setResolved(pref === "system" ? systemTheme() : pref);
  }, []);

  // Follow OS changes live, but only while the user hasn't overridden.
  useEffect(() => {
    if (preference !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      apply("system");
      setResolved(systemTheme());
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [preference]);

  const setPreference = useCallback((p: ThemePreference) => {
    setPreferenceState(p);
    localStorage.setItem(THEME_KEY, p);
    apply(p);
    setResolved(p === "system" ? systemTheme() : p);
  }, []);

  return (
    <ThemeContext.Provider value={{ preference, resolved, setPreference }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within <ThemeProvider>");
  return ctx;
}

/* Compact three-state toggle (light → dark → system) for the header. */
export function ThemeToggle({ className = "" }: { className?: string }) {
  const { preference, resolved, setPreference } = useTheme();

  // Always flip the RESOLVED theme so the first click visibly changes the
  // page even when the preference is still "system" — a blind
  // light→dark→system cycle made that first click a no-op when the OS
  // theme matched the next stop.
  const next: ThemePreference = resolved === "dark" ? "light" : "dark";
  const label =
    preference === "system" ? `Theme: auto (${resolved})` : `Theme: ${preference}`;

  return (
    <button
      type="button"
      onClick={() => setPreference(next)}
      title={`${label} — click for ${next}`}
      aria-label={`${label}. Switch to ${next}.`}
      className={`no-print inline-flex h-10 w-10 items-center justify-center rounded-full border-[1.5px] border-line bg-field text-ink transition-colors hover:border-marigold-deep ${className}`}
    >
      {preference === "system" ? (
        /* auto: half sun / half moon */
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M12 3a9 9 0 1 0 0 18Z" fill="currentColor" />
          <circle cx="12" cy="12" r="8.4" stroke="currentColor" strokeWidth="1.8" />
        </svg>
      ) : resolved === "dark" ? (
        /* moon */
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M20.6 14.4A8.5 8.5 0 0 1 9.6 3.4a8.5 8.5 0 1 0 11 11Z"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
        </svg>
      ) : (
        /* sun */
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="12" cy="12" r="4.2" stroke="currentColor" strokeWidth="1.8" />
          <path
            d="M12 2.5v2.4M12 19.1v2.4M2.5 12h2.4M19.1 12h2.4M5 5l1.7 1.7M17.3 17.3 19 19M19 5l-1.7 1.7M6.7 17.3 5 19"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
      )}
    </button>
  );
}
