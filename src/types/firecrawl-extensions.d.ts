// file: src/types/firecrawl-extensions.d.ts
// description: Ambient module augmentation re-exporting agent method types from
//   @mendable/firecrawl-js for explicit use in firecrawl-client.ts. These methods
//   ARE declared in the SDK at version 4.13.0 but were historically cast to `any`
//   due to an authoring oversight. This file makes the types explicitly available
//   as named imports without any augmentation needed.
//
//   SDK version verified against: @mendable/firecrawl-js@4.13.0
//   Review this file whenever that version changes in package.json.
//   Run: grep -n "startAgent\|getAgentStatus" node_modules/@mendable/firecrawl-js/dist/index.d.ts
//   If the methods appear with compatible signatures, remove any workarounds here.

// No augmentation is required — AgentResponse and AgentStatusResponse are already
// exported from the SDK. This file exists as a mandatory review checkpoint during
// SDK version upgrades (see docs/dev/engineering-standards.md § SDK Type Augmentations).

export type {};
