import SwiftUI

struct SearchView: View {
    @StateObject private var viewModel = SearchViewModel()
    @State private var searchText = ""
    @State private var selectedItem: SaveItem?
    @FocusState private var isSearchFocused: Bool
    
    var body: some View {
        NavigationStack {
            ZStack {
                Color(red: 0.07, green: 0.07, blue: 0.12)
                    .ignoresSafeArea()
                
                VStack(spacing: 0) {
                    // Search bar
                    HStack(spacing: 12) {
                        HStack(spacing: 10) {
                            Image(systemName: "magnifyingglass")
                                .foregroundColor(.white.opacity(0.5))
                            
                            TextField("", text: $searchText, prompt: Text("Search by meaning or keywords...").foregroundColor(.white.opacity(0.4)))
                                .foregroundColor(.white)
                                .autocapitalization(.none)
                                .focused($isSearchFocused)
                                .onSubmit {
                                    Task {
                                        await viewModel.search(query: searchText)
                                    }
                                }
                            
                            if !searchText.isEmpty {
                                Button {
                                    searchText = ""
                                    viewModel.clearResults()
                                } label: {
                                    Image(systemName: "xmark.circle.fill")
                                        .foregroundColor(.white.opacity(0.4))
                                }
                            }
                        }
                        .padding()
                        .background(Color.white.opacity(0.1))
                        .cornerRadius(14)
                        
                        if isSearchFocused {
                            Button("Cancel") {
                                isSearchFocused = false
                                searchText = ""
                                viewModel.clearResults()
                            }
                            .foregroundColor(.white.opacity(0.7))
                        }
                    }
                    .padding()
                    
                    // Search mode toggle
                    if !searchText.isEmpty || !viewModel.results.isEmpty {
                        HStack(spacing: 0) {
                            ForEach(SearchMode.allCases, id: \.self) { mode in
                                Button {
                                    viewModel.searchMode = mode
                                    if !searchText.isEmpty {
                                        Task {
                                            await viewModel.search(query: searchText)
                                        }
                                    }
                                } label: {
                                    VStack(spacing: 4) {
                                        HStack(spacing: 6) {
                                            Image(systemName: mode.icon)
                                                .font(.caption)
                                            Text(mode.displayName)
                                                .font(.subheadline.weight(.medium))
                                        }
                                        .foregroundColor(viewModel.searchMode == mode ? .cyan : .white.opacity(0.5))
                                        
                                        Rectangle()
                                            .fill(viewModel.searchMode == mode ? Color.cyan : Color.clear)
                                            .frame(height: 2)
                                    }
                                }
                                .frame(maxWidth: .infinity)
                            }
                        }
                        .padding(.horizontal)
                    }
                    
                    // Results
                    if viewModel.isLoading {
                        Spacer()
                        ProgressView()
                            .progressViewStyle(CircularProgressViewStyle(tint: .cyan))
                            .scaleEffect(1.5)
                        Spacer()
                    } else if searchText.isEmpty && viewModel.results.isEmpty {
                        // Recent searches & suggestions
                        ScrollView {
                            VStack(alignment: .leading, spacing: 24) {
                                // Recent searches
                                if !viewModel.recentSearches.isEmpty {
                                    VStack(alignment: .leading, spacing: 12) {
                                        HStack {
                                            Text("Recent Searches")
                                                .font(.headline)
                                                .foregroundColor(.white)
                                            Spacer()
                                            Button("Clear") {
                                                viewModel.clearRecentSearches()
                                            }
                                            .font(.caption)
                                            .foregroundColor(.white.opacity(0.5))
                                        }
                                        
                                        ForEach(viewModel.recentSearches, id: \.self) { query in
                                            Button {
                                                searchText = query
                                                Task {
                                                    await viewModel.search(query: query)
                                                }
                                            } label: {
                                                HStack {
                                                    Image(systemName: "clock")
                                                        .foregroundColor(.white.opacity(0.4))
                                                    Text(query)
                                                        .foregroundColor(.white.opacity(0.8))
                                                    Spacer()
                                                }
                                            }
                                        }
                                    }
                                }
                                
                                // Search suggestions
                                VStack(alignment: .leading, spacing: 12) {
                                    Text("Try searching for")
                                        .font(.headline)
                                        .foregroundColor(.white)
                                    
                                    FlowLayout(spacing: 10) {
                                        ForEach(viewModel.suggestions, id: \.self) { suggestion in
                                            Button {
                                                searchText = suggestion
                                                Task {
                                                    await viewModel.search(query: suggestion)
                                                }
                                            } label: {
                                                Text(suggestion)
                                                    .font(.subheadline)
                                                    .padding(.horizontal, 14)
                                                    .padding(.vertical, 8)
                                                    .background(Color.white.opacity(0.1))
                                                    .cornerRadius(20)
                                                    .foregroundColor(.white.opacity(0.8))
                                            }
                                        }
                                    }
                                }
                            }
                            .padding()
                        }
                    } else if viewModel.results.isEmpty && !searchText.isEmpty {
                        Spacer()
                        VStack(spacing: 16) {
                            Image(systemName: "magnifyingglass")
                                .font(.system(size: 50))
                                .foregroundColor(.white.opacity(0.3))
                            
                            Text("No results found")
                                .font(.headline)
                                .foregroundColor(.white.opacity(0.6))
                            
                            Text("Try different keywords or\nuse semantic search")
                                .font(.subheadline)
                                .foregroundColor(.white.opacity(0.4))
                                .multilineTextAlignment(.center)
                        }
                        Spacer()
                    } else {
                        ScrollView {
                            LazyVStack(spacing: 12) {
                                ForEach(viewModel.results) { item in
                                    SearchResultRow(item: item, searchQuery: searchText)
                                        .onTapGesture {
                                            selectedItem = item
                                        }
                                }
                            }
                            .padding()
                        }
                    }
                }
            }
            .navigationTitle("Search")
            .navigationBarTitleDisplayMode(.large)
            .sheet(item: $selectedItem) { item in
                VideoDetailSheet(item: item)
            }
        }
    }
}

