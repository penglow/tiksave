import SwiftUI

struct SettingsView: View {
    @StateObject private var viewModel = SettingsViewModel()
    @EnvironmentObject var authViewModel: AuthViewModel
    @State private var showingDeleteConfirmation = false
    
    var body: some View {
        NavigationStack {
            ZStack {
                Color(red: 0.07, green: 0.07, blue: 0.12)
                    .ignoresSafeArea()
                
                List {
                    // Processing Settings
                    Section {
                        Toggle("Enable Video Upload", isOn: $viewModel.settings.enableVideoUpload)
                            .tint(.cyan)
                        
                        Toggle("Auto-file High Confidence", isOn: $viewModel.settings.autoFileHighConfidence)
                            .tint(.cyan)
                        
                        HStack {
                            Text("Confidence Threshold")
                            Spacer()
                            Text("\(Int(viewModel.settings.confidenceThreshold * 100))%")
                                .foregroundColor(.white.opacity(0.5))
                        }
                        
                        Slider(
                            value: $viewModel.settings.confidenceThreshold,
                            in: 0.5...0.95,
                            step: 0.05
                        )
                        .tint(.cyan)
                    } header: {
                        Text("Processing")
                    } footer: {
                        Text("Video upload enables richer AI analysis. Without it, classification uses only shared text and URL.")
                    }
                    
                    // Appearance
                    Section {
                        Picker("Theme", selection: $viewModel.settings.theme) {
                            ForEach(User.AppTheme.allCases, id: \.self) { theme in
                                Text(theme.displayName).tag(theme)
                            }
                        }
                        
                        Toggle("Notifications", isOn: $viewModel.settings.notificationsEnabled)
                            .tint(.cyan)
                    } header: {
                        Text("Appearance")
                    }
                    
                    // Storage
                    Section {
                        HStack {
                            Text("Cached Thumbnails")
                            Spacer()
                            Text(viewModel.thumbnailCacheSize)
                                .foregroundColor(.white.opacity(0.5))
                        }
                        
                        Button("Clear Thumbnail Cache") {
                            viewModel.clearThumbnailCache()
                        }
                        .foregroundColor(.orange)
                    } header: {
                        Text("Storage")
                    }
                    
                    // Data & Privacy
                    Section {
                        NavigationLink {
                            PrivacyPolicyView()
                        } label: {
                            Text("Privacy Policy")
                        }
                        
                        NavigationLink {
                            DataExportView()
                        } label: {
                            Text("Export My Data")
                        }
                        
                        Button("Delete All My Data") {
                            showingDeleteConfirmation = true
                        }
                        .foregroundColor(.red)
                    } header: {
                        Text("Data & Privacy")
                    } footer: {
                        Text("Deleting your data removes all saved videos, folders, and learning data permanently.")
                    }
                    
                    // About
                    Section {
                        HStack {
                            Text("Version")
                            Spacer()
                            Text("1.0.0")
                                .foregroundColor(.white.opacity(0.5))
                        }
                        
                        Link(destination: URL(string: "https://yourapp.com/support")!) {
                            HStack {
                                Text("Support")
                                Spacer()
                                Image(systemName: "arrow.up.right")
                                    .font(.caption)
                            }
                        }
                        
                        Link(destination: URL(string: "https://yourapp.com/feedback")!) {
                            HStack {
                                Text("Send Feedback")
                                Spacer()
                                Image(systemName: "arrow.up.right")
                                    .font(.caption)
                            }
                        }
                    } header: {
                        Text("About")
                    }
                    
                    // Account
                    Section {
                        Button("Sign Out") {
                            authViewModel.signOut()
                        }
                        .foregroundColor(.red)
                    } header: {
                        Text("Account")
                    }
                }
                .scrollContentBackground(.hidden)
                .listStyle(.insetGrouped)
            }
            .navigationTitle("Settings")
            .navigationBarTitleDisplayMode(.large)
            .alert("Delete All Data?", isPresented: $showingDeleteConfirmation) {
                Button("Cancel", role: .cancel) {}
                Button("Delete", role: .destructive) {
                    Task {
                        await viewModel.deleteAllData()
                    }
                }
            } message: {
                Text("This will permanently delete all your saved videos, folders, and learning data. This action cannot be undone.")
            }
            .onDisappear {
                viewModel.saveSettings()
            }
        }
    }
}

