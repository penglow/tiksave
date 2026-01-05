import Foundation
import SwiftUI
import Combine

@MainActor
class AppState: ObservableObject {
    @Published var selectedTab: Tab = .inbox
    @Published var isProcessing = false
    @Published var unreadInboxCount = 0
    @Published var showingError = false
    @Published var errorMessage = ""
    
    private let apiService = APIService.shared
    private let sharedStorage = SharedStorage.shared
    private var cancellables = Set<AnyCancellable>()
    
    enum Tab: Hashable {
        case inbox
        case folders
        case search
        case settings
    }
    
    init() {
        setupObservers()
    }
    
    private func setupObservers() {
        // Refresh inbox count periodically
        Timer.publish(every: 30, on: .main, in: .common)
            .autoconnect()
            .sink { [weak self] _ in
                Task {
                    await self?.refreshInboxCount()
                }
            }
            .store(in: &cancellables)
    }
    
    func checkForNewSharedItems() {
        Task {
            // Get items saved by share extension
            let pendingItems = sharedStorage.getPendingItems()
            
            for item in pendingItems {
                do {
                    // Send to backend
                    try await apiService.createSaveItem(
                        sourceURL: item.sourceURL,
                        rawSharedText: item.rawSharedText
                    )
                    // Mark as synced
                    sharedStorage.markAsSynced(itemId: item.id)
                } catch {
                    print("Failed to sync item: \(error)")
                }
            }
            
            await refreshInboxCount()
        }
    }
    
    func refreshInboxCount() async {
        do {
            let items = try await apiService.getItems(status: .needsReview)
            unreadInboxCount = items.count
        } catch {
            print("Failed to refresh inbox count: \(error)")
        }
    }
    
    func showError(_ message: String) {
        errorMessage = message
        showingError = true
    }
}

