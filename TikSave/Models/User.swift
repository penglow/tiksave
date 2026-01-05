import Foundation

// MARK: - User Model
struct User: Identifiable, Codable {
    let id: String
    var email: String?
    var displayName: String?
    var avatarURL: String?
    var createdAt: Date
    var settings: UserSettings
    
    struct UserSettings: Codable {
        var enableVideoUpload: Bool
        var autoFileHighConfidence: Bool
        var notificationsEnabled: Bool
        var confidenceThreshold: Double
        var defaultInboxRetention: Int // days
        var theme: AppTheme
        
        init() {
            enableVideoUpload = true
            autoFileHighConfidence = true
            notificationsEnabled = true
            confidenceThreshold = 0.85
            defaultInboxRetention = 30
            theme = .system
        }
    }
    
    enum AppTheme: String, Codable, CaseIterable {
        case light
        case dark
        case system
        
        var displayName: String {
            switch self {
            case .light: return "Light"
            case .dark: return "Dark"
            case .system: return "System"
            }
        }
    }
}

// MARK: - Auth Response
struct AuthResponse: Codable {
    let user: User
    let accessToken: String
    let refreshToken: String
    let expiresAt: Date
}

// MARK: - Auth State
enum AuthState: Equatable {
    case unknown
    case authenticated(User)
    case unauthenticated
    
    var isAuthenticated: Bool {
        if case .authenticated = self {
            return true
        }
        return false
    }
    
    var user: User? {
        if case .authenticated(let user) = self {
            return user
        }
        return nil
    }
}

