import Foundation

struct CloudSyncService {
    private let supabaseURL: URL
    private let supabaseAnonKey: String

    init?() {
        let key = AppConfiguration.supabaseAnonKey
        guard !key.isEmpty else { return nil }
        supabaseURL = AppConfiguration.supabaseURL
        supabaseAnonKey = key
    }

    func migrateLocalMaps(_ maps: [ActionMap], accessToken: String) async throws {
        guard !maps.isEmpty else { return }
        try await upsertMaps(maps, accessToken: accessToken)
    }

    func pullMaps(accessToken: String) async throws -> [ActionMap] {
        var request = URLRequest(
            url: supabaseURL
                .appending(path: "rest/v1/maps")
                .appending(queryItems: [
                    URLQueryItem(name: "select", value: "id,title,category,pinned_at,source_type,session,created_at,updated_at"),
                    URLQueryItem(name: "order", value: "updated_at.desc"),
                ])
        )
        request.httpMethod = "GET"
        applyHeaders(&request, accessToken: accessToken)

        let (data, response) = try await URLSession.shared.data(for: request)
        try validate(response)
        let rows = try JSONDecoder().decode([CloudMapRow].self, from: data)
        return try rows.map { try $0.toActionMap() }
    }

    func pushMap(_ map: ActionMap, accessToken: String) async throws {
        try await upsertMaps([map], accessToken: accessToken)
    }

    static func merge(local: [ActionMap], remote: [ActionMap]) -> [ActionMap] {
        var merged: [String: ActionMap] = [:]
        for map in local + remote {
            if let existing = merged[map.id], existing.updatedAt >= map.updatedAt { continue }
            merged[map.id] = map
        }
        return merged.values.sorted { $0.updatedAt > $1.updatedAt }.prefix(30).map { $0 }
    }

    private func upsertMaps(_ maps: [ActionMap], accessToken: String) async throws {
        let payload = try maps.map { try $0.cloudPayload() }
        var request = URLRequest(url: supabaseURL.appending(path: "rest/v1/maps"))
        request.httpMethod = "POST"
        request.setValue("resolution=merge-duplicates", forHTTPHeaderField: "Prefer")
        applyHeaders(&request, accessToken: accessToken)
        request.httpBody = try JSONSerialization.data(withJSONObject: payload)

        let (_, response) = try await URLSession.shared.data(for: request)
        try validate(response)
    }

    private func applyHeaders(_ request: inout URLRequest, accessToken: String) {
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue(supabaseAnonKey, forHTTPHeaderField: "apikey")
        request.setValue("Bearer \(accessToken)", forHTTPHeaderField: "Authorization")
    }

    private func validate(_ response: URLResponse) throws {
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
            throw URLError(.badServerResponse)
        }
    }
}

private struct CloudMapRow: Decodable {
    let id: String
    let title: String
    let category: String?
    let pinned_at: String?
    let source_type: String
    let session: CloudSessionRow
    let created_at: String
    let updated_at: String

    func toActionMap() throws -> ActionMap {
        let document = try JSONSerialization.data(withJSONObject: session.data.value)
        return ActionMap(
            id: id,
            title: title,
            category: category,
            pinnedAt: pinned_at.flatMap { ISO8601DateFormatter().date(from: $0) },
            sourceType: source_type,
            document: document,
            currentStep: session.currentStep,
            isComplete: session.isComplete,
            viewAll: session.viewAll,
            createdAt: try parseDate(created_at),
            updatedAt: try parseDate(updated_at)
        )
    }

    private func parseDate(_ value: String) throws -> Date {
        if let date = ISO8601DateFormatter().date(from: value) { return date }
        throw URLError(.cannotDecodeContentData)
    }
}

private struct CloudSessionRow: Decodable {
    let data: AnyDecodable
    let currentStep: Int
    let isComplete: Bool
    let viewAll: Bool
}

private struct AnyDecodable: Decodable {
    let value: Any

    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if container.decodeNil() {
            value = NSNull()
        } else if let bool = try? container.decode(Bool.self) {
            value = bool
        } else if let int = try? container.decode(Int.self) {
            value = int
        } else if let double = try? container.decode(Double.self) {
            value = double
        } else if let string = try? container.decode(String.self) {
            value = string
        } else if let array = try? container.decode([AnyDecodable].self) {
            value = array.map(\.value)
        } else if let object = try? container.decode([String: AnyDecodable].self) {
            value = object.mapValues(\.value)
        } else {
            throw DecodingError.dataCorruptedError(in: container, debugDescription: "Unsupported JSON value")
        }
    }
}

private extension ActionMap {
    func cloudPayload() throws -> [String: Any] {
        let dataObject = try JSONSerialization.jsonObject(with: document)
        return [
            "id": id,
            "title": title,
            "category": category as Any,
            "pinned_at": pinnedAt.map { ISO8601DateFormatter().string(from: $0) } as Any,
            "source_type": sourceType,
            "session": [
                "data": dataObject,
                "currentStep": currentStep,
                "isComplete": isComplete,
                "viewAll": viewAll,
            ],
            "created_at": ISO8601DateFormatter().string(from: createdAt),
            "updated_at": ISO8601DateFormatter().string(from: updatedAt),
        ]
    }
}
