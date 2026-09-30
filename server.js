const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 10000;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const INDEX_FILE = path.join(__dirname, "index.html");


// =====================================================
// JSON RESPONSE
// =====================================================

function sendJSON(res, status, data) {

  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS"
  });

  res.end(JSON.stringify(data));
}


// =====================================================
// HTML RESPONSE
// =====================================================

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

    throw new Error(
      "GEMINI_API_KEY পাওয়া যায়নি। Render Environment চেক করো।"
    );
  }


  const url =
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=" +
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

              "ব্যবহারকারীর সাথে স্বাভাবিক, মিষ্টি এবং সহজ বাংলায় কথা বলবে। " +

              "ব্যবহারকারী বাংলা ভাষায় প্রশ্ন করলে বাংলায় উত্তর দেবে। " +

              "প্রয়োজন হলে বিস্তারিত ব্যাখ্যা করবে। " +

              "তথ্য নিশ্চিত না হলে সেটা পরিষ্কারভাবে জানাবে। " +

              "ব্যবহারকারী চাইলে ইংরেজিতেও উত্তর দিতে পারবে। " +

              "তোমার উত্তর যেন স্বাভাবিক মানুষের কথার মতো হয়।"

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

        maxOutputTokens: 1200

      }

    })

  });


  const data = await response.json();


  // Gemini error

  if (!response.ok) {

    console.error(
      "Gemini API Error:",
      JSON.stringify(data, null, 2)
    );


    throw new Error(
      data?.error?.message ||
      "Gemini API থেকে উত্তর পাওয়া যায়নি"
    );
  }


  // ===================================================
  // GEMINI ANSWER
  // ===================================================

  let answer = "";


  if (
    data.candidates &&
    data.candidates.length > 0
  ) {

    const candidate =
      data.candidates[0];


    if (
      candidate.content &&
      Array.isArray(
        candidate.content.parts
      )
    ) {

      for (
        const part of candidate.content.parts
      ) {

        if (part.text) {

          answer += part.text;

        }

      }

    }

  }


  // ===================================================
  // EMPTY ANSWER
  // ===================================================

  if (!answer.trim()) {

    answer =
      "দুঃখিত, এখন কোনো উত্তর পাওয়া যাচ্ছে না।";

  }


  return answer.trim();
}


// =====================================================
// HTTP SERVER
// =====================================================

const server = http.createServer(
  async (req, res) => {


    // =================================================
    // CORS OPTIONS
    // =================================================

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


    // =================================================
    // HOME PAGE
    // =================================================

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


    // =================================================
    // HEALTH CHECK
    // =================================================

    if (
      req.method === "GET" &&
      req.url === "/health"
    ) {

      sendJSON(res, 200, {

        status: "ok",

        app: "Moyna Pakhi",

        ai: "Gemini",

        model: "gemini-3.8-flash",

        geminiKeyConfigured:
          Boolean(GEMINI_API_KEY)

      });

      return;
    }


    // =================================================
    // AI API
    // =================================================

    if (
      req.method === "POST" &&
      req.url === "/api/ai"
    ) {

      let body = "";


      req.on("data", chunk => {

        body += chunk;


        // Prevent huge requests

        if (
          body.length > 100000
        ) {

          req.destroy();

        }

      });


      req.on("end", async () => {

        try {


          // -------------------------------------------
          // Parse JSON
          // -------------------------------------------

          const data =
            JSON.parse(body);


          const message =
            String(
              data.message || ""
            ).trim();


          // -------------------------------------------
          // Empty message
          // -------------------------------------------

          if (!message) {

            sendJSON(res, 400, {

              error:
                "বার্তা পাওয়া যায়নি"

            });

            return;
          }


          console.log(
            "User:",
            message
          );


          // -------------------------------------------
          // Ask Gemini
          // -------------------------------------------

          const answer =
            await askGemini(
              message
            );


          console.log(
            "Gemini response received"
          );


          // -------------------------------------------
          // Send answer
          // -------------------------------------------

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


    // =================================================
    // 404
    // =================================================

    sendJSON(res, 404, {

      error: "Not Found"

    });

  }
);


// =====================================================
// START SERVER
// =====================================================

server.listen(
  PORT,
  () => {

    console.log(
      "===================================="
    );

    console.log(
      "🐦 Moyna Pakhi AI Server"
    );

    console.log(
      "🤖 AI: Gemini"
    );

    console.log(
      "🧠 Model: gemini-3.8-flash"
    );

    console.log(
      "🔐 Gemini Key:",
      GEMINI_API_KEY
        ? "Configured"
        : "Missing"
    );

    console.log(
      "🚀 Server started on port",
      PORT
    );

    console.log(
      "===================================="
    );

  }
);