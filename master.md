# SCRP — Secure Consent Recording Platform
## Master Blueprint & Technical Architecture Document

> **Document Type:** Master Product & Engineering Blueprint  
> **Version:** 1.0.0  
> **Status:** Draft — Awaiting Product Design Review  
> **Prepared For:** Internal Review — Product Design Manager  
> **Domain:** Financial Technology / Consent Management / Video Infrastructure  
> **Jurisdiction Context:** Nepal (NRB-compliant design, globally extensible)  
> **Classification:** Confidential — Internal Use Only

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Problem Statement](#2-problem-statement)
3. [Solution Overview](#3-solution-overview)
4. [System Actors & Roles](#4-system-actors--roles)
5. [Feature Specification](#5-feature-specification)
6. [System Architecture](#6-system-architecture)
7. [Database Schema Design](#7-database-schema-design)
8. [API Design](#8-api-design)
9. [Security Architecture](#9-security-architecture)
10. [Media & Recording Infrastructure](#10-media--recording-infrastructure)
11. [Storage Architecture](#11-storage-architecture)
12. [UI/UX Design Specification](#12-uiux-design-specification)
13. [Session Lifecycle](#13-session-lifecycle)
14. [Configuration System](#14-configuration-system)
15. [Notification System](#15-notification-system)
16. [Consent Certificate Generation](#16-consent-certificate-generation)
17. [Audit & Compliance](#17-audit--compliance)
18. [Technology Stack](#18-technology-stack)
19. [Deployment Architecture](#19-deployment-architecture)
20. [Release Roadmap](#20-release-roadmap)
21. [Risk & Mitigation](#21-risk--mitigation)
22. [Glossary](#22-glossary)

---

## 1. Executive Summary

The **Secure Consent Recording Platform (SCRP)** is a purpose-built, web-based video consent management system designed to digitize, record, and preserve legally defensible proof of consent between financial institutions and their clients' guarantors.

In Nepal's current lending landscape, loan guarantors are required to formally acknowledge their obligations. This traditionally involves in-person visits, paper documentation, and significant operational overhead. SCRP replaces this process with a **secure, recorded, auditable video call** — generating tamper-evident consent artifacts stored under write-once, read-many (WORM) policies.

The platform is architected as a **generic consent engine** — initially serving the loan guarantor use case, but extensible to insurance underwriting, property agreements, legal declarations, and any regulated consent scenario.

**Key Value Propositions:**
- Eliminates physical branch visits for guarantors
- Creates legally defensible, timestamped, hashed video proof
- Reduces consent fraud risk through multi-layer identity verification
- Provides a complete audit trail from session creation to storage
- Reduces processing time from days to under 30 minutes

---

## 2. Problem Statement

### 2.1 Current State (Manual Process)

```
Loan Application Received
        │
        ▼
Bank contacts Guarantor ──► Guarantor travels to branch
        │
        ▼
Paper consent form signed ──► Filed in physical cabinet
        │
        ▼
No verifiable proof of live, informed consent
```

**Pain Points:**
- Guarantors may deny having given consent (no live proof)
- Physical documents are susceptible to forgery and loss
- No mechanism to verify guarantor was present and willing
- Branch visit creates friction, especially for remote guarantors
- No centralized audit trail across loan operations
- NRB digital documentation directives are unmet

### 2.2 Regulatory Context

Nepal Rastra Bank (NRB) is actively promoting digital KYC and documentation practices for licensed financial institutions. A platform generating cryptographically signed, stored video consent directly supports compliance with emerging NRB digital operations guidelines.

---

## 3. Solution Overview

SCRP introduces a **four-phase consent workflow**:

```
PHASE 1: REGISTRATION          PHASE 2: INVITATION
─────────────────────          ───────────────────
Staff creates consent    ──►   Secure one-time link
session with loan              sent to guarantor via
context and guarantor          SMS + Email with OTP
details                        verification required

PHASE 3: LIVE SESSION          PHASE 4: PRESERVATION
─────────────────────          ──────────────────────
Staff + Guarantor join   ──►   Recording uploaded to
recorded video call.           WORM storage. PDF
Staff takes consent            certificate generated.
snapshots. Timer               Hashes computed and
enforces minimum               logged. Link invalidated.
duration.
```

---

## 4. System Actors & Roles

### 4.1 Role Definitions

| Role | Description | Access Level |
|------|-------------|--------------|
| **Super Admin** | Platform-wide configuration, tenant management | Full |
| **Branch Manager** | Approve sessions, access all branch recordings | Branch-scoped |
| **Loan Officer (Staff)** | Create sessions, conduct calls, take snapshots | Session-scoped |
| **Compliance Officer** | Read-only access to all sessions and recordings | Read-only |
| **Guarantor** | Join via secure link, no login, no stored account | Token-scoped |
| **System/Daemon** | Recording service, certificate generator, cleanup jobs | Internal |

### 4.2 Permission Matrix

| Action | Super Admin | Branch Manager | Loan Officer | Compliance | Guarantor |
|--------|:-----------:|:--------------:|:------------:|:----------:|:---------:|
| Create Session | ✅ | ✅ | ✅ | ❌ | ❌ |
| Send Invite Link | ✅ | ✅ | ✅ | ❌ | ❌ |
| Join Call (Staff) | ✅ | ✅ | ✅ | ❌ | ❌ |
| Join Call (Guarantor) | ❌ | ❌ | ❌ | ❌ | ✅ |
| Take Snapshots | ❌ | ❌ | ✅ | ❌ | ❌ |
| Extend Session | ✅ | ✅ | ✅ | ❌ | ❌ |
| End Session | ✅ | ✅ | ✅ | ❌ | ❌ |
| View Recording | ✅ | ✅ | ✅ (own) | ✅ | ✅ (own, limited) |
| Download Recording | ✅ | ✅ | ❌ | ✅ | ❌ |
| Delete Recording | ✅ | ❌ | ❌ | ❌ | ❌ |
| Export Audit Log | ✅ | ❌ | ❌ | ✅ | ❌ |
| Configure Platform | ✅ | ❌ | ❌ | ❌ | ❌ |

---

## 5. Feature Specification

### 5.1 Core Features (v1.0 — Release Scope)

#### F-001: Session Registration
- Staff creates a consent session with the following context:
  - Session purpose (loan, insurance, property — configurable enum)
  - Reference ID (Loan ID, Case number, etc.)
  - Guarantor details: full name, phone number, email, NID/citizenship number
  - Session notes (internal)
  - Configured duration parameters
- Session assigned a unique `session_id` (UUID v4)
- Session state begins as `PENDING`

#### F-002: Secure Invite Link Generation
- JWT-signed token containing: `session_id`, `role=guarantor`, `jti` (unique token ID), `iat`, `exp`
- Token signed with RS256 (asymmetric — private key server-side, public key for verification)
- Configurable expiry window (default: 48 hours)
- Single-use enforcement: `jti` stored in Redis; invalidated on first use
- URL format: `https://consent.domain.com/join/{session_id}?t={JWT}`
- Optional: IP binding at token generation time

#### F-003: Guarantor OTP Verification
- Guarantor opens link → enters registered phone/email
- System validates against session registration data
- OTP (6-digit, numeric) delivered via SMS and/or email
- OTP TTL: 5 minutes
- Max attempts: 3 (session locked on exhaustion, staff notified)
- On success: guarantor receives session-scoped access token

#### F-004: Live Video Call
- WebRTC peer-to-peer video and audio
- STUN/TURN server for NAT traversal (self-hosted Coturn)
- Side-by-side layout: Guarantor (large, primary) | Staff (secondary)
- Recording indicator: animated red badge visible to both parties
- Session timer: counts up from 0:00, displays minimum remaining time
- Consent banner displayed persistently to guarantor: "This call is being recorded for consent purposes."
- Language toggle: English / Nepali (i18n support)

#### F-005: Configurable Session Timer
- Parameters (all configurable per session or globally):
  ```yaml
  min_duration_seconds: 60
  default_duration_seconds: 120
  max_duration_seconds: 600
  extend_increment_seconds: 60
  max_extensions: 5
  end_call_locked_until_min: true
  ```
- "End Call" button is disabled until minimum duration is reached
- Staff can extend in configured increments with each extension logged
- Hard cap enforced server-side — call auto-terminates at `max_duration`
- Extension log: `[{extended_at, extended_by, increment_seconds, reason}]`

#### F-006: Staff Snapshot Capture (Silent)
- Three configurable snapshot buttons in staff UI: Snapshot 1, 2, 3 (labels configurable)
- Capture modes (configurable per session or per button):
  - `guarantor_only` — crops guarantor's video feed element via Canvas API
  - `full_screen` — entire call interface screenshot
  - `split_frame` — both feeds composited side-by-side as one image
- Capture is **silent and invisible to guarantor** — no UI indication on their screen
- Each snapshot: timestamped, session-bound, auto-labeled (`snap_{session_id}_{n}_{timestamp}.png`)
- Stored alongside recording in object storage
- Included in consent certificate as identity evidence
- Configurable: enable/disable snapshots, number of buttons (1–5), labels, capture mode per button

#### F-007: Staff Private Notes Panel
- Collapsible side panel, visible to staff only
- Timestamped text entries during live session
- Notes stored in DB, linked to session
- Notes are **not** recorded, **not** visible to guarantor
- Included in staff-only session report (not in public certificate)

#### F-008: Consent Moment Marker
- Staff clicks "Mark Consent Given" button at the precise moment
- Creates a video timestamp bookmark in the recording metadata
- Event logged: `{event: "consent_marked", timestamp_seconds: N, marked_by: staff_id}`
- The bookmarked timestamp is referenced in the PDF certificate
- Multiple markers allowed (each logged separately)

#### F-009: Watermark Overlay on Recording
- Persistent, semi-transparent watermark on recorded video:
  - Session ID
  - Date and time (ISO 8601)
  - Loan/Reference ID
  - Institution name
- Watermark rendered server-side during recording — cannot be stripped by client
- Font size and opacity configurable

#### F-010: Session Recording & Upload
- Recording begins automatically on both parties joining
- Server-side recording via SFU (Mediasoup) — not dependent on client
- Format: WebM (VP8/VP9 video, Opus audio)
- Post-call: recording uploaded to configured storage backend (MinIO or local)
- SHA-256 hash computed on upload; stored in DB
- Object locked immediately after upload (WORM)

#### F-011: Post-Session PDF Consent Certificate
- Auto-generated after successful session completion
- Certificate contents:
  - Institution name, logo, and branch details
  - Session ID, Reference ID, session purpose
  - Guarantor full name, NID number, geolocation at join
  - Staff name, employee ID
  - Session date, start time, end time, total duration
  - Consent Marked timestamp(s)
  - Snapshot images (guarantor_only or split, configurable)
  - Recording file name and SHA-256 hash
  - Verification QR code (links to verification portal)
  - Digital signature block
- Certificate itself is SHA-256 hashed and stored
- Delivered to: staff email, guarantor email (configurable)

#### F-012: Geolocation Capture
- Captured on join for both staff and guarantor (browser Geolocation API)
- Coordinates stored in session record
- Flag raised if guarantor joins from outside Nepal (configurable threshold)
- Geolocation logged in certificate and audit trail

#### F-013: Device Fingerprinting (Guarantor)
- Browser fingerprint collected on guarantor's join: user-agent, screen resolution, timezone, language, platform
- Stored in session record
- Used for anomaly detection (same device joining multiple sessions)

#### F-014: Connection Quality Monitoring
- Real-time WebRTC stats: packet loss, jitter, bitrate
- Quality degradation warning shown to both parties
- If quality falls below threshold for > 10 seconds: session paused, warning logged
- Severe degradation: auto-flag on session record for review

#### F-015: Session Dashboard (Staff/Admin)
- Tabular view of all sessions with filters: status, date range, staff, branch, purpose
- Status badges: `PENDING`, `LINK_SENT`, `GUARANTOR_VERIFIED`, `ACTIVE`, `COMPLETED`, `FAILED`, `EXPIRED`
- Quick actions: Resend link, Cancel session, View recording (presigned URL)
- Export: CSV/PDF report of filtered sessions
- Real-time status update via WebSocket

### 5.2 Extended Features (v2.0 — Planned)

| ID | Feature | Description |
|----|---------|-------------|
| F-101 | Face Match on Join | Compare live guarantor face to uploaded ID photo using face recognition |
| F-102 | Liveness Check | Blink/nod challenge before session start to prevent photo spoofing |
| F-103 | QR Verification Portal | Public URL on certificate where anyone can verify recording integrity |
| F-104 | Bulk Invite | Upload CSV of guarantors for batch session creation |
| F-105 | Video Chapter Markers | Auto-chapter the recording based on logged events |
| F-106 | Speech-to-Text Transcript | Auto-transcription of session for searchable text records |
| F-107 | e-Signature Integration | Post-call digital signature collection |
| F-108 | NRB Export Module | Regulatory report generator for NRB submissions |
| F-109 | Multi-tenancy | Support multiple banks/institutions on a single platform instance |
| F-110 | Mobile App | Native iOS/Android for staff and guarantor (with WebRTC support) |

---

## 6. System Architecture

### 6.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          CLIENT LAYER                                    │
│                                                                          │
│   ┌──────────────────┐              ┌────────────────────────────────┐  │
│   │  Staff Web App   │              │     Guarantor Portal           │  │
│   │  (React + WS)    │              │  (React, accessed via link)    │  │
│   └────────┬─────────┘              └──────────────┬─────────────────┘  │
└────────────│──────────────────────────────────────│────────────────────┘
             │ HTTPS / WSS                           │ HTTPS / WSS
┌────────────▼──────────────────────────────────────▼────────────────────┐
│                        API GATEWAY / REVERSE PROXY                      │
│                    (Nginx — TLS termination, rate limiting)             │
└────────────────────────────┬────────────────────────────────────────────┘
                             │
         ┌───────────────────┼───────────────────────┐
         │                   │                       │
┌────────▼────────┐ ┌────────▼────────┐  ┌──────────▼──────────┐
│  FastAPI App    │ │  Signaling WS   │  │  Mediasoup SFU      │
│  (REST API)     │ │  Server (FastAPI│  │  (Node.js)          │
│                 │ │  WebSocket)     │  │  Server-side        │
│  - Sessions     │ │                 │  │  recording          │
│  - Auth/OTP     │ │  - Room mgmt    │  │  + watermarking     │
│  - Links        │ │  - ICE/SDP      │  └──────────┬──────────┘
│  - Snapshots    │ │  - Presence     │             │
│  - Certificates │ └─────────────────┘             │ Media streams
└────────┬────────┘                                 │
         │                              ┌───────────▼──────────┐
         │                              │  Recording Worker    │
┌────────▼────────┐                     │  (Python / FFmpeg)   │
│  PostgreSQL     │                     │  - Merge streams     │
│  Database       │◄────────────────────│  - Add watermark     │
│                 │                     │  - Compute hash      │
│  - Sessions     │                     │  - Upload to MinIO   │
│  - Audit logs   │                     └──────────────────────┘
│  - Snapshots    │
│  - Certificates │          ┌──────────────────────────────────┐
└─────────────────┘          │          MinIO / Local FS        │
                             │  - WORM buckets                  │
┌─────────────────┐          │  - Video recordings              │
│  Redis          │          │  - Snapshots                     │
│                 │          │  - PDF certificates              │
│  - OTP store    │          │  - Audit exports                 │
│  - JWT jti set  │          └──────────────────────────────────┘
│  - Session state│
│  - Rate limits  │          ┌──────────────────────────────────┐
└─────────────────┘          │  Notification Service            │
                             │  - SMS (Sparrow SMS / Twilio)    │
                             │  - Email (SMTP / SendGrid)       │
                             └──────────────────────────────────┘
```

### 6.2 WebRTC Architecture

```
Staff Browser ◄──── STUN (IP discovery) ────► Coturn STUN/TURN Server
      │                                                    │
      │ SDP Offer/Answer via Signaling WS                  │
      │                                                    │
Guarantor Browser ◄── TURN relay (if P2P fails) ──────────┘
      │
      ▼ Media stream also mirrored to:
Mediasoup SFU ──► Recording pipeline
```

---

## 7. Database Schema Design

### 7.1 Core Tables

```sql
-- ============================================================
-- INSTITUTIONS (for multi-tenancy readiness)
-- ============================================================
CREATE TABLE institutions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(255) NOT NULL,
    code            VARCHAR(50) UNIQUE NOT NULL,
    logo_url        TEXT,
    config          JSONB DEFAULT '{}',  -- institution-level config overrides
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- USERS (Staff accounts)
-- ============================================================
CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    institution_id  UUID REFERENCES institutions(id),
    employee_id     VARCHAR(100) NOT NULL,
    full_name       VARCHAR(255) NOT NULL,
    email           VARCHAR(255) UNIQUE NOT NULL,
    phone           VARCHAR(20),
    role            VARCHAR(50) NOT NULL,  -- SUPER_ADMIN, BRANCH_MANAGER, LOAN_OFFICER, COMPLIANCE
    branch_code     VARCHAR(50),
    password_hash   VARCHAR(255) NOT NULL,
    is_active       BOOLEAN DEFAULT TRUE,
    last_login_at   TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- CONSENT SESSIONS
-- ============================================================
CREATE TABLE consent_sessions (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    institution_id          UUID REFERENCES institutions(id),
    created_by              UUID REFERENCES users(id),
    
    -- Context
    purpose                 VARCHAR(100) NOT NULL,  -- LOAN_GUARANTEE, INSURANCE, PROPERTY
    reference_id            VARCHAR(255) NOT NULL,  -- Loan ID, Case ID, etc.
    reference_label         VARCHAR(100),           -- Human-readable label for reference_id
    internal_notes          TEXT,
    
    -- Guarantor Info
    guarantor_name          VARCHAR(255) NOT NULL,
    guarantor_phone         VARCHAR(20) NOT NULL,
    guarantor_email         VARCHAR(255),
    guarantor_nid           VARCHAR(100),           -- National ID / Citizenship number
    
    -- Session State
    status                  VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    -- PENDING | LINK_SENT | GUARANTOR_VERIFIED | ACTIVE | COMPLETED | FAILED | EXPIRED | CANCELLED
    
    -- Timing
    scheduled_at            TIMESTAMPTZ,
    started_at              TIMESTAMPTZ,
    ended_at                TIMESTAMPTZ,
    duration_seconds        INTEGER,
    
    -- Configuration snapshot (at time of creation)
    session_config          JSONB NOT NULL DEFAULT '{}',
    
    -- Recording
    recording_filename      VARCHAR(500),
    recording_path          VARCHAR(1000),
    recording_hash_sha256   VARCHAR(64),
    recording_size_bytes    BIGINT,
    recording_storage       VARCHAR(50),  -- MINIO | LOCAL
    
    -- Certificate
    certificate_filename    VARCHAR(500),
    certificate_path        VARCHAR(1000),
    certificate_hash_sha256 VARCHAR(64),
    
    -- Flags
    has_snapshots           BOOLEAN DEFAULT FALSE,
    consent_marked          BOOLEAN DEFAULT FALSE,
    quality_flagged         BOOLEAN DEFAULT FALSE,
    geo_flagged             BOOLEAN DEFAULT FALSE,
    
    created_at              TIMESTAMPTZ DEFAULT NOW(),
    updated_at              TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- INVITE TOKENS
-- ============================================================
CREATE TABLE invite_tokens (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id      UUID REFERENCES consent_sessions(id),
    jti             VARCHAR(255) UNIQUE NOT NULL,  -- JWT ID (for one-use check)
    token_hash      VARCHAR(64) NOT NULL,           -- SHA-256 of full JWT
    sent_to_phone   VARCHAR(20),
    sent_to_email   VARCHAR(255),
    expires_at      TIMESTAMPTZ NOT NULL,
    used_at         TIMESTAMPTZ,
    invalidated_at  TIMESTAMPTZ,
    invalidation_reason VARCHAR(100),
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- OTP VERIFICATIONS
-- ============================================================
CREATE TABLE otp_verifications (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id      UUID REFERENCES consent_sessions(id),
    otp_hash        VARCHAR(64) NOT NULL,   -- Hashed OTP (never store plain)
    attempts        INTEGER DEFAULT 0,
    max_attempts    INTEGER DEFAULT 3,
    expires_at      TIMESTAMPTZ NOT NULL,
    verified_at     TIMESTAMPTZ,
    locked_at       TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- GUARANTOR JOIN DETAILS
-- ============================================================
CREATE TABLE guarantor_sessions (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id          UUID REFERENCES consent_sessions(id),
    joined_at           TIMESTAMPTZ,
    left_at             TIMESTAMPTZ,
    ip_address          INET,
    geolocation_lat     DECIMAL(10, 8),
    geolocation_lng     DECIMAL(11, 8),
    geolocation_city    VARCHAR(100),
    geolocation_country VARCHAR(100),
    geo_flagged         BOOLEAN DEFAULT FALSE,
    device_fingerprint  JSONB,  -- UA, screen, timezone, platform, language
    browser_info        JSONB,
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- SESSION SNAPSHOTS
-- ============================================================
CREATE TABLE session_snapshots (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id      UUID REFERENCES consent_sessions(id),
    taken_by        UUID REFERENCES users(id),
    snapshot_index  INTEGER NOT NULL,  -- 1, 2, 3
    label           VARCHAR(100),      -- Configurable button label
    capture_mode    VARCHAR(50),       -- GUARANTOR_ONLY | FULL_SCREEN | SPLIT_FRAME
    filename        VARCHAR(500),
    storage_path    VARCHAR(1000),
    file_hash_sha256 VARCHAR(64),
    file_size_bytes INTEGER,
    taken_at        TIMESTAMPTZ DEFAULT NOW(),
    session_second  INTEGER  -- At what second of the call was this taken
);

-- ============================================================
-- SESSION EVENTS (consent markers, extensions, quality flags)
-- ============================================================
CREATE TABLE session_events (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id      UUID REFERENCES consent_sessions(id),
    actor_id        UUID,           -- NULL for system events
    actor_role      VARCHAR(50),    -- STAFF | SYSTEM | GUARANTOR
    event_type      VARCHAR(100) NOT NULL,
    -- GUARANTOR_JOINED | GUARANTOR_LEFT | STAFF_JOINED | STAFF_LEFT
    -- CONSENT_MARKED | SESSION_EXTENDED | SESSION_ENDED | SESSION_PAUSED
    -- SNAPSHOT_TAKEN | QUALITY_WARNING | QUALITY_FLAGGED
    -- OTP_SENT | OTP_VERIFIED | OTP_FAILED | OTP_LOCKED
    -- RECORDING_STARTED | RECORDING_STOPPED | RECORDING_UPLOADED
    -- CERTIFICATE_GENERATED | LINK_SENT | LINK_EXPIRED | LINK_USED
    event_data      JSONB,          -- Additional context per event type
    session_second  INTEGER,        -- Second in recording when event occurred
    ip_address      INET,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- SESSION NOTES (Staff private)
-- ============================================================
CREATE TABLE session_notes (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id      UUID REFERENCES consent_sessions(id),
    written_by      UUID REFERENCES users(id),
    note_text       TEXT NOT NULL,
    session_second  INTEGER,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- AUDIT LOG (immutable, append-only)
-- ============================================================
CREATE TABLE audit_log (
    id              BIGSERIAL PRIMARY KEY,
    institution_id  UUID,
    session_id      UUID,
    user_id         UUID,
    action          VARCHAR(200) NOT NULL,
    resource_type   VARCHAR(100),
    resource_id     VARCHAR(255),
    old_value       JSONB,
    new_value       JSONB,
    ip_address      INET,
    user_agent      TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW()
    -- NO UPDATE, NO DELETE triggers enforced
);

-- ============================================================
-- PLATFORM CONFIGURATION
-- ============================================================
CREATE TABLE platform_config (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    institution_id  UUID REFERENCES institutions(id),  -- NULL = global default
    config_key      VARCHAR(200) NOT NULL,
    config_value    JSONB NOT NULL,
    description     TEXT,
    updated_by      UUID REFERENCES users(id),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(institution_id, config_key)
);
```

---

## 8. API Design

### 8.1 API Conventions

- **Base URL:** `https://api.consent.domain.com/v1`
- **Authentication:** JWT Bearer token (staff); session-scoped token (guarantor)
- **Format:** JSON request/response
- **Errors:** Standard `{code, message, details}` structure
- **Versioning:** URL-path versioned (`/v1/`, `/v2/`)
- **Rate Limiting:** Per-IP and per-user, enforced at Nginx and Redis layer

### 8.2 Endpoint Catalog

#### Auth
```
POST   /v1/auth/login              Staff login → JWT
POST   /v1/auth/refresh            Refresh access token
POST   /v1/auth/logout             Invalidate token
```

#### Sessions
```
POST   /v1/sessions                Create consent session
GET    /v1/sessions                List sessions (filters: status, date, branch)
GET    /v1/sessions/{id}           Get session detail
PATCH  /v1/sessions/{id}           Update session (pre-start only)
DELETE /v1/sessions/{id}           Cancel session (PENDING/LINK_SENT only)
POST   /v1/sessions/{id}/invite    Generate and send invite link
POST   /v1/sessions/{id}/extend    Extend session duration
POST   /v1/sessions/{id}/end       End active session
POST   /v1/sessions/{id}/mark-consent  Add consent timestamp marker
```

#### Guarantor (Token-authenticated)
```
POST   /v1/guarantor/verify-otp    Verify OTP → session access token
GET    /v1/guarantor/session       Get own session detail
POST   /v1/guarantor/join          Notify join, capture geolocation + fingerprint
```

#### Snapshots
```
POST   /v1/sessions/{id}/snapshots       Upload snapshot (multipart)
GET    /v1/sessions/{id}/snapshots       List snapshots
GET    /v1/sessions/{id}/snapshots/{n}   Get snapshot (presigned URL)
```

#### Notes
```
POST   /v1/sessions/{id}/notes     Add staff note
GET    /v1/sessions/{id}/notes     Get all notes for session
```

#### Recordings
```
GET    /v1/sessions/{id}/recording      Get presigned playback URL
GET    /v1/sessions/{id}/recording/verify  Verify recording hash integrity
```

#### Certificates
```
GET    /v1/sessions/{id}/certificate    Get presigned PDF URL
POST   /v1/sessions/{id}/certificate/resend  Resend certificate email
```

#### Admin / Config
```
GET    /v1/config                  Get current platform config
PATCH  /v1/config                  Update config (Super Admin only)
GET    /v1/audit                   Query audit log (Compliance + Super Admin)
GET    /v1/users                   List users
POST   /v1/users                   Create user
PATCH  /v1/users/{id}              Update user
DELETE /v1/users/{id}              Deactivate user
```

### 8.3 Key Request/Response Samples

**POST /v1/sessions — Create Session**
```json
Request:
{
  "purpose": "LOAN_GUARANTEE",
  "reference_id": "LOAN-2024-0091823",
  "reference_label": "Home Loan Application",
  "guarantor_name": "Ram Bahadur Thapa",
  "guarantor_phone": "+977-9841XXXXXX",
  "guarantor_email": "ram.thapa@example.com",
  "guarantor_nid": "12-34-56-78901",
  "internal_notes": "Primary guarantor for home loan, KYC completed.",
  "session_config": {
    "min_duration_seconds": 90,
    "default_duration_seconds": 180,
    "extend_increment_seconds": 60,
    "max_extensions": 3,
    "otp_required": true,
    "snapshots": {
      "enabled": true,
      "buttons": [
        {"index": 1, "label": "Face Capture", "capture_mode": "guarantor_only"},
        {"index": 2, "label": "Full Screen",  "capture_mode": "full_screen"},
        {"index": 3, "label": "Split View",   "capture_mode": "split_frame"}
      ]
    }
  }
}

Response: 201 Created
{
  "session_id": "a1b2c3d4-...",
  "status": "PENDING",
  "created_at": "2024-11-15T09:30:00Z"
}
```

**POST /v1/sessions/{id}/invite — Send Invite**
```json
Response: 200 OK
{
  "invite_url": "https://consent.domain.com/join/a1b2c3d4?t=eyJhbGci...",
  "expires_at": "2024-11-17T09:30:00Z",
  "sent_via": ["sms", "email"]
}
```

---

## 9. Security Architecture

### 9.1 Security Layers

```
Layer 1: Transport
  └── TLS 1.3 enforced everywhere (HTTPS + WSS)
  └── HSTS headers on all responses
  └── Certificate pinning recommended for mobile clients

Layer 2: Authentication
  └── Staff: JWT (RS256), 15-min access token + 7-day refresh token
  └── Guarantor: one-time invite JWT + OTP → session-scoped token (TTL = session duration)
  └── All tokens: jti stored in Redis for revocation

Layer 3: Authorization
  └── Role-based access control (RBAC) enforced at API middleware
  └── Session-scoped checks: staff can only access their own sessions
  └── Branch-scoped checks: branch managers scoped to their branch

Layer 4: Link Security
  └── RS256 JWT with session_id, jti, exp claims
  └── jti stored in Redis; invalidated on first use OR session end
  └── Optional IP binding: token rejects requests from different IP
  └── Token expires after configured window (default 48h)

Layer 5: Identity Verification
  └── Guarantor phone/email must match session registration data before OTP
  └── OTP: 6-digit numeric, HMAC-SHA256 based, TTL 5 min, max 3 attempts
  └── OTP stored as bcrypt hash (never plain text)

Layer 6: Data Security
  └── All PII fields encrypted at rest (PostgreSQL TDE or column encryption)
  └── NID numbers stored encrypted (AES-256-GCM)
  └── Presigned URLs for media access (TTL: 15 min for playback)
  └── No media publicly accessible

Layer 7: Recording Integrity
  └── SHA-256 hash computed server-side after upload
  └── Hash stored in DB and embedded in certificate
  └── MinIO object lock (WORM) prevents modification/deletion
  └── Watermark burned into recording server-side

Layer 8: Infrastructure
  └── Rate limiting at Nginx: per-IP, per-endpoint
  └── DDoS protection at load balancer
  └── Secrets managed via HashiCorp Vault or environment secrets manager
  └── No secrets in codebase (12-factor app)
  └── All logs sanitized: no PII or tokens in application logs
```

### 9.2 Threat Model

| Threat | Mitigation |
|--------|-----------|
| Link sharing / forwarding | Single-use JTI + OTP verification + IP binding (optional) |
| Guarantor impersonation | Phone/email match + OTP + geolocation logging + snapshot |
| Recording tampering | WORM storage + SHA-256 hash in DB and certificate |
| Replay attack | JTI invalidated on use; session tokens expire with session |
| Man-in-the-middle | TLS 1.3 enforced; HSTS enabled |
| Brute force OTP | Max 3 attempts, then lock; rate limiting on OTP endpoint |
| Insider access to recordings | Role-based presigned URL; access logged in audit trail |
| Staff fabricating snapshots | Snapshots taken via server-confirmed API call; timestamp + hash stored |
| Session data leakage | PII encrypted at rest; logs sanitized |

---

## 10. Media & Recording Infrastructure

### 10.1 SFU Architecture (Mediasoup)

```
Staff Browser ──► Mediasoup SFU Router ──► Guarantor Browser
                        │
                        ▼
                  Recording Consumer
                        │
                        ▼
                  RTP Streams (VP8 + Opus)
                        │
                        ▼
                  FFmpeg Pipe Process
                        │
                  ┌─────┴──────────────┐
                  │                    │
            Watermark Filter     Audio Mix
                  │                    │
                  └─────────┬──────────┘
                            │
                      Output: WebM file
                            │
                      Upload to MinIO
```

### 10.2 Recording Pipeline

1. **Session Start** → Mediasoup room created, both producers registered
2. **Recording Consumer** subscribes to both audio/video tracks
3. **RTP → FFmpeg** via Unix socket pipe:
   ```
   ffmpeg -f rtp -i rtp://127.0.0.1:5004  \# video
          -f rtp -i rtp://127.0.0.1:5005  \# audio
          -vf "drawtext=text='{session_id} | {date} | {loan_ref}':
               fontsize=18:fontcolor=white@0.5:x=10:y=10"
          -c:v libvpx-vp9 -c:a libopus
          output_{session_id}.webm
   ```
4. **Session End** → FFmpeg process terminated, file finalized
5. **Post-processing** → SHA-256 computed, upload to MinIO, DB updated, WORM lock applied
6. **Certificate generated** → PDF with recording hash embedded

### 10.3 Snapshot Capture (Client-Side, Staff Only)

```javascript
// Staff browser — Canvas API snapshot logic
const captureSnapshot = (mode) => {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  if (mode === 'guarantor_only') {
    // Capture only guarantor video element
    ctx.drawImage(guarantorVideoEl, 0, 0, canvas.width, canvas.height);

  } else if (mode === 'full_screen') {
    // Capture entire call UI
    html2canvas(callContainerEl).then(c => uploadSnapshot(c));
    return;

  } else if (mode === 'split_frame') {
    // Composite both feeds side by side
    ctx.drawImage(guarantorVideoEl, 0, 0, halfW, canvas.height);
    ctx.drawImage(staffVideoEl, halfW, 0, halfW, canvas.height);
  }

  canvas.toBlob(blob => uploadSnapshot(blob), 'image/png');
};

// Upload to backend — no UI indication shown to guarantor
const uploadSnapshot = async (blob) => {
  const formData = new FormData();
  formData.append('snapshot', blob);
  formData.append('session_second', currentSessionSecond);
  await api.post(`/v1/sessions/${sessionId}/snapshots`, formData);
};
```

---

## 11. Storage Architecture

### 11.1 MinIO Configuration

```yaml
# MinIO Bucket Structure
buckets:
  consent-recordings:
    versioning: enabled
    object_lock: enabled          # WORM — compliance mode
    lock_mode: COMPLIANCE          # Cannot be overridden even by admin
    lock_retention_days: 2555      # 7 years (NRB recommended retention)
    access: private

  consent-snapshots:
    versioning: enabled
    object_lock: enabled
    lock_mode: COMPLIANCE
    lock_retention_days: 2555
    access: private

  consent-certificates:
    versioning: enabled
    object_lock: enabled
    lock_mode: COMPLIANCE
    lock_retention_days: 2555
    access: private

  consent-exports:
    versioning: disabled
    object_lock: disabled
    ttl_days: 30                   # Auto-cleaned export files
    access: private
```

### 11.2 Object Naming Convention

```
recordings/  {institution_code}/{YYYY/MM/DD}/{session_id}/
             recording_{session_id}_{unix_ts}.webm

snapshots/   {institution_code}/{YYYY/MM/DD}/{session_id}/
             snap_{session_id}_{index}_{unix_ts}.png

certificates/ {institution_code}/{YYYY/MM/DD}/{session_id}/
              cert_{session_id}_{unix_ts}.pdf
```

### 11.3 Presigned URL Policy

| Actor | Action | URL TTL |
|-------|--------|---------|
| Loan Officer | View recording (stream) | 15 minutes |
| Branch Manager | View recording | 15 minutes |
| Compliance Officer | View + Download | 60 minutes |
| Guarantor | View own recording | 10 minutes |
| Certificate download | Any authorized staff | 30 minutes |

All presigned URL generation events are logged in the audit trail.

### 11.4 Local Storage Fallback

```python
# Storage abstraction layer — drop-in replaceable
class StorageBackend(ABC):
    @abstractmethod
    async def upload(self, key: str, data: bytes, metadata: dict) -> str: ...
    
    @abstractmethod
    async def get_presigned_url(self, key: str, ttl_seconds: int) -> str: ...
    
    @abstractmethod
    async def compute_hash(self, key: str) -> str: ...

class MinIOBackend(StorageBackend): ...
class LocalFileSystemBackend(StorageBackend): ...

# Configured via environment:
# STORAGE_BACKEND=minio | local
```

---

## 12. UI/UX Design Specification

### 12.1 Staff — Session Creation Screen

- Clean form layout: purpose selector (dropdown), reference ID, guarantor details
- Config accordion: session duration, snapshots config, OTP toggle
- "Create & Send Invite" primary CTA
- Success state: invite link displayed with copy + share buttons

### 12.2 Staff — Active Call Screen

```
┌────────────────────────────────────────────────────────────────────┐
│  🔴 RECORDING  │  LOAN-2024-0091823 — Ram Bahadur Thapa  │ 02:34 │
├────────────────────────────────────────────────────────────────────┤
│                                      │                             │
│                                      │  ┌─────────────────────┐   │
│                                      │  │                     │   │
│      GUARANTOR VIDEO FEED            │  │   STAFF VIDEO FEED  │   │
│         (Primary — Large)            │  │   (Secondary)       │   │
│                                      │  │                     │   │
│                                      │  └─────────────────────┘   │
│                                      │                             │
├─────────────────────┬────────────────┼────────────────────────────┤
│ [📷 Face Capture]  [📷 Full Screen] [📷 Split View]               │
├─────────────────────┴────────────────┴────────────────────────────┤
│ [✅ Mark Consent Given]  [⏱ +1 min]  [📝 Notes]  [🔴 End Call]   │
└────────────────────────────────────────────────────────────────────┘
│ PRIVATE NOTES PANEL (collapsible, right side)                      │
│ 09:31 — Guarantor appears calm, confirmed understanding of terms   │
│ [Add note...]                                                       │
└────────────────────────────────────────────────────────────────────┘
```

**Design Rules:**
- Red recording indicator always visible
- "End Call" button: greyed/disabled until minimum duration reached; changes to red when enabled
- Snapshot buttons: labeled per config; pulse briefly on click (staff confirmation)
- Connection quality bar: green/yellow/red indicator at top right
- Language toggle: persistent top-right

### 12.3 Guarantor — Portal Screen

```
┌────────────────────────────────────────────────────────────────────┐
│              Everest Bank — Consent Recording Session               │
├────────────────────────────────────────────────────────────────────┤
│  ⚠️  THIS SESSION IS BEING RECORDED AS PROOF OF YOUR CONSENT       │
│      यो सत्र तपाईंको सहमतिको प्रमाणको रूपमा रेकर्ड गरिँदैछ       │
├────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   ┌──────────────────────────┐  ┌──────────────────────────────┐   │
│   │                          │  │                              │   │
│   │   YOUR VIDEO (You)       │  │   BANK STAFF VIDEO           │   │
│   │                          │  │                              │   │
│   └──────────────────────────┘  └──────────────────────────────┘   │
│                                                                     │
│         Loan Reference: LOAN-2024-0091823                           │
│         Session ID: a1b2c3d4                                        │
│         Duration: 02:34 / Minimum: 01:30                           │
│                                                                     │
└────────────────────────────────────────────────────────────────────┘
```

**Design Rules:**
- Consent banner permanently displayed — cannot be dismissed
- Guarantor sees their own feed prominently (transparency principle)
- No snapshot indication visible on guarantor screen
- No controls other than mic/camera mute (cannot end call)
- Branded per institution (logo, colors)

### 12.4 Staff — Session Dashboard

- Table with sortable columns: Session ID, Reference, Guarantor, Status, Created, Duration
- Color-coded status badges
- Quick action menu per row: View, Resend Link, Download Certificate, View Recording
- Stats summary bar: Today's sessions, Completed, Pending, Failed
- Export button: CSV / PDF

---

## 13. Session Lifecycle

### 13.1 State Machine

```
                    ┌──────────┐
                    │  PENDING │ ──── Staff creates session
                    └────┬─────┘
                         │ Staff sends invite
                    ┌────▼──────┐
                    │ LINK_SENT │ ──── Invite link delivered to guarantor
                    └────┬──────┘
                         │ Guarantor opens link + passes OTP
               ┌─────────▼──────────┐
               │ GUARANTOR_VERIFIED │
               └─────────┬──────────┘
                         │ Both parties join call
                    ┌────▼──────┐
                    │  ACTIVE   │ ──── Recording in progress
                    └────┬──────┘
              ┌──────────┤
              │          │ Staff ends call (after min duration)
              │     ┌────▼──────┐
              │     │ COMPLETED │ ──── Recording stored, cert generated
              │     └───────────┘
              │
              │ Token expired before guarantor joins
              ├────► EXPIRED
              │
              │ OTP max attempts exceeded
              ├────► FAILED
              │
              │ Staff cancels
              └────► CANCELLED
```

### 13.2 Timeout & Failure Handling

| Scenario | Behavior |
|----------|---------|
| Guarantor doesn't join within link TTL | Status → `EXPIRED`; staff notified |
| OTP fails 3 times | OTP locked; staff notified; new link must be sent |
| Staff disconnects mid-call | 60-second grace period; session paused; reconnect allowed |
| Guarantor disconnects mid-call | Session paused; staff sees reconnection prompt |
| Recording upload fails | Retry up to 3 times with exponential backoff; alert triggered on final failure |
| Both parties disconnected > 120s | Session auto-terminated; marked `FAILED` |

---

## 14. Configuration System

### 14.1 Global Default Configuration

```yaml
# platform_config table — global defaults (institution_id = NULL)

session:
  min_duration_seconds: 60
  default_duration_seconds: 120
  max_duration_seconds: 600
  extend_increment_seconds: 60
  max_extensions: 5
  end_call_locked_until_min: true
  auto_record: true

invite:
  token_expiry_hours: 48
  ip_binding_enabled: false
  resend_cooldown_minutes: 5
  max_resends: 3

otp:
  length: 6
  ttl_minutes: 5
  max_attempts: 3
  channel: ["sms", "email"]    # sms | email | both

snapshots:
  enabled: true
  max_buttons: 3
  default_buttons:
    - index: 1
      label: "Face Capture"
      capture_mode: "guarantor_only"
    - index: 2
      label: "Full Screen"
      capture_mode: "full_screen"
    - index: 3
      label: "Split View"
      capture_mode: "split_frame"

recording:
  format: "webm"
  video_codec: "vp9"
  audio_codec: "opus"
  watermark:
    enabled: true
    opacity: 0.5
    position: "top_left"
    fields: ["session_id", "date", "reference_id", "institution_name"]

storage:
  backend: "minio"             # minio | local
  retention_days: 2555         # 7 years
  worm_mode: "COMPLIANCE"

certificate:
  include_snapshots: true
  snapshot_mode: "guarantor_only"
  include_geolocation: true
  include_device_info: false   # Compliance-toggle
  delivery:
    staff_email: true
    guarantor_email: true
    guarantor_sms_link: false

security:
  geo_flag_outside_country: "NP"
  rate_limit_otp_per_hour: 10
  rate_limit_api_per_minute: 60
  session_token_ttl_minutes: 30

notifications:
  sms_provider: "sparrow_sms"  # sparrow_sms | twilio
  email_provider: "smtp"       # smtp | sendgrid
  notify_staff_on_guarantor_join: true
  notify_staff_on_otp_lock: true
  notify_staff_on_recording_ready: true
```

### 14.2 Configuration Override Hierarchy

```
Global Default
    └── Institution Override
            └── Session-Level Override (per session_config field)
```

Lowest level wins. All overrides validated against schema on save.

---

## 15. Notification System

### 15.1 Notification Events & Templates

| Event | Recipients | Channels |
|-------|-----------|---------|
| Invite Link Generated | Guarantor | SMS + Email |
| OTP Sent | Guarantor | SMS + Email |
| OTP Verification Failed (×3) | Staff | Email |
| Guarantor Joined Call | Staff | In-app + Email (optional) |
| Session Completed | Staff, Guarantor | Email |
| Recording Ready | Staff | Email |
| Certificate Ready | Staff, Guarantor | Email (with attachment or link) |
| Session Expired | Staff | Email |
| Recording Upload Failed | Admin | Email + Alert |

### 15.2 SMS Template (Guarantor Invite — English)

```
Dear {guarantor_name},

{institution_name} has requested your presence for a consent 
verification call regarding {reference_label}.

Join securely here: {invite_url}

Link valid until: {expires_at}
Your OTP will be sent separately.

Do NOT share this link. If you did not expect this message, 
call {institution_helpdesk}.
```

### 15.3 SMS Template (OTP)

```
Your SCRP verification code is: {otp}
Valid for 5 minutes.
Do NOT share this code with anyone.
- {institution_name}
```

---

## 16. Consent Certificate Generation

### 16.1 Certificate Structure (PDF)

```
PAGE 1
══════════════════════════════════════════════════════
[INSTITUTION LOGO]             [QR CODE — Verify online]
CONSENT RECORDING CERTIFICATE
══════════════════════════════════════════════════════

CERTIFICATE ID:    CERT-{session_id}-{timestamp}
ISSUED ON:         {date} {time} (NPT, UTC+5:45)

────────────────────────────────────────────────────
SESSION DETAILS
────────────────────────────────────────────────────
Session ID:        {session_id}
Purpose:           Loan Guarantee Consent
Reference:         {reference_id} — {reference_label}
Institution:       {institution_name}, {branch_name}

────────────────────────────────────────────────────
PARTICIPANTS
────────────────────────────────────────────────────
Guarantor:         {guarantor_name}
NID/Citizenship:   {guarantor_nid_masked}
Phone:             {guarantor_phone_masked}
Joined From:       {guarantor_city}, {guarantor_country}

Staff Officer:     {staff_name} ({employee_id})
Department:        {staff_branch}

────────────────────────────────────────────────────
SESSION TIMELINE
────────────────────────────────────────────────────
Call Started:      {started_at}
Consent Marked:    {consent_marked_at} (at 00:{consent_second} of recording)
Call Ended:        {ended_at}
Total Duration:    {duration_seconds}s ({duration_human})

────────────────────────────────────────────────────
IDENTITY SNAPSHOTS                [Snapshot 1] [Snapshot 2]
────────────────────────────────────────────────────

────────────────────────────────────────────────────
RECORDING INTEGRITY
────────────────────────────────────────────────────
Recording File:    {recording_filename}
SHA-256 Hash:      {recording_hash}
Storage:           MinIO — Compliance WORM Locked
Retention Until:   {retention_expiry}

────────────────────────────────────────────────────
CERTIFICATE INTEGRITY
────────────────────────────────────────────────────
Certificate Hash:  {cert_hash}
Digital Signature: {signature_block}

This certificate is system-generated and does not require
a handwritten signature. Verify authenticity at:
https://verify.consent.domain.com/{session_id}
══════════════════════════════════════════════════════
```

---

## 17. Audit & Compliance

### 17.1 Audit Principles

- The `audit_log` table is **append-only** — no UPDATE or DELETE operations permitted at the application or database user level
- Database trigger enforces immutability: any UPDATE/DELETE on `audit_log` raises an exception
- All user actions, system events, and data access are logged
- Audit records include: actor, action, resource, old/new values, IP address, timestamp

### 17.2 Key Audited Actions

```
AUTH:        login, logout, token_refresh, failed_login
SESSIONS:    created, updated, cancelled, link_sent, link_used, link_expired
CALL:        staff_joined, guarantor_joined, consent_marked, session_extended, ended
SNAPSHOTS:   taken, viewed, downloaded
RECORDING:   started, stopped, uploaded, hash_verified, viewed, downloaded
CERTIFICATE: generated, viewed, downloaded, resent
CONFIG:      any config change (with old and new values)
ACCESS:      presigned_url_generated, presigned_url_accessed
ADMIN:       user_created, user_deactivated, role_changed
```

### 17.3 Compliance Export

- Compliance Officers can export filtered audit logs as PDF or CSV
- Exports include metadata: exported_by, exported_at, filter_applied
- Export itself is logged in audit trail

---

## 18. Technology Stack

| Category | Technology | Justification |
|----------|-----------|--------------|
| **Backend API** | Python 3.12 + FastAPI | Async, performant, strong typing, excellent ecosystem |
| **WebSocket Signaling** | FastAPI WebSockets | Unified codebase, no additional server |
| **SFU / Media Server** | Mediasoup (Node.js) | Industry-standard, server-side recording support |
| **Recording Pipeline** | FFmpeg | Battle-tested, watermark support, wide codec support |
| **Frontend** | React 18 + TailwindCSS | Component reuse, fast development, responsive |
| **WebRTC** | Browser native + adapter.js | No plugin dependency |
| **TURN Server** | Coturn (self-hosted) | NAT traversal; no third-party dependency |
| **Database** | PostgreSQL 16 | ACID compliance, JSONB for config, row-level security |
| **Cache / State** | Redis 7 | OTP TTL, JWT jti store, session state, rate limiting |
| **Object Storage** | MinIO | S3-compatible, WORM/object lock support, self-hosted |
| **PDF Generation** | WeasyPrint (Python) | HTML/CSS → PDF, no headless browser required |
| **SMS (Nepal)** | Sparrow SMS | Nepal-local, NTC/Ncell coverage |
| **Email** | SMTP / SendGrid | Configurable provider |
| **Reverse Proxy** | Nginx | TLS termination, rate limiting, static serving |
| **Containerization** | Docker + Docker Compose | Reproducible environments |
| **Orchestration (v2)** | Kubernetes (K8s) | Production scaling |
| **Secrets Management** | HashiCorp Vault or env-based | No secrets in code |
| **Monitoring** | Prometheus + Grafana | Metrics and alerting |
| **Logging** | Loki + Grafana or ELK | Centralized log aggregation |
| **CI/CD** | GitHub Actions | Automated test and deploy pipeline |

---

## 19. Deployment Architecture

### 19.1 Docker Compose (Development / Single-Server Production)

```yaml
services:
  nginx:           # Reverse proxy + TLS
  fastapi-app:     # Main API (3 replicas)
  mediasoup:       # SFU / Recording
  recording-worker: # FFmpeg pipeline + upload
  postgres:        # Primary database
  redis:           # Cache + state
  minio:           # Object storage
  coturn:          # TURN server
  prometheus:      # Metrics
  grafana:         # Dashboards
```

### 19.2 Production Network Topology

```
Internet
    │
    ▼
[WAF / DDoS Protection]
    │
    ▼
[Load Balancer — HTTPS:443, WSS:443, RTP:10000-59999/UDP]
    │
    ├── /api/*      → FastAPI (2+ instances)
    ├── /ws/*       → Signaling WebSocket
    ├── /media/*    → Nginx static (frontend)
    └── :3478/UDP   → Coturn TURN
    
[Private Network]
    ├── PostgreSQL (primary + replica)
    ├── Redis (primary + sentinel)
    ├── MinIO (clustered, 4+ nodes for production)
    └── Mediasoup (1 per recording session)
```

### 19.3 Environment Configuration

```bash
# .env — all secrets via environment only
DATABASE_URL=postgresql+asyncpg://user:pass@postgres:5432/scrp
REDIS_URL=redis://:pass@redis:6379/0
MINIO_ENDPOINT=minio:9000
MINIO_ACCESS_KEY=...
MINIO_SECRET_KEY=...
JWT_PRIVATE_KEY_PATH=/run/secrets/jwt_private.pem
JWT_PUBLIC_KEY_PATH=/run/secrets/jwt_public.pem
SPARROW_SMS_TOKEN=...
SMTP_HOST=...
FFMPEG_PATH=/usr/bin/ffmpeg
COTURN_SECRET=...
STORAGE_BACKEND=minio   # minio | local
GEO_FLAG_COUNTRY=NP
```

---

## 20. Release Roadmap

### Phase 1 — Foundation (Weeks 1–4)
- [ ] Project scaffold: FastAPI + PostgreSQL + Redis
- [ ] Authentication: staff JWT login, role-based middleware
- [ ] Session CRUD API
- [ ] Invite token generation (JWT RS256, single-use)
- [ ] OTP generation and verification
- [ ] Database migrations (Alembic)
- [ ] Unit tests for auth and session logic

### Phase 2 — Media Layer (Weeks 5–8)
- [ ] Mediasoup SFU integration
- [ ] WebRTC signaling via WebSocket
- [ ] Coturn TURN server setup
- [ ] FFmpeg recording pipeline with watermark
- [ ] MinIO integration with WORM bucket policy
- [ ] SHA-256 hash computation and storage
- [ ] Snapshot upload and storage API

### Phase 3 — Frontend (Weeks 7–10, parallel)
- [ ] Staff dashboard: session list, create, status
- [ ] Active call UI: side-by-side layout, timer, controls
- [ ] Snapshot buttons (staff only), private notes panel
- [ ] Consent marker button
- [ ] Guarantor portal: OTP screen, call UI, consent banner
- [ ] Language toggle (EN/NP)
- [ ] Responsive design (tablet + desktop)

### Phase 4 — Certificate & Notifications (Weeks 9–11)
- [ ] PDF certificate generation (WeasyPrint)
- [ ] Certificate storage and hash
- [ ] Email delivery (staff + guarantor)
- [ ] SMS notifications (Sparrow SMS integration)
- [ ] In-app notifications via WebSocket

### Phase 5 — Hardening & Compliance (Weeks 12–14)
- [ ] Full audit log implementation and query API
- [ ] Compliance export (CSV/PDF)
- [ ] Geolocation capture and flagging
- [ ] Device fingerprinting
- [ ] Connection quality monitoring
- [ ] Presigned URL access control
- [ ] Rate limiting and DDoS hardening
- [ ] Penetration testing
- [ ] Load testing

### Phase 6 — v1.0 Release (Week 15)
- [ ] Staging environment validation
- [ ] Staff training documentation
- [ ] Production deployment
- [ ] Monitoring dashboards live
- [ ] Runbook documentation

### Phase 7 — v2.0 Planning
- Face match + liveness check
- QR verification portal
- Multi-tenancy
- NRB regulatory export module
- Mobile app (React Native)

---

## 21. Risk & Mitigation

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| Recording upload failure | Medium | High | Retry queue + admin alert + local buffer fallback |
| TURN server failure | Low | High | Redundant TURN endpoints; fallback relay |
| OTP delivery failure (SMS) | Medium | Medium | Email fallback; staff can manually re-initiate |
| Guarantor claims non-participation | Low | High | OTP proof + geolocation + snapshot + audit trail |
| Storage breach | Low | Critical | Encryption at rest + WORM + no public access + audit on every access |
| Regulatory non-compliance | Low | High | Retention policy config + audit export + NRB alignment built-in |
| Network degradation during call | Medium | Medium | Quality monitor + warning + session pause/resume |
| JWT token interception | Very Low | High | TLS 1.3 + short-TTL tokens + single-use JTI |

---

## 22. Glossary

| Term | Definition |
|------|-----------|
| **SCRP** | Secure Consent Recording Platform — this system |
| **SFU** | Selective Forwarding Unit — a media server that routes streams without decoding |
| **WORM** | Write Once Read Many — storage policy that prevents modification after write |
| **JTI** | JWT ID — unique identifier embedded in a JWT to enable single-use enforcement |
| **OTP** | One-Time Password — time-limited numeric code for identity verification |
| **WebRTC** | Web Real-Time Communication — browser-native protocol for P2P audio/video |
| **TURN** | Traversal Using Relays around NAT — relay server for WebRTC when P2P fails |
| **STUN** | Session Traversal Utilities for NAT — server that helps peers discover public IPs |
| **RS256** | RSA Signature with SHA-256 — asymmetric JWT signing algorithm |
| **NRB** | Nepal Rastra Bank — Nepal's central banking regulator |
| **NID** | National Identity Document — Nepal national ID card |
| **Presigned URL** | A time-limited, pre-authorized URL for accessing private object storage |
| **Guarantor** | A person who agrees to be legally responsible if a borrower defaults |
| **Consent Marker** | A timestamp event logged when staff confirms verbal consent was given |
| **RBAC** | Role-Based Access Control — permissions tied to user roles |
| **PII** | Personally Identifiable Information — data that can identify an individual |
| **HSTS** | HTTP Strict Transport Security — forces HTTPS for all connections |
| **TDE** | Transparent Data Encryption — database-level encryption at rest |

---

*Document prepared for product design review and engineering planning.*  
*This is a living document — version-controlled and to be updated with each planning milestone.*  
*All architecture decisions are subject to review and approval before implementation begins.*

---

**SCRP v1.0 Master Blueprint — End of Document**
