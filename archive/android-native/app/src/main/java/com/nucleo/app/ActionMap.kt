package com.nucleo.app

import androidx.room.Entity
import androidx.room.PrimaryKey
import kotlinx.serialization.Serializable

@Serializable
data class ActionMap(
    val id: String,
    val title: String,
    val category: String? = null,
    val pinnedAt: Long? = null,
    val sourceType: String,
    val document: String,
    val currentStep: Int = 0,
    val isComplete: Boolean = false,
    val viewAll: Boolean = false,
    val createdAt: Long,
    val updatedAt: Long
)

@Entity(tableName = "maps")
data class CachedMap(@PrimaryKey val id: String, val payload: String, val updatedAt: Long)
