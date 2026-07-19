import Foundation
import SwiftData

struct ActionMap: Codable, Identifiable, Sendable {
    var id: String
    var title: String
    var category: String?
    var pinnedAt: Date?
    var sourceType: String
    var document: Data
    var currentStep: Int
    var isComplete: Bool
    var viewAll: Bool
    var createdAt: Date
    var updatedAt: Date
}

@Model
final class CachedMap {
    @Attribute(.unique) var id: String
    var payload: Data
    var updatedAt: Date

    init(map: ActionMap) throws {
        id = map.id
        payload = try JSONEncoder().encode(map)
        updatedAt = map.updatedAt
    }

    func decode() throws -> ActionMap { try JSONDecoder().decode(ActionMap.self, from: payload) }
}
