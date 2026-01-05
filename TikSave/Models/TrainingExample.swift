import Foundation

// MARK: - Training Example
/// Records when a user moves an item to a different folder, used for learning
struct TrainingExample: Identifiable, Codable {
    let id: String
    let itemId: String
    let originalFolderId: String?
    let correctedFolderId: String
    let features: TrainingFeatures
    let timestamp: Date
    
    struct TrainingFeatures: Codable {
        var topics: [String]
        var labels: [String]
        var transcriptKeywords: [String]
        var hashtags: [String]
        var creatorUsername: String?
    }
}

// MARK: - User Preference Model
/// Tracks learned patterns for a user
struct UserPreference: Identifiable, Codable {
    let id: String
    var userId: String
    var folderId: String
    var weights: PreferenceWeights
    var updatedAt: Date
    
    struct PreferenceWeights: Codable {
        /// Topics that indicate this folder (topic -> weight)
        var topicWeights: [String: Double]
        
        /// Labels that indicate this folder (label -> weight)
        var labelWeights: [String: Double]
        
        /// Creators that usually go in this folder
        var creatorWeights: [String: Double]
        
        /// Keywords from transcripts
        var keywordWeights: [String: Double]
        
        /// How much to boost/penalize this folder overall
        var folderBias: Double
        
        init() {
            topicWeights = [:]
            labelWeights = [:]
            creatorWeights = [:]
            keywordWeights = [:]
            folderBias = 0.0
        }
        
        mutating func updateFromCorrection(
            topics: [String],
            labels: [String],
            keywords: [String],
            creator: String?,
            isPositive: Bool
        ) {
            let delta = isPositive ? 0.1 : -0.05
            
            for topic in topics {
                topicWeights[topic, default: 0.0] += delta
            }
            
            for label in labels {
                labelWeights[label, default: 0.0] += delta
            }
            
            for keyword in keywords {
                keywordWeights[keyword, default: 0.0] += delta
            }
            
            if let creator = creator {
                creatorWeights[creator, default: 0.0] += delta * 2 // Creators are strong signals
            }
        }
    }
}

// MARK: - Classification Result
struct ClassificationResult: Codable {
    let folderId: String
    let folderName: String
    let confidence: Double
    let reasons: [String]
    let alternativeFolders: [AlternativeFolder]
    
    struct AlternativeFolder: Codable {
        let folderId: String
        let folderName: String
        let confidence: Double
    }
}

