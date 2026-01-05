import SwiftUI

struct FolderDetailView: View {
    let folder: Folder
    @StateObject private var viewModel = FolderDetailViewModel()
    @State private var selectedItem: SaveItem?
    @State private var showingMoveSheet = false
    
    let columns = [
        GridItem(.flexible(), spacing: 12),
        GridItem(.flexible(), spacing: 12)
    ]
    
    var body: some View {
        ZStack {
            Color(red: 0.07, green: 0.07, blue: 0.12)
                .ignoresSafeArea()
            
            if viewModel.isLoading && viewModel.items.isEmpty {
                LoadingView()
            } else if viewModel.items.isEmpty {
                EmptyFolderView(folderName: folder.name)
            } else {
                ScrollView {
                    LazyVGrid(columns: columns, spacing: 12) {
                        ForEach(viewModel.items) { item in
                            VideoThumbnailCard(item: item)
                                .onTapGesture {
                                    selectedItem = item
                                }
                                .contextMenu {
                                    Button {
                                        selectedItem = item
                                        showingMoveSheet = true
                                    } label: {
                                        Label("Move to Folder", systemImage: "folder")
                                    }
                                    
                                    Button {
                                        openInTikTok(item.sourceURL)
                                    } label: {
                                        Label("Open in TikTok", systemImage: "arrow.up.right")
                                    }
                                    
                                    Divider()
                                    
                                    Button(role: .destructive) {
                                        Task {
                                            await viewModel.deleteItem(item)
                                        }
                                    } label: {
                                        Label("Delete", systemImage: "trash")
                                    }
                                }
                        }
                    }
                    .padding()
                }
                .refreshable {
                    await viewModel.loadItems(folderId: folder.id)
                }
            }
        }
        .navigationTitle(folder.name)
        .navigationBarTitleDisplayMode(.large)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Text(folder.displayIcon)
                    .font(.title2)
            }
        }
        .sheet(item: $selectedItem) { item in
            VideoDetailSheet(item: item)
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
        .task {
            await viewModel.loadItems(folderId: folder.id)
        }
    }
    
    private func openInTikTok(_ urlString: String) {
        if let url = URL(string: urlString) {
            UIApplication.shared.open(url)
        }
    }
}

// MARK: - View Model
@MainActor
class FolderDetailViewModel: ObservableObject {
    @Published var items: [SaveItem] = []
    @Published var isLoading = false
    @Published var error: String?
    
    private let apiService = APIService.shared
    
    func loadItems(folderId: String) async {
        isLoading = true
        do {
            items = try await apiService.getItems(folderId: folderId)
        } catch {
            self.error = error.localizedDescription
        }
        isLoading = false
    }
    
    func moveItem(_ item: SaveItem, to folderId: String) async {
        do {
            _ = try await apiService.moveItemToFolder(itemId: item.id, folderId: folderId)
            items.removeAll { $0.id == item.id }
        } catch {
            self.error = error.localizedDescription
        }
    }
    
    func deleteItem(_ item: SaveItem) async {
        do {
            try await apiService.deleteItem(id: item.id)
            items.removeAll { $0.id == item.id }
        } catch {
            self.error = error.localizedDescription
        }
    }
}

