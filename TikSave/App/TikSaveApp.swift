import SwiftUI

@main
struct TikSaveApp: App {
    @StateObject private var appState = AppState()
    @StateObject private var dataController = DataController.shared
    
    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(appState)
                .environment(\.managedObjectContext, dataController.container.viewContext)
                .onAppear {
                    // Check for new items from share extension
                    appState.checkForNewSharedItems()
                }
                .onReceive(NotificationCenter.default.publisher(for: UIApplication.willEnterForegroundNotification)) { _ in
                    appState.checkForNewSharedItems()
                }
        }
    }
}

