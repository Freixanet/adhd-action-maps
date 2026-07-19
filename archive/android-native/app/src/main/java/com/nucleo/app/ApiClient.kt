package com.nucleo.app

import io.ktor.client.HttpClient
import io.ktor.client.call.body
import io.ktor.client.engine.okhttp.OkHttp
import io.ktor.client.plugins.contentnegotiation.ContentNegotiation
import io.ktor.client.request.header
import io.ktor.client.request.post
import io.ktor.client.request.setBody
import io.ktor.http.ContentType
import io.ktor.http.contentType
import io.ktor.serialization.kotlinx.json.json
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json

@Serializable data class TransformRequest(val text: String? = null, val type: String, val fileData: String? = null, val mimeType: String? = null, val preferredModel: String = "auto")

class ApiClient(private val baseUrl: String) {
    private val client = HttpClient(OkHttp) { install(ContentNegotiation) { json(Json { ignoreUnknownKeys = true }) } }
    suspend fun transform(request: TransformRequest, accessToken: String? = null): String = client.post("$baseUrl/api/transform") {
        contentType(ContentType.Application.Json)
        if (accessToken != null) header("Authorization", "Bearer $accessToken")
        setBody(request)
    }.body()
}
