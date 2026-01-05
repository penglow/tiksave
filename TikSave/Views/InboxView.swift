import SwiftUI

struct InboxView: View {
    @StateObject private var viewModel = InboxViewModel()
    @State private var selectedItem: SaveItem?
    @State private var showingMoveSheet = false
    
    var body: some View {
        NavigationStack {
            ZStack {
                // Background
                Color(red: 0.07, green: 0.07, blue: 0.12)
                    .ignoresSafeArea()
                
                if viewModel.isLoading && viewModel.items.isEmpty {
                    LoadingView()
                } else if viewModel.items.isEmpty {
                    EmptyInboxView()
                } else {
                    ScrollView {
                        LazyVStack(spacing: 16) {
                            // Processing section
                            if !viewModel.processingItems.isEmpty {
                                ProcessingSection(items: viewModel.processingItems)
                            }
                            
                            // Needs review section
                            if !viewModel.needsReviewItems.isEmpty {
                                NeedsReviewSection(
                                    items: viewModel.needsReviewItems,
                                    onSelect: { item in
                                        selectedItem = item
                                        showingMoveSheet = true
                                    }
                                )
                            }
                            
                            // Recently filed section
                            if !viewModel.recentlyFiledItems.isEmpty {
                                RecentlyFiledSection(items: viewModel.recentlyFiledItems)
                            }
                        }
                        .padding()
                    }
                    .refreshable {
                        await viewModel.refresh()
                    }
                }
            }
            .navigationTitle("Inbox")
            .navigationBarTitleDisplayMode(.large)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Menu {
                        Button {
                            Task { await viewModel.refresh() }
                        } label: {
                            Label("Refresh", systemImage: "arrow.clockwise")
                        }
                    } label: {
                        Image(systemName: "ellipsis.circle")
                            .foregroundColor(.white)
                    }
                }
            }
            .sheet(isPresented: $showingMoveSheet) {
                if let item = selectedItem {
                    MoveFolderSheet(item: item) { folderId in
                        Task {
                            await viewModel.moveItem(item, to: folderId)
                        }
                    }
                }
            }
        }
        .task {
            await viewModel.loadItems()
        }
    }
}

// MARK: - View Model
@MainActor
class InboxViewModel: ObservableObject {
    @Published var items: [SaveItem] = []
    @Published var isLoading = false
    @Published var error: String?
    
    private let apiService = APIService.shared
    
    var processingItems: [SaveItem] {
        items.filter { $0.status.isLoading }
    }
    
    var needsReviewItems: [SaveItem] {
        items.filter { $0.status == .needsReview }
    }
    
    var recentlyFiledItems: [SaveItem] {
        items.filter { $0.status == .ready && $0.folderId != nil }
            .sorted { $0.dateAdded > $1.dateAdded }
            .prefix(10)
            .map { $0 }
    }
    
    func loadItems() async {
        isLoading = true
        do {
            let all = try await apiService.getItems()
            items = all.sorted { $0.dateAdded > $1.dateAdded }
        } catch {
            self.error = error.localizedDescription
        }
        isLoading = false
    }
    
    func refresh() async {
        await loadItems()
    }
    
    func moveItem(_ item: SaveItem, to folderId: String) async {
        do {
            _ = try await apiService.moveItemToFolder(itemId: item.id, folderId: folderId)
            await refresh()
        } catch {
            self.error = error.localizedDescription
        }
    }
}

// MARK: - Processing Section
struct ProcessingSection: View {
    let items: [SaveItem]
    
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Image(systemName: "gearshape.2.fill")
                    .foregroundColor(.cyan)
                Text("Processing")
                    .font(.headline)
                    .foregroundColor(.white)
                Spacer()
                Text("\(items.count)")
                    .font(.subheadline)
                    .foregroundColor(.white.opacity(0.6))
            }
            
            ForEach(items) { item in
                ProcessingItemRow(item: item)
            }
        }
        .padding()
        .background(Color.white.opacity(0.05))
        .cornerRadius(16)
    }
}

struct ProcessingItemRow: View {
    let item: SaveItem
    
    var body: some View {
        HStack(spacing: 12) {
            ZStack {
                RoundedRectangle(cornerRadius: 8)
                    .fill(Color.white.opacity(0.1))
                    .frame(width: 50, height: 50)
                
                ProgressView()
                    .progressViewStyle(CircularProgressViewStyle(tint: .cyan))
            }
            
            VStack(alignment: .leading, spacing: 4) {
                Text(item.displayTitle)
                    .font(.subheadline)
                    .foregroundColor(.white)
                    .lineLimit(1)
                
                Text(item.status.displayName)
                    .font(.caption)
                    .foregroundColor(.cyan)
            }
            
            Spacer()
        }
        .padding(8)
        .background(Color.white.opacity(0.03))
        .cornerRadius(10)
    }
}

