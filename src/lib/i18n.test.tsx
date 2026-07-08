import { describe, expect, it, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { I18nProvider, dictionaries, useLocalStrings } from "./i18n";

function keysDeep(obj: Record<string, unknown>, prefix = ""): string[] {
  return Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === "object" && !Array.isArray(v)
      ? keysDeep(v as Record<string, unknown>, `${prefix}${k}.`)
      : [`${prefix}${k}`]
  );
}

describe("shared dictionaries", () => {
  it("hi covers exactly the same keys as en (no missing translations)", () => {
    expect(keysDeep(dictionaries.hi).sort()).toEqual(keysDeep(dictionaries.en).sort());
  });

  it("nav has entries for every page in the header", () => {
    for (const key of ["home", "guide", "about", "myComplaints", "submit", "signIn", "profile"]) {
      expect(dictionaries.en.nav).toHaveProperty(key);
      expect(dictionaries.hi.nav).toHaveProperty(key);
    }
  });
});

describe("useLocalStrings", () => {
  const strings = {
    en: { title: "Hello", body: "World" },
    hi: { title: "नमस्ते" }, // body deliberately missing
  };

  beforeEach(() => localStorage.clear());

  it("returns English by default", () => {
    const { result } = renderHook(() => useLocalStrings(strings), { wrapper: I18nProvider });
    expect(result.current.title).toBe("Hello");
  });

  it("returns Hindi with per-key English fallback", async () => {
    localStorage.setItem("janvaani.locale", "hi");
    const { result } = renderHook(() => useLocalStrings(strings), { wrapper: I18nProvider });
    await waitFor(() => expect(result.current.title).toBe("नमस्ते"));
    expect(result.current.body).toBe("World"); // fell back to en
  });

  it("unsupported locales read English", async () => {
    localStorage.setItem("janvaani.locale", "ta");
    const { result } = renderHook(() => useLocalStrings(strings), { wrapper: I18nProvider });
    await waitFor(() => expect(result.current.title).toBe("Hello"));
  });
});
