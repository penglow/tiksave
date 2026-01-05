import SwiftUI

struct FoldersView: View {
    @StateObject private var viewModel = FoldersViewModel()
    @State private var showingAddFolder = false
    @State private var selectedFolder: Folder?
    
    var body: some View {
        NavigationStack {
            ZStack {
                Color(red: 0.07, green: 0.07, blue: 0.12)
                    .ignoresSafeArea()
                
                if viewModel.isLoading && viewModel.folderNodes.isEmpty {
                    LoadingView()
                } else if viewModel.folderNodes.isEmpty {
                    EmptyFoldersView(onAddFolder: { showingAddFolder = true })
                } else {
                    ScrollView {
                        LazyVStack(spacing: 12) {
                            ForEach(viewModel.folderNodes) { node in
                                FolderNodeView(
                                    node: node,
                                    onSelect: { folder in
                                        selectedFolder = folder
                                    }
                                )
                            }
                        }
                        .padding()
                    }
                    .refreshable {
                        await viewModel.refresh()
                    }
                }
            }
            .navigationTitle("Folders")
            .navigationBarTitleDisplayMode(.large)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        showingAddFolder = true
                    } label: {
                        Image(systemName: "plus")
                            .foregroundColor(.cyan)
                    }
                }
            }
            .sheet(isPresented: $showingAddFolder) {
                AddFolderSheet(viewModel: viewModel)
            }
            .navigationDestination(item: $selectedFolder) { folder in
                FolderDetailView(folder: folder)
            }
        }
        .task {
            await viewModel.loadFolders()
        }
    }
}

// MARK: - View Model
@MainActor
class FoldersViewModel: ObservableObject {
    @Published var folders: [Folder] = []
    @Published var folderNodes: [FolderNode] = []
    @Published var isLoading = false
    @Published var error: String?
    
    private let apiService = APIService.shared
    
    func loadFolders() async {
        isLoading = true
        do {
            folders = try await apiService.getFolders()
            folderNodes = buildTree(from: folders)
        } catch {
            self.error = error.localizedDescription
        }
        isLoading = false
    }
    
    func refresh() async {
        await loadFolders()
    }
    
    func createFolder(name: String, parentId: String?, iconName: String?) async {
        do {
            _ = try await apiService.createFolder(name: name, parentId: parentId, iconName: iconName)
            await refresh()
        } catch {
            self.error = error.localizedDescription
        }
    }
    
    func deleteFolder(id: String) async {
        do {
            try await apiService.deleteFolder(id: id)
            await refresh()
        } catch {
            self.error = error.localizedDescription
        }
    }
    
    private func buildTree(from folders: [Folder]) -> [FolderNode] {
        let topLevel = folders.filter { $0.parentId == nil }
        
        return topLevel.map { folder in
            buildNode(for: folder, allFolders: folders)
        }.sorted { $0.folder.sortOrder < $1.folder.sortOrder }
    }
    
    private func buildNode(for folder: Folder, allFolders: [Folder]) -> FolderNode {
        let children = allFolders
            .filter { $0.parentId == folder.id }
            .map { buildNode(for: $0, allFolders: allFolders) }
            .sorted { $0.folder.sortOrder < $1.folder.sortOrder }
        
        return FolderNode(folder: folder, children: children)
    }
}

// MARK: - Folder Node View
struct FolderNodeView: View {
    let node: FolderNode
    let onSelect: (Folder) -> Void
    @State private var isExpanded = true
    
