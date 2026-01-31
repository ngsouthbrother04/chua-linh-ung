# AI_GUIDELINES

> **Audience**: GitHub Copilot, AI Agents, Developers using AI assistance
>
> **Purpose**: Define system invariants, constraints, and non-negotiable rules that AI-generated code MUST follow.

---

## 1. System Identity

This project is a **Location-Based Auto-Narration System**.

Core principle:
> **Correct narration at the correct physical location is more important than narration completeness.**

---

## 2. Non‑Negotiable Invariants (MUST)

AI-generated code **MUST always preserve** the following invariants:

### 2.1 Geofence Engine = Decision Core
- All decisions about *when* narration starts or stops originate from the **Geofence Engine**.
- GPS tracking alone must **never** directly trigger audio playback.

### 2.2 Narration Engine Responsibilities
The Narration Engine MUST:
- Maintain an **audio queue** (async-safe / multi-thread capable)
- Support:
  - `play`
  - `stop-on-exit`
  - `interrupt-on-enter-new-POI`
- Prevent duplicate playback of the same POI

### 2.3 Stop-on-Exit is Mandatory
- If the user exits a POI geofence, narration MUST stop immediately.
- It is invalid for narration to continue when the user is outside the POI boundary.

### 2.4 Fast-Movement Handling
- When `EXIT_POI_A` and `ENTER_POI_B` occur close in time:
  - Audio for POI_A MUST be interrupted
  - Audio for POI_B MUST start immediately (after debounce rules)

---

## 3. Debounce & Cooldown Rules

To prevent spam near geofence boundaries:
- Rapid enter/exit events MUST be debounced
- Cooldown MUST exist before re-triggering the same POI

AI MUST NOT remove or weaken debounce/cooldown logic.

---

## 4. Offline‑First Constraint

- POI data and narration scripts MUST be available offline
- **SQLite** (via expo-sqlite) is the REQUIRED local storage mechanism for POI Data
- Network availability MUST NOT be assumed

---

## 5. Analytics: No Vibe‑Coding

AI-generated features MUST be **data-driven**.

Allowed:
- Heatmap generation
- Time-listened metrics
- POI popularity ranking

Disallowed:
- UX decisions based on intuition only
- Heuristic changes without measurable metrics

---

## 6. QR Code Usage Rules

- QR codes are allowed ONLY as a fallback trigger
- QR codes MUST NOT be associated with moving points (e.g., bus stops)
- QR codes represent fixed, physical POIs

---

## 7. Explicit Non‑Goals (DO NOT)

AI MUST NOT:
- Allow narration outside POI boundaries
- Bypass the Geofence Engine
- Remove analytics logging
- Assume continuous internet connectivity

---

## 8. AI Prompt Hint

When generating code or analysis, assume:

"This system prioritizes spatial correctness, interruption safety, offline availability, and analytics-based validation over continuous narration."

---

## 9. Technology Stack (MANDATORY)

### 9.1 Mobile Application
- **Framework**: React Native with **Expo managed workflow** (Default).
- **Build Tool**: EAS Build (only if native modules are strictly required).
- **Core Features**: Location services, Background tasks (expo-task-manager), **TTS (expo-speech)**, SQLite (expo-sqlite).

### 9.2 Backend API
- **Runtime**: Node.js + Express (TypeScript).
- **Reasoning**: Lightweight, fast prototyping, shared language with mobile.
- **Protocol**: REST API (primary).

### 9.3 Database & Storage
- **Primary DB**: **PostgreSQL** (SQL).
  - *Extensions*: **PostGIS** (Required for geospatial logic).
  - *Reason*: Strong relational data integrity, ERD support, and powerful geospatial queries.
- **Cache**: **Redis**.
  - *Usage*: Caching recent queries, geofence data, session states.
- **Offline DB**: **SQLite**.
  - *Usage*: Local mirror of POI content for offline narration.
- **Relational DB**: ONLY use PostgreSQL if complex analytics/transactions strongly demand it.

### 9.4 Payment Processing
- **Gateways**: **VNPay** (Default) or **Momo**.
- **Mobile Flow**: WebView (expo-web-browser) -> Redirect -> Deep Link Callback.
- **Offline Flow**: One-time Claim Codes (OTP) verified against backend.

### 9.5 Cloud Infrastructure
- **Provider**: AWS / GCP / Azure (Flexible).
- **Preference**: Managed Services (PaaS/SaaS) over raw VMs.

---

**End of AI_GUIDELINES**

