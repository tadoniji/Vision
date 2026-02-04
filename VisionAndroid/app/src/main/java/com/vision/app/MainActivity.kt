package com.vision.app

import android.annotation.SuppressLint
import android.net.Uri
import android.os.Bundle
import android.util.Log
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import coil.compose.AsyncImage
import com.google.gson.Gson
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import retrofit2.http.GET
import retrofit2.http.Path
import retrofit2.http.Query

// --- TMDB API ---
const val TMDB_API_KEY = "0e6cf9686697496bc8cafef543dd11fe"

data class TmdbResult(val results: List<MediaItem>)
data class MediaItem(
    val id: Int,
    val title: String?,
    val name: String?,
    val poster_path: String?,
    val backdrop_path: String?,
    val media_type: String?,
    val overview: String?,
    val release_date: String?,
    val first_air_date: String?
)

data class Season(val id: Int, val name: String, val season_number: Int, val episode_count: Int)
data class TvShowDetail(val id: Int, val name: String, val seasons: List<Season>)
data class Episode(val id: Int, val name: String, val episode_number: Int, val still_path: String?)
data class SeasonDetail(val episodes: List<Episode>)

interface TmdbApi {
    @GET("search/multi")
    suspend fun search(@Query("api_key") key: String, @Query("query") query: String): TmdbResult

    @GET("tv/{series_id}")
    suspend fun getTvDetails(@Path("series_id") id: Int, @Query("api_key") key: String): TvShowDetail

    @GET("tv/{series_id}/season/{season_number}")
    suspend fun getSeasonDetails(
        @Path("series_id") id: Int,
        @Path("season_number") season: Int,
        @Query("api_key") key: String
    ): SeasonDetail
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

@Composable
fun VisionApp() {
    val navController = rememberNavController()

    MaterialTheme(
        colorScheme = darkColorScheme(
            background = Color(0xFF0F172A),
            surface = Color(0xFF1E293B),
            onSurface = Color.White,
            primary = Color(0xFF38BDF8)
        )
    ) {
        NavHost(navController = navController, startDestination = "home") {
            composable("home") { HomeScreen(navController) }
            composable("detail/{type}/{id}/{title}/{poster}") { backStackEntry ->
                val type = backStackEntry.arguments?.getString("type") ?: "movie"
                val id = backStackEntry.arguments?.getString("id")?.toInt() ?: 0
                val title = Uri.decode(backStackEntry.arguments?.getString("title") ?: "")
                val poster = Uri.decode(backStackEntry.arguments?.getString("poster") ?: "")
                
                DetailScreen(navController, type, id, title, poster)
            }
        }
    }
}

// --- HOME SCREEN ---
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HomeScreen(navController: NavController) {
    var query by remember { mutableStateOf("") }
    var results by remember { mutableStateOf<List<MediaItem>>(emptyList()) }
    var loading by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()

    Column(
        modifier = Modifier.fillMaxSize().background(MaterialTheme.colorScheme.background).padding(16.dp)
    ) {
        Text("VISION", style = MaterialTheme.typography.headlineLarge, color = MaterialTheme.colorScheme.primary, fontWeight = FontWeight.Bold)
        
        Spacer(modifier = Modifier.height(16.dp))

        OutlinedTextField(
            value = query,
            onValueChange = { query = it },
            label = { Text("Films, Séries, Animes...") },
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
                        e.printStackTrace()
                    }
                    loading = false
                }
            })
        )

        Spacer(modifier = Modifier.height(16.dp))

        if (loading) {
            Box(modifier = Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
                CircularProgressIndicator()
            }
        }

        LazyColumn(
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            items(results) { item ->
                MediaCard(item) {
                    val encodedTitle = Uri.encode(item.title ?: item.name)
                    val encodedPoster = Uri.encode(item.poster_path ?: "")
                    navController.navigate("detail/${item.media_type}/${item.id}/$encodedTitle/$encodedPoster")
                }
            }
        }
    }
}

@Composable
fun MediaCard(item: MediaItem, onClick: () -> Unit) {
    Card(
        modifier = Modifier.fillMaxWidth().height(140.dp).clickable { onClick() },
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 4.dp)
    ) {
        Row {
            AsyncImage(
                model = "https://image.tmdb.org/t/p/w300${item.poster_path}",
                contentDescription = null,
                modifier = Modifier.width(95.dp).fillMaxHeight(),
                contentScale = ContentScale.Crop
            )
            Column(modifier = Modifier.padding(12.dp).weight(1f)) {
                Text(
                    item.title ?: item.name ?: "???", 
                    style = MaterialTheme.typography.titleMedium, 
                    fontWeight = FontWeight.Bold,
                    color = Color.White,
                    maxLines = 2
                )
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    (item.release_date ?: item.first_air_date ?: "").take(4), 
                    style = MaterialTheme.typography.bodySmall, 
                    color = Color.Gray
                )
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    item.overview ?: "", 
                    style = MaterialTheme.typography.bodySmall, 
                    color = Color.LightGray,
                    maxLines = 3
                )
            }
        }
    }
}

