import SwiftUI
import PhotosUI
import SwiftData

private struct TransformSummary: Decodable {
    let title: String
    let category: String?
}

@MainActor
final class MapStore: ObservableObject {
    @Published var maps: [ActionMap] = []
    @Published var currentMap: ActionMap?
    @Published var isLoading = false
    @Published var errorMessage: String?
    @Published var syncError: String?

    private let client = APIClient()
    private let authService: AuthService
    private let cloudSync: CloudSyncService? = CloudSyncService()
    private var modelContext: ModelContext?

    init(authService: AuthService) {
        self.authService = authService
    }

    func attach(context: ModelContext) {
        modelContext = context
        loadCached()
    }

    func loadCached() {
        guard let modelContext else { return }
        let descriptor = FetchDescriptor<CachedMap>(
            sortBy: [SortDescriptor(\.updatedAt, order: .reverse)]
        )
        guard let cached = try? modelContext.fetch(descriptor) else { return }
        maps = cached.compactMap { try? $0.decode() }
    }

    func syncWithCloud() async {
        guard let cloudSync, await authService.accessToken() != nil else { return }
        guard let token = await authService.accessToken() else { return }

        do {
            try await cloudSync.migrateLocalMaps(maps, accessToken: token)
            let remote = try await cloudSync.pullMaps(accessToken: token)
            let merged = CloudSyncService.merge(local: maps, remote: remote)
            try replaceLocalMaps(merged)
            syncError = nil
        } catch {
            syncError = "No se pudo sincronizar. Se conservará en este dispositivo."
        }
    }

    func create(text: String, imageData: Data? = nil) async {
        isLoading = true
        defer { isLoading = false }

        do {
            let token = await authService.accessToken()
            let request = TransformRequest(
                text: text.isEmpty ? nil : text,
                type: imageData == nil ? "text" : "image",
                fileData: imageData?.base64EncodedString(),
                mimeType: imageData == nil ? nil : "image/jpeg",
                preferredModel: "auto"
            )
            let document = try await client.transform(request, accessToken: token)
            let summary = try JSONDecoder().decode(TransformSummary.self, from: document)
            let now = Date()
            let map = ActionMap(
                id: UUID().uuidString,
                title: summary.title,
                category: summary.category,
                pinnedAt: nil,
                sourceType: imageData == nil ? "text" : "file",
                document: document,
                currentStep: 0,
                isComplete: false,
                viewAll: false,
                createdAt: now,
                updatedAt: now
            )
            maps.insert(map, at: 0)
            currentMap = map
            try persist(map)
            if let cloudSync, let token {
                try? await cloudSync.pushMap(map, accessToken: token)
            }
        } catch {
            errorMessage = "No se pudo crear el mapa. \(error.localizedDescription)"
        }
    }

    private func persist(_ map: ActionMap) throws {
        guard let modelContext else { return }
        modelContext.insert(try CachedMap(map: map))
        try modelContext.save()
    }

    private func replaceLocalMaps(_ merged: [ActionMap]) throws {
        guard let modelContext else { return }
        let existing = try modelContext.fetch(FetchDescriptor<CachedMap>())
        existing.forEach { modelContext.delete($0) }
        for map in merged {
            modelContext.insert(try CachedMap(map: map))
        }
        try modelContext.save()
        maps = merged
    }
}

struct RootView: View {
    private enum Tab: Hashable {
        case newMap
        case history
    }

    @EnvironmentObject private var authService: AuthService
    @EnvironmentObject private var store: MapStore
    @Environment(\.modelContext) private var modelContext
    @State private var text = ""
    @State private var pickedPhoto: PhotosPickerItem?
    @State private var showingDocumentPicker = false
    @State private var selectedTab: Tab = .newMap

    var body: some View {
        TabView(selection: $selectedTab) {
            NavigationStack {
                Form {
                    Section("Nuevo mapa") {
                        TextEditor(text: $text).frame(minHeight: 180)
                        PhotosPicker("Añadir foto", selection: $pickedPhoto, matching: .images)
                        Button("Seleccionar documento") { showingDocumentPicker = true }
                        Button(store.isLoading ? "Creando mapa…" : "Crear mapa") {
                            Task { await store.create(text: text) }
                        }
                        .disabled(text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || store.isLoading)
                    }

                    if authService.isConfigured {
                        Section("Cuenta") {
                            if let email = authService.userEmail {
                                Text("Sincronizado como \(email)")
                                Button("Cerrar sesión") {
                                    Task {
                                        await authService.signOut()
                                        store.loadCached()
                                    }
                                }
                            } else {
                                Button("Continuar con Google") {
                                    Task { await authService.signIn(provider: .google) }
                                }
                                Button("Continuar con Apple") {
                                    Task { await authService.signIn(provider: .apple) }
                                }
                            }
                        }
                    }
                }
                .navigationTitle("Núcleo")
                .sheet(isPresented: $showingDocumentPicker) {
                    DocumentPicker { _ in showingDocumentPicker = false }
                }
            }
            .tabItem { Label("Nuevo", systemImage: "square.and.pencil") }
            .tag(Tab.newMap)

            NavigationStack {
                List(store.maps) { map in
                    Button(map.title) { store.currentMap = map }
                }
                .navigationTitle("Historial")
                .safeAreaInset(edge: .bottom, alignment: .trailing, spacing: 0) {
                    NewMapGlassButton {
                        text = ""
                        pickedPhoto = nil
                        selectedTab = .newMap
                    }
                    .padding(.trailing, 16)
                    .padding(.top, 8)
                    .padding(.bottom, 8)
                }
            }
            .tabItem { Label("Historial", systemImage: "clock") }
            .tag(Tab.history)
        }
        .onAppear { store.attach(context: modelContext) }
        .task {
            await authService.restoreSession()
            if authService.userEmail != nil {
                await store.syncWithCloud()
            }
        }
        .onChange(of: authService.userEmail) { _, email in
            guard email != nil else { return }
            Task { await store.syncWithCloud() }
        }
        .task(id: pickedPhoto) {
            guard let data = try? await pickedPhoto?.loadTransferable(type: Data.self) else { return }
            await store.create(text: text, imageData: data)
        }
        .alert("Núcleo", isPresented: Binding(
            get: { store.errorMessage != nil },
            set: { if !$0 { store.errorMessage = nil } }
        )) {
            Button("Aceptar", role: .cancel) {}
        } message: {
            Text(store.errorMessage ?? "")
        }
        .alert("Sincronización", isPresented: Binding(
            get: { store.syncError != nil },
            set: { if !$0 { store.syncError = nil } }
        )) {
            Button("Aceptar", role: .cancel) {}
        } message: {
            Text(store.syncError ?? "")
        }
    }
}
