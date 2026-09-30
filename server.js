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


// =====================================================
// GEMINI AI
// =====================================================

async function askGemini(message) {

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
              "তোমার নাম ময়না পাখি। " +
              "তুমি একজন বন্ধুসুলভ বাংলা AI ভয়েস অ্যাসিস্ট্যান্ট। " +
              "ব্যবহারকারীর সাথে স্বাভাবিক, মিষ্টি ও সহজ বাংলায় কথা বলবে। " +
              "ব্যবহারকারী বাংলা ভাষায় প্রশ্ন করলে বাংলায় উত্তর দেবে। " +
              "প্রয়োজন হলে সংক্ষিপ্ত কিন্তু তথ্যপূর্ণ উত্তর দেবে। " +
              "নিজেকে AI assistant হিসেবে পরিচয় দিতে পারো।"
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

    console.error("Gemini API Error:", data);

    throw new Error(
      data?.error?.message ||
      "Gemini API থেকে উত্তর পাওয়া যায়নি"
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
      Array.isArray(candidate.content.parts)
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
      "দুঃখিত, এখন কোনো উত্তর পাওয়া যাচ্ছে না।";
  }

  return answer.trim();
}


// =====================================================
// SERVER
// =====================================================

const server = http.createServer(
  async (req, res) => {

    // -----------------------------------------------
    // OPTIONS / CORS
    // -----------------------------------------------

    if (req.method === "OPTIONS") {

      res.writeHead(204, {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "GET,POST,OPTIONS"
      });

      res.end();

      return;
    }


    // -----------------------------------------------
    // HOME PAGE
    // -----------------------------------------------

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


    // -----------------------------------------------
    // HEALTH CHECK
    // -----------------------------------------------

    if (
      req.method === "GET" &&
      req.url === "/health"
    ) {

      sendJSON(res, 200, {
        status: "ok",
        app: "Moyna Pakhi",
        ai: "Gemini",
        geminiKeyConfigured:
          Boolean(GEMINI_API_KEY)
      });

      return;
    }


    // -----------------------------------------------
    // AI API
    // -----------------------------------------------

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


          console.log(
            "User asked:",
            message
          );


          const answer =
            await askGemini(message);


          console.log(
            "Gemini answered successfully"
          );


          sendJSON(res, 200, {
            answer: answer
          });


        } catch (error) {

          console.error(
            "AI Server Error:",
            error
          );


          sendJSON(res, 500, {
            error:
              error.message ||
              "AI Server Error"
          });

        }

      });

      return;
    }


    // -----------------------------------------------
    // 404
    // -----------------------------------------------

    sendJSON(res, 404, {
      error: "Not Found"
    });

  }
);


// =====================================================
// START SERVER
// =====================================================

server.listen(PORT, () => {

  console.log(
    `Moyna Pakhi Gemini server started on port ${PORT}`
  );

});