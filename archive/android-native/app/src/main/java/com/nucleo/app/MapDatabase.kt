package com.nucleo.app

import androidx.room.Dao
import androidx.room.Database
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.RoomDatabase
import kotlinx.coroutines.flow.Flow

@Dao
interface MapDao {
    @Query("SELECT * FROM maps ORDER BY updatedAt DESC") fun observeAll(): Flow<List<CachedMap>>
    @Query("SELECT * FROM maps ORDER BY updatedAt DESC") suspend fun fetchAll(): List<CachedMap>
    @Insert(onConflict = OnConflictStrategy.REPLACE) suspend fun upsert(map: CachedMap)
    @Query("DELETE FROM maps WHERE id = :id") suspend fun delete(id: String)
    @Query("DELETE FROM maps") suspend fun deleteAll()
}

@Database(entities = [CachedMap::class], version = 1)
abstract class MapDatabase : RoomDatabase() { abstract fun mapDao(): MapDao }
