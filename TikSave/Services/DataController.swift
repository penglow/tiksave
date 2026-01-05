import Foundation
import CoreData

/// Core Data controller for local caching
class DataController: ObservableObject {
    static let shared = DataController()
    
    let container: NSPersistentContainer
    
    private init() {
        container = NSPersistentContainer(name: "TikSave")
        
        // Use App Group for shared storage
        if let storeURL = FileManager.default
            .containerURL(forSecurityApplicationGroupIdentifier: Config.appGroupIdentifier)?
            .appendingPathComponent("TikSave.sqlite") {
            
            let description = NSPersistentStoreDescription(url: storeURL)
            container.persistentStoreDescriptions = [description]
        }
        
        container.loadPersistentStores { description, error in
            if let error = error {
                print("Core Data failed to load: \(error.localizedDescription)")
            }
        }
        
        container.viewContext.automaticallyMergesChangesFromParent = true
        container.viewContext.mergePolicy = NSMergeByPropertyObjectTrumpMergePolicy
    }
    
    // MARK: - Convenience Methods
    
    func save() {
        let context = container.viewContext
        
        if context.hasChanges {
            do {
                try context.save()
            } catch {
                print("Error saving context: \(error)")
            }
        }
    }
    
    func performBackgroundTask(_ block: @escaping (NSManagedObjectContext) -> Void) {
        container.performBackgroundTask(block)
    }
}

// MARK: - Cache Entity Definitions
// Note: In a real Xcode project, these would be generated from the .xcdatamodeld file

/*
 Core Data Model (TikSave.xcdatamodeld):
 
 Entity: CachedSaveItem
 - id: String (primary key)
 - sourceURL: String
 - dateAdded: Date
 - rawSharedText: String?
 - status: String
 - thumbnailURL: String?
 - thumbnailData: Binary?
 - transcriptText: String?
 - detectedTopics: Transformable (JSON array)
 - detectedLabels: Transformable (JSON array)
 - predictedFolderId: String?
 - confidence: Double
 - folderId: String?
 - folderName: String?
 - title: String?
 - duration: Double
 - creatorName: String?
 - creatorUsername: String?
 - lastSyncedAt: Date
 
 Entity: CachedFolder
 - id: String (primary key)
 - name: String
 - parentId: String?
 - iconName: String?
 - colorHex: String?
 - sortOrder: Int32
 - isDefault: Bool
 - itemCount: Int32
 - lastSyncedAt: Date
 
 Entity: SearchHistory
 - id: String (primary key)
 - query: String
 - timestamp: Date
 - resultCount: Int32
 */

// MARK: - Cache Manager
class CacheManager {
    static let shared = CacheManager()
    
    private let fileManager = FileManager.default
    private let thumbnailCacheURL: URL?
    
    private init() {
        // Set up thumbnail cache directory
        if let cacheURL = fileManager.containerURL(forSecurityApplicationGroupIdentifier: Config.appGroupIdentifier)?
            .appendingPathComponent("ThumbnailCache", isDirectory: true) {
            
            if !fileManager.fileExists(atPath: cacheURL.path) {
                try? fileManager.createDirectory(at: cacheURL, withIntermediateDirectories: true)
            }
            thumbnailCacheURL = cacheURL
        } else {
            thumbnailCacheURL = nil
        }
    }
    
    // MARK: - Thumbnail Cache
    
    func cacheThumbnail(data: Data, for itemId: String) {
        guard let cacheURL = thumbnailCacheURL else { return }
        
        let fileURL = cacheURL.appendingPathComponent("\(itemId).jpg")
        try? data.write(to: fileURL)
    }
    
    func getThumbnail(for itemId: String) -> Data? {
        guard let cacheURL = thumbnailCacheURL else { return nil }
        
        let fileURL = cacheURL.appendingPathComponent("\(itemId).jpg")
        return try? Data(contentsOf: fileURL)
    }
    
    func removeThumbnail(for itemId: String) {
        guard let cacheURL = thumbnailCacheURL else { return }
        
        let fileURL = cacheURL.appendingPathComponent("\(itemId).jpg")
        try? fileManager.removeItem(at: fileURL)
    }
    
    func clearThumbnailCache() {
        guard let cacheURL = thumbnailCacheURL else { return }
        
        if let files = try? fileManager.contentsOfDirectory(at: cacheURL, includingPropertiesForKeys: nil) {
            for file in files {
                try? fileManager.removeItem(at: file)
            }
        }
    }
    
    // MARK: - Cache Size
    
    func thumbnailCacheSize() -> Int64 {
        guard let cacheURL = thumbnailCacheURL else { return 0 }
        
        var totalSize: Int64 = 0
        
        if let files = try? fileManager.contentsOfDirectory(at: cacheURL, includingPropertiesForKeys: [.fileSizeKey]) {
            for file in files {
                if let size = try? file.resourceValues(forKeys: [.fileSizeKey]).fileSize {
                    totalSize += Int64(size)
                }
            }
        }
        
        return totalSize
    }
}

