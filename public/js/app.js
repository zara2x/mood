// Wait for DOM to be fully loaded
document.addEventListener('DOMContentLoaded', function() {
  // Initialize app
  initApp();
});

function initApp() {
  // DOM elements
  const imageUploadEl = document.getElementById('image-upload');
  const imagePreviewEl = document.getElementById('image-preview');
  const uploadBtnEl = document.getElementById('upload-btn');
  const generateContainerEl = document.getElementById('generate-container');
  const generateBtnEl = document.getElementById('generate-btn');
  const loadingEl = document.getElementById('loading');
  const resultsSectionEl = document.getElementById('results-section');
  const playlistExplanationEl = document.getElementById('playlist-explanation');
  const songsContainerEl = document.getElementById('songs-container');
  const topSongsContainerEl = document.getElementById('top-songs-container');
  const errorMessageEl = document.getElementById('error-message');
  const apiKeyInputEl = document.getElementById('api-key-input');
  
  // Check if all elements exist
  if (!imageUploadEl || !imagePreviewEl || !uploadBtnEl || !generateContainerEl || 
      !generateBtnEl || !loadingEl || !resultsSectionEl || !playlistExplanationEl || 
      !songsContainerEl || !topSongsContainerEl || !errorMessageEl || !apiKeyInputEl) {
    console.error('Failed to find all required DOM elements');
    return;
  }
  
  // Handle file selection
  imageUploadEl.addEventListener('change', function(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    // Validate file is an image
    if (!file.type.match('image.*')) {
      showError('Please select an image file (JPEG, PNG, etc.)');
      return;
    }
    
    // Display image preview
    const reader = new FileReader();
    reader.onload = function(e) {
      imagePreviewEl.src = e.target.result;
      imagePreviewEl.style.display = 'block';
      generateContainerEl.style.display = 'block';
    };
    reader.readAsDataURL(file);
  });
  
  // Save API key to local storage when entered
  apiKeyInputEl.addEventListener('change', function() {
    if (apiKeyInputEl.value) {
      localStorage.setItem('claude_api_key', apiKeyInputEl.value);
    }
  });
  
  // Load API key from local storage if available
  if (localStorage.getItem('claude_api_key')) {
    apiKeyInputEl.value = localStorage.getItem('claude_api_key');
  }
  
  // Generate playlist on button click
  generateBtnEl.addEventListener('click', function() {
    if (!imagePreviewEl.src) {
      showError('Please select an image first');
      return;
    }
    
    // Get API key from input field
    const apiKey = apiKeyInputEl.value;
    if (!apiKey) {
      showError('Please enter your Claude API key');
      return;
    }
    
    // Show loading state
    loadingEl.style.display = 'block';
    generateBtnEl.disabled = true;
    errorMessageEl.style.display = 'none';
    resultsSectionEl.style.display = 'none';
    
    // Get the actual file from input
    const file = imageUploadEl.files[0];
    if (!file) {
      showError('Image file not found');
      return;
    }
    
    // Create form data for upload
    const formData = new FormData();
    formData.append('image', file);
    
    // Call server to generate playlist
    fetch('/generate-playlist', {
      method: 'POST',
      body: formData,
      headers: {
        'X-Claude-API-Key': apiKey
      }
    })
    .then(response => {
      if (!response.ok) {
        return response.json().then(data => {
          throw new Error(data.error || 'API request failed');
        });
      }
      return response.json();
    })
    .then(data => {
      // Log the data received from server for debugging
      console.log("Data received from server:", data);
      
      // Check if we have songs
      if (!data.songs || data.songs.length === 0) {
        showError("No songs were found in Claude's response. Try a different image or check the server logs.");
        return;
      }
      
      // Display the playlist results
      displayPlaylistResults(data);
    })
    .catch(error => {
      showError(`Error: ${error.message}`);
      console.error('Error:', error);
    });
  });
  
  // Function to show error messages
  function showError(message) {
    errorMessageEl.textContent = message;
    errorMessageEl.style.display = 'block';
    loadingEl.style.display = 'none';
    generateBtnEl.disabled = false;
  }

  // Function to fetch YouTube video ID for a song
  async function getYouTubeVideoId(songTitle, artist) {
    try {
      const searchQuery = encodeURIComponent(`${songTitle} ${artist} official`);
      // Use our own endpoint to fetch YouTube search results
      const response = await fetch(`/youtube-search?q=${searchQuery}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch YouTube video ID');
      }
      
      const data = await response.json();
      return data.videoId; // The server will return the first video ID from search results
    } catch (error) {
      console.error('Error fetching YouTube video ID:', error);
      return null;
    }
  }
  
  // Function to fetch Spotify track link for a song
  async function getSpotifyTrackLink(songTitle, artist) {
    try {
      const searchQuery = encodeURIComponent(`${songTitle} ${artist}`);
      // Use our own endpoint to fetch Spotify search results
      const response = await fetch(`/spotify-search?q=${searchQuery}`);

      if (!response.ok) {
        throw new Error('Failed to fetch Spotify track link');
      }

      const data = await response.json();
      return data.trackUrl; // The server will return the first track URL from search results
    } catch (error) {
      console.error('Error fetching Spotify track link:', error);
      // Fallback to search URL if direct track link fails
      return `https://open.spotify.com/search/${encodeURIComponent(`${songTitle} ${artist}`)}`;
    }
  }

  // Function to display playlist results
  async function displayPlaylistResults(responseData) {
    // Clear previous results
    songsContainerEl.innerHTML = '';
    topSongsContainerEl.innerHTML = '';
    
    // Display playlist explanation
    playlistExplanationEl.textContent = responseData.explanation || "Claude analyzed your image and created this playlist:";
    
    console.log(`Displaying ${responseData.songs.length} songs`);
    
    // The server already reordered the songs array to put the top song first
    const topSong = responseData.songs[0];
    console.log("Top song:", topSong);

    // Create and display top song card
    await createAndDisplaySongCard(topSong, topSongsContainerEl, true);
    
    // For the rest of the songs, create the regular song list
    for (const song of responseData.songs) {
      await createAndDisplaySongCard(song, songsContainerEl, false);
    }
    
    // Show results
    loadingEl.style.display = 'none';
    resultsSectionEl.style.display = 'block';
    generateBtnEl.disabled = false;
    
    // Scroll to results
    resultsSectionEl.scrollIntoView({ behavior: 'smooth' });
  }

  // Create and display a song card
  async function createAndDisplaySongCard(song, container, isTopSong) {
    // Create song card
    const songCard = document.createElement('div');
    songCard.className = 'song-card';
    
    if (isTopSong) {
      songCard.classList.add('top-song-card');
    }
    
    // Create song header
    const songHeader = document.createElement('div');
    songHeader.className = 'song-header';
    
    const songTitle = document.createElement('h3');
    songTitle.className = 'song-title';
    songTitle.textContent = `"${song.title}"`;
    
    const songArtist = document.createElement('p');
    songArtist.className = 'song-artist';
    songArtist.textContent = song.artist;
    
    songHeader.appendChild(songTitle);
    songHeader.appendChild(songArtist);
    
    // Create video container
    const videoContainer = document.createElement('div');
    videoContainer.className = 'video-container';
    
    // Fetch the YouTube video ID for this song
    let videoId = await getYouTubeVideoId(song.title, song.artist);
    
    // If we couldn't get a video ID, fall back to the YouTube search page
    if (!videoId) {
      console.log(`Couldn't get video ID for "${song.title}" by ${song.artist}, using search page instead`);
      videoId = 'videoseries';
    }
    
    const iframe = document.createElement('iframe');
    if (videoId === 'videoseries') {
      // Use search results as fallback
      const searchQuery = encodeURIComponent(`${song.title} ${song.artist}`);
      iframe.src = `https://www.youtube.com/results?search_query=${searchQuery}`;
    } else {
      // Use the specific video ID
      iframe.src = `https://www.youtube.com/embed/${videoId}`;
    }
    iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
    iframe.allowFullscreen = true;
    
    videoContainer.appendChild(iframe);
    
    // Create song footer with Spotify button
    const songFooter = document.createElement('div');
    songFooter.className = 'song-footer';
    
    // Get Spotify track link
    const spotifyLink = await getSpotifyTrackLink(song.title, song.artist);

    const spotifyBtn = document.createElement('a');
    spotifyBtn.className = 'spotify-btn';
    spotifyBtn.href = spotifyLink || song.spotifyLink;
    spotifyBtn.target = '_blank';
    spotifyBtn.rel = 'noopener noreferrer';
    
    const spotifyIcon = document.createElement('img');
    spotifyIcon.className = 'spotify-icon';
    spotifyIcon.src = '/images/spotify-icon.svg';
    spotifyIcon.alt = 'Spotify';
    
    const spotifyText = document.createTextNode('Open in Spotify');
    
    spotifyBtn.appendChild(spotifyIcon);
    spotifyBtn.appendChild(spotifyText);
    
    songFooter.appendChild(spotifyBtn);
    
    // Assemble song card
    songCard.appendChild(songHeader);
    songCard.appendChild(videoContainer);
    songCard.appendChild(songFooter);
    
    // Add to container
    container.appendChild(songCard);
  }
}