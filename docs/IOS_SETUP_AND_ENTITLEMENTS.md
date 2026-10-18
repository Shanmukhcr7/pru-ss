# iOS Setup, Entitlements & Physical Device Testing Guide

This guide explains how to configure, sign, build, and test the **ParentVision** native iOS application and ReplayKit Broadcast Upload Extension on a physical iPhone.

---

## 1. Prerequisites

| Requirement | Specification | Notes |
| :--- | :--- | :--- |
| **Workstation** | Mac running macOS 14 (Sonoma) or 15 (Sequoia) | Required for Xcode compilation |
| **IDE** | Xcode 15.0 or Xcode 16+ | Available via Mac App Store |
| **Tool** | `xcodegen` (`brew install xcodegen`) | Generates `.xcodeproj` from `project.yml` |
| **Device** | Physical iPhone with iOS 16.0 or later | **Simulator does not support ReplayKit broadcast extensions or FamilyControls** |
| **Apple Developer Account** | Paid Apple Developer Program ($99/yr) | Required for FamilyControls entitlement & App Groups |

---

## 2. Apple Developer Portal Configuration

### A. App Identifiers
In the [Apple Developer Portal](https://developer.apple.com/account/resources/identifiers/list), register two App IDs:

1. **Main Application**:
   - Description: `ParentVision App`
   - Bundle Identifier: `Explicit` &rarr; `com.parentvision.app`
   - Capabilities:
     - [x] **App Groups**
     - [x] **Family Controls** (Requires Apple entitlement request approval)

2. **Broadcast Upload Extension**:
   - Description: `ParentVision Broadcast Extension`
   - Bundle Identifier: `Explicit` &rarr; `com.parentvision.app.broadcast`
   - Capabilities:
     - [x] **App Groups**

### B. App Group Setup
1. Navigate to **Identifiers** &rarr; select **App Groups** from the dropdown.
2. Create group: `group.com.parentvision.app`.
3. In both App IDs above, configure the **App Groups** capability and check `group.com.parentvision.app`.

### C. Requesting Family Controls Entitlement
1. Submit an entitlement request form via Apple Developer Support:
   - Entitlement: `com.apple.developer.family-controls`
   - Purpose: Parental control application for child device supervision and screen time management.
   - Note: For development/testing without the entitlement, the live screen broadcasting feature functions independently through ReplayKit, while FamilyControls shields can be tested in Sandbox mode.

---

## 3. Project Generation with XcodeGen

On your Mac, clone the repository and run:

```bash
cd apps/ios

# Install xcodegen if not already installed
brew install xcodegen

# Generate ParentVision.xcodeproj
xcodegen generate
```

This generates `ParentVision.xcodeproj` configured with:
- Target 1: `ParentVision` (Main App)
- Target 2: `ParentVisionBroadcastUpload` (Extension embedded in `ParentVision.app/PlugIns`)
- Linked frameworks: `ReplayKit`, `FamilyControls`, `ManagedSettings`, `DeviceActivity`, `VideoToolbox`.

---

## 4. Signing & Provisioning in Xcode

1. Open `ParentVision.xcodeproj` in Xcode.
2. Select the top-level **ParentVision** project in the navigator.
3. Under **Signing & Capabilities**:
   - For **ParentVision** target:
     - Select your Apple Developer Team.
     - Verify Bundle Identifier: `com.parentvision.app`.
     - Verify App Groups includes `group.com.parentvision.app`.
   - For **ParentVisionBroadcastUpload** target:
     - Select the same Apple Developer Team.
     - Verify Bundle Identifier: `com.parentvision.app.broadcast`.
     - Verify App Groups includes `group.com.parentvision.app`.

---

## 5. Physical iPhone Installation

1. Connect your physical iPhone to your Mac via USB-C or Lightning cable.
2. On the iPhone:
   - Enable Developer Mode: **Settings** &rarr; **Privacy & Security** &rarr; **Developer Mode** &rarr; toggle **ON** and reboot the device.
3. In Xcode:
   - Select your physical iPhone as the active run destination.
   - Press **Cmd + R** (Build & Run).
4. When prompted on the iPhone, trust your Developer Certificate under **Settings** &rarr; **General** &rarr; **VPN & Device Management**.

---

## 6. End-to-End Verification Procedure

### Step 1: Parent Dashboard Setup
1. Open your deployed ParentVision website (e.g. `https://parentvision.yourdomain.com` or local dev `http://localhost:3000`).
2. Log in or create a parent account.
3. Navigate to **Devices** &rarr; click **Pair New iPhone**.
4. Enter device name (e.g. `Leo's iPhone`) and note the 6-digit code (e.g. `849201`).

### Step 2: Child iPhone Pairing
1. Open the **ParentVision** app on the iPhone.
2. Enter the server URL (e.g. `https://parentvision.yourdomain.com`).
3. Enter the 6-digit pairing code.
4. Tap **Pair & Authorize Device**.
5. Verify the device transitions to the supervised dashboard showing battery level and "Online & Connected".

### Step 3: Screen Time Authorization (Optional/If Entitled)
1. Tap **Screen Time Safeguards**.
2. Tap **Request Screen Time Permission**.
3. Authenticate with the parent Apple ID to grant `FamilyControls` access.

### Step 4: Live Screen Broadcasting
1. On the parent website dashboard, click **Request Live Screen** next to the enrolled iPhone.
2. On the child's iPhone, tap the **Broadcast Button** on the dashboard.
3. In the system sheet that appears:
   - Confirm **ParentVision Live Broadcaster** is selected.
   - Tap **Start Broadcast**.
4. Observe the 3-second system countdown.
5. Notice the **system-level red recording indicator** in the iPhone status bar / Dynamic Island.
6. Check the parent website: the live WebRTC stream will connect within 1–2 seconds, rendering the child's screen with real-time FPS and round-trip latency.

### Step 5: Termination & Revocation Verification
- On the website dashboard, click **Stop Broadcast**.
  - Verify the WebRTC connection tears down and the broadcast extension terminates gracefully.
- Click **Revoke Access** on the parent dashboard.
  - Verify the device token is invalidated and subsequent heartbeat/broadcast attempts return HTTP 403 Forbidden.
