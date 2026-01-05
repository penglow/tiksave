import Foundation

// MARK: - SaveItem Status
enum SaveItemStatus: String, Codable, CaseIterable {
    case queued = "queued"
    case uploadRequested = "upload_requested"
    case uploading = "uploading"
    case processing = "processing"
    case ready = "ready"
    case needsReview = "needs_review"
    case failed = "failed"
    
    var displayName: String {
        switch self {
        case .queued: return "Queued"
        case .uploadRequested: return "Preparing Upload"
        case .uploading: return "Uploading"
        case .processing: return "Processing"
        case .ready: return "Ready"
        case .needsReview: return "Needs Review"
        case .failed: return "Failed"
        }
    }
    
    var isLoading: Bool {
        switch self {
        case .queued, .uploadRequested, .uploading, .processing:
            return true
        default:
            return false
        }
    }
}

// MARK: - SaveItem Model
struct SaveItem: Identifiable, Codable, Hashable {
    let id: String
    let sourceURL: String
    let dateAdded: Date
    var rawSharedText: String?
    var status: SaveItemStatus
    var thumbnailURL: String?
    var transcriptText: String?
    var detectedTopics: [String]
    var detectedLabels: [String]
    var predictedFolderId: String?
    var confidence: Double?
    var folderId: String?
    var folderName: String?
    var title: String?
    var duration: Double?
    var creatorName: String?
    var creatorUsername: String?
    var errorMessage: String?
    
    // Computed properties
    var displayTitle: String {
        if let title = title, !title.isEmpty {
            return title
        }
        if let transcript = transcriptText, !transcript.isEmpty {
            let words = transcript.split(separator: " ").prefix(10)
            return words.joined(separator: " ") + (transcript.split(separator: " ").count > 10 ? "..." : "")
        }
        return "TikTok Video"
    }
    
    var needsUserReview: Bool {
        status == .needsReview || (confidence ?? 0) < Config.mediumConfidenceThreshold
    }
    
    var confidenceLevel: ConfidenceLevel {
        guard let confidence = confidence else { return .low }
        if confidence >= Config.highConfidenceThreshold { return .high }
        if confidence >= Config.mediumConfidenceThreshold { return .medium }
        return .low
    }
    
    enum ConfidenceLevel {
        case high, medium, low
        
        var color: String {
            switch self {
            case .high: return "green"
            case .medium: return "orange"
            case .low: return "red"
            }
        }
    }
}

// MARK: - SaveItem Extensions
extension SaveItem {
    static func preview() -> SaveItem {
        SaveItem(
            id: UUID().uuidString,
            sourceURL: "https://tiktok.com/@user/video/123456",
            dateAdded: Date(),
            rawSharedText: "Check out this amazing ramen spot in Tokyo! #japan #food #tokyo",
            status: .ready,
            thumbnailURL: nil,
            transcriptText: "This ramen shop in Shinjuku has the best tonkotsu ramen I've ever had...",
            detectedTopics: ["Japan", "Food", "Travel"],
            detectedLabels: ["ramen", "restaurant", "tokyo", "noodles"],
            predictedFolderId: "japan-food",
            confidence: 0.92,
            folderId: "japan-food",
            folderName: "Japan Food",
            title: "Best Ramen in Tokyo",
            duration: 45.0,
            creatorName: "Travel Foodie",
            creatorUsername: "@travelfoodie"
        )
    }
}

// MARK: - Pending Shared Item (for share extension)
struct PendingSharedItem: Codable {
    let id: String
    let sourceURL: String
    let rawSharedText: String?
    let dateAdded: Date
    var isSynced: Bool
    
    init(sourceURL: String, rawSharedText: String?) {
        self.id = UUID().uuidString
        self.sourceURL = sourceURL
        self.rawSharedText = rawSharedText
        self.dateAdded = Date()
        self.isSynced = false
    }
}