// MARK: - Needs Review Section
struct NeedsReviewSection: View {
    let items: [SaveItem]
    let onSelect: (SaveItem) -> Void
    
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Image(systemName: "exclamationmark.circle.fill")
                    .foregroundColor(.orange)
                Text("Needs Review")
                    .font(.headline)
                    .foregroundColor(.white)
                Spacer()
                Text("\(items.count)")
                    .font(.subheadline)
                    .foregroundColor(.white.opacity(0.6))
            }
            
            ForEach(items) { item in
                NeedsReviewItemRow(item: item)
                    .onTapGesture {
                        onSelect(item)
                    }
            }
        }
        .padding()
        .background(Color.orange.opacity(0.1))
        .cornerRadius(16)
    }
}

struct NeedsReviewItemRow: View {
    let item: SaveItem
    
    var body: some View {
        HStack(spacing: 12) {
            // Thumbnail placeholder
            ZStack {
                RoundedRectangle(cornerRadius: 8)
                    .fill(Color.white.opacity(0.1))
                    .frame(width: 60, height: 80)
                
                Image(systemName: "play.fill")
                    .foregroundColor(.white.opacity(0.5))
            }
            
            VStack(alignment: .leading, spacing: 6) {
                Text(item.displayTitle)
                    .font(.subheadline.weight(.medium))
                    .foregroundColor(.white)
                    .lineLimit(2)
                
                if let folderName = item.folderName {
                    HStack(spacing: 4) {
                        Image(systemName: "folder.fill")
                            .font(.caption2)
                        Text("Suggested: \(folderName)")
                            .font(.caption)
                    }
                    .foregroundColor(.orange)
                }
                
                HStack(spacing: 8) {
                    ForEach(item.detectedTopics.prefix(2), id: \.self) { topic in
                        Text(topic)
                            .font(.caption2)
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(Color.white.opacity(0.1))
                            .cornerRadius(4)
                            .foregroundColor(.white.opacity(0.7))
                    }
                }
            }
            
            Spacer()
            
            Image(systemName: "chevron.right")
                .foregroundColor(.white.opacity(0.3))
        }
        .padding(10)
        .background(Color.white.opacity(0.03))
        .cornerRadius(10)
    }
}

// MARK: - Recently Filed Section
struct RecentlyFiledSection: View {
    let items: [SaveItem]
    
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Image(systemName: "checkmark.circle.fill")
                    .foregroundColor(.green)
                Text("Recently Filed")
                    .font(.headline)
                    .foregroundColor(.white)
                Spacer()
            }
            
            ForEach(items) { item in
                RecentlyFiledItemRow(item: item)
            }
        }
        .padding()
        .background(Color.white.opacity(0.05))
        .cornerRadius(16)
    }
}

struct RecentlyFiledItemRow: View {
    let item: SaveItem
    
    var body: some View {
        HStack(spacing: 12) {
            ZStack {
                RoundedRectangle(cornerRadius: 8)
                    .fill(Color.white.opacity(0.1))
                    .frame(width: 50, height: 50)
                
                Image(systemName: "play.fill")
                    .foregroundColor(.white.opacity(0.5))
            }
            
            VStack(alignment: .leading, spacing: 4) {
                Text(item.displayTitle)
                    .font(.subheadline)
                    .foregroundColor(.white)
                    .lineLimit(1)
                
                if let folderName = item.folderName {
                    HStack(spacing: 4) {
                        Image(systemName: "folder.fill")
                            .font(.caption2)
                        Text(folderName)
                            .font(.caption)
                    }
                    .foregroundColor(.green)
                }
            }
            
            Spacer()
            
            Text(item.dateAdded.timeAgo())
                .font(.caption)
                .foregroundColor(.white.opacity(0.4))
        }
        .padding(8)
        .background(Color.white.opacity(0.03))
        .cornerRadius(10)
    }
}

// MARK: - Empty Inbox View
struct EmptyInboxView: View {
    var body: some View {
        VStack(spacing: 24) {
            ZStack {
                Circle()
                    .fill(Color.cyan.opacity(0.2))
                    .frame(width: 120, height: 120)
                
                Image(systemName: "tray.fill")
                    .font(.system(size: 50))
                    .foregroundColor(.cyan)
            }
            
            VStack(spacing: 8) {
                Text("Your inbox is empty")
                    .font(.title2.weight(.semibold))
                    .foregroundColor(.white)
                
                Text("Share a TikTok video to get started.\nIt will appear here for processing.")
                    .font(.subheadline)
                    .foregroundColor(.white.opacity(0.6))
                    .multilineTextAlignment(.center)
            }
        }
        .padding()
    }
}

// MARK: - Loading View
struct LoadingView: View {
    var body: some View {
        VStack(spacing: 16) {
            ProgressView()
                .progressViewStyle(CircularProgressViewStyle(tint: .cyan))
                .scaleEffect(1.5)
            
            Text("Loading...")
                .font(.subheadline)
                .foregroundColor(.white.opacity(0.6))
        }
    }
}

// MARK: - Date Extension
extension Date {
    func timeAgo() -> String {
        let formatter = RelativeDateTimeFormatter()
        formatter.unitsStyle = .abbreviated
        return formatter.localizedString(for: self, relativeTo: Date())
    }
}

#Preview {
    InboxView()
        .environmentObject(AppState())
}

