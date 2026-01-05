import Foundation

// MARK: - API Error
enum APIError: LocalizedError {
    case invalidURL
    case invalidResponse
    case unauthorized
    case serverError(Int, String?)
    case networkError(Error)
    case decodingError(Error)
    case unknown
    
    var errorDescription: String? {
        switch self {
        case .invalidURL:
            return "Invalid URL"
        case .invalidResponse:
            return "Invalid response from server"
        case .unauthorized:
            return "Please sign in again"
        case .serverError(let code, let message):
            return message ?? "Server error (\(code))"
        case .networkError(let error):
            return "Network error: \(error.localizedDescription)"
        case .decodingError(let error):
            return "Data error: \(error.localizedDescription)"
        case .unknown:
            return "An unknown error occurred"
        }
    }
}

// MARK: - API Service
@MainActor
class APIService: ObservableObject {
    static let shared = APIService()
    
    private let baseURL: String
    private let session: URLSession
    private let decoder: JSONDecoder
    private let encoder: JSONEncoder
    
    @Published var isAuthenticated = false
    private var accessToken: String?
    
    private init() {
        self.baseURL = Config.apiBaseURL
        
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = Config.apiTimeoutSeconds
        self.session = URLSession(configuration: config)
        
        self.decoder = JSONDecoder()
        self.decoder.dateDecodingStrategy = .iso8601
        
        self.encoder = JSONEncoder()
        self.encoder.dateEncodingStrategy = .iso8601
        
        // Load saved token
        loadToken()
    }
    
    // MARK: - Token Management
    
    private func loadToken() {
        accessToken = KeychainHelper.load(key: "accessToken")
        isAuthenticated = accessToken != nil
    }
    
    func setToken(_ token: String) {
        accessToken = token
        KeychainHelper.save(key: "accessToken", value: token)
        isAuthenticated = true
    }
    
    func clearToken() {
        accessToken = nil
        KeychainHelper.delete(key: "accessToken")
        isAuthenticated = false
    }
    
    // MARK: - Request Helpers
    
