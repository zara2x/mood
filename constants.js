// Constants for the application

/**
 * Text prompt for Claude to analyze an image and generate a music playlist
 */
const PLAYLIST_GENERATION_PROMPT = "Analyze this image and create a music playlist of 9 songs based on the mood, elements, and overall feeling of the image. Out of those 9 pick 1 that best represents the image.\n\nPlease provide your response in the exact following format:\n\n1. First, write a brief explanation (2-4 sentences) about why the playlist matches the image.\n\n2. Then provide a list of songs with this exact format:\n\nSONGS:\n1. \"Song Title\" - Artist Name\n2. \"Song Title\" - Artist Name\n(and so on for all 9 songs)\n\n3. Finally, indicate the top song that best represents the vibe of the image with:\nTOP SONG: #X\n\nWhere X is the number of the song from your list above.";

module.exports = {
  PLAYLIST_GENERATION_PROMPT
};