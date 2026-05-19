# ADR-001: Vite + React + TypeScript frontend stack

## Status
Accepted

## Context
Need a framework for building a canvas-based data tool. tldraw is a React library, so React is required. Need a bundler with fast HMR for iterative development.

## Decision
Use Vite as the bundler/dev server, React as the UI framework, and TypeScript for type safety. No SSR framework (Next.js, Remix) — this is a client-heavy interactive tool with no SEO or server-rendering needs.

## Consequences
- Fast dev experience with Vite HMR
- Single-language stack (TypeScript everywhere)
- tldraw's typed shape API works naturally with TypeScript
- No server-side rendering complexity
