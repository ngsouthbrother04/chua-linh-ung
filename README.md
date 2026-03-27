# Phố Ẩm Thực - Location-Based Food Narration System

> **Product Version**: 2.0  
> **Documentation Version**: 2.0  
> **Last Updated**: 2026-03-25  
> **Academic Course**: Seminar chuyên đề (Group 22)

---

## Quick Navigation

**For different audiences**, start here:
- **👨‍💼 Product Managers**: Đọc [`SPEC_CANONICAL.md`](./SPEC_CANONICAL.md) §1-2 → [`docs/prd/`](./docs/prd/)
- **🏗️ Architects**: Đọc [`ARCHITECTURE.md`](./ARCHITECTURE.md) → [`SPEC_CANONICAL.md`](./SPEC_CANONICAL.md) §11 (conflict resolution)
- **💻 Backend Developers**: [`docs/backend_design.md`](./docs/backend_design.md) + [`docs/database_design.md`](./docs/database_design.md) + [`AI_GUIDELINES.md`](./AI_GUIDELINES.md)
- **📱 Mobile Developers**: [`ARCHITECTURE.md`](./ARCHITECTURE.md) §2-7 + [`USE_CASES.md`](./USE_CASES.md) + [`AI_GUIDELINES.md`](./AI_GUIDELINES.md)
- **🧪 QA / Testing**: [`docs/test_scenarios.md`](./docs/test_scenarios.md) + [`USE_CASES.md`](./USE_CASES.md)
- **🤖 AI Agents**: Read **[`TEAM_START_HERE.md`](./TEAM_START_HERE.md)** first (mandatory)

---

## 📖 Project Overview

**Phố Ẩm Thực** is a **Location-Based Food Narration System** allowing users to explore restaurants on a map and listen to multi-language narration when they explicitly tap a POI or scan a QR code.

### Core Principle (Nguyên tắc Cốt Lõi)

> **User-Triggered Audio Only**: No auto-play. Narration activates ONLY via explicit user interaction (Tap POI or Scan QR). Single Voice Rule: strictly one narration at a time. Offline-first: all content accessible without internet after initial sync.

**See**: [`SPEC_CANONICAL.md`](./SPEC_CANONICAL.md) §2 (Core System Invariants)

---

## 🚀 Getting Started (Hướng dẫn Cài đặt)

### 1. Yêu cầu Hệ thống (Prerequisites)

Để chạy dự án này, bạn cần cài đặt:

* **Node.js**: Phiên bản 20+
* **Docker Desktop**: Để chạy Database (PostgreSQL + Redis)
* **Expo Go**: Cài trên điện thoại (iOS/Android) để chạy thử Mobile App

---

### 2. Cài đặt (Installation)

Clone repository và cài đặt thư viện cho toàn bộ dự án:

```bash
git clone https://github.com/ngsouthbrother04/pho-am-thuc.git
npm install
```

---

### 3. Chạy Ứng dụng

Dự án được cấu hình sẵn các lệnh tiện lợi tại thư mục gốc (`root`):

#### Bước 1: Khởi động Database

Chạy PostgreSQL (Cổng 5433) và Redis (Cổng 6379) qua Docker:

```bash
npm run db:up
```

#### Bước 2: Chạy Backend API

Backend sẽ chạy tại `http://localhost:3000`:

```bash
npm run dev:backend
```

#### Bước 3: Chạy Mobile App

Sử dụng Expo để chạy ứng dụng trên thiết bị thật hoặc máy ảo:

```bash
npm run dev:mobile
```

*Sau khi chạy lệnh, quét mã QR hiển thị trên Terminal bằng ứng dụng Expo Go.*

---

## 📌 Documentation Scope

**README** = Quick start + documentation navigation.  
**[`SPEC_CANONICAL.md`](./SPEC_CANONICAL.md)** = Source of truth for invariants, state machine, timing, and conflict resolution.  
**[`ARCHITECTURE.md`](./ARCHITECTURE.md)** = Technical implementation details.  
**[`AI_GUIDELINES.md`](./AI_GUIDELINES.md)** = AI guardrails & technology stack specifics.

### Documentation Hierarchy (Conflict Resolution)

⚠️ **When documents conflict, follow this priority order**:

