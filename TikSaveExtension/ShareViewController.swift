import UIKit
import Social
import MobileCoreServices
import UniformTypeIdentifiers

/// Share Extension for capturing TikTok video shares
/// This extension must be FAST - iOS will kill slow extensions
class ShareViewController: UIViewController {
    
    // UI Elements
    private let containerView = UIView()
    private let iconView = UIImageView()
    private let titleLabel = UILabel()
    private let statusLabel = UILabel()
    private let checkmarkView = UIImageView()
    
    // Shared storage
    private let appGroupIdentifier = "group.com.yourcompany.tiksave"
    private let pendingItemsKey = "pendingSharedItems"
    
    override func viewDidLoad() {
        super.viewDidLoad()
        setupUI()
        processSharedContent()
    }
    
    // MARK: - UI Setup
    
    private func setupUI() {
        view.backgroundColor = UIColor.black.withAlphaComponent(0.4)
        
        // Container
        containerView.backgroundColor = UIColor(red: 0.1, green: 0.1, blue: 0.14, alpha: 1.0)
        containerView.layer.cornerRadius = 20
        containerView.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(containerView)
        
        // Icon
        iconView.image = UIImage(systemName: "play.rectangle.fill")
        iconView.tintColor = .cyan
        iconView.contentMode = .scaleAspectFit
        iconView.translatesAutoresizingMaskIntoConstraints = false
        containerView.addSubview(iconView)
        
        // Title
        titleLabel.text = "TikSave"
        titleLabel.font = .systemFont(ofSize: 22, weight: .bold)
        titleLabel.textColor = .white
        titleLabel.textAlignment = .center
        titleLabel.translatesAutoresizingMaskIntoConstraints = false
        containerView.addSubview(titleLabel)
        
        // Status
        statusLabel.text = "Saving..."
        statusLabel.font = .systemFont(ofSize: 16, weight: .medium)
        statusLabel.textColor = .white.withAlphaComponent(0.7)
        statusLabel.textAlignment = .center
        statusLabel.translatesAutoresizingMaskIntoConstraints = false
        containerView.addSubview(statusLabel)
        
        // Checkmark (hidden initially)
        checkmarkView.image = UIImage(systemName: "checkmark.circle.fill")
        checkmarkView.tintColor = .systemGreen
        checkmarkView.contentMode = .scaleAspectFit
        checkmarkView.alpha = 0
        checkmarkView.translatesAutoresizingMaskIntoConstraints = false
        containerView.addSubview(checkmarkView)
        
        NSLayoutConstraint.activate([
            containerView.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            containerView.centerYAnchor.constraint(equalTo: view.centerYAnchor),
            containerView.widthAnchor.constraint(equalToConstant: 280),
            containerView.heightAnchor.constraint(equalToConstant: 200),
            
            iconView.centerXAnchor.constraint(equalTo: containerView.centerXAnchor),
            iconView.topAnchor.constraint(equalTo: containerView.topAnchor, constant: 30),
            iconView.widthAnchor.constraint(equalToConstant: 50),
            iconView.heightAnchor.constraint(equalToConstant: 50),
            
            checkmarkView.centerXAnchor.constraint(equalTo: containerView.centerXAnchor),
            checkmarkView.topAnchor.constraint(equalTo: containerView.topAnchor, constant: 30),
            checkmarkView.widthAnchor.constraint(equalToConstant: 50),
            checkmarkView.heightAnchor.constraint(equalToConstant: 50),
            
            titleLabel.centerXAnchor.constraint(equalTo: containerView.centerXAnchor),
            titleLabel.topAnchor.constraint(equalTo: iconView.bottomAnchor, constant: 16),
            
            statusLabel.centerXAnchor.constraint(equalTo: containerView.centerXAnchor),
            statusLabel.topAnchor.constraint(equalTo: titleLabel.bottomAnchor, constant: 8),
            statusLabel.leadingAnchor.constraint(equalTo: containerView.leadingAnchor, constant: 20),
            statusLabel.trailingAnchor.constraint(equalTo: containerView.trailingAnchor, constant: -20),
        ])
        
        // Add tap to dismiss
        let tapGesture = UITapGestureRecognizer(target: self, action: #selector(handleTap))
        view.addGestureRecognizer(tapGesture)
    }
    
    @objc private func handleTap() {
        // Only dismiss if save is complete
        if checkmarkView.alpha > 0 {
            completeExtension()
        }
    }
    
    // MARK: - Process Shared Content
    
    private func processSharedContent() {
        guard let extensionItems = extensionContext?.inputItems as? [NSExtensionItem] else {
            showError("Could not read shared content")
            return
        }
        
        var foundURL: String?
        var rawText: String?
        
        let group = DispatchGroup()
        
        for extensionItem in extensionItems {
            guard let attachments = extensionItem.attachments else { continue }
            
            for attachment in attachments {
                // Try to get URL
                if attachment.hasItemConformingToTypeIdentifier(UTType.url.identifier) {
                    group.enter()
                    attachment.loadItem(forTypeIdentifier: UTType.url.identifier, options: nil) { [weak self] item, error in
                        defer { group.leave() }
                        
                        if let url = item as? URL {
                            foundURL = url.absoluteString
                        } else if let urlString = item as? String {
                            foundURL = urlString
                        }
                    }
                }
                
                // Try to get text (often contains URL and hashtags)
                if attachment.hasItemConformingToTypeIdentifier(UTType.plainText.identifier) {
                    group.enter()
                    attachment.loadItem(forTypeIdentifier: UTType.plainText.identifier, options: nil) { [weak self] item, error in
                        defer { group.leave() }
                        
                        if let text = item as? String {
                            rawText = text
                            // Extract URL from text if not found directly
                            if foundURL == nil {
                                foundURL = self?.extractTikTokURL(from: text)
                            }
                        }
                    }
                }
            }
        }
        
        group.notify(queue: .main) { [weak self] in
            guard let self = self else { return }
            
            if let url = foundURL {
                self.saveTikTok(url: url, rawText: rawText)
            } else {
                self.showError("No TikTok link found")
            }
        }
    }
    
    // MARK: - Save Logic
    
    private func saveTikTok(url: String, rawText: String?) {
        // Create pending item
        let item = PendingSharedItem(
            id: UUID().uuidString,
            sourceURL: url,
            rawSharedText: rawText,
            dateAdded: Date(),
            isSynced: false
        )
        
        // Save to shared storage
        savePendingItem(item)
        
        // Show success
        showSuccess()
    }
    
    private func savePendingItem(_ item: PendingSharedItem) {
        guard let userDefaults = UserDefaults(suiteName: appGroupIdentifier) else {
            print("Could not access app group")
            return
        }
        
        var items: [PendingSharedItem] = []
        
        // Load existing items
        if let data = userDefaults.data(forKey: pendingItemsKey),
           let existing = try? JSONDecoder().decode([PendingSharedItem].self, from: data) {
            items = existing
        }
        
        // Add new item
        items.append(item)
        
        // Keep only last 100 items
        if items.count > 100 {
            items = Array(items.suffix(100))
        }
        
        // Save
        if let data = try? JSONEncoder().encode(items) {
            userDefaults.set(data, forKey: pendingItemsKey)
            userDefaults.synchronize()
        }
    }
    
    // MARK: - URL Extraction
    
    private func extractTikTokURL(from text: String) -> String? {
        let patterns = [
            #"https?://(?:www\.)?tiktok\.com/@[\w.-]+/video/\d+"#,
            #"https?://vm\.tiktok\.com/[\w]+"#,
            #"https?://(?:www\.)?tiktok\.com/t/[\w]+"#,
            #"https?://[^\s]*tiktok\.com[^\s]*"#
        ]
        
        for pattern in patterns {
            if let regex = try? NSRegularExpression(pattern: pattern, options: []),
               let match = regex.firstMatch(in: text, options: [], range: NSRange(text.startIndex..., in: text)),
               let range = Range(match.range, in: text) {
                return String(text[range]).trimmingCharacters(in: CharacterSet(charactersIn: ".,!?;:\"'"))
            }
        }
        
        return nil
    }
    
    // MARK: - UI Feedback
    
    private func showSuccess() {
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }
            
            self.statusLabel.text = "Saved to Inbox!"
            
            UIView.animate(withDuration: 0.3) {
                self.iconView.alpha = 0
                self.checkmarkView.alpha = 1
            }
            
            // Auto-dismiss after delay
            DispatchQueue.main.asyncAfter(deadline: .now() + 1.2) {
                self.completeExtension()
            }
        }
    }
    
    private func showError(_ message: String) {
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }
            
            self.statusLabel.text = message
            self.statusLabel.textColor = .systemRed
            self.iconView.tintColor = .systemRed
            self.iconView.image = UIImage(systemName: "exclamationmark.circle.fill")
            
            // Auto-dismiss after delay
            DispatchQueue.main.asyncAfter(deadline: .now() + 2.0) {
                self.completeExtension()
            }
        }
    }
    
    private func completeExtension() {
        extensionContext?.completeRequest(returningItems: nil, completionHandler: nil)
    }
}

// MARK: - Pending Item Model (duplicated for extension isolation)

struct PendingSharedItem: Codable {
    let id: String
    let sourceURL: String
    let rawSharedText: String?
    let dateAdded: Date
    var isSynced: Bool
}