// MARK: - Video Thumbnail Card
struct VideoThumbnailCard: View {
    let item: SaveItem
    
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            // Thumbnail
            ZStack {
                RoundedRectangle(cornerRadius: 12)
                    .fill(
                        LinearGradient(
                            colors: [
                                Color.purple.opacity(0.3),
                                Color.cyan.opacity(0.3)
                            ],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
                    .aspectRatio(9/16, contentMode: .fit)
                
                Image(systemName: "play.fill")
                    .font(.largeTitle)
                    .foregroundColor(.white.opacity(0.8))
                
                // Duration badge
                if let duration = item.duration {
                    VStack {
                        Spacer()
                        HStack {
                            Spacer()
                            Text(formatDuration(duration))
                                .font(.caption2.weight(.semibold))
                                .padding(.horizontal, 6)
                                .padding(.vertical, 2)
                                .background(Color.black.opacity(0.7))
                                .cornerRadius(4)
                        }
                    }
                    .padding(8)
                }
                
                // Confidence indicator
                if item.needsUserReview {
                    VStack {
                        HStack {
                            Image(systemName: "exclamationmark.circle.fill")
                                .font(.caption)
                                .foregroundColor(.orange)
                                .padding(6)
                                .background(Color.black.opacity(0.7))
                                .clipShape(Circle())
                            Spacer()
                        }
                        Spacer()
                    }
                    .padding(6)
                }
            }
            
            // Title
            Text(item.displayTitle)
                .font(.caption.weight(.medium))
                .foregroundColor(.white)
                .lineLimit(2)
            
            // Creator
            if let creator = item.creatorUsername {
                Text(creator)
                    .font(.caption2)
                    .foregroundColor(.white.opacity(0.5))
                    .lineLimit(1)
            }
        }
        .padding(8)
        .background(Color.white.opacity(0.05))
        .cornerRadius(14)
    }
    
    private func formatDuration(_ seconds: Double) -> String {
        let minutes = Int(seconds) / 60
        let secs = Int(seconds) % 60
        return String(format: "%d:%02d", minutes, secs)
    }
}

// MARK: - Video Detail Sheet
struct VideoDetailSheet: View {
    let item: SaveItem
    @Environment(\.dismiss) private var dismiss
    
    var body: some View {
        NavigationStack {
            ZStack {
                Color(red: 0.07, green: 0.07, blue: 0.12)
                    .ignoresSafeArea()
                
                ScrollView {
                    VStack(alignment: .leading, spacing: 20) {
                        // Video preview
                        ZStack {
                            RoundedRectangle(cornerRadius: 16)
                                .fill(
                                    LinearGradient(
                                        colors: [.purple.opacity(0.4), .cyan.opacity(0.4)],
                                        startPoint: .topLeading,
                                        endPoint: .bottomTrailing
                                    )
                                )
                                .aspectRatio(9/16, contentMode: .fit)
                            
                            Button {
                                openInTikTok()
                            } label: {
                                VStack(spacing: 12) {
                                    Image(systemName: "play.circle.fill")
                                        .font(.system(size: 60))
                                        .foregroundColor(.white)
                                    
                                    Text("Open in TikTok")
                                        .font(.headline)
                                        .foregroundColor(.white)
                                }
                            }
                        }
                        .frame(maxWidth: 300)
                        .frame(maxWidth: .infinity)
                        
                        // Info sections
                        VStack(alignment: .leading, spacing: 16) {
                            // Title
                            VStack(alignment: .leading, spacing: 4) {
                                Text("Title")
                                    .font(.caption)
                                    .foregroundColor(.white.opacity(0.5))
                                
                                Text(item.displayTitle)
                                    .font(.headline)
                                    .foregroundColor(.white)
                            }
                            
                            // Creator
                            if let creator = item.creatorUsername {
                                VStack(alignment: .leading, spacing: 4) {
                                    Text("Creator")
                                        .font(.caption)
                                        .foregroundColor(.white.opacity(0.5))
                                    
                                    Text(creator)
                                        .font(.subheadline)
                                        .foregroundColor(.cyan)
                                }
                            }
                            
                            // Folder
                            if let folderName = item.folderName {
                                VStack(alignment: .leading, spacing: 4) {
                                    Text("Filed in")
                                        .font(.caption)
                                        .foregroundColor(.white.opacity(0.5))
                                    
                                    HStack {
                                        Image(systemName: "folder.fill")
                                        Text(folderName)
                                    }
                                    .font(.subheadline)
                                    .foregroundColor(.white)
                                }
                            }
                            
                            // Topics
                            if !item.detectedTopics.isEmpty {
                                VStack(alignment: .leading, spacing: 8) {
                                    Text("Topics")
                                        .font(.caption)
                                        .foregroundColor(.white.opacity(0.5))
                                    
                                    FlowLayout(spacing: 8) {
                                        ForEach(item.detectedTopics, id: \.self) { topic in
                                            Text(topic)
                                                .font(.caption)
                                                .padding(.horizontal, 10)
                                                .padding(.vertical, 5)
                                                .background(Color.cyan.opacity(0.2))
                                                .cornerRadius(8)
                                                .foregroundColor(.cyan)
                                        }
                                    }
                                }
                            }
                            
                            // Labels
                            if !item.detectedLabels.isEmpty {
                                VStack(alignment: .leading, spacing: 8) {
                                    Text("Labels")
                                        .font(.caption)
                                        .foregroundColor(.white.opacity(0.5))
                                    
                                    FlowLayout(spacing: 6) {
                                        ForEach(item.detectedLabels.prefix(10), id: \.self) { label in
                                            Text(label)
                                                .font(.caption2)
                                                .padding(.horizontal, 8)
                                                .padding(.vertical, 4)
                                                .background(Color.white.opacity(0.1))
                                                .cornerRadius(6)
                                                .foregroundColor(.white.opacity(0.7))
                                        }
                                    }
                                }
                            }
                            
                            // Transcript preview
                            if let transcript = item.transcriptText, !transcript.isEmpty {
                                VStack(alignment: .leading, spacing: 8) {
                                    Text("Transcript")
                                        .font(.caption)
                                        .foregroundColor(.white.opacity(0.5))
                                    
                                    Text(transcript)
                                        .font(.caption)
                                        .foregroundColor(.white.opacity(0.8))
                                        .lineLimit(10)
                                }
                            }
                        }
                        .padding()
                        .background(Color.white.opacity(0.05))
                        .cornerRadius(16)
                    }
                    .padding()
                }
            }
            .navigationTitle("Video Details")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") {
                        dismiss()
                    }
                    .foregroundColor(.cyan)
                }
            }
        }
    }
    
    private func openInTikTok() {
        if let url = URL(string: item.sourceURL) {
            UIApplication.shared.open(url)
        }
    }
}

