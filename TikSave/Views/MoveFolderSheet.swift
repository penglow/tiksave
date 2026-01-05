import SwiftUI

struct MoveFolderSheet: View {
    let item: SaveItem
    let onMove: (String) -> Void
    
    @Environment(\.dismiss) private var dismiss
    @StateObject private var viewModel = MoveFolderViewModel()
    @State private var selectedFolderId: String?
    
    var body: some View {
        NavigationStack {
            ZStack {
                Color(red: 0.07, green: 0.07, blue: 0.12)
                    .ignoresSafeArea()
                
                VStack(spacing: 0) {
                    // Item preview
                    HStack(spacing: 12) {
                        ZStack {
                            RoundedRectangle(cornerRadius: 8)
                                .fill(Color.white.opacity(0.1))
                                .frame(width: 50, height: 66)
                            
                            Image(systemName: "play.fill")
                                .foregroundColor(.white.opacity(0.5))
                        }
                        
                        VStack(alignment: .leading, spacing: 4) {
                            Text(item.displayTitle)
                                .font(.subheadline.weight(.medium))
                                .foregroundColor(.white)
                                .lineLimit(2)
                            
                            if let current = item.folderName {
                                HStack(spacing: 4) {
                                    Text("Currently in:")
                                        .foregroundColor(.white.opacity(0.5))
                                    Text(current)
                                        .foregroundColor(.cyan)
                                }
                                .font(.caption)
                            }
                        }
                        
                        Spacer()
                    }
                    .padding()
                    .background(Color.white.opacity(0.05))
                    
                    // Suggested folders (if AI made a suggestion)
                    if let predictedId = item.predictedFolderId,
                       let predictedFolder = viewModel.folders.first(where: { $0.id == predictedId }),
                       predictedId != item.folderId {
                        VStack(alignment: .leading, spacing: 8) {
                            Text("AI Suggestion")
                                .font(.caption)
                                .foregroundColor(.white.opacity(0.5))
                                .padding(.horizontal)
                            
                            FolderOptionRow(
                                folder: predictedFolder,
                                isSelected: selectedFolderId == predictedFolder.id,
                                isSuggested: true,
                                confidence: item.confidence
                            )
                            .onTapGesture {
                                selectedFolderId = predictedFolder.id
                            }
                            .padding(.horizontal)
                        }
                        .padding(.top)
                    }
                    
                    // All folders
                    ScrollView {
                        VStack(alignment: .leading, spacing: 8) {
                            Text("All Folders")
                                .font(.caption)
                                .foregroundColor(.white.opacity(0.5))
                                .padding(.horizontal)
                            
                            ForEach(viewModel.folderNodes) { node in
                                FolderSelectionNode(
                                    node: node,
                                    selectedId: $selectedFolderId,
                                    currentFolderId: item.folderId
                                )
                            }
                        }
                        .padding()
                    }
                }
            }
            .navigationTitle("Move to Folder")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") {
                        dismiss()
                    }
                    .foregroundColor(.white)
                }
                
                ToolbarItem(placement: .confirmationAction) {
                    Button("Move") {
                        if let folderId = selectedFolderId {
                            onMove(folderId)
                            dismiss()
                        }
                    }
                    .foregroundColor(.cyan)
                    .disabled(selectedFolderId == nil || selectedFolderId == item.folderId)
                }
            }
        }
        .task {
            await viewModel.loadFolders()
        }
    }
}

// MARK: - View Model
@MainActor
class MoveFolderViewModel: ObservableObject {
    @Published var folders: [Folder] = []
    @Published var folderNodes: [FolderNode] = []
    
    private let apiService = APIService.shared
    
