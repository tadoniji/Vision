package com.vision.app

import android.annotation.SuppressLint
import android.os.Bundle
import android.webkit.JavascriptInterface
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.unit.dp
import coil.compose.AsyncImage
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import retrofit2.http.GET
import retrofit2.http.Query

// --- TMDB API ---
// REMPLACEZ CETTE CLÉ PAR LA VÔTRE
const val TMDB_API_KEY = "0e6cf9686697496bc8cafef543dd11fe" 

data class TmdbResult(val results: List<MediaItem>)
data class MediaItem(
    val id: Int,
    val title: String?,
    val name: String?,
    val poster_path: String?,
    val media_type: String?
)

interface TmdbApi {
    @GET("search/multi")
    suspend fun search(@Query("api_key") key: String, @Query("query") query: String): TmdbResult
}

val retrofit = Retrofit.Builder()
    .baseUrl("https://api.themoviedb.org/3/")
    .addConverterFactory(GsonConverterFactory.create())
    .build()
val tmdbApi = retrofit.create(TmdbApi::class.java)

// --- MAIN ACTIVITY ---
class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        setContent {
            VisionApp()
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun VisionApp() {
    var query by remember { mutableStateOf("") }
    var results by remember { mutableStateOf<List<MediaItem>>(emptyList()) }
    var loading by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()

    // Theme sombre simple
    MaterialTheme(
        colorScheme = darkColorScheme(
            background = Color(0xFF0F172A),
            surface = Color(0xFF1E293B),
            onSurface = Color.White
        )
    ) {
        Column(
            modifier = Modifier.fillMaxSize().background(MaterialTheme.colorScheme.background).padding(16.dp)
        ) {
            Text("VISION MOBILE", style = MaterialTheme.typography.headlineMedium, color = Color(0xFF38BDF8))
            
            Spacer(modifier = Modifier.height(16.dp))

            // Recherche
            OutlinedTextField(
                value = query,
                onValueChange = { query = it },
                label = { Text("Rechercher un film/série") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
                keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search),
                keyboardActions = KeyboardActions(onSearch = {
                    scope.launch {
                        loading = true
                        try {
                            val res = withContext(Dispatchers.IO) {
                                tmdbApi.search(TMDB_API_KEY, query)
                            }
                            results = res.results.filter { it.media_type == "movie" || it.media_type == "tv" }
                        } catch (e: Exception) {
                            // Erreur
                        }
                        loading = false
                    }
                })
            )

            Spacer(modifier = Modifier.height(16.dp))

            if (loading) {
                CircularProgressIndicator(modifier = Modifier.align(Alignment.CenterHorizontally))
            }

            // Liste Résultats
            LazyColumn(
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                items(results) { item ->
                    MediaCard(item)
                }
            }
        }
    }
}

@Composable
fun MediaCard(item: MediaItem) {
    Card(
        modifier = Modifier.fillMaxWidth().height(120.dp).clickable { /* TODO: Lancer scraping */ },
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
    ) {
        Row {
            AsyncImage(
                model = "https://image.tmdb.org/t/p/w200${item.poster_path}",
                contentDescription = null,
                modifier = Modifier.width(80.dp).fillMaxHeight(),
                contentScale = ContentScale.Crop
            )
            Column(modifier = Modifier.padding(10.dp)) {
                Text(item.title ?: item.name ?: "???", style = MaterialTheme.typography.titleMedium, color = Color.White)
                Text(item.media_type?.uppercase() ?: "", style = MaterialTheme.typography.bodySmall, color = Color.Gray)
            }
        }
    }
}
