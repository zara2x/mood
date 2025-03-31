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
  
  // Function to display playlist results
  function displayPlaylistResults(responseData) {
    // Clear previous results
    songsContainerEl.innerHTML = '';
    topSongsContainerEl.innerHTML = '';
    
    // Display playlist explanation
    playlistExplanationEl.textContent = responseData.explanation || "Claude analyzed your image and created this playlist:";
    
    console.log(`Displaying ${responseData.songs.length} songs`);
    
    // The server already reordered the songs array to put the top song first,
    // so we can just display the first song as the top song
    const topSong = responseData.songs[0]; // Just use the first song (which should be the top song after server reordering)
    console.log("Top song:", topSong);
      // Create top song card
      const songCard = document.createElement('div');
      songCard.className = 'song-card top-song-card';
      
      // Create song header
      const songHeader = document.createElement('div');
      songHeader.className = 'song-header';
      
      const songTitle = document.createElement('h3');
      songTitle.className = 'song-title';
    songTitle.textContent = `"${topSong.title}"`;
      
      const songArtist = document.createElement('p');
      songArtist.className = 'song-artist';
    songArtist.textContent = topSong.artist;
      
      songHeader.appendChild(songTitle);
      songHeader.appendChild(songArtist);
      
      // Create video container
      const videoContainer = document.createElement('div');
      videoContainer.className = 'video-container';
      
      // Extract search query for YouTube embed
      const searchQuery = encodeURIComponent(`${topSong.title} ${topSong.artist}`);
      
      const iframe = document.createElement('iframe');
      // Fix: Use correct YouTube search embed URL format
      iframe.src = `https://www.youtube.com/embed/videoseries?list=search_query=${searchQuery}`;
      iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
      iframe.allowFullscreen = true;
      
      videoContainer.appendChild(iframe);
      
      // Create song footer with Spotify button
      const songFooter = document.createElement('div');
      songFooter.className = 'song-footer';
      
      const spotifyBtn = document.createElement('a');
      spotifyBtn.className = 'spotify-btn';
      spotifyBtn.href = topSong.spotifyLink;
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
      
      // Add to top songs container
      topSongsContainerEl.appendChild(songCard);

    // For the rest of the songs, create the regular song list
    // Start from index 0 since we want to show all songs including the top one
    responseData.songs.forEach((song, index) => {
      console.log(`Creating card for song ${index + 1}:`, song);
      
      // Create song card
      const songCard = document.createElement('div');
      songCard.className = 'song-card';
      
      // Add a special class if this is the top song
      if (index === 0) {
        songCard.classList.add('top-ranked-song');
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
      
      // Extract search query for YouTube embed
      const searchQuery = encodeURIComponent(`${song.title} ${song.artist}`);
      
      const iframe = document.createElement('iframe');
      // Fix: Use correct YouTube search embed URL format
      iframe.src = `https://www.youtube.com/embed/videoseries?list=search_query=${searchQuery}`;
      iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
      iframe.allowFullscreen = true;
      
      videoContainer.appendChild(iframe);
      
      // Create song footer with Spotify button
      const songFooter = document.createElement('div');
      songFooter.className = 'song-footer';
      
      const spotifyBtn = document.createElement('a');
      spotifyBtn.className = 'spotify-btn';
      spotifyBtn.href = song.spotifyLink;
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
      
      // Add to songs container
      songsContainerEl.appendChild(songCard);
    });
    
    // Show results
    loadingEl.style.display = 'none';
    resultsSectionEl.style.display = 'block';
    generateBtnEl.disabled = false;
    
    // Scroll to results
    resultsSectionEl.scrollIntoView({ behavior: 'smooth' });
  }
}