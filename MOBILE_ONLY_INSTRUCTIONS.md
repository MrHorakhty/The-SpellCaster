# Agent Instruction: Mobile Scoping Only

This file serves as a persistent reminder for the AI agent to ensure that all future modifications to this project are strictly focused on the **mobile (Android)** version of "The SpellCaster".

## Core Directives
1. **Desktop/Web Protection**: Do NOT make any changes that break or negatively impact the desktop (Windows) or web versions of the application.
2. **Platform Gating**: Use platform detection (e.g., `@tauri-apps/plugin-os`) to isolate mobile-specific logic in the shared React frontend.
3. **UI Adjustments**: Focus UI changes on touch-friendliness, mobile layouts, and Android-specific visual patterns.
4. **Android Native**: Modifications within `src-tauri/gen/android/` are safe and preferred for mobile-only adjustments.

## Why this exists?
The application features are finalized. Future work is UI-centric and optimization-focused for the mobile release.

---
*Created per user request on 2026-08-31.*