| Priority | Document | Authority |
|----------|----------|----------|
| 1️⃣ **HIGHEST** | [README.md](./README.md) | Product vision |
| 2️⃣ | [SPEC_CANONICAL.md](./SPEC_CANONICAL.md) | System invariants |
| 3️⃣ | [AI_GUIDELINES.md](./AI_GUIDELINES.md) | AI guardrails, tech stack |
| 4️⃣ | [ARCHITECTURE.md](./ARCHITECTURE.md) | Technical blueprint |
| 5️⃣ | [docs/backend_design.md](./docs/backend_design.md) | API, TTS pipeline |
| 6️⃣ | [docs/database_design.md](./docs/database_design.md) | Database schema |
| 7️⃣ | [USE_CASES.md](./USE_CASES.md) | User flows |
| 8️⃣ **LOWEST** | [docs/test_scenarios.md](./docs/test_scenarios.md) | Test matrix |

**See**: [`SPEC_CANONICAL.md`](./SPEC_CANONICAL.md) §11

---

## 📚 Complete Documentation Structure

### 🔴 Core Specification (6 Documents - v2.0)

These 6 documents form the complete specification suite:

1. **[`SPEC_CANONICAL.md`](./SPEC_CANONICAL.md)** – System invariants, non-negotiables, state machine, admin rules
2. **[`AI_GUIDELINES.md`](./AI_GUIDELINES.md)** – AI guardrails, technology stack, testing mandate
3. **[`ARCHITECTURE.md`](./ARCHITECTURE.md)** – Technical implementation, data models, flows
4. **[`docs/backend_design.md`](./docs/backend_design.md)** – API endpoints (15+), TTS pipeline, i18n strategy
5. **[`docs/database_design.md`](./docs/database_design.md)** – PostgreSQL schema (8 tables), SQLite mirror, relationships
6. **[`USE_CASES.md`](./USE_CASES.md)** – 8 detailed use cases (Authorization, Explore, Play, QR, Language, Controls, Tour, Offline)

### 🔵 Supporting Documentation

- **[`docs/test_scenarios.md`](./docs/test_scenarios.md)** – 100+ test cases across 16 test suites
- **[`docs/prd/`](./docs/prd/)** – Product Requirements (15 sections including admin rules)
- **[`USE_CASE_MAPPING.md`](./USE_CASE_MAPPING.md)** – UC ↔ Test Scenario ↔ Component traceability

---

## 🤖 For AI Agents & Developers

**MANDATORY**: Read **[`TEAM_START_HERE.md`](./TEAM_START_HERE.md)** before coding.

This file defines:
- ✅ Mandatory read order for all AI code generation
- ✅ Forbidden patterns (auto-play, background GPS, on-device TTS, etc.)
- ✅ Testing requirements (AAA pattern, 70%+ coverage)
- ✅ Pre-submission verification checklist

**Read Order** (to avoid logic inconsistency):
```
1. README.md (this file)
2. SPEC_CANONICAL.md §2-6 (system invariants)
3. AI_GUIDELINES.md §2-6 (guardrails & stack)
4. ARCHITECTURE.md §2-7 (implementation)
5. docs/backend_design.md or USE_CASES.md (depending on task)
6. docs/test_scenarios.md (test matrix)
```

**See**: [`TEAM_START_HERE.md`](./TEAM_START_HERE.md)

---

## 🛠️ Technology Stack

### Mobile Client (React Native / Expo)

| Component | Technology | Purpose |
|-----------|-----------|----------|
| Framework | React Native 0.81+ (Expo SDK 54) | UI & interactions |
| Language | TypeScript 5.0+ | Type safety |
| Location | `expo-location` | Foreground GPS only |
| **Audio** | **`expo-av`** | **Playback pre-generated MP3** (NOT on-device TTS) |
| Offline | `expo-sqlite` | Local POI mirror |
| Cache | `expo-file-system` | MP3 audio cache |
| State | `zustand` | Global state & Narration State Machine |
| Maps | `react-native-maps` | POI display & interaction |

**Important**: TTS generation is **SERVER-SIDE ONLY** (not on-device). Mobile app plays pre-generated MP3 files from cache.  
**See**: [`AI_GUIDELINES.md`](./AI_GUIDELINES.md) §2.1, [`SPEC_CANONICAL.md`](./SPEC_CANONICAL.md) §4.1

