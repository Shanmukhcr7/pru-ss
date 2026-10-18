# ParentVision — iOS Parental Control & Live Screen Sharing Platform

![ParentVision Banner](https://img.shields.io/badge/Platform-iOS%2016%2B%20%7C%20Web%20%7C%20Node.js-indigo)
![WebRTC](https://img.shields.io/badge/Media-WebRTC%20DTLS--SRTP-emerald)
![Apple APIs](https://img.shields.io/badge/Apple-ReplayKit%20%7C%20ScreenTime-blue)
![Tests](https://img.shields.io/badge/Automated%20Tests-25%20Passing-brightgreen)

ParentVision is a production-oriented parental-control and live screen supervision platform for iOS devices. It combines a native Swift/SwiftUI iPhone app utilizing Apple's official **ReplayKit** and **Screen Time** APIs, a high-throughput **Node.js/TypeScript** backend with WebSocket WebRTC signaling, and a responsive **Next.js** parent dashboard.

---

## 1. System Architecture

```mermaid
flowchart TD
    subgraph ChildDevice ["Child's iPhone (iOS 16+)"]
        App["ParentVision App (SwiftUI)"]
        Keychain[("Keychain (Device Token)")]
        AppGroup["AppGroup Shared Container"]
        Ext["Broadcast Upload Extension (ReplayKit)"]
        ScreenTime["Apple Screen Time (FamilyControls / ManagedSettings)"]
        
        App -->|Store Auth & Session Info| AppGroup
        App -->|Secure Credentials| Keychain
        AppGroup -->|Read Auth| Ext
    end

    subgraph Infrastructure ["Hostinger KVM VPS (Docker Compose)"]
        Caddy["Caddy Reverse Proxy (Auto TLS)"]
        API["Node.js + TypeScript API (Port 4000)"]
        Signaling["WebRTC WebSocket Signaling (/ws/signaling)"]
        DB[("PostgreSQL 16")]
        Coturn["Coturn STUN/TURN Media Relay (Port 3478/5349)"]
        Audit[("Audit Logs & Summaries")]
        
        Caddy -->|Proxy HTTP & WS| API
        API --> Signaling
        API --> DB
        API --> Audit
    end

    subgraph ParentBrowser ["Parent Dashboard (Web)"]
        Web["Next.js 14 Dashboard"]
        Player["Live WebRTC Screen Viewer (HTML5 Video)"]
        Controls["Stop Stream & Revoke Controls"]
    end

    %% Signaling & Media Flow
    App -->|Enroll & Heartbeat (HTTPS)| Caddy
    Ext -->|Signaling WebSocket (WSS)| Signaling
    Web -->|Signaling WebSocket (WSS)| Signaling
    
    Ext -.->|P2P DTLS-SRTP Media (Direct)| Player
    Ext ==>|TURN Relay Media (Fallback)| Coturn
    Coturn ==>|Relay Media| Player
```

---

## 2. Key Components & Technologies

### A. Native iOS Application (`apps/ios`)
- **Swift & SwiftUI**: Clean, modern interface supporting iOS 16.0+.
- **Apple ReplayKit**: Uses `RPSystemBroadcastPickerView` and a Broadcast Upload Extension (`RPBroadcastSampleHandler`) for system-level screen capture across all apps.
- **Apple Screen Time**: Integrates `FamilyControls`, `ManagedSettings`, and `DeviceActivity` for shields, downtime, and web filtering.
- **App Groups & Keychain**: `group.com.parentvision.app` container communicates credentials between the main app and extension; sensitive tokens persist in iOS Keychain (`kSecClassGenericPassword`).
- **50MB RAM Guard**: Frame downsampling and strict memory management to avoid iOS extension watchdog termination.

### B. Backend API & WebRTC Signaling (`services/api`)
- **Node.js, Express & TypeScript**: High performance, strictly typed service.
- **WebSocket WebRTC Signaling**: Room-isolated 1:1 signaling server matching broadcaster with authorized viewer.
- **Ephemeral TURN Credentials**: Implements RFC 5766 REST API HMAC-SHA1 dynamic credentials for Coturn with 15-minute expiration.
- **Security & Multi-Tenancy**: Strong Bcrypt hashing, short-lived JWT access tokens, refresh token rotation, strict tenant isolation, and audit logging.
- **PostgreSQL 16**: Schema migrations and queries with zero-config test fallback.

### C. Parent Website Dashboard (`apps/web`)
- **Next.js 14, React & Tailwind CSS**: Modern dark-themed dashboard.
- **Live WebRTC Viewer**: Ultra-low-latency screen rendering with real-time telemetry (FPS, RTT latency, resolution, bitrate).
- **Session Controls**: Instant "Stop Live Broadcast" and "Revoke Access" triggers.
- **Device Management**: 6-digit pairing code generation and device renaming.
- **Usage Reports**: Screen Time category breakdowns and daily totals.

### D. Deployment Infrastructure (`infrastructure/`)
- **Docker Compose**: Orchestrates PostgreSQL, API, Next.js Web, Coturn, and Caddy.
- **Caddy**: Automatic Let's Encrypt TLS reverse proxy with WebSockets forwarding.
- **Coturn**: STUN and TURN relay service for NAT traversal across cellular networks.

---

## 3. Repository Structure

```
parentvision/
├── apps/
│   ├── ios/
│   │   ├── ParentVision/                  # Main SwiftUI application
│   │   │   ├── App/                       # App lifecycle & AppState
│   │   │   ├── Services/                  # Keychain, AppGroup, APIClient, ScreenTime
│   │   │   ├── Views/                     # Onboarding, Enrollment, Dashboard, Controls
│   │   │   └── Resources/                 # Info.plist & Entitlements
│   │   ├── ParentVisionBroadcastUpload/   # ReplayKit Broadcast Extension
│   │   │   ├── SampleHandler.swift        # Sample buffer pipeline
│   │   │   └── WebRTCBroadcaster.swift    # Extension WebRTC publisher
│   │   └── project.yml                    # XcodeGen project specification
│   └── web/                               # Next.js 14 Parent Dashboard
│       └── src/app/                       # Auth, Dashboard, Live, Reports, Settings
├── services/
│   └── api/                               # Node.js + TypeScript Backend & Signaling
│       ├── src/controllers/               # Auth, Devices, Sessions, ScreenTime, Audit
│       ├── src/db/                        # PostgreSQL schema & database abstraction
│       ├── src/signaling/                 # WebRTC WebSocket signaling server
│       └── src/test/                      # Automated security & API test suite
├── infrastructure/
│   ├── docker/                            # Dockerfile.api, Dockerfile.web, docker-compose.yml
│   ├── coturn/                            # turnserver.conf
│   └── caddy/                             # Caddyfile reverse proxy
├── docs/
│   ├── DEPLOYMENT_HOSTINGER.md            # Complete VPS deployment instructions
│   ├── IOS_SETUP_AND_ENTITLEMENTS.md      # Physical iPhone, Xcode & signing guide
│   ├── FEATURE_MATRIX.md                  # Comprehensive capability matrix
│   └── openapi.yaml                       # OpenAPI 3.0 specification
└── .env.example                           # Configuration environment template
```

---

## 4. Quickstart: Local Development

### 1. Run Backend API
```bash
cd services/api
npm install
npm test          # Runs the 25 automated tests
npm run dev       # Starts API at http://localhost:4000
```

### 2. Run Parent Dashboard
```bash
cd apps/web
npm install
npm run dev       # Starts Dashboard at http://localhost:3000
```

### 3. Generate iOS Project
```bash
cd apps/ios
brew install xcodegen
xcodegen generate # Generates ParentVision.xcodeproj
open ParentVision.xcodeproj
```

---

## 5. Automated Test Suite

ParentVision includes 25 automated test cases testing core security, pairing, and WebRTC signaling:

```bash
cd services/api
npm test
```

Test coverage includes:
- Parent registration, duplicate prevention, and login validation.
- Refresh token rotation and replay prevention.
- 6-digit device pairing protocol and single-use code enforcement.
- Strict cross-tenant account isolation (Parent B cannot see or control Parent A devices).
- Ephemeral RFC 5766 Coturn TURN credential generation.
- WebRTC WebSocket signaling handshake, token authentication, and SDP offer/answer relay.
- Device revocation and immediate token revocation.
- Screen Time summary ingestion and retrieval.
- Tamper-evident administrative audit logging.

---

## 6. Apple Platform Transparency & Privacy Guarantees

In strict accordance with Apple's developer guidelines:
1. **Explicit Consent**: Broadcasting must be manually initiated by the user via `RPSystemBroadcastPickerView`.
2. **System Recording Indicator**: The system status bar and Dynamic Island display an unmistakable red recording indicator while active.
3. **DRM Protection**: FairPlay video, Apple TV, banking apps, and password inputs are automatically censored by the iOS compositor.
4. **Data Minimization**: Apple Screen Time APIs deliberately hide raw URLs and keystrokes from third-party code.
5. **No Covert Surveillance**: The app contains zero private APIs, background recording daemons, or exploit persistence mechanisms.

---

## 7. Documentation Links

- [Hostinger KVM VPS Production Deployment Guide](docs/DEPLOYMENT_HOSTINGER.md)
- [iOS Setup, Entitlements & Physical Testing Guide](docs/IOS_SETUP_AND_ENTITLEMENTS.md)
- [Platform Feature Matrix](docs/FEATURE_MATRIX.md)
- [OpenAPI 3.0 Specification](docs/openapi.yaml)