// --- DETAIL SCREEN ---
@Composable
fun DetailScreen(navController: NavController, type: String, id: Int, title: String, posterPath: String) {
    val scope = rememberCoroutineScope()
    var seasons by remember { mutableStateOf<List<Season>>(emptyList()) }
    var selectedSeason by remember { mutableStateOf<Season?>(null) }
    var episodes by remember { mutableStateOf<List<Episode>>(emptyList()) }
    var loadingDetails by remember { mutableStateOf(false) }

    LaunchedEffect(id) {
        if (type == "tv") {
            loadingDetails = true
            try {
                val details = withContext(Dispatchers.IO) {
                    tmdbApi.getTvDetails(id, TMDB_API_KEY)
                }
                seasons = details.seasons.filter { it.season_number > 0 } // Exclude specials usually
                if (seasons.isNotEmpty()) {
                    selectedSeason = seasons[0]
                }
            } catch (e: Exception) {
                e.printStackTrace()
            }
            loadingDetails = false
        }
    }

    LaunchedEffect(selectedSeason) {
        selectedSeason?.let { season ->
            loadingDetails = true
            try {
                val details = withContext(Dispatchers.IO) {
                    tmdbApi.getSeasonDetails(id, season.season_number, TMDB_API_KEY)
                }
                episodes = details.episodes
            } catch (e: Exception) {
                e.printStackTrace()
            }
            loadingDetails = false
        }
    }

    Column(modifier = Modifier.fillMaxSize().background(MaterialTheme.colorScheme.background)) {
        // Header
        Box(modifier = Modifier.fillMaxWidth().height(250.dp)) {
            AsyncImage(
                model = "https://image.tmdb.org/t/p/w780$posterPath",
                contentDescription = null,
                modifier = Modifier.fillMaxSize().alpha(0.3f),
                contentScale = ContentScale.Crop
            )
            
            // Gradient Overlay could be added here
            
            Column(
                modifier = Modifier.align(Alignment.BottomStart).padding(16.dp)
            ) {
                IconButton(onClick = { navController.popBackStack() }) {
                    Icon(Icons.Default.ArrowBack, contentDescription = "Back", tint = Color.White)
                }
                Text(title, style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold, color = Color.White)
            }
        }

        if (type == "tv") {
            // Season Selector
            if (seasons.isNotEmpty()) {
                LazyRow(
                    modifier = Modifier.fillMaxWidth().padding(16.dp),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    items(seasons) { season ->
                        FilterChip(
                            selected = season == selectedSeason,
                            onClick = { selectedSeason = season },
                            label = { Text("Saison ${season.season_number}") }
                        )
                    }
                }
            }

            // Episode List
            if (loadingDetails) {
                Box(modifier = Modifier.fillMaxWidth().height(200.dp), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator()
                }
            } else {
                LazyColumn(modifier = Modifier.padding(horizontal = 16.dp)) {
                    items(episodes) { episode ->
                        EpisodeItem(episode) {
                            // TODO: Phase 2 - Lancer le scraping
                            Log.d("Vision", "Click episode: ${episode.name}")
                        }
                    }
                }
            }
        } else {
            // Movie Button
            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Button(
                    onClick = { /* TODO Phase 2 */ },
                    colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.primary)
                ) {
                    Icon(Icons.Default.PlayArrow, contentDescription = null)
                    Spacer(modifier = Modifier.width(8.dp))
                    Text("Lancer le film")
                }
            }
        }
    }
}

@Composable
fun Modifier.alpha(alpha: Float) = this.then(Modifier.background(Color.Black.copy(alpha = 1f - alpha))) // Fake alpha via overlay if needed or standard alpha

@Composable
fun EpisodeItem(episode: Episode, onClick: () -> Unit) {
    Card(
        modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp).clickable { onClick() },
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            AsyncImage(
                model = "https://image.tmdb.org/t/p/w300${episode.still_path}",
                contentDescription = null,
                modifier = Modifier.width(120.dp).height(70.dp),
                contentScale = ContentScale.Crop
            )
            Column(modifier = Modifier.padding(10.dp)) {
                Text("Épisode ${episode.episode_number}", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.primary)
                Text(episode.name, style = MaterialTheme.typography.bodyMedium, color = Color.White, maxLines = 1)
            }
        }
    }
}