### Backend API (Node.js Monolith)

| Component | Technology | Purpose |
|-----------|-----------|----------|
| Runtime | Node.js 20+ | Server process |
| Framework | Express.js + TypeScript | REST API |
| Database | PostgreSQL 14+ (with PostGIS) | Primary source of truth |
| Cache | Redis | Query caching, sync manifest |
| **TTS Engine** | **Piper (offline, free, no account)** | **Background job queue** (NOT on-device) |
| Storage | Audio local filesystem + Image Cloudinary | Media files |
| ORM | Prisma | Type-safe database access |
| Jobs | BullMQ / Node-Schedule | Background TTS processing |

**Constraint**: No Kafka/RabbitMQ (keep monolith simple for MVP).  
**See**: [`AI_GUIDELINES.md`](./AI_GUIDELINES.md) §2.2, [`backend_design.md`](./docs/backend_design.md) §3

---

## 🍜 System Philosophy vs. Previous Versions

**Different from GPS auto-trigger version:**

| Aspect | ❌ Previous | ✅ Current (v2.0) |
|--------|-----------|------------------|
| Audio Trigger | Geofence auto-play | User tap/QR only |
| Background GPS | Continuous tracking | Foreground only (blue dot) |
| Audio Generation | On-device TTS | Server-side MP3 batch |
| Priority | Automation | User control + offline-first |
| Use Case | Auto-narration zones | Manual exploration narrative |

**See**: [`SPEC_CANONICAL.md`](./SPEC_CANONICAL.md) §2 (System Invariants)

---

## 🔐 Authentication & Access

**Two authorization paths**:
1. **Claim Code** – Offline voucher validation (preferable for MVP)
2. **Payment Integration** – VNPay / Momo webhook callback

**Both paths**: Trigger offline sync → User explores with cached data (no internet required)

**See**: [`USE_CASES.md`](./USE_CASES.md) UC1 (Authorization), [`backend_design.md`](./docs/backend_design.md) §2.2 (Auth API)

---

## 📊 Key Metrics & SLA

| Metric | Target | Reference |
|--------|--------|-----------|
| Tap Response | < 500ms | SPEC_CANONICAL.md §6 |
| Audio Start | < 1-2s | SPEC_CANONICAL.md §6 |
| API Response | < 200ms P95 | backend_design.md §6 |
| Full Sync | < 5s | backend_design.md §3 |
| Memory Usage | < 150MB | SPEC_CANONICAL.md §6 |
| Uptime | 99.9% | ARCHITECTURE.md §9 |
| Test Coverage | 70%+ | AI_GUIDELINES.md §8 |

---

## 📝 README Scope

**README** provides:
- ✅ Quick project overview & core principle
- ✅ Setup instructions (Prerequisites, Installation, Running)
- ✅ Documentation navigation for different roles
- ✅ Tech stack overview (corrected to server-side TTS)
- ✅ Links to complete specification suite

**NOT in README** (see links above):
- ❌ Detailed API specs → [`docs/backend_design.md`](./docs/backend_design.md)
- ❌ Database schema → [`docs/database_design.md`](./docs/database_design.md)
- ❌ Use case flows → [`USE_CASES.md`](./USE_CASES.md)
- ❌ Test scenarios → [`docs/test_scenarios.md`](./docs/test_scenarios.md)
- ❌ System invariants → [`SPEC_CANONICAL.md`](./SPEC_CANONICAL.md)
- ❌ Implementation patterns → [`ARCHITECTURE.md`](./ARCHITECTURE.md)

---

## 📋 Document Versions & Update History

| Document | Version | Last Updated |
|----------|---------|--------------|
| README.md | 2.0 | 2026-03-25 |
| SPEC_CANONICAL.md | 2.0 | 2026-03-25 |
| AI_GUIDELINES.md | 2.0 | 2026-03-25 |
| ARCHITECTURE.md | 2.0 | 2026-03-25 |
| docs/backend_design.md | 2.0 | 2026-03-25 |
| docs/database_design.md | 2.0 (new) | 2026-03-25 |
| USE_CASES.md | 3.0 | 2026-03-25 |
| docs/test_scenarios.md | 2.0 | 2026-03-25 |

**All 6 core specification documents are synchronized, cross-referenced, and form a cohesive specification suite.**
