import express from "express";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

// Extract YouTube video ID from URL
function extractVideoId(url) {
  const regex =
    /(?:v=|\/)([0-9A-Za-z_-]{11})(?:\?|&|$)/;
  const match = url.match(regex);
  return match ? match[1] : null;
}

// API Endpoint
app.post("/api/get-thumbnail", (req, res) => {
  const { url } = req.body;
  const videoId = extractVideoId(url);

  if (!videoId) {
    return res.status(400).json({ error: "Invalid YouTube URL" });
  }

  const thumbnails = {
    maxres: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
    // high: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
    medium: `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
    // standard: `https://img.youtube.com/vi/${videoId}/sddefault.jpg`,
  };

  res.json({ videoId, thumbnails });
});

app.get("/", (req, res) => {
  res.send("✅ YouTube Thumbnail Downloader API is running...");
});


app.listen(5000, () => {
  console.log("✅ Backend running on http://localhost:5000");
});
