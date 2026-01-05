import SwiftUI

struct ContentView: View {
    @EnvironmentObject var appState: AppState
    @StateObject private var authViewModel = AuthViewModel()
    
    var body: some View {
        Group {
            if authViewModel.isAuthenticated {
                MainTabView()
            } else {
                AuthView()
            }
        }
        .environmentObject(authViewModel)
    }
}

// MARK: - Main Tab View
struct MainTabView: View {
    @EnvironmentObject var appState: AppState
    
    var body: some View {
        TabView(selection: $appState.selectedTab) {
            InboxView()
                .tabItem {
                    Label("Inbox", systemImage: "tray.fill")
                }
                .tag(AppState.Tab.inbox)
                .badge(appState.unreadInboxCount)
            
            FoldersView()
                .tabItem {
                    Label("Folders", systemImage: "folder.fill")
                }
                .tag(AppState.Tab.folders)
            
            SearchView()
                .tabItem {
                    Label("Search", systemImage: "magnifyingglass")
                }
                .tag(AppState.Tab.search)
            
            SettingsView()
                .tabItem {
                    Label("Settings", systemImage: "gearshape.fill")
                }
                .tag(AppState.Tab.settings)
        }
        .tint(Color("AccentColor"))
    }
}

// MARK: - Auth View Model
@MainActor
class AuthViewModel: ObservableObject {
    @Published var isAuthenticated = false
    @Published var isLoading = false
    @Published var error: String?
    
    private let apiService = APIService.shared
    
    init() {
        isAuthenticated = apiService.isAuthenticated
    }
    
    func signIn(email: String, password: String) async {
        isLoading = true
        error = nil
        
        do {
            _ = try await apiService.signIn(email: email, password: password)
            isAuthenticated = true
        } catch {
            self.error = error.localizedDescription
        }
        
        isLoading = false
    }
    
    func signUp(email: String, password: String) async {
        isLoading = true
        error = nil
        
        do {
            _ = try await apiService.signUp(email: email, password: password)
            isAuthenticated = true
        } catch {
            self.error = error.localizedDescription
        }
        
        isLoading = false
    }
    
    func signOut() {
        apiService.signOut()
        isAuthenticated = false
    }
}

// MARK: - Auth View
struct AuthView: View {
    @EnvironmentObject var authViewModel: AuthViewModel
    @State private var email = ""
    @State private var password = ""
    @State private var isSignUp = false
    
    var body: some View {
        NavigationStack {
            ZStack {
                // Background gradient
                LinearGradient(
                    colors: [
                        Color(red: 0.07, green: 0.07, blue: 0.12),
                        Color(red: 0.12, green: 0.08, blue: 0.18)
                    ],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )
                .ignoresSafeArea()
                
                VStack(spacing: 32) {
                    Spacer()
                    
                    // Logo & Title
                    VStack(spacing: 16) {
                        ZStack {
                            Circle()
                                .fill(
                                    LinearGradient(
                                        colors: [.cyan, .purple],
                                        startPoint: .topLeading,
                                        endPoint: .bottomTrailing
                                    )
                                )
                                .frame(width: 100, height: 100)
                                .blur(radius: 20)
                            
                            Image(systemName: "play.rectangle.fill")
                                .font(.system(size: 50))
                                .foregroundStyle(
                                    LinearGradient(
                                        colors: [.cyan, .purple],
                                        startPoint: .topLeading,
                                        endPoint: .bottomTrailing
                                    )
                                )
                        }
                        
                        Text("TikSave")
                            .font(.system(size: 42, weight: .black, design: .rounded))
                            .foregroundColor(.white)
                        
                        Text("Organize your TikTok saves\nwith AI-powered folders")
                            .font(.system(size: 16, weight: .medium))
                            .foregroundColor(.white.opacity(0.7))
                            .multilineTextAlignment(.center)
                    }
                    
                    Spacer()
                    
                    // Auth Form
                    VStack(spacing: 16) {
                        TextField("", text: $email, prompt: Text("Email").foregroundColor(.white.opacity(0.5)))
                            .textContentType(.emailAddress)
                            .keyboardType(.emailAddress)
                            .autocapitalization(.none)
                            .padding()
                            .background(Color.white.opacity(0.1))
                            .cornerRadius(14)
                            .foregroundColor(.white)
                        
                        SecureField("", text: $password, prompt: Text("Password").foregroundColor(.white.opacity(0.5)))
                            .textContentType(isSignUp ? .newPassword : .password)
                            .padding()
                            .background(Color.white.opacity(0.1))
                            .cornerRadius(14)
                            .foregroundColor(.white)
                        
                        if let error = authViewModel.error {
                            Text(error)
                                .font(.caption)
                                .foregroundColor(.red)
                                .padding(.horizontal)
                        }
                        
                        Button {
                            Task {
                                if isSignUp {
                                    await authViewModel.signUp(email: email, password: password)
                                } else {
                                    await authViewModel.signIn(email: email, password: password)
                                }
                            }
                        } label: {
                            HStack {
                                if authViewModel.isLoading {
                                    ProgressView()
                                        .progressViewStyle(CircularProgressViewStyle(tint: .white))
                                } else {
                                    Text(isSignUp ? "Create Account" : "Sign In")
                                        .font(.headline)
                                }
                            }
                            .frame(maxWidth: .infinity)
                            .padding()
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
                        .disabled(email.isEmpty || password.isEmpty || authViewModel.isLoading)
                        
                        Button {
                            isSignUp.toggle()
                        } label: {
                            Text(isSignUp ? "Already have an account? Sign In" : "Don't have an account? Sign Up")
                                .font(.subheadline)
                                .foregroundColor(.white.opacity(0.7))
                        }
                    }
                    .padding(.horizontal, 24)
                    
                    Spacer()
                }
            }
        }
    }
}

#Preview {
    ContentView()
        .environmentObject(AppState())
}

