import Foundation

/// Manages shared storage between main app and share extension using App Groups
class SharedStorage {
    static let shared = SharedStorage()
    
    private let suiteName = Config.appGroupIdentifier
    private let pendingItemsKey = "pendingSharedItems"
    
    private var userDefaults: UserDefaults? {
        UserDefaults(suiteName: suiteName)
    }
    
    private init() {}
    
    // MARK: - Pending Items
    
    /// Get all pending items that haven't been synced to the server
    func getPendingItems() -> [PendingSharedItem] {
        guard let data = userDefaults?.data(forKey: pendingItemsKey) else {
            return []
        }
        
        do {
            let items = try JSONDecoder().decode([PendingSharedItem].self, from: data)
            return items.filter { !$0.isSynced }
        } catch {
            print("Error decoding pending items: \(error)")
            return []
        }
    }
    
    /// Get all items (including synced ones)
    func getAllItems() -> [PendingSharedItem] {
        guard let data = userDefaults?.data(forKey: pendingItemsKey) else {
            return []
        }
        
        do {
            return try JSONDecoder().decode([PendingSharedItem].self, from: data)
        } catch {
            print("Error decoding items: \(error)")
            return []
        }
    }
    
    /// Add a new pending item (called from share extension)
    func addPendingItem(_ item: PendingSharedItem) {
        var items = getAllItems()
        items.append(item)
        
        // Keep only last 100 items to prevent unbounded growth
        if items.count > 100 {
            items = Array(items.suffix(100))
        }
        
        saveItems(items)
    }
    
    /// Mark an item as synced (called from main app after successful API call)
    func markAsSynced(itemId: String) {
        var items = getAllItems()
        if let index = items.firstIndex(where: { $0.id == itemId }) {
            items[index].isSynced = true
            saveItems(items)
        }
    }
    
    /// Remove an item completely
    func removeItem(itemId: String) {
        var items = getAllItems()
        items.removeAll { $0.id == itemId }
        saveItems(items)
    }
    
    /// Clean up old synced items (keep last 7 days)
    func cleanupOldItems() {
        let cutoffDate = Date().addingTimeInterval(-7 * 24 * 60 * 60)
        var items = getAllItems()
        items.removeAll { $0.isSynced && $0.dateAdded < cutoffDate }
        saveItems(items)
    }
    
    // MARK: - Private
    
    private func saveItems(_ items: [PendingSharedItem]) {
        do {
            let data = try JSONEncoder().encode(items)
            userDefaults?.set(data, forKey: pendingItemsKey)
            userDefaults?.synchronize()
        } catch {
            print("Error saving items: \(error)")
        }
    }
}

// MARK: - URL Extraction Helpers

extension SharedStorage {
    /// Extract TikTok URL from shared text
    static func extractTikTokURL(from text: String) -> String? {
        // TikTok URL patterns
        let patterns = [
            // Standard TikTok URLs
            #"https?://(?:www\.)?tiktok\.com/@[\w.-]+/video/\d+"#,
            // Short TikTok URLs (vm.tiktok.com)
            #"https?://vm\.tiktok\.com/[\w]+"#,
            // TikTok lite URLs
            #"https?://(?:www\.)?tiktok\.com/t/[\w]+"#,
            // Any tiktok.com URL as fallback
            #"https?://[^\s]*tiktok\.com[^\s]*"#
        ]
        
        for pattern in patterns {
            if let range = text.range(of: pattern, options: .regularExpression) {
                let url = String(text[range])
                // Clean up any trailing characters that aren't part of URL
                return url.trimmingCharacters(in: CharacterSet(charactersIn: ".,!?;:\"'"))
            }
        }
        
        return nil
    }
    
    /// Extract hashtags from shared text
    static func extractHashtags(from text: String) -> [String] {
        let pattern = #"#[\w]+"#
        let regex = try? NSRegularExpression(pattern: pattern, options: [])
        let range = NSRange(text.startIndex..., in: text)
        
        guard let matches = regex?.matches(in: text, options: [], range: range) else {
            return []
        }
        
        return matches.compactMap { match in
            guard let range = Range(match.range, in: text) else { return nil }
            return String(text[range])
        }
    }
}

