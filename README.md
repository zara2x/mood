# Image to Playlist Generator

A web application that analyzes images and generates music playlists based on the mood and content of the image using Claude AI.

## Features

- Upload any image to analyze
- Get a custom playlist based on the mood and content of your image
- View embedded YouTube videos for each song
- Open songs directly in Spotify
- Node.js backend handles Claude API requests

## Prerequisites

- Node.js (v14+)
- Claude API key from [Anthropic](https://console.anthropic.com/)

## Installation

1. Clone the repository:
   ```
   git clone https://github.com/yourusername/image-to-playlist.git
   cd image-to-playlist
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Start the server:
   ```
   npm start
   ```

4. Open your browser and navigate to:
   ```
   http://localhost:3000
   ```

## Usage

1. Enter your Claude API key in the field provided
2. Upload an image by clicking "Choose an image"
3. Click "Generate Playlist"
4. Wait for Claude to analyze your image and generate a playlist
5. Enjoy your custom playlist with embedded YouTube videos and Spotify links

## Project Structure

```
image-to-playlist/
├── public/               # Static assets
│   ├── css/              # Stylesheets
│   ├── js/               # Client-side JavaScript
│   └── images/           # Images and icons
├── views/                # EJS templates
│   └── index.ejs         # Main page template
├── server.js             # Express server and API endpoints
├── package.json          # Project dependencies
└── README.md             # Project documentation
```

## License

MIT