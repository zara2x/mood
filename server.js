const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const cheerio = require('cheerio');
const sharp = require('sharp'); // Add Sharp library for image processing
const { PLAYLIST_GENERATION_PROMPT } = require('./constants');

const app = express();
const port = process.env.PORT || 3000;

// Set up storage for uploaded images
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Serve static files
app.use(express.static('public'));
app.use(express.json());

// Set EJS as the view engine
app.set('view engine', 'ejs');

// Home route
app.get('/', (req, res) => {
  res.render('index');
});

// Search Youtube
app.get('/youtube-search', async (req, res) => {
    try {
      const query = req.query.q;
      if (!query) {
        return res.status(400).json({ error: 'Search query is required' });
      }
  
      // Format search query for YouTube
      const searchQuery = encodeURIComponent(query);
      const searchUrl = `https://www.youtube.com/results?search_query=${searchQuery}`;
      
      console.log(`Searching YouTube for: ${query}`);
      
      // Get response from YouTube
      const response = await axios.get(searchUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      });
      
      // Use cheerio to parse the HTML
      const $ = cheerio.load(response.data);
      
      // Try to extract video ID using regex
      const videoIdRegex = /watch\?v=([a-zA-Z0-9_-]{11})/;
      let videoId = null;
      
      // First try to find it in the HTML
      const watchLinks = $('a[href*="watch?v="]');
      if (watchLinks.length > 0) {
        const href = $(watchLinks[0]).attr('href');
        const match = href.match(videoIdRegex);
        if (match && match[1]) {
          videoId = match[1];
        }
      }
      
      // If not found in HTML, try regex on the whole response
      if (!videoId) {
        const matches = response.data.match(videoIdRegex);
        if (matches && matches[1]) {
          videoId = matches[1];
        }
      }
      
      if (videoId) {
        console.log(`Found video ID for "${query}": ${videoId}`);
        return res.json({ videoId });
      } else {
        console.log(`No video ID found for "${query}"`);
        return res.status(404).json({ error: 'No video found' });
      }
    } catch (error) {
      console.error('YouTube search error:', error.message);
      return res.status(500).json({ error: 'Failed to search YouTube' });
    }
});

// Spotify search endpoint
app.get('/spotify-search', async (req, res) => {
  const query = req.query.q;
  if (!query) {
    return res.status(400).json({ error: 'Missing query parameter' });
  }
  try {
    // Use Spotify's web search page
    const searchUrl = `https://open.spotify.com/search/${encodeURIComponent(query)}`;

    // This is a simple approach to scrape the first track URL
    // For a more robust solution, you might consider using Spotify's API with proper auth
    const response = await axios.get(searchUrl);
    const $ = cheerio.load(response.data);

    // This selector would need to be updated based on Spotify's actual HTML structure
    // This is a placeholder example
    const trackElement = $('a[href*="/track/"]').first();
    let trackUrl = trackElement.attr('href');
    if (trackUrl) {
      // Make sure it's a full URL
      if (!trackUrl.startsWith('http')) {
        trackUrl = 'https://open.spotify.com' + trackUrl;
      }
      return res.json({ trackUrl });
    }

    // Fallback to search URL if no direct track is found
    return res.json({ trackUrl: searchUrl });
  } catch (error) {
    console.error('Error fetching Spotify track:', error);
    return res.status(500).json({
      error: 'Failed to fetch Spotify track',
      fallbackUrl: `https://open.spotify.com/search/${encodeURIComponent(query)}`
    });
  }
});

// Route to handle image uploads and Claude API requests
app.post('/generate-playlist', upload.single('image'), async (req, res) => {
  try {
    // Check if image was uploaded
    if (!req.file) {
      return res.status(400).json({ error: 'No image uploaded' });
    }

    // Get Claude API key from request headers
    const apiKey = req.headers['x-claude-api-key'];
    if (!apiKey) {
      return res.status(400).json({ error: 'Claude API key is required' });
    }

    // Scale down the image by 4x (reduce to 25% of original dimensions)
    let processedImageBuffer;
    try {
      // Process the image with sharp
      const imageMetadata = await sharp(req.file.buffer).metadata();

      // Calculate new dimensions (max width/height of 800px)
      const scaleFactor = Math.min(800 / imageMetadata.width, 800 / imageMetadata.height);
      const newWidth = Math.round(imageMetadata.width * scaleFactor);
      const newHeight = Math.round(imageMetadata.height * scaleFactor);

      console.log(`Scaling image from ${imageMetadata.width}x${imageMetadata.height} to ${newWidth}x${newHeight}`);

      // Resize the image
      processedImageBuffer = await sharp(req.file.buffer)
        .resize(newWidth, newHeight)
        .toBuffer();

    } catch (err) {
      console.error('Image processing error:', err);
      // Fall back to original image if processing fails
      processedImageBuffer = req.file.buffer;
    }
    
    // Prepare image for Claude API
    const base64Image = processedImageBuffer.toString('base64');
    const mimeType = req.file.mimetype;

    // Create request payload for Claude API with structured format request
    const payload = {
      model: "claude-3-7-sonnet-20250219",
      max_tokens: 1000,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: PLAYLIST_GENERATION_PROMPT
            },
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mimeType,
                data: base64Image
              }
            }
          ]
        }
      ]
    };

    console.log("Sending request to Claude API...");

    // Call Claude API
    const response = await axios.post('https://api.anthropic.com/v1/messages', payload, {
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      }
    });
  
    console.log("Got response from Claude API");

    // Extract text content from Claude's response
    const content = response.data.content[0].text;

    // Process the playlist from Claude's response
    const processedResponse = processClaudeResponse(content);
    // Return the processed playlist data
    res.json(processedResponse);

  } catch (error) {
    console.error('Error:', error.message);

    // Send appropriate error response
    if (error.response) {
      // Claude API error response
      console.error('Claude API error:', error.response.data);
      res.status(error.response.status).json({
        error: error.response.data.error?.message || 'API request failed'
      });
    } else {
      // Other errors
      res.status(500).json({ error: 'Server error: ' + error.message });
    }
  }
});

// Process Claude's response text
function processClaudeResponse(responseText) {
  // Log the full response for debugging
  console.log("Claude's full response:", responseText);

  // Extract explanation - get everything before "SONGS:"
  let explanation = "";
  const songsMarkerIndex = responseText.indexOf("SONGS:");

  if (songsMarkerIndex > 0) {
    explanation = responseText.substring(0, songsMarkerIndex).trim();
  } else {
    // If we don't find the SONGS marker, just use the first paragraph
    const paragraphs = responseText.split('\n\n');
    explanation = paragraphs[0] || responseText;
  }

  // Extract the songs section
  let songsSection = "";
  let topSongInfo = "";

  if (songsMarkerIndex > 0) {
    const topSongMarkerIndex = responseText.indexOf("TOP SONG:");
    if (topSongMarkerIndex > 0) {
      songsSection = responseText.substring(songsMarkerIndex, topSongMarkerIndex).trim();
      topSongInfo = responseText.substring(topSongMarkerIndex).trim();
    } else {
      songsSection = responseText.substring(songsMarkerIndex).trim();
    }
  }

  // Parse songs from the songs section
  const songs = [];

  if (songsSection) {
    // Remove the "SONGS:" header
    const songsList = songsSection.replace("SONGS:", "").trim();

    // Split by numbered lines
    const songLines = songsList.split(/\n\d+\.\s+/).filter(line => line.trim().length > 0);

    // Process each song line
    songLines.forEach(line => {
      // Match pattern "Song Title" - Artist Name
      const match = line.match(/[""]([^""]+)[""][\s\-—–]+([^\n]+)/);

      if (match) {
        const title = match[1].trim();
        const artist = match[2].trim();

        if (title && artist) {
          songs.push({ title, artist });
        }
      }
    });
  }

  // Determine the top song
  let topSongIndex = 0;
  if (topSongInfo) {
    const topSongMatch = topSongInfo.match(/TOP SONG:\s*#(\d+)/);
    if (topSongMatch && topSongMatch[1]) {
      // Convert to 0-based index and ensure it's valid
      const index = parseInt(topSongMatch[1]) - 1;
      if (index >= 0 && index < songs.length) {
        topSongIndex = index;
      }
    }
  }

  // Log extracted songs for debugging
  console.log("Extracted songs:", songs);
  console.log("Top song index:", topSongIndex);

  // Reorder songs to put the top song first if needed
  if (topSongIndex > 0 && topSongIndex < songs.length) {
    const topSong = songs[topSongIndex];
    songs.splice(topSongIndex, 1); // Remove top song from its position
    songs.unshift(topSong); // Add it to the beginning
  }

  // Create links for each song
  const songsWithLinks = songs.map(song => {
    const youtubeSearchQuery = encodeURIComponent(`${song.title} ${song.artist}`);
    const youtubeLink = `https://www.youtube.com/results?search_query=${youtubeSearchQuery}`;
    const spotifyLink = `https://open.spotify.com/search/${encodeURIComponent(song.title + ' ' + song.artist)}`;

    return {
      ...song,
      youtubeLink,
      spotifyLink
    };
  });

  // Return the processed response
  return {
    explanation,
    songs: songsWithLinks
  };
}

// Start server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
