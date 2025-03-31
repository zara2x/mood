const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const axios = require('axios');

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

    // Prepare image for Claude API
    const base64Image = req.file.buffer.toString('base64');
    const mimeType = req.file.mimetype;

    // Create request payload for Claude API
    const payload = {
      model: "claude-3-7-sonnet-20250219",
      max_tokens: 1000,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Analyze this image and create a music playlist of 9 songs based on the mood, elements, and overall feeling of the image. For each song, provide the title and artist. Also provide a brief explanation about why the playlist matches the image. Out of those 9 pick 3 that best represent the vibe of the image (don't just focus on keywords from the image, contextualise the meaning and pick the most appropriate songs."
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
  
  // Extract explanation - get everything before the first numbered item
  let explanation = "";
  const firstNumberedItemIndex = responseText.search(/\d+[\.\)]/);
  
  if (firstNumberedItemIndex > 0) {
    explanation = responseText.substring(0, firstNumberedItemIndex).trim();
  } else {
    // If we don't find a numbered list, just use the first paragraph
    const paragraphs = responseText.split('\n\n');
    explanation = paragraphs[0] || responseText;
  }
  
  // Try different regex patterns to extract songs
  // Try pattern 1: standard numbered items with quotes and hyphen
  let songRegex = /\d+[\.\)]\s*[""]([^""]+)[""][\s\-—–]+([^,\n]+)/g;
  let songs = extractSongsWithRegex(responseText, songRegex);
  
  // If that didn't work, try pattern 2: songs with quotes but no number
  if (songs.length === 0) {
    songRegex = /[""]([^""]+)[""][\s\-—–]+([^,\n]+)/g;
    songs = extractSongsWithRegex(responseText, songRegex);
  }
  
  // If that didn't work, try pattern 3: just look for "Title" by Artist
  if (songs.length === 0) {
    songRegex = /[""]([^""]+)[""] by ([^\n]+)/g;
    songs = extractSongsWithRegex(responseText, songRegex);
  }
  
  // If still no songs, try an even more generic approach
  if (songs.length === 0) {
    const lines = responseText.split('\n');
    for (const line of lines) {
      // Look for lines that might be song listingsr
      if ((line.includes('"') || line.includes('"') || line.includes('"')) && 
          (line.includes(' - ') || line.includes(' by '))) {
        let title = '';
        let artist = '';
        
        // Try to extract title between quotes
        const titleMatch = line.match(/[""]([^""]+)[""]/);
        if (titleMatch) title = titleMatch[1].trim();
        
        // Try to extract artist after hyphen or "by"
        if (line.includes(' - ')) {
          artist = line.split(' - ').pop().trim();
        } else if (line.includes(' by ')) {
          artist = line.split(' by ').pop().trim();
        }
        
        if (title && artist) {
          songs.push({ title, artist });
        }
      }
    }
  }
  
  // Log extracted songs for debugging
  console.log("Extracted songs:", songs);
  
  // Create links for each song
  songs = songs.map(song => {
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
    songs
  };
}

// Helper function to extract songs using a regex pattern
function extractSongsWithRegex(text, regex) {
  const songs = [];
  let match;
  
  while ((match = regex.exec(text)) !== null) {
    const title = match[1].trim();
    const artist = match[2].trim();
    
    if (title && artist) {
      songs.push({ title, artist });
    }
  }
  
  return songs;
}

// Start server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});