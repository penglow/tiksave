import Foundation

enum Config {
    // MARK: - API Configuration
    static let apiBaseURL: String = {
        #if DEBUG
        return "http://localhost:3000/api"
        #else
        return "https://your-production-api.com/api"
        #endif
    }()
    
    // MARK: - App Group
    static let appGroupIdentifier = "group.com.yourcompany.tiksave"
    
    // MARK: - Keychain
    static let keychainServiceName = "com.yourcompany.tiksave"
    
    // MARK: - Feature Flags
    static let enableSemanticSearch = true
    static let enableVideoUpload = true
    static let autoFileHighConfidence = true
    
    // MARK: - Thresholds
    static let highConfidenceThreshold: Double = 0.85
    static let mediumConfidenceThreshold: Double = 0.60
    
    // MARK: - Cache
    static let thumbnailCacheSize = 100 * 1024 * 1024 // 100MB
    static let maxCachedThumbnails = 500
    
    // MARK: - Timeouts
    static let apiTimeoutSeconds: TimeInterval = 30
    static let uploadTimeoutSeconds: TimeInterval = 300
}

