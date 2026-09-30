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
// HTML
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
// WAIT
// =====================================================

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}


// =====================================================
// GEMINI REQUEST
// =====================================================

async function requestGemini(model, message) {

  const url =
    "https://generativelanguage.googleapis.com/v1beta/models/" +
    model +
    ":generateContent?key=" +
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
              "বাংলায় প্রশ্ন করলে বাংলায় উত্তর দেবে। " +
              "তথ্য নিশ্চিত না হলে সেটা পরিষ্কারভাবে বলবে। " +
              "উত্তর স্বাভাবিক মানুষের কথার মতো হবে।"
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
        maxOutputTokens: 1200
      }

    })
  });

  const data = await response.json();

  return {
    ok: response.ok,
    status: response.status,
    data: data
  };
}


// =====================================================
// GEMINI AI WITH RETRY + FALLBACK
// =====================================================

async function askGemini(message) {

  if (!GEMINI_API_KEY) {
    throw new Error(
      "GEMINI_API_KEY পাওয়া যায়নি। Render Environment চেক করো।"
    );
  }


  // বর্তমান stable model আগে
  const models = [
    "gemini-3.8-flash",
    "gemini-3.7-flash",
    "gemini-3.6-flash",
    "gemini-3.5-flash"
  ];


  let lastError =
    "Gemini থেকে উত্তর পাওয়া যায়নি";


  // প্রতিটি model চেষ্টা করবে
  for (const model of models) {

    // একই model সর্বোচ্চ 2 বার চেষ্টা
    for (let attempt = 1; attempt <= 2; attempt++) {

      try {

        console.log(
          `Trying ${model} - attempt ${attempt}`
        );


        const result =
          await requestGemini(
            model,
            message
          );


        const data =
          result.data;


        // সফল
        if (result.ok) {

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


          if (answer.trim()) {

            console.log(
              `Success with ${model}`
            );

            return answer.trim();
          }


          lastError =
            "Gemini খালি উত্তর দিয়েছে";


          break;
        }


        // Error message
        const errorMessage =
          data?.error?.message ||
          "Unknown Gemini error";


        lastError =
          errorMessage;


        console.error(
          `${model} error:`,
          errorMessage
        );


        // যেসব error-এ fallback/retry করা হবে
        const temporaryError =
          result.status === 429 ||
          result.status === 500 ||
          result.status === 502 ||
          result.status === 503 ||
          result.status === 504 ||
          /high demand/i.test(errorMessage) ||
          /temporarily/i.test(errorMessage) ||
          /overloaded/i.test(errorMessage) ||
          /unavailable/i.test(errorMessage);


        if (temporaryError) {

          // দ্বিতীয়বার চেষ্টা করার আগে অপেক্ষা
          if (attempt === 1) {

            console.log(
              `${model} temporarily unavailable. Retrying...`
            );

            await wait(2500);

            continue;
          }

          // এই model ব্যস্ত হলে পরের model
          break;
        }


        // অন্য error হলে সরাসরি পরের model
        break;


      } catch (error) {

        lastError =
          error.message ||
          "Network error";


        console.error(
          `${model} request error:`,
          error
        );


        if (attempt === 1) {

          await wait(2000);

          continue;
        }

        break;
      }

    }

  }


  throw new Error(lastError);
}


// =====================================================
// HTTP SERVER
// =====================================================

const server = http.createServer(
  async (req, res) => {


    // =================================================
    // CORS
    // =================================================

    if (req.method === "OPTIONS") {

      res.writeHead(204, {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "GET,POST,OPTIONS"
      });

      res.end();

      return;
    }


    // =================================================
    // HOME
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
    // HEALTH
    // =================================================

    if (
      req.method === "GET" &&
      req.url === "/health"
    ) {

      sendJSON(res, 200, {

        status: "ok",

        app: "Moyna Pakhi",

        ai: "Gemini",

        primaryModel:
          "gemini-3.8-flash",

        fallbackModels: [
          "gemini-3.7-flash",
          "gemini-3.6-flash",
          "gemini-3.5-flash"
        ],

        geminiKeyConfigured:
          Boolean(GEMINI_API_KEY)

      });

      return;
    }


    // =================================================
    // AI
    // =================================================

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

          const data =
            JSON.parse(body);


          const message =
            String(
              data.message || ""
            ).trim();


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


          const answer =
            await askGemini(
              message
            );


          console.log(
            "AI response received successfully"
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


    // =================================================
    // 404
    // =================================================

    sendJSON(res, 404, {
      error: "Not Found"
    });

  }
);


// =====================================================
// START
// =====================================================

server.listen(PORT, () => {

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
    "🔄 Retry + Fallback: Enabled"
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

});