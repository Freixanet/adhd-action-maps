package com.nucleo.app

import android.content.Intent
import io.github.jan.supabase.auth.Auth
import io.github.jan.supabase.auth.auth
import io.github.jan.supabase.auth.handleDeeplinks
import io.github.jan.supabase.auth.providers.Apple
import io.github.jan.supabase.auth.providers.Google
import io.github.jan.supabase.createSupabaseClient
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

class AuthRepository {
    val isConfigured = BuildConfig.SUPABASE_ANON_KEY.isNotBlank()

    private val client = if (isConfigured) {
        createSupabaseClient(
            supabaseUrl = BuildConfig.SUPABASE_URL,
            supabaseKey = BuildConfig.SUPABASE_ANON_KEY
        ) {
            install(Auth) {
                scheme = "com.nucleo.app"
                host = "login-callback"
            }
        }
    } else {
        null
    }

    private val _userEmail = MutableStateFlow<String?>(null)
    val userEmail: StateFlow<String?> = _userEmail.asStateFlow()

    suspend fun restoreSession() {
        _userEmail.value = client?.auth?.currentSessionOrNull()?.user?.email
    }

    suspend fun accessToken(): String? = client?.auth?.currentSessionOrNull()?.accessToken

    suspend fun signInWithGoogle() {
        client?.auth?.signInWith(Google) ?: throw IllegalStateException("La sincronización todavía no está configurada.")
    }

    suspend fun signInWithApple() {
        client?.auth?.signInWith(Apple) ?: throw IllegalStateException("La sincronización todavía no está configurada.")
    }

    suspend fun signOut() {
        client?.auth?.signOut()
        _userEmail.value = null
    }

    suspend fun handleDeepLink(intent: Intent) {
        val activeClient = client ?: return
        activeClient.handleDeeplinks(intent)
        _userEmail.value = activeClient.auth.currentSessionOrNull()?.user?.email
    }
}