// MARK: - Search Mode
enum SearchMode: String, CaseIterable {
    case semantic
    case keyword
    
    var displayName: String {
        switch self {
        case .semantic: return "Semantic"
        case .keyword: return "Keyword"
        }
    }
    
    var icon: String {
        switch self {
        case .semantic: return "brain"
        case .keyword: return "textformat"
        }
    }
}

// MARK: - View Model
@MainActor
class SearchViewModel: ObservableObject {
    @Published var results: [SaveItem] = []
    @Published var isLoading = false
    @Published var searchMode: SearchMode = .semantic
    @Published var recentSearches: [String] = []
    @Published var error: String?
    
    let suggestions = [
        "ramen tokyo",
        "hotel room tour",
        "temple kyoto",
        "shopping haul",
        "street food",
        "ryokan experience"
    ]
    
    private let apiService = APIService.shared
    private let recentSearchesKey = "recentSearches"
    
    init() {
        loadRecentSearches()
    }
    
    func search(query: String) async {
        guard !query.isEmpty else { return }
        
        isLoading = true
        
        do {
            results = try await apiService.search(query: query, semantic: searchMode == .semantic)
            saveRecentSearch(query)
        } catch {
            self.error = error.localizedDescription
            results = []
        }
        
        isLoading = false
    }
    
    func clearResults() {
        results = []
    }
    
    func clearRecentSearches() {
        recentSearches = []
        UserDefaults.standard.removeObject(forKey: recentSearchesKey)
    }
    
    private func loadRecentSearches() {
        recentSearches = UserDefaults.standard.stringArray(forKey: recentSearchesKey) ?? []
    }
    
    private func saveRecentSearch(_ query: String) {
        var searches = recentSearches
        searches.removeAll { $0.lowercased() == query.lowercased() }
        searches.insert(query, at: 0)
        searches = Array(searches.prefix(10))
        recentSearches = searches
        UserDefaults.standard.set(searches, forKey: recentSearchesKey)
    }
}

// MARK: - Search Result Row
struct SearchResultRow: View {
    let item: SaveItem
    let searchQuery: String
    
    var body: some View {
        HStack(spacing: 14) {
            // Thumbnail
            ZStack {
                RoundedRectangle(cornerRadius: 10)
                    .fill(
                        LinearGradient(
                            colors: [.purple.opacity(0.3), .cyan.opacity(0.3)],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
                    .frame(width: 70, height: 90)
                
                Image(systemName: "play.fill")
                    .foregroundColor(.white.opacity(0.6))
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
                        Text(folderName)
                            .font(.caption)
                    }
                    .foregroundColor(.cyan)
                }
                
                // Match highlights
                if let matchContext = findMatchContext() {
                    Text(matchContext)
                        .font(.caption)
                        .foregroundColor(.white.opacity(0.5))
                        .lineLimit(2)
                }
                
                // Topics
                if !item.detectedTopics.isEmpty {
                    HStack(spacing: 6) {
                        ForEach(item.detectedTopics.prefix(3), id: \.self) { topic in
                            Text(topic)
                                .font(.caption2)
                                .padding(.horizontal, 6)
                                .padding(.vertical, 2)
                                .background(Color.white.opacity(0.1))
                                .cornerRadius(4)
                                .foregroundColor(.white.opacity(0.6))
                        }
                    }
                }
            }
            
            Spacer()
            
            Image(systemName: "chevron.right")
                .font(.caption)
                .foregroundColor(.white.opacity(0.3))
        }
        .padding(12)
        .background(Color.white.opacity(0.05))
        .cornerRadius(14)
    }
    
    private func findMatchContext() -> String? {
        guard let transcript = item.transcriptText else { return nil }
        
        let queryWords = searchQuery.lowercased().split(separator: " ")
        let transcriptLower = transcript.lowercased()
        
        for word in queryWords {
            if let range = transcriptLower.range(of: String(word)) {
                let start = transcriptLower.index(range.lowerBound, offsetBy: -30, limitedBy: transcriptLower.startIndex) ?? transcriptLower.startIndex
                let end = transcriptLower.index(range.upperBound, offsetBy: 50, limitedBy: transcriptLower.endIndex) ?? transcriptLower.endIndex
                
                var context = String(transcript[start..<end])
                if start != transcriptLower.startIndex {
                    context = "..." + context
                }
                if end != transcriptLower.endIndex {
                    context = context + "..."
                }
                return context
            }
        }
        
        return nil
    }
}

#Preview {
    SearchView()
}

