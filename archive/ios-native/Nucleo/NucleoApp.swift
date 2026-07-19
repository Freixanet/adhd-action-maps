import SwiftUI
import SwiftData

@main
struct NucleoApp: App {
    @StateObject private var authService = AuthService()
    @StateObject private var store: MapStore

    init() {
        let auth = AuthService()
        _authService = StateObject(wrappedValue: auth)
        _store = StateObject(wrappedValue: MapStore(authService: auth))
    }

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(authService)
                .environmentObject(store)
                .onOpenURL { url in
                    Task { await authService.handleOpenURL(url) }
                }
        }
        .modelContainer(for: CachedMap.self)
    }
}
