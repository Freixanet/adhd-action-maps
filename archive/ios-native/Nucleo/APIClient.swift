import Foundation

struct TransformRequest: Encodable {
    let text: String?
    let type: String
    let fileData: String?
    let mimeType: String?
    let preferredModel: String?
}

actor APIClient {
    func transform(_ request: TransformRequest, accessToken: String?) async throws -> Data {
        var urlRequest = URLRequest(url: AppConfiguration.apiBaseURL.appending(path: "/api/transform"))
        urlRequest.httpMethod = "POST"
        urlRequest.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if let accessToken { urlRequest.setValue("Bearer \(accessToken)", forHTTPHeaderField: "Authorization") }
        urlRequest.httpBody = try JSONEncoder().encode(request)
        let (data, response) = try await URLSession.shared.data(for: urlRequest)
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
            throw URLError(.badServerResponse)
        }
        return data
    }
}
