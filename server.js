const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 10000;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const INDEX_FILE = path.join(__dirname, "index.html");

function sendJSON(res, status, data) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS"
  });

  res.end(JSON.stringify(data));
}

function sendHTML(res) {
  if (!fs.existsSync(INDEX_FILE)) {
    res.writeHead(404, {
      "Content-Type": "text/plain; charset=utf-8"
    });

    res.end("index.html পাওয়া যায়নি");
    return;
  }

  res.writeHead(200, {
    "Content-Type": "text/html; charset=utf-8"
  });

  fs.createReadStream(INDEX_FILE).pipe(res);
}


// ========================================
// GEMINI AI
// ========================================

async function askAI(message) {

  if (!GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY পাওয়া যায়নি");
  }

  const url =
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" +
    encodeURIComponent(GEMINI_API_KEY);

  const response = await fetch(url, {
    method: "POST",

    headers: {
      "Content-Type": "application/json"
    },

    body: JSON.stringify({

      systemInstruction: {
        parts: [
          {
            text:
              "তুমি ময়না পাখি নামে একজন বন্ধুসুলভ বাংলা AI ভয়েস অ্যাসিস্ট্যান্ট। " +
              "ব্যবহারকারীর সাথে স্বাভাবিক ও সহজ বাংলায় কথা বলবে। " +
              "উত্তর সংক্ষিপ্ত, পরিষ্কার এবং স্বাভাবিক রাখবে। " +
              "ব্যবহারকারী বাংলা ভাষায় প্রশ্ন করলে বাংলায় উত্তর দেবে।"
          }
        ]
      },

      contents: [
        {
          role: "user",

          parts: [
            {
              text: message
            }
          ]
        }
      ],

      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 1000
      }

    })
  });

  const data = await response.json();

  if (!response.ok) {

    console.error("Gemini Error:", data);

    throw new Error(
      data?.error?.message ||
      "Gemini থেকে উত্তর পাওয়া যায়নি"
    );
  }


  let answer = "";

  if (
    data.candidates &&
    data.candidates.length > 0
  ) {

    const candidate = data.candidates[0];

    if (
      candidate.content &&
      candidate.content.parts
    ) {

      for (const part of candidate.content.parts) {

        if (part.text) {
          answer += part.text;
        }

      }
    }
  }


  if (!answer.trim()) {
    answer =
      "দুঃখিত, এই মুহূর্তে কোনো উত্তর পাওয়া যায়নি।";
  }

  return answer.trim();
}


// ========================================
// SERVER
// ========================================

const server = http.createServer(
  async (req, res) => {

    // CORS
    if (req.method === "OPTIONS") {

      res.writeHead(204, {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers":
          "Content-Type",
        "Access-Control-Allow-Methods":
          "GET,POST,OPTIONS"
      });

      res.end();

      return;
    }


    // HOME
    if (
      req.method === "GET" &&
      (
        req.url === "/" ||
        req.url === "/index.html"
      )
    ) {

      sendHTML(res);

      return;
    }


    // HEALTH CHECK
    if (
      req.method === "GET" &&
      req.url === "/health"
    ) {

      sendJSON(res, 200, {
        status: "ok",
        app: "Moyna Pakhi",
        ai: "Gemini"
      });

      return;
    }


    // AI API
    if (
      req.method === "POST" &&
      req.url === "/api/ai"
    ) {

      let body = "";

      req.on("data", chunk => {

        body += chunk;

        if (body.length > 100000) {
          req.destroy();
        }

      });


      req.on("end", async () => {

        try {

          const data = JSON.parse(body);

          const message =
            String(data.message || "").trim();


          if (!message) {

            sendJSON(res, 400, {
              error: "বার্তা পাওয়া যায়নি"
            });

            return;
          }


          const answer =
            await askAI(message);


          sendJSON(res, 200, {
            answer: answer
          });


        } catch (error) {

          console.error(
            "Server Error:",
            error
          );


          sendJSON(res, 500, {
            error:
              error.message ||
              "Server error"
          });

        }

      });

      return;
    }


    // NOT FOUND
    sendJSON(res, 404, {
      error: "Not Found"
    });

  }
);


// ========================================
// START
// ========================================

server.listen(PORT, () => {

  console.log(
    `Moyna Pakhi Gemini server started on port ${PORT}`
  );

});