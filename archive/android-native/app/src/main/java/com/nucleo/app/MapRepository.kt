package com.nucleo.app

import android.content.Context
import androidx.room.Room
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import java.util.UUID

class MapRepository(
    context: Context,
    private val apiClient: ApiClient,
    private val authRepository: AuthRepository,
    private val cloudSync: CloudSyncRepository
) {
    private val json = Json { ignoreUnknownKeys = true }
    private val db = Room.databaseBuilder(context, MapDatabase::class.java, "nucleo-maps").build()

    fun observeMaps(): Flow<List<ActionMap>> = db.mapDao().observeAll().map { cached ->
        cached.mapNotNull { entry ->
            runCatching { json.decodeFromString(ActionMap.serializer(), entry.payload) }.getOrNull()
        }
    }

    suspend fun syncWithCloud() {
        if (!cloudSync.isConfigured) return
        val token = authRepository.accessToken() ?: return
        val local = loadAllMaps()
        cloudSync.migrateLocalMaps(local, token)
        val remote = cloudSync.pullMaps(token)
        replaceAll(CloudSyncRepository.merge(local, remote))
    }

    suspend fun createMap(text: String): ActionMap {
        val token = authRepository.accessToken()
        val response = apiClient.transform(
            TransformRequest(text = text, type = "text"),
            accessToken = token
        )
        val payload = json.parseToJsonElement(response).jsonObject
        val title = payload["title"]?.jsonPrimitive?.content ?: "Mapa sin título"
        val category = payload["category"]?.jsonPrimitive?.content
        val now = System.currentTimeMillis()
        val map = ActionMap(
            id = UUID.randomUUID().toString(),
            title = title,
            category = category,
            sourceType = "text",
            document = response,
            createdAt = now,
            updatedAt = now
        )
        persist(map)
        if (token != null) {
            runCatching { cloudSync.pushMap(map, token) }
        }
        return map
    }

    private suspend fun loadAllMaps(): List<ActionMap> = db.mapDao().fetchAll().mapNotNull { entry ->
        runCatching { json.decodeFromString(ActionMap.serializer(), entry.payload) }.getOrNull()
    }

    private suspend fun persist(map: ActionMap) {
        db.mapDao().upsert(
            CachedMap(
                id = map.id,
                payload = json.encodeToString(ActionMap.serializer(), map),
                updatedAt = map.updatedAt
            )
        )
    }

    private suspend fun replaceAll(maps: List<ActionMap>) {
        db.mapDao().deleteAll()
        maps.forEach { persist(it) }
    }
}
