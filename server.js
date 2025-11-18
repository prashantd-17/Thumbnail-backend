import express from "express";
import cors from "cors";
import ytdl from "ytdl-core";
// import nodemailer from "nodemailer";
import { Resend } from "resend";

const app = express();
app.use(cors({
  origin: "*",
  methods: ["POST", "GET", "OPTIONS"],
  allowedHeaders: ["Content-Type"]
}));
app.use(express.json());

// ✅ Primary LibreTranslate mirror (confirmed working)
// const LIBRE_API = "https://libretranslate.com/translate";
const LIBRE_API = "https://translate.terraprint.co/translate";
// ✅ Fallback API (MyMemory) for reliability
const MEMORY_API = "https://api.mymemory.translated.net/get";


// Normalize YouTube URL
function normalizeYouTubeUrl(url) {
    if (url.includes("youtu.be")) {
        const videoId = url.split("/").pop().split("?")[0];
        return `https://www.youtube.com/watch?v=${videoId}`;
    }
    return url;
}

// Thumbnail API
app.post("/api/get-thumbnail", (req, res) => {
  const { url } = req.body;
  const normalizedUrl = normalizeYouTubeUrl(url);
  const videoId = ytdl.getVideoID(normalizedUrl);

  const thumbnails = {
    maxres: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
    medium: `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
  };

  res.json({ videoId, thumbnails });
});

// Video info API
app.post("/api/video-info", async (req, res) => {
  try {
    const { url } = req.body;
    const normalizedUrl = normalizeYouTubeUrl(url);
    const info = await ytdl.getInfo(normalizedUrl);
    const formats = ytdl.filterFormats(info.formats, "videoandaudio");
    res.json({
      title: info.videoDetails.title,
      formats: formats.map(f => ({ quality: f.qualityLabel, itag: f.itag })),
    });
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: "Invalid URL or video not available" });
  }
});

// Video download API
app.get("/api/download", async (req, res) => {
  try {
    const { url, itag } = req.query;
    const normalizedUrl = normalizeYouTubeUrl(url);
    res.header("Content-Disposition", 'attachment; filename="video.mp4"');
    ytdl(normalizedUrl, { quality: itag }).pipe(res);
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: "Download failed" });
  }
});

app.get("/", (req, res) => {
  res.send("✅ YouTube Video Downloader API is running...");
});


// New backend for Transcriptor and translation web app 
app.post("/api/translate", async (req, res) => {
  const { q, source, target } = req.body;

  if (!q || !source || !target) {
    return res.status(400).json({ error: "Missing parameters" });
  }

  try {
    // -----------------------------
    // Primary: LibreTranslate
    // -----------------------------
    const response = await fetch(LIBRE_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ q, source, target, format: "text" }),
    });

    const text = await response.text(); // safer than .json()
    let data;

    try {
      data = JSON.parse(text);
    } catch (err) {
      console.warn("⚠️ LibreTranslate returned non-JSON. Switching to fallback...");
      throw new Error("Invalid JSON from LibreTranslate");
    }

    // ✅ Success
    if (data.translatedText) {
      return res.json({ translatedText: data.translatedText });
    } else {
      throw new Error("Invalid response from LibreTranslate");
    }
  } catch (primaryError) {
    console.warn("⚠️ Primary API failed:", primaryError.message);

    // -----------------------------
    // Fallback: MyMemory
    // -----------------------------
    try {
      const backupResponse = await fetch(
        `${MEMORY_API}?q=${encodeURIComponent(q)}&langpair=${source}|${target}`
      );
      const backupData = await backupResponse.json();

      if (backupData?.responseData?.translatedText) {
        return res.json({
          translatedText: backupData.responseData.translatedText,
          source: "MyMemory Fallback",
        });
      }

      return res.status(500).json({
        error: "Both translation APIs failed. Please try again later.",
      });
    } catch (fallbackError) {
      console.error("❌ Fallback API failed:", fallbackError);
      return res.status(500).json({
        error: "Translation failed completely.",
        details: fallbackError.message,
      });
    }
  }
});

// new portfolio app 
// app.post("/send-email", async (req, res) => {
//   const { name, email, message } = req.body;

//   const transporter = nodemailer.createTransport({
//     service: "gmail",
//     auth: {
//       user: "xyz@gmail.com",
//       pass: "abc xyz ddd dkt"  // Gmail App password
//     }
//   });

//   const mail = {
//     from: email,
//     to: "xyz@gmail.com",
//     subject: `Portfolio Contact from ${name}`,
//     text: message + "\n\nReply to: " + email
//   };

//   try {
//    transporter.sendMail(mail)
//     .then(() => console.log("Email sent successfully"))
//     .catch(err => console.error("Email error:", err));

//   // 👇 Respond instantly so Render does NOT timeout
//   res.json({ status: "queued" });

//   } catch (err) {
//     res.status(500).json(err);
//   }
// });

const resend = new Resend('re_RDFF4JTo_NporqeVHRCKSMiZDPiAsVM9u');

app.post("/send-email", express.text({ type: "*/*" }), async (req, res) => {
  let data = req.body;

  // If body is a string (Beacon), parse it
  if (typeof data === "string") {
    try {
      data = JSON.parse(data);
    } catch {
      return res.status(400).json({ error: "Invalid JSON" });
    }
  }
  const { name, email, message } = req.body;

  try {
    await resend.emails.send({
      from: "Portfolio Contact <onboarding@resend.dev>",
      to: "pd.myportfolio@gmail.com",
      subject: `Message from ${name}`,
      html: `
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Message:</strong></p>
        <p>${message}</p>
      `
    });

    return res.json({ status: "sent" });
  } catch (err) {
    console.error("Email error:", err);
    return res.status(500).json({ status: "error", message: err.message });
  }
});


app.listen(3000, () => console.log("✅ Backend running on http://localhost:3000"));
