# VEMI — Fitness & Nutrition Product Engineering

**Live product:** https://vemi.ro  
**Technology:** React, TypeScript, Next.js / Vinext, Cloudflare, Supabase (PostgreSQL, Auth, RLS), automated tests.  
**Focus:** Workout planning, journal states, content architecture, authentication, account isolation and validation.

This public repository contains a **curated historical VEMI source snapshot**, exported from a local development checkpoint. It is **not the latest deployed production version**. The available local Git checkpoint was dated **23 August 2026**. More recent features and deployments are not represented as if they were included here.

## Product scope

VEMI is a mobile-first fitness platform integrating training journeys, exercise content, nutrition, a personal training journal (VemiFIT) and subscription-aware experiences.

## Engineering areas to review

| Area | Code |
| --- | --- |
| User journeys and routing | [app](app) |
| Reusable UI and interaction components | [components](components) |
| Workout, exercise and journal domain logic | [lib](lib) |
| Editorial and nutrition models | [content](content) |
| Database migrations and RLS-related work | [supabase/migrations](supabase/migrations) |
| Automated tests and regression cases | [tests](tests) |
| Runtime adapters and utilities | [utils](utils) |

## My role and technical ownership

I owned product scope, feature acceptance rules, UI/UX decisions, test scenarios and release readiness decisions. I coordinated AI coding agents and validated their implementations rather than considering generated code automatically production-ready.

Particular engineering priorities included:

1. **Data isolation:** Specify and review authorization boundaries, including PostgreSQL Row Level Security.
2. **Journal continuity:** Account-aware state, history consistency and recovery-oriented behavior.
3. **Workout planning:** Rule-driven plan generation with differentiated journeys.
4. **Release quality:** Review edge cases, regressions and mobile responsiveness before shipping.

These are areas of ownership and review, **not** claims that I manually authored every module or that this snapshot passed a full security certification.

## Technical constraints

This export reflects the development environment of its historical checkpoint. Some production integrations and build tooling depend on external services, Linux shell tools or private configuration that are **deliberately not included**. It is shared primarily for source inspection and technical discussion.

The production website is independent from this GitHub repository; publishing or editing this repository does not deploy changes to VEMI.

## Publication and security

- **Fresh Git history**; historical commits and internal infrastructure remotes are not published.
- Credentials, local environment files, operational artifacts, internal configuration and logs are excluded.
- No production database, user records or private API access are included.
- This is a portfolio sample, not an authorized deployment template or a redistribution license for third-party assets.

**Export prepared:** 9 November 2026.  
**Source checkpoint:** 23 August 2026.
