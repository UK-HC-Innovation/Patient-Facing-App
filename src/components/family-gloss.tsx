"use client";

import React, {
  createContext,
  useContext,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState
} from "react";
import { tFamily, type FamilyStringKey } from "@/i18n/family-strings";
import type { Language } from "@/i18n/strings";

/**
 * The words this app inherits from Kentucky's systems and does not get to
 * assume a caregiver already knows. One plain line each, at roughly a sixth-grade
 * reading level, shown the first time the term appears on a surface — after that
 * the term stands on its own, because repeating the definition under every card
 * is its own kind of noise.
 */
export type FamilyGlossTerm = "poe" | "ifsp" | "iep" | "plan504" | "arc";

const GLOSS_KEYS: Record<FamilyGlossTerm, FamilyStringKey> = {
  poe: "glossPoe",
  ifsp: "glossIfsp",
  iep: "glossIep",
  plan504: "gloss504",
  arc: "glossArc"
};

// Catalog copy is English in both languages (each card carries its own
// source-language tag), so detection reads English. ARC is matched
// case-sensitively: lowercase "arc" is an ordinary word.
const TERM_PATTERNS: ReadonlyArray<{ term: FamilyGlossTerm; pattern: RegExp }> = [
  { term: "poe", pattern: /\b(?:point of entry|POE)\b/i },
  { term: "ifsp", pattern: /\b(?:IFSP|Individualized Family Service Plan)\b/i },
  { term: "plan504", pattern: /\b504\s+plan\b/i },
  { term: "iep", pattern: /\b(?:IEP|Individualized Education Program)\b/i },
  { term: "arc", pattern: /\bARC\b/ }
];

/** Which glossary terms a piece of copy actually uses, in glossary order. */
export function familyGlossTermsIn(...text: Array<string | undefined>): FamilyGlossTerm[] {
  const haystack = text.filter((part): part is string => typeof part === "string").join(" ");
  return TERM_PATTERNS.filter(({ pattern }) => pattern.test(haystack)).map(({ term }) => term);
}

type GlossRegistry = {
  /** True when this caller is the one that owns the term's single explanation. */
  claim: (term: FamilyGlossTerm, claimant: string) => boolean;
  release: (term: FamilyGlossTerm, claimant: string) => void;
  subscribe: (claimant: string, listener: (term: FamilyGlossTerm) => void) => () => void;
};

const FamilyGlossContext = createContext<GlossRegistry | null>(null);

/**
 * One registry per surface. Switching tabs mounts a different provider, so the
 * first card on the Programs surface explains "Point of Entry" again even though
 * Home already did — each screen is read on its own.
 */
export function FamilyGlossSurface({ children }: { children: React.ReactNode }) {
  const owners = useRef(new Map<FamilyGlossTerm, string>());
  const listeners = useRef(new Map<string, (term: FamilyGlossTerm) => void>());
  const registry = useMemo<GlossRegistry>(
    () => ({
      claim(term, claimant) {
        const owner = owners.current.get(term);
        if (owner === undefined) {
          owners.current.set(term, claimant);
          return true;
        }
        return owner === claimant;
      },
      release(term, claimant) {
        if (owners.current.get(term) === claimant) {
          owners.current.delete(term);
          for (const [listenerClaimant, listener] of listeners.current) {
            if (listenerClaimant !== claimant) listener(term);
          }
        }
      },
      subscribe(claimant, listener) {
        listeners.current.set(claimant, listener);
        return () => listeners.current.delete(claimant);
      }
    }),
    []
  );

  return <FamilyGlossContext.Provider value={registry}>{children}</FamilyGlossContext.Provider>;
}

export type FamilyGlossProps = {
  terms: readonly FamilyGlossTerm[];
  language: Language;
  className?: string;
};

/**
 * The one-line explanations this caller owns. Outside a surface provider every
 * term is explained — an isolated card has no "earlier on the screen" to defer to.
 */
export function FamilyGloss({ terms, language, className }: FamilyGlossProps) {
  const registry = useContext(FamilyGlossContext);
  const claimant = useId();
  const termsKey = terms.join("|");
  const [mine, setMine] = useState<readonly FamilyGlossTerm[]>(registry ? [] : terms);
  const requestedRef = useRef<readonly FamilyGlossTerm[]>(terms);
  const ownedRef = useRef(new Set<FamilyGlossTerm>());
  requestedRef.current = termsKey.length === 0
    ? []
    : Array.from(new Set(termsKey.split("|") as FamilyGlossTerm[]));

  useLayoutEffect(() => {
    if (!registry) return;
    return registry.subscribe(claimant, (term) => {
      if (!requestedRef.current.includes(term) || ownedRef.current.has(term)) return;
      if (!registry.claim(term, claimant)) return;
      ownedRef.current.add(term);
      const next = requestedRef.current.filter((requested) => ownedRef.current.has(requested));
      setMine(next);
    });
  }, [claimant, registry]);

  useLayoutEffect(() => {
    const requested = requestedRef.current;
    if (!registry) {
      setMine(requested);
      return;
    }
    const requestedSet = new Set(requested);
    for (const term of ownedRef.current) {
      if (requestedSet.has(term)) continue;
      ownedRef.current.delete(term);
      registry.release(term, claimant);
    }
    for (const term of requested) {
      if (!ownedRef.current.has(term) && registry.claim(term, claimant)) {
        ownedRef.current.add(term);
      }
    }
    const owned = requested.filter((term) => ownedRef.current.has(term));
    setMine((current) =>
      current.length === owned.length && current.every((term, index) => term === owned[index])
        ? current
        : owned
    );
  }, [claimant, registry, termsKey]);

  useLayoutEffect(() => {
    if (!registry) return;
    const ownedTerms = ownedRef.current;
    return () => {
      const owned = Array.from(ownedTerms);
      ownedTerms.clear();
      for (const term of owned) registry.release(term, claimant);
    };
  }, [claimant, registry]);

  if (mine.length === 0) return null;

  return (
    <div data-testid="family-gloss" className={`grid gap-1 ${className ?? ""}`}>
      {mine.map((term) => (
        <p key={term} data-gloss-term={term} className="break-words text-sm leading-6 text-ink/70">
          {tFamily(language, GLOSS_KEYS[term])}
        </p>
      ))}
    </div>
  );
}