    var body: some View {
        VStack(spacing: 8) {
            // Parent folder button
            Button {
                if node.hasChildren {
                    withAnimation(.spring(response: 0.3)) {
                        isExpanded.toggle()
                    }
                } else {
                    onSelect(node.folder)
                }
            } label: {
                HStack(spacing: 14) {
                    // Icon
                    Text(node.folder.displayIcon)
                        .font(.title2)
                        .frame(width: 44, height: 44)
                        .background(
                            LinearGradient(
                                colors: [.cyan.opacity(0.3), .purple.opacity(0.3)],
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            )
                        )
                        .cornerRadius(12)
                    
                    VStack(alignment: .leading, spacing: 2) {
                        Text(node.folder.name)
                            .font(.headline)
                            .foregroundColor(.white)
                        
                        Text("\(node.folder.itemCount) items")
                            .font(.caption)
                            .foregroundColor(.white.opacity(0.5))
                    }
                    
                    Spacer()
                    
                    if node.hasChildren {
                        Image(systemName: "chevron.down")
                            .font(.caption.weight(.semibold))
                            .foregroundColor(.white.opacity(0.4))
                            .rotationEffect(.degrees(isExpanded ? 0 : -90))
                    } else {
                        Image(systemName: "chevron.right")
                            .font(.caption)
                            .foregroundColor(.white.opacity(0.3))
                    }
                }
                .padding()
                .background(Color.white.opacity(0.08))
                .cornerRadius(16)
            }
            .buttonStyle(ScaleButtonStyle())
            .contextMenu {
                Button {
                    onSelect(node.folder)
                } label: {
                    Label("Open", systemImage: "folder")
                }
                
                Button(role: .destructive) {
                    // Delete action
                } label: {
                    Label("Delete", systemImage: "trash")
                }
            }
            
            // Children
            if isExpanded && node.hasChildren {
                VStack(spacing: 6) {
                    ForEach(node.children) { childNode in
                        Button {
                            onSelect(childNode.folder)
                        } label: {
                            HStack(spacing: 12) {
                                Text(childNode.folder.displayIcon)
                                    .font(.body)
                                    .frame(width: 32, height: 32)
                                    .background(Color.white.opacity(0.08))
                                    .cornerRadius(8)
                                
                                Text(childNode.folder.name)
                                    .font(.subheadline)
                                    .foregroundColor(.white.opacity(0.9))
                                
                                Spacer()
                                
                                Text("\(childNode.folder.itemCount)")
                                    .font(.caption)
                                    .foregroundColor(.white.opacity(0.4))
                                
                                Image(systemName: "chevron.right")
                                    .font(.caption2)
                                    .foregroundColor(.white.opacity(0.3))
                            }
                            .padding(.horizontal, 12)
                            .padding(.vertical, 10)
                            .background(Color.white.opacity(0.04))
                            .cornerRadius(10)
                        }
                        .buttonStyle(ScaleButtonStyle())
                    }
                }
                .padding(.leading, 24)
            }
        }
    }
}

// MARK: - Add Folder Sheet
struct AddFolderSheet: View {
    @ObservedObject var viewModel: FoldersViewModel
    @Environment(\.dismiss) private var dismiss
    
    @State private var name = ""
    @State private var selectedParentId: String?
    @State private var selectedIcon = "📁"
    
    let availableIcons = ["📁", "🇯🇵", "🇰🇷", "🇺🇸", "🇬🇧", "🍽️", "🏨", "🎡", "🛍️", "💪", "🚗", "💰", "📱", "👗", "💄", "🐾", "🎵", "📚"]
    