    private func makeRequest(
        path: String,
        method: String = "GET",
        body: Data? = nil,
        queryItems: [URLQueryItem]? = nil
    ) throws -> URLRequest {
        var components = URLComponents(string: "\(baseURL)\(path)")
        components?.queryItems = queryItems
        
        guard let url = components?.url else {
            throw APIError.invalidURL
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        if let token = accessToken {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        
        request.httpBody = body
        
        return request
    }
    
    private func perform<T: Decodable>(_ request: URLRequest) async throws -> T {
        let (data, response) = try await session.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.invalidResponse
        }
        
        switch httpResponse.statusCode {
        case 200...299:
            do {
                return try decoder.decode(T.self, from: data)
            } catch {
                throw APIError.decodingError(error)
            }
        case 401:
            clearToken()
            throw APIError.unauthorized
        default:
            let message = try? decoder.decode(ErrorResponse.self, from: data).message
            throw APIError.serverError(httpResponse.statusCode, message)
        }
    }
    
    // MARK: - Auth Endpoints
    
    func signUp(email: String, password: String) async throws -> AuthResponse {
        let body = try encoder.encode(["email": email, "password": password])
        let request = try makeRequest(path: "/auth/signup", method: "POST", body: body)
        let response: AuthResponse = try await perform(request)
        setToken(response.accessToken)
        return response
    }
    
    func signIn(email: String, password: String) async throws -> AuthResponse {
        let body = try encoder.encode(["email": email, "password": password])
        let request = try makeRequest(path: "/auth/signin", method: "POST", body: body)
        let response: AuthResponse = try await perform(request)
        setToken(response.accessToken)
        return response
    }
    
    func signInWithApple(identityToken: String) async throws -> AuthResponse {
        let body = try encoder.encode(["identityToken": identityToken])
        let request = try makeRequest(path: "/auth/apple", method: "POST", body: body)
        let response: AuthResponse = try await perform(request)
        setToken(response.accessToken)
        return response
    }
    
    func signOut() {
        clearToken()
    }
    
    // MARK: - Save Items Endpoints
    
    func createSaveItem(sourceURL: String, rawSharedText: String?) async throws -> SaveItem {
        var payload: [String: String] = ["sourceURL": sourceURL]
        if let text = rawSharedText {
            payload["rawSharedText"] = text
        }
        let body = try encoder.encode(payload)
        let request = try makeRequest(path: "/items", method: "POST", body: body)
        return try await perform(request)
    }
    
    func getItems(
        status: SaveItemStatus? = nil,
        folderId: String? = nil,
        limit: Int = 50,
        offset: Int = 0
    ) async throws -> [SaveItem] {
        var queryItems: [URLQueryItem] = [
            URLQueryItem(name: "limit", value: String(limit)),
            URLQueryItem(name: "offset", value: String(offset))
        ]
        
        if let status = status {
            queryItems.append(URLQueryItem(name: "status", value: status.rawValue))
        }
        
        if let folderId = folderId {
            queryItems.append(URLQueryItem(name: "folderId", value: folderId))
        }
        
        let request = try makeRequest(path: "/items", queryItems: queryItems)
        let response: ItemsResponse = try await perform(request)
        return response.items
    }
    
    func getItem(id: String) async throws -> SaveItem {
        let request = try makeRequest(path: "/items/\(id)")
        return try await perform(request)
    }
    
    func moveItemToFolder(itemId: String, folderId: String) async throws -> SaveItem {
        let body = try encoder.encode(["folderId": folderId])
        let request = try makeRequest(path: "/items/\(itemId)/moveFolder", method: "POST", body: body)
        return try await perform(request)
    }
    
    func deleteItem(id: String) async throws {
        let request = try makeRequest(path: "/items/\(id)", method: "DELETE")
        let _: EmptyResponse = try await perform(request)
    }
    
    func getUploadURL(itemId: String) async throws -> UploadURLResponse {
        let request = try makeRequest(path: "/items/\(itemId)/uploadUrl", method: "POST")
        return try await perform(request)
    }
    
    func completeUpload(itemId: String) async throws -> SaveItem {
        let request = try makeRequest(path: "/items/\(itemId)/completeUpload", method: "POST")
        return try await perform(request)
    }
    
    // MARK: - Folders Endpoints
    
    func getFolders() async throws -> [Folder] {
        let request = try makeRequest(path: "/folders")
        let response: FoldersResponse = try await perform(request)
        return response.folders
    }
    
    func createFolder(name: String, parentId: String?, iconName: String?) async throws -> Folder {
        var payload: [String: String] = ["name": name]
        if let parentId = parentId {
            payload["parentId"] = parentId
        }
        if let iconName = iconName {
            payload["iconName"] = iconName
        }
        let body = try encoder.encode(payload)
        let request = try makeRequest(path: "/folders", method: "POST", body: body)
        return try await perform(request)
    }
    
    func updateFolder(id: String, name: String?, iconName: String?) async throws -> Folder {
        var payload: [String: String] = [:]
        if let name = name {
            payload["name"] = name
        }
        if let iconName = iconName {
            payload["iconName"] = iconName
        }
        let body = try encoder.encode(payload)
        let request = try makeRequest(path: "/folders/\(id)", method: "PATCH", body: body)
        return try await perform(request)
    }
    
    func deleteFolder(id: String) async throws {
        let request = try makeRequest(path: "/folders/\(id)", method: "DELETE")
        let _: EmptyResponse = try await perform(request)
    }
    
    // MARK: - Search Endpoint
    
    func search(query: String, semantic: Bool = true) async throws -> [SaveItem] {
        let queryItems = [
            URLQueryItem(name: "q", value: query),
            URLQueryItem(name: "semantic", value: String(semantic))
        ]
        let request = try makeRequest(path: "/search", queryItems: queryItems)
        let response: ItemsResponse = try await perform(request)
        return response.items
    }
}

// MARK: - Response Types

private struct ItemsResponse: Codable {
    let items: [SaveItem]
    let total: Int?
}

private struct FoldersResponse: Codable {
    let folders: [Folder]
}

struct UploadURLResponse: Codable {
    let uploadURL: String
    let expiresAt: Date
}

private struct ErrorResponse: Codable {
    let message: String
}

private struct EmptyResponse: Codable {}

// MARK: - Keychain Helper

enum KeychainHelper {
    static func save(key: String, value: String) {
        let data = value.data(using: .utf8)!
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: key,
            kSecAttrService as String: Config.keychainServiceName,
            kSecValueData as String: data
        ]
        
        SecItemDelete(query as CFDictionary)
        SecItemAdd(query as CFDictionary, nil)
    }
    
    static func load(key: String) -> String? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: key,
            kSecAttrService as String: Config.keychainServiceName,
            kSecReturnData as String: true
        ]
        
        var result: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &result)
        
        guard status == errSecSuccess, let data = result as? Data else {
            return nil
        }
        
        return String(data: data, encoding: .utf8)
    }
    
    static func delete(key: String) {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: key,
            kSecAttrService as String: Config.keychainServiceName
        ]
        
        SecItemDelete(query as CFDictionary)
    }
}

