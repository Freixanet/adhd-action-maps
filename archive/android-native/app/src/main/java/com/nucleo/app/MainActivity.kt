package com.nucleo.app

import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.History
import androidx.compose.material.icons.outlined.NoteAdd
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.lifecycleScope
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.compose.*
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.launch

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        lifecycleScope.launch {
            authRepository().handleDeepLink(intent)
        }
        setContent { MaterialTheme { NucleoApp() } }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        lifecycleScope.launch {
            authRepository().handleDeepLink(intent)
        }
    }
}

@Composable
private fun NucleoApp() {
    val nav = rememberNavController()
    val viewModel = rememberMapViewModel()
    Scaffold(bottomBar = {
        NavigationBar {
            NavigationBarItem(
                selected = false,
                onClick = { nav.navigate("new") },
                icon = { Icon(Icons.Outlined.NoteAdd, contentDescription = null) },
                label = { Text("Nuevo") }
            )
            NavigationBarItem(
                selected = false,
                onClick = { nav.navigate("history") },
                icon = { Icon(Icons.Outlined.History, contentDescription = null) },
                label = { Text("Historial") }
            )
        }
    }) { padding ->
        NavHost(navController = nav, startDestination = "new", modifier = Modifier.padding(padding)) {
            composable("new") { CreateMapScreen(viewModel) }
            composable("history") { HistoryScreen(viewModel) }
        }
    }
}

@Composable
private fun rememberMapViewModel(): MapViewModel {
    val context = LocalContext.current
    return viewModel(factory = object : ViewModelProvider.Factory {
        override fun <T : ViewModel> create(modelClass: Class<T>): T {
            @Suppress("UNCHECKED_CAST")
            return MapViewModel(context.repository(), context.authRepository()) as T
        }
    })
}

@Composable
private fun CreateMapScreen(viewModel: MapViewModel) {
    var text by rememberSaveable { mutableStateOf("") }
    val isLoading by viewModel.isLoading.collectAsStateWithLifecycle()
    val errorMessage by viewModel.errorMessage.collectAsStateWithLifecycle()
    val syncError by viewModel.syncError.collectAsStateWithLifecycle()
    val userEmail by viewModel.userEmail.collectAsStateWithLifecycle()
    val isCloudConfigured = viewModel.isCloudConfigured

    Column(Modifier.fillMaxSize().padding(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text("Núcleo", style = MaterialTheme.typography.headlineMedium)
        OutlinedTextField(
            value = text,
            onValueChange = { text = it },
            label = { Text("Pega texto o un enlace") },
            modifier = Modifier.fillMaxWidth().weight(1f)
        )
        Button(
            onClick = { viewModel.createMap(text) },
            modifier = Modifier.fillMaxWidth(),
            enabled = text.isNotBlank() && !isLoading
        ) {
            Text(if (isLoading) "Creando mapa…" else "Crear mapa")
        }

        if (isCloudConfigured) {
            HorizontalDivider()
            if (userEmail != null) {
                Text("Sincronizado como $userEmail")
                TextButton(onClick = { viewModel.signOut() }) { Text("Cerrar sesión") }
            } else {
                TextButton(onClick = { viewModel.signInWithGoogle() }) { Text("Continuar con Google") }
                TextButton(onClick = { viewModel.signInWithApple() }) { Text("Continuar con Apple") }
            }
        }
    }

    if (errorMessage != null) {
        AlertDialog(
            onDismissRequest = { viewModel.clearError() },
            confirmButton = { TextButton(onClick = { viewModel.clearError() }) { Text("Aceptar") } },
            title = { Text("Núcleo") },
            text = { Text(errorMessage ?: "") }
        )
    }

    if (syncError != null) {
        AlertDialog(
            onDismissRequest = { viewModel.clearSyncError() },
            confirmButton = { TextButton(onClick = { viewModel.clearSyncError() }) { Text("Aceptar") } },
            title = { Text("Sincronización") },
            text = { Text(syncError ?: "") }
        )
    }
}

@Composable
private fun HistoryScreen(viewModel: MapViewModel) {
    val maps by viewModel.maps.collectAsStateWithLifecycle(emptyList())

    Column(Modifier.fillMaxSize().padding(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text("Historial", style = MaterialTheme.typography.headlineMedium)
        if (maps.isEmpty()) {
            Text("Tus mapas generados aparecerán aquí.")
        } else {
            maps.forEach { map ->
                Text(map.title, style = MaterialTheme.typography.titleMedium)
            }
        }
    }
}

class MapViewModel(
    private val repository: MapRepository,
    private val authRepository: AuthRepository
) : ViewModel() {
    private val _isLoading = MutableStateFlow(false)
    val isLoading = _isLoading
    private val _errorMessage = MutableStateFlow<String?>(null)
    val errorMessage = _errorMessage
    private val _syncError = MutableStateFlow<String?>(null)
    val syncError = _syncError
    val maps = repository.observeMaps()
    val userEmail = authRepository.userEmail
    val isCloudConfigured = authRepository.isConfigured

    init {
        viewModelScope.launch {
            authRepository.restoreSession()
            if (authRepository.userEmail.value != null) {
                syncWithCloud()
            }
        }
        viewModelScope.launch {
            var previousEmail: String? = authRepository.userEmail.value
            authRepository.userEmail.collect { email ->
                if (previousEmail == null && email != null) {
                    syncWithCloud()
                }
                previousEmail = email
            }
        }
    }

    fun createMap(text: String) {
        viewModelScope.launch {
            _isLoading.value = true
            try {
                repository.createMap(text.trim())
                _errorMessage.value = null
            } catch (error: Exception) {
                _errorMessage.value = "No se pudo crear el mapa. ${error.message ?: ""}".trim()
            } finally {
                _isLoading.value = false
            }
        }
    }

    fun syncWithCloud() {
        viewModelScope.launch {
            try {
                repository.syncWithCloud()
                _syncError.value = null
            } catch (_: Exception) {
                _syncError.value = "No se pudo sincronizar. Se conservará en este dispositivo."
            }
        }
    }

    fun signInWithGoogle() {
        viewModelScope.launch {
            try {
                authRepository.signInWithGoogle()
            } catch (error: Exception) {
                _errorMessage.value = error.message
            }
        }
    }

    fun signInWithApple() {
        viewModelScope.launch {
            try {
                authRepository.signInWithApple()
            } catch (error: Exception) {
                _errorMessage.value = error.message
            }
        }
    }

    fun signOut() {
        viewModelScope.launch { authRepository.signOut() }
    }

    fun clearError() {
        _errorMessage.value = null
    }

    fun clearSyncError() {
        _syncError.value = null
    }
}