// MARK: - View Model
@MainActor
class SettingsViewModel: ObservableObject {
    @Published var settings = User.UserSettings()
    @Published var thumbnailCacheSize = "0 MB"
    
    private let cacheManager = CacheManager.shared
    
    init() {
        loadSettings()
        updateCacheSize()
    }
    
    func loadSettings() {
        if let data = UserDefaults.standard.data(forKey: "userSettings"),
           let settings = try? JSONDecoder().decode(User.UserSettings.self, from: data) {
            self.settings = settings
        }
    }
    
    func saveSettings() {
        if let data = try? JSONEncoder().encode(settings) {
            UserDefaults.standard.set(data, forKey: "userSettings")
        }
    }
    
    func updateCacheSize() {
        let bytes = cacheManager.thumbnailCacheSize()
        let mb = Double(bytes) / 1_000_000
        thumbnailCacheSize = String(format: "%.1f MB", mb)
    }
    
    func clearThumbnailCache() {
        cacheManager.clearThumbnailCache()
        updateCacheSize()
    }
    
    func deleteAllData() async {
        // TODO: Implement full data deletion via API
        clearThumbnailCache()
    }
}

// MARK: - Privacy Policy View
struct PrivacyPolicyView: View {
    var body: some View {
        ZStack {
            Color(red: 0.07, green: 0.07, blue: 0.12)
                .ignoresSafeArea()
            
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    Text("Privacy Policy")
                        .font(.title.weight(.bold))
                        .foregroundColor(.white)
                    
                    Group {
                        Text("What We Store")
                            .font(.headline)
                            .foregroundColor(.white)
                        
                        Text("""
                        • TikTok URLs you share into the app
                        • Video content (if you enable video upload)
                        • AI-generated transcripts and classifications
                        • Your folder organization
                        • Learning data from your corrections
                        """)
                        .foregroundColor(.white.opacity(0.7))
                    }
                    
                    Group {
                        Text("How We Use Your Data")
                            .font(.headline)
                            .foregroundColor(.white)
                        
                        Text("""
                        Your data is used solely to:
                        • Classify videos into folders
                        • Enable search functionality
                        • Learn from your corrections to improve accuracy
                        
                        We do not sell your data or use it for advertising.
                        """)
                        .foregroundColor(.white.opacity(0.7))
                    }
                    
                    Group {
                        Text("Data Retention")
                            .font(.headline)
                            .foregroundColor(.white)
                        
                        Text("""
                        • Your data is retained until you delete it
                        • You can delete individual items or all data
                        • Deleted data is permanently removed within 30 days
                        """)
                        .foregroundColor(.white.opacity(0.7))
                    }
                }
                .padding()
            }
        }
        .navigationBarTitleDisplayMode(.inline)
    }
}

// MARK: - Data Export View
struct DataExportView: View {
    @State private var isExporting = false
    @State private var exportComplete = false
    
    var body: some View {
        ZStack {
            Color(red: 0.07, green: 0.07, blue: 0.12)
                .ignoresSafeArea()
            
            VStack(spacing: 24) {
                Image(systemName: "arrow.down.doc.fill")
                    .font(.system(size: 60))
                    .foregroundColor(.cyan)
                
                Text("Export Your Data")
                    .font(.title2.weight(.semibold))
                    .foregroundColor(.white)
                
                Text("Download a copy of all your saved videos, folders, and settings.")
                    .font(.subheadline)
                    .foregroundColor(.white.opacity(0.6))
                    .multilineTextAlignment(.center)
                
                Button {
                    isExporting = true
                    // Simulate export
                    DispatchQueue.main.asyncAfter(deadline: .now() + 2) {
                        isExporting = false
                        exportComplete = true
                    }
                } label: {
                    HStack {
                        if isExporting {
                            ProgressView()
                                .progressViewStyle(CircularProgressViewStyle(tint: .white))
                        } else {
                            Text("Export Data")
                        }
                    }
                    .frame(maxWidth: .infinity)
                    .padding()
                    .background(Color.cyan)
                    .foregroundColor(.white)
                    .cornerRadius(14)
                }
                .disabled(isExporting)
                .padding(.horizontal, 40)
                
                if exportComplete {
                    Text("✓ Export complete! Check your downloads.")
                        .font(.subheadline)
                        .foregroundColor(.green)
                }
            }
            .padding()
        }
        .navigationTitle("Export Data")
        .navigationBarTitleDisplayMode(.inline)
    }
}

#Preview {
    SettingsView()
        .environmentObject(AuthViewModel())
}

