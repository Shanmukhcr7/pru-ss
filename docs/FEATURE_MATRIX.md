# ParentVision Platform Feature Matrix

This matrix categorizes each feature across the four production readiness states:
1. **Automated-Tested**: Verified via automated unit/integration test suites.
2. **Locally Verified**: Built and verified in the monorepo codebase.
3. **Entitlement-Dependent**: Implemented in code, but requires Apple Developer Program approval and physical hardware.
4. **Unsupported / Restricted**: Excluded due to hard iOS sandboxing and Apple privacy constraints.

---

## 1. Feature Classification Table

| Feature | Category | Status | Notes / Limitations |
| :--- | :--- | :--- | :--- |
| **Parent Registration & Login** | Backend & Web | ✅ **Automated-Tested** | Bcrypt password hashing, JWT access & refresh tokens with replay protection. |
| **Cross-Tenant Tenant Isolation** | Backend Security | ✅ **Automated-Tested** | Parent accounts strictly isolated; zero cross-account device access or stream snooping. |
| **6-Digit Device Pairing Protocol** | Backend & iOS | ✅ **Automated-Tested** | 15-minute TTL, single-use codes, secure device enrollment. |
| **Device Heartbeat & Battery Status** | Backend & iOS | ✅ **Automated-Tested** | Reports battery percentage, charging state, online/offline status. |
| **Device Revocation** | Backend & Web | ✅ **Automated-Tested** | Immediate token invalidation, socket termination, and session teardown. |
| **Ephemeral Coturn TURN Credentials** | WebRTC Infrastructure | ✅ **Automated-Tested** | RFC 5766 REST API HMAC-SHA1 time-limited credentials. |
| **Signaling Server Room Isolation** | WebRTC Infrastructure | ✅ **Automated-Tested** | 1:1 supervision topology with token handshake and peer negotiation. |
| **Screen Time Ingestion & Reporting** | Backend & Web | ✅ **Automated-Tested** | Permitted category totals, 7-day aggregation, and daily stats. |
| **Parent Web Dashboard UI** | Web Dashboard | ✅ **Locally Verified** | Next.js 14, Tailwind CSS, Lucide icons, responsive layout. |
| **Live WebRTC Video Player** | Web Dashboard | ✅ **Locally Verified** | Renders live screen, telemetry metrics (FPS, RTT, bitrate, resolution). |
| **ReplayKit Broadcast Extension** | Native iOS | ✅ **Locally Verified** | `RPBroadcastSampleHandler`, frame throttling to respect 50MB RAM ceiling. |
| **AppGroup IPC Bridge** | Native iOS | ✅ **Locally Verified** | Shares credentials between main app and extension via shared container. |
| **Keychain Token Persistence** | Native iOS | ✅ **Locally Verified** | Secure hardware-backed storage for device token and secrets. |
| **Apple FamilyControls Authorization** | Native iOS | ⚠️ **Entitlement-Dependent** | Requires `com.apple.developer.family-controls` entitlement granted by Apple. |
| **ManagedSettings App/Web Shields** | Native iOS | ⚠️ **Entitlement-Dependent** | Enforces adult web filters and category blocks out-of-process. |
| **Physical ReplayKit Streaming** | Native iOS | ⚠️ **Hardware-Dependent** | Requires physical iPhone (iOS Simulator does not support ReplayKit broadcast). |
| **Silent Background Screen Capture** | Native iOS | 🚫 **Unsupported by Apple** | Strictly forbidden by iOS sandboxing. Broadcasting requires explicit user tap. |
| **Hiding Status Bar Recording Indicator** | Native iOS | 🚫 **Unsupported by Apple** | System red pill / Dynamic Island indicator is rendered out-of-process by iOS. |
| **Capturing Protected DRM Media** | Native iOS | 🚫 **Unsupported by Apple** | FairPlay, Netflix, Apple TV, banking apps, and password fields are masked by iOS compositor. |
| **Silent Keystroke / URL Exfiltration** | Native iOS | 🚫 **Unsupported by Apple** | Apple Screen Time purposefully hides granular keystrokes/URLs for child privacy. |

---

## 2. Technical Safeguards & Privacy Declarations

### A. ReplayKit Memory Ceilings
Broadcast Upload Extensions run in an isolated process with a strict memory limit of **50 MB RAM**. Exceeding this limit causes immediate termination by the OS kernel (`EXC_RESOURCE RESOURCE_TYPE_MEMORY`). ParentVision addresses this via:
- Strict autorelease pools around sample buffer processing.
- Dynamic frame throttling (24 FPS max).
- Zero frame queue accumulation.

### B. Anti-Surveillance by Design
ParentVision is engineered strictly for **parental consent and child safety**, adhering 100% to Apple's App Store Review Guidelines:
- No hidden background daemons.
- No jailbreak or private framework dependencies.
- No covert spyware hooks.
