import Foundation

// MARK: - Folder Model
struct Folder: Identifiable, Codable, Hashable {
    let id: String
    var name: String
    var parentId: String?
    var iconName: String?
    var colorHex: String?
    var sortOrder: Int
    var isDefault: Bool
    var rules: [FolderRule]?
    var itemCount: Int
    var createdAt: Date
    var updatedAt: Date
    
    // Computed
    var isTopLevel: Bool {
        parentId == nil
    }
    
    var displayIcon: String {
        iconName ?? defaultIconForName(name)
    }
    
    private func defaultIconForName(_ name: String) -> String {
        let lowercased = name.lowercased()
        
        // Travel destinations
        if lowercased.contains("japan") { return "🇯🇵" }
        if lowercased.contains("korea") { return "🇰🇷" }
        if lowercased.contains("china") { return "🇨🇳" }
        if lowercased.contains("usa") || lowercased.contains("america") { return "🇺🇸" }
        if lowercased.contains("uk") || lowercased.contains("britain") { return "🇬🇧" }
        if lowercased.contains("france") { return "🇫🇷" }
        if lowercased.contains("italy") { return "🇮🇹" }
        if lowercased.contains("spain") { return "🇪🇸" }
        if lowercased.contains("germany") { return "🇩🇪" }
        if lowercased.contains("thailand") { return "🇹🇭" }
        if lowercased.contains("vietnam") { return "🇻🇳" }
        
        // Categories
        if lowercased.contains("food") || lowercased.contains("recipe") { return "🍽️" }
        if lowercased.contains("hotel") || lowercased.contains("stay") { return "🏨" }
        if lowercased.contains("attraction") || lowercased.contains("sightseeing") { return "🎡" }
        if lowercased.contains("shopping") || lowercased.contains("haul") { return "🛍️" }
        if lowercased.contains("gym") || lowercased.contains("fitness") || lowercased.contains("workout") { return "💪" }
        if lowercased.contains("car") || lowercased.contains("auto") { return "🚗" }
        if lowercased.contains("finance") || lowercased.contains("money") || lowercased.contains("invest") { return "💰" }
        if lowercased.contains("tech") || lowercased.contains("gadget") { return "📱" }
        if lowercased.contains("fashion") || lowercased.contains("style") || lowercased.contains("outfit") { return "👗" }
        if lowercased.contains("beauty") || lowercased.contains("makeup") || lowercased.contains("skincare") { return "💄" }
        if lowercased.contains("pet") || lowercased.contains("dog") || lowercased.contains("cat") { return "🐾" }
        if lowercased.contains("diy") || lowercased.contains("craft") { return "🔨" }
        if lowercased.contains("music") { return "🎵" }
        if lowercased.contains("dance") { return "💃" }
        if lowercased.contains("comedy") || lowercased.contains("funny") { return "😂" }
        if lowercased.contains("education") || lowercased.contains("learn") { return "📚" }
        
        return "📁"
    }
}

// MARK: - Folder Rule
struct FolderRule: Codable, Hashable {
    let id: String
    var field: RuleField
    var operation: RuleOperation
    var value: String
    var weight: Double
    
    enum RuleField: String, Codable {
        case topic
        case label
        case transcript
        case hashtag
        case creator
    }
    
    enum RuleOperation: String, Codable {
        case contains
        case equals
        case startsWith
        case matches // regex
    }
}

// MARK: - Folder with Children (for tree display)
struct FolderNode: Identifiable {
    let folder: Folder
    var children: [FolderNode]
    
    var id: String { folder.id }
    
    var hasChildren: Bool { !children.isEmpty }
}

// MARK: - Default Folder Templates
extension Folder {
    static func createDefaultFolders() -> [[String: Any]] {
        [
            // Japan category
            ["name": "Japan", "icon": "🇯🇵", "children": [
                ["name": "Japan Food", "icon": "🍜"],
                ["name": "Japan Hotels", "icon": "🏨"],
                ["name": "Japan Attractions", "icon": "⛩️"],
                ["name": "Japan Shopping", "icon": "🛍️"]
            ]],
            // Fitness category
            ["name": "Gym", "icon": "💪", "children": [
                ["name": "Workouts", "icon": "🏋️"],
                ["name": "Nutrition", "icon": "🥗"],
                ["name": "Motivation", "icon": "🔥"]
            ]],
            // Recipes category
            ["name": "Recipes", "icon": "👨‍🍳", "children": [
                ["name": "Quick Meals", "icon": "⏱️"],
                ["name": "Desserts", "icon": "🍰"],
                ["name": "Healthy", "icon": "🥦"]
            ]]
        ]
    }
    
    static func preview() -> Folder {
        Folder(
            id: "japan-food",
            name: "Japan Food",
            parentId: "japan",
            iconName: "🍜",
            colorHex: "#FF6B6B",
            sortOrder: 0,
            isDefault: false,
            rules: nil,
            itemCount: 12,
            createdAt: Date(),
            updatedAt: Date()
        )
    }
}

