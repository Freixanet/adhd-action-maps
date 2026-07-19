package com.nucleo.app

import io.ktor.client.HttpClient
import io.ktor.client.engine.android.Android
import io.ktor.client.request.get
import io.ktor.client.request.header
import io.ktor.client.request.post
import io.ktor.client.request.setBody
import io.ktor.client.request.url
import io.ktor.client.statement.bodyAsText
import io.ktor.http.ContentType
import io.ktor.http.contentType
import io.ktor.http.isSuccess
import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.builtins.ListSerializer
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import java.time.Instant

class CloudSyncRepository {
    val isConfigured = BuildConfig.SUPABASE_ANON_KEY.isNotBlank()

    private val json = Json { ignoreUnknownKeys = true }
    private val client = HttpClient(Android)
    private val baseUrl = BuildConfig.SUPABASE_URL.trimEnd('/')

    suspend fun migrateLocalMaps(maps: List<ActionMap>, accessToken: String) {
        if (maps.isEmpty()) return
        upsertMaps(maps, accessToken)
    }

    suspend fun pullMaps(accessToken: String): List<ActionMap> {
        val response = client.get("$baseUrl/rest/v1/maps") {
            header("apikey", BuildConfig.SUPABASE_ANON_KEY)
            header("Authorization", "Bearer $accessToken")
            url {
                parameters.append(
                    "select",
                    "id,title,category,pinned_at,source_type,session,created_at,updated_at"
                )
                parameters.append("order", "updated_at.desc")
            }
        }
        if (!response.status.isSuccess()) error("No se pudo descargar el historial.")
        val rows = json.decodeFromString<List<CloudMapRow>>(response.bodyAsText())
        return rows.map { it.toActionMap(json) }
    }

    suspend fun pushMap(map: ActionMap, accessToken: String) {
        upsertMaps(listOf(map), accessToken)
    }

    private suspend fun upsertMaps(maps: List<ActionMap>, accessToken: String) {
        val payload = maps.map { it.toCloudPayload(json) }
        val response = client.post("$baseUrl/rest/v1/maps") {
            contentType(ContentType.Application.Json)
            header("apikey", BuildConfig.SUPABASE_ANON_KEY)
            header("Authorization", "Bearer $accessToken")
            header("Prefer", "resolution=merge-duplicates")
            setBody(json.encodeToString(ListSerializer(JsonObject.serializer()), payload))
        }
        if (!response.status.isSuccess()) error("No se pudo subir el historial.")
    }

    companion object {
        fun merge(local: List<ActionMap>, remote: List<ActionMap>): List<ActionMap> {
            val merged = linkedMapOf<String, ActionMap>()
            (local + remote).forEach { map ->
                val existing = merged[map.id]
                if (existing == null || map.updatedAt > existing.updatedAt) {
                    merged[map.id] = map
                }
            }
            return merged.values.sortedByDescending { it.updatedAt }.take(30)
        }
    }
}

@Serializable
private data class CloudSessionRow(
    val data: JsonElement,
    val currentStep: Int,
    val isComplete: Boolean,
    val viewAll: Boolean
)

@Serializable
private data class CloudMapRow(
    val id: String,
    val title: String,
    val category: String? = null,
    val pinned_at: String? = null,
    val source_type: String,
    val session: CloudSessionRow,
    val created_at: String,
    val updated_at: String
) {
    fun toActionMap(json: Json): ActionMap {
        val document = json.encodeToString(session.data)
        return ActionMap(
            id = id,
            title = title,
            category = category,
            pinnedAt = pinned_at?.let { runCatching { Instant.parse(it).toEpochMilli() }.getOrNull() },
            sourceType = source_type,
            document = document,
            currentStep = session.currentStep,
            isComplete = session.isComplete,
            viewAll = session.viewAll,
            createdAt = Instant.parse(created_at).toEpochMilli(),
            updatedAt = Instant.parse(updated_at).toEpochMilli()
        )
    }
}

private fun ActionMap.toCloudPayload(json: Json): JsonObject {
    val dataObject = json.parseToJsonElement(document)
    return buildJsonObject {
        put("id", id)
        put("title", title)
        category?.let { put("category", it) }
        pinnedAt?.let { put("pinned_at", Instant.ofEpochMilli(it).toString()) }
        put("source_type", sourceType)
        put(
            "session",
            buildJsonObject {
                put("data", dataObject)
                put("currentStep", currentStep)
                put("isComplete", isComplete)
                put("viewAll", viewAll)
            }
        )
        put("created_at", Instant.ofEpochMilli(createdAt).toString())
        put("updated_at", Instant.ofEpochMilli(updatedAt).toString())
    }
}
