import Foundation
import UIKit

public enum APIError: LocalizedError {
    case invalidURL
    case serverError(String)
    case unauthorized
    case decodingError
    case networkError(Error)

    public var errorDescription: String? {
        switch self {
        case .invalidURL: return "Invalid server URL"
        case .serverError(let msg): return msg
        case .unauthorized: return "Device enrollment is invalid or revoked"
        case .decodingError: return "Failed to process server response"
        case .networkError(let err): return err.localizedDescription
        }
    }
}

public struct DeviceEnrollResponse: Codable {
    public struct DeviceData: Codable {
        public let id: String
        public let name: String
        public let model: String
        public let osVersion: String
    }
    public let device: DeviceData
    public let deviceToken: String
}

public struct ActiveSessionResponse: Codable {
    public struct SessionData: Codable {
        public let id: String
        public let status: String
    }
    public struct IceServersData: Codable {
        public let urls: [String]
        public let username: String
        public let credential: String
    }
    public let session: SessionData?
    public let iceServers: IceServersData?
}

public final class APIClient {
    public static let shared = APIClient()
    private let session = URLSession.shared

    private init() {}

    private var baseURL: String {
        return AppGroupBridge.shared.backendUrl
    }

    // MARK: - Enroll Device
    public func enrollDevice(pairingCode: String, deviceName: String) async throws -> DeviceEnrollResponse {
        guard let url = URL(string: "\(baseURL)/api/devices/enroll") else {
            throw APIError.invalidURL
        }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        let body: [String: Any] = [
            "code": pairingCode,
            "name": deviceName,
            "model": UIDevice.current.model,
            "osVersion": "iOS \(UIDevice.current.systemVersion)"
        ]

        request.httpBody = try? JSONSerialization.data(withJSONObject: body)

        let (data, response) = try await session.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.decodingError
        }

        if httpResponse.statusCode == 201 {
            let decoded = try JSONDecoder().decode(DeviceEnrollResponse.self, from: data)
            return decoded
        } else {
            let errObj = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
            let message = errObj?["error"] as? String ?? "Enrollment failed with status \(httpResponse.statusCode)"
            throw APIError.serverError(message)
        }
    }

    // MARK: - Send Heartbeat
    public func sendHeartbeat(batteryLevel: Int, isCharging: Bool, status: String = "online") async throws {
        guard let token = KeychainService.shared.loadString(key: "device_token"),
              let url = URL(string: "\(baseURL)/api/devices/heartbeat") else {
            return
        }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")

        let body: [String: Any] = [
            "batteryLevel": batteryLevel,
            "isCharging": isCharging,
            "status": status
        ]
        request.httpBody = try? JSONSerialization.data(withJSONObject: body)

        let (_, response) = try await session.data(for: request)
        if let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 403 {
            // Revoked by parent
            KeychainService.shared.clearAll()
            AppGroupBridge.shared.deviceId = nil
            AppGroupBridge.shared.deviceToken = nil
            throw APIError.unauthorized
        }
    }

    // MARK: - Poll / Check Active Session
    public func fetchActiveSession(deviceId: String) async throws -> ActiveSessionResponse {
        guard let url = URL(string: "\(baseURL)/api/sessions/active/\(deviceId)"),
              let token = KeychainService.shared.loadString(key: "device_token") else {
            throw APIError.invalidURL
        }

        var request = URLRequest(url: url)
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")

        let (data, response) = try await session.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode == 200 else {
            throw APIError.decodingError
        }

        return try JSONDecoder().decode(ActiveSessionResponse.self, from: data)
    }

    // MARK: - Upload Screen Time Summary
    public func uploadScreenTimeSummary(date: String, totalMinutes: Int, categories: [String: Int]) async throws {
        guard let token = KeychainService.shared.loadString(key: "device_token"),
              let url = URL(string: "\(baseURL)/api/screentime/summary") else {
            return
        }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")

        let body: [String: Any] = [
            "summaryDate": date,
            "totalMinutes": totalMinutes,
            "categoryBreakdown": categories
        ]
        request.httpBody = try? JSONSerialization.data(withJSONObject: body)

        let (_, response) = try await session.data(for: request)
        if let httpResponse = response as? HTTPURLResponse, httpResponse.statusCode != 201 {
            throw APIError.serverError("Failed to upload screen time summary")
        }
    }
}
