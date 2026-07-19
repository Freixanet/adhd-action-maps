import Foundation
import Supabase

@MainActor
final class AuthService: ObservableObject {
    @Published private(set) var userEmail: String?
    @Published private(set) var isConfigured = false
    @Published var authError: String?

    private let client: SupabaseClient?
    private let redirectURL = URL(string: "com.nucleo.app://login-callback")!

    init() {
        let key = AppConfiguration.supabaseAnonKey
        guard !key.isEmpty else {
            client = nil
            isConfigured = false
            return
        }
        client = SupabaseClient(supabaseURL: AppConfiguration.supabaseURL, supabaseKey: key)
        isConfigured = true
    }

    func restoreSession() async {
        guard let client else { return }
        do {
            let session = try await client.auth.session
            userEmail = session.user.email
        } catch {
            userEmail = nil
        }
    }

    func signIn(provider: Provider) async {
        guard let client else {
            authError = "La sincronización todavía no está configurada."
            return
        }
        do {
            try await client.auth.signInWithOAuth(provider: provider, redirectTo: redirectURL)
        } catch {
            authError = error.localizedDescription
        }
    }

    func handleOpenURL(_ url: URL) async {
        guard let client else { return }
        do {
            try await client.auth.session(from: url)
            userEmail = try await client.auth.session.user.email
        } catch {
            authError = error.localizedDescription
        }
    }

    func signOut() async {
        guard let client else { return }
        do {
            try await client.auth.signOut()
            userEmail = nil
        } catch {
            authError = error.localizedDescription
        }
    }

    func accessToken() async -> String? {
        guard let client else { return nil }
        return try? await client.auth.session.accessToken
    }
}
