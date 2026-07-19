package com.nucleo.app

import android.app.Application

class NucleoApplication : Application() {
    lateinit var authRepository: AuthRepository
        private set
    lateinit var repository: MapRepository
        private set

    override fun onCreate() {
        super.onCreate()
        authRepository = AuthRepository()
        val cloudSync = CloudSyncRepository()
        repository = MapRepository(this, ApiClient(BuildConfig.API_BASE_URL), authRepository, cloudSync)
    }
}

fun android.content.Context.repository(): MapRepository = (applicationContext as NucleoApplication).repository

fun android.content.Context.authRepository(): AuthRepository = (applicationContext as NucleoApplication).authRepository