    var body: some View {
        NavigationStack {
            ZStack {
                Color(red: 0.07, green: 0.07, blue: 0.12)
                    .ignoresSafeArea()
                
                VStack(spacing: 24) {
                    // Icon selector
                    VStack(alignment: .leading, spacing: 12) {
                        Text("Icon")
                            .font(.subheadline.weight(.medium))
                            .foregroundColor(.white.opacity(0.6))
                        
                        ScrollView(.horizontal, showsIndicators: false) {
                            HStack(spacing: 8) {
                                ForEach(availableIcons, id: \.self) { icon in
                                    Text(icon)
                                        .font(.title2)
                                        .frame(width: 44, height: 44)
                                        .background(
                                            icon == selectedIcon
                                                ? Color.cyan.opacity(0.3)
                                                : Color.white.opacity(0.1)
                                        )
                                        .cornerRadius(10)
                                        .overlay(
                                            RoundedRectangle(cornerRadius: 10)
                                                .stroke(icon == selectedIcon ? Color.cyan : Color.clear, lineWidth: 2)
                                        )
                                        .onTapGesture {
                                            selectedIcon = icon
                                        }
                                }
                            }
                        }
                    }
                    
                    // Name field
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Name")
                            .font(.subheadline.weight(.medium))
                            .foregroundColor(.white.opacity(0.6))
                        
                        TextField("", text: $name, prompt: Text("Folder name").foregroundColor(.white.opacity(0.4)))
                            .padding()
                            .background(Color.white.opacity(0.1))
                            .cornerRadius(12)
                            .foregroundColor(.white)
                    }
                    
                    // Parent folder picker
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Parent Folder (optional)")
                            .font(.subheadline.weight(.medium))
                            .foregroundColor(.white.opacity(0.6))
                        
                        Menu {
                            Button("None (Top Level)") {
                                selectedParentId = nil
                            }
                            
                            ForEach(viewModel.folders.filter { $0.parentId == nil }) { folder in
                                Button(folder.name) {
                                    selectedParentId = folder.id
                                }
                            }
                        } label: {
                            HStack {
                                Text(selectedParentName)
                                    .foregroundColor(.white)
                                Spacer()
                                Image(systemName: "chevron.up.chevron.down")
                                    .font(.caption)
                                    .foregroundColor(.white.opacity(0.5))
                            }
                            .padding()
                            .background(Color.white.opacity(0.1))
                            .cornerRadius(12)
                        }
                    }
                    
                    Spacer()
                }
                .padding()
            }
            .navigationTitle("New Folder")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") {
                        dismiss()
                    }
                    .foregroundColor(.white)
                }
                
                ToolbarItem(placement: .confirmationAction) {
                    Button("Create") {
                        Task {
                            await viewModel.createFolder(
                                name: name,
                                parentId: selectedParentId,
                                iconName: selectedIcon
                            )
                            dismiss()
                        }
                    }
                    .foregroundColor(.cyan)
                    .disabled(name.isEmpty)
                }
            }
        }
    }
    
    private var selectedParentName: String {
        if let parentId = selectedParentId,
           let parent = viewModel.folders.first(where: { $0.id == parentId }) {
            return parent.name
        }
        return "None (Top Level)"
    }
}

// MARK: - Empty Folders View
struct EmptyFoldersView: View {
    let onAddFolder: () -> Void
    
    var body: some View {
        VStack(spacing: 24) {
            ZStack {
                Circle()
                    .fill(Color.purple.opacity(0.2))
                    .frame(width: 120, height: 120)
                
                Image(systemName: "folder.fill.badge.plus")
                    .font(.system(size: 50))
                    .foregroundColor(.purple)
            }
            
            VStack(spacing: 8) {
                Text("No folders yet")
                    .font(.title2.weight(.semibold))
                    .foregroundColor(.white)
                
                Text("Create folders to organize\nyour saved TikToks")
                    .font(.subheadline)
                    .foregroundColor(.white.opacity(0.6))
                    .multilineTextAlignment(.center)
            }
            
            Button {
                onAddFolder()
            } label: {
                HStack {
                    Image(systemName: "plus")
                    Text("Add Folder")
                }
                .font(.headline)
                .padding(.horizontal, 24)
                .padding(.vertical, 14)
                .background(
                    LinearGradient(
                        colors: [.cyan, .purple],
                        startPoint: .leading,
                        endPoint: .trailing
                    )
                )
                .foregroundColor(.white)
                .cornerRadius(14)
            }
        }
        .padding()
    }
}

// MARK: - Scale Button Style
struct ScaleButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? 0.97 : 1)
            .animation(.easeInOut(duration: 0.15), value: configuration.isPressed)
    }
}

#Preview {
    FoldersView()
        .environmentObject(AppState())
}