// MARK: - Empty Folder View
struct EmptyFolderView: View {
    let folderName: String
    
    var body: some View {
        VStack(spacing: 20) {
            Image(systemName: "folder")
                .font(.system(size: 60))
                .foregroundColor(.white.opacity(0.3))
            
            Text("No videos in \(folderName)")
                .font(.headline)
                .foregroundColor(.white.opacity(0.6))
            
            Text("Videos will appear here when\nthey're filed into this folder")
                .font(.subheadline)
                .foregroundColor(.white.opacity(0.4))
                .multilineTextAlignment(.center)
        }
    }
}

// MARK: - Flow Layout
struct FlowLayout: Layout {
    var spacing: CGFloat = 8
    
    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let result = FlowResult(in: proposal.width ?? 0, subviews: subviews, spacing: spacing)
        return CGSize(width: proposal.width ?? 0, height: result.height)
    }
    
    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        let result = FlowResult(in: bounds.width, subviews: subviews, spacing: spacing)
        
        for (index, subview) in subviews.enumerated() {
            let point = result.positions[index]
            subview.place(at: CGPoint(x: bounds.minX + point.x, y: bounds.minY + point.y), proposal: .unspecified)
        }
    }
    
    struct FlowResult {
        var positions: [CGPoint] = []
        var height: CGFloat = 0
        
        init(in width: CGFloat, subviews: Subviews, spacing: CGFloat) {
            var x: CGFloat = 0
            var y: CGFloat = 0
            var rowHeight: CGFloat = 0
            
            for subview in subviews {
                let size = subview.sizeThatFits(.unspecified)
                
                if x + size.width > width && x > 0 {
                    x = 0
                    y += rowHeight + spacing
                    rowHeight = 0
                }
                
                positions.append(CGPoint(x: x, y: y))
                rowHeight = max(rowHeight, size.height)
                x += size.width + spacing
            }
            
            height = y + rowHeight
        }
    }
}

#Preview {
    NavigationStack {
        FolderDetailView(folder: Folder.preview())
    }
}