    func loadFolders() async {
        do {
            folders = try await apiService.getFolders()
            folderNodes = buildTree(from: folders)
        } catch {
            print("Error loading folders: \(error)")
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

// MARK: - Folder Option Row
struct FolderOptionRow: View {
    let folder: Folder
    let isSelected: Bool
    var isSuggested: Bool = false
    var confidence: Double? = nil
    
    var body: some View {
        HStack(spacing: 12) {
            Text(folder.displayIcon)
                .font(.title3)
                .frame(width: 36, height: 36)
                .background(
                    isSelected
                        ? Color.cyan.opacity(0.3)
                        : Color.white.opacity(0.1)
                )
                .cornerRadius(8)
            
            VStack(alignment: .leading, spacing: 2) {
                Text(folder.name)
                    .font(.subheadline.weight(.medium))
                    .foregroundColor(.white)
                
                if isSuggested, let conf = confidence {
                    Text("\(Int(conf * 100))% confident")
                        .font(.caption)
                        .foregroundColor(.cyan)
                }
            }
            
            Spacer()
            
            if isSelected {
                Image(systemName: "checkmark.circle.fill")
                    .foregroundColor(.cyan)
            }
        }
        .padding(12)
        .background(
            isSelected
                ? Color.cyan.opacity(0.1)
                : Color.white.opacity(0.05)
        )
        .cornerRadius(12)
        .overlay(
            RoundedRectangle(cornerRadius: 12)
                .stroke(isSelected ? Color.cyan : Color.clear, lineWidth: 2)
        )
    }
}

// MARK: - Folder Selection Node
struct FolderSelectionNode: View {
    let node: FolderNode
    @Binding var selectedId: String?
    let currentFolderId: String?
    @State private var isExpanded = true
    
    var body: some View {
        VStack(spacing: 6) {
            // Parent folder
            HStack(spacing: 12) {
                if node.hasChildren {
                    Button {
                        withAnimation(.spring(response: 0.3)) {
                            isExpanded.toggle()
                        }
                    } label: {
                        Image(systemName: "chevron.down")
                            .font(.caption.weight(.semibold))
                            .foregroundColor(.white.opacity(0.4))
                            .rotationEffect(.degrees(isExpanded ? 0 : -90))
                            .frame(width: 20)
                    }
                } else {
                    Spacer()
                        .frame(width: 20)
                }
                
                Text(node.folder.displayIcon)
                    .font(.title3)
                    .frame(width: 36, height: 36)
                    .background(
                        selectedId == node.folder.id
                            ? Color.cyan.opacity(0.3)
                            : Color.white.opacity(0.1)
                    )
                    .cornerRadius(8)
                
                Text(node.folder.name)
                    .font(.subheadline.weight(.medium))
                    .foregroundColor(node.folder.id == currentFolderId ? .white.opacity(0.5) : .white)
                
                Spacer()
                
                if node.folder.id == currentFolderId {
                    Text("Current")
                        .font(.caption)
                        .foregroundColor(.white.opacity(0.4))
                } else if selectedId == node.folder.id {
                    Image(systemName: "checkmark.circle.fill")
                        .foregroundColor(.cyan)
                }
            }
            .padding(10)
            .background(
                selectedId == node.folder.id
                    ? Color.cyan.opacity(0.1)
                    : Color.white.opacity(0.03)
            )
            .cornerRadius(10)
            .onTapGesture {
                if node.folder.id != currentFolderId {
                    selectedId = node.folder.id
                }
            }
            
            // Children
            if isExpanded && node.hasChildren {
                VStack(spacing: 4) {
                    ForEach(node.children) { childNode in
                        HStack(spacing: 10) {
                            Spacer()
                                .frame(width: 20)
                            
                            Text(childNode.folder.displayIcon)
                                .font(.body)
                                .frame(width: 30, height: 30)
                                .background(
                                    selectedId == childNode.folder.id
                                        ? Color.cyan.opacity(0.3)
                                        : Color.white.opacity(0.08)
                                )
                                .cornerRadius(6)
                            
                            Text(childNode.folder.name)
                                .font(.subheadline)
                                .foregroundColor(childNode.folder.id == currentFolderId ? .white.opacity(0.5) : .white.opacity(0.9))
                            
                            Spacer()
                            
                            if childNode.folder.id == currentFolderId {
                                Text("Current")
                                    .font(.caption)
                                    .foregroundColor(.white.opacity(0.4))
                            } else if selectedId == childNode.folder.id {
                                Image(systemName: "checkmark.circle.fill")
                                    .foregroundColor(.cyan)
                            }
                        }
                        .padding(8)
                        .background(
                            selectedId == childNode.folder.id
                                ? Color.cyan.opacity(0.1)
                                : Color.white.opacity(0.02)
                        )
                        .cornerRadius(8)
                        .onTapGesture {
                            if childNode.folder.id != currentFolderId {
                                selectedId = childNode.folder.id
                            }
                        }
                    }
                }
                .padding(.leading, 32)
            }
        }
    }
}

#Preview {
    MoveFolderSheet(item: SaveItem.preview()) { _ in }
}

