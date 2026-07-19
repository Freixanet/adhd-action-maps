import Foundation

enum AppConfiguration {
    // Replace these values through an xcconfig excluded from source control.
    static let apiBaseURL = URL(string: ProcessInfo.processInfo.environment["NUCLEO_API_URL"] ?? "https://optimizador-tdah-production.up.railway.app")!
    static let supabaseURL = URL(string: ProcessInfo.processInfo.environment["SUPABASE_URL"] ?? "https://your-project.supabase.co")!
    static let supabaseAnonKey = ProcessInfo.processInfo.environment["SUPABASE_ANON_KEY"] ?? ""
}
