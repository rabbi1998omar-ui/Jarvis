const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 10000;

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

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


async function askAI(message) {

  if (!OPENAI_API_KEY) {

    throw new Error(
      "OPENAI_API_KEY পাওয়া যায়নি"
    );

  }


  const response = await fetch(
    "https://api.openai.com/v1/responses",
    {

      method: "POST",

      headers: {

        "Content-Type":
          "application/json",

        "Authorization":
          "Bearer " + OPENAI_API_KEY

      },

      body: JSON.stringify({

        model: "gpt-5.6-luna",

        instructions:
          "তুমি ময়না পাখি নামে একজন বন্ধুসুলভ বাংলা ভয়েস অ্যাসিস্ট্যান্ট। ব্যবহারকারীর প্রশ্নের সহজ, স্বাভাবিক এবং সংক্ষিপ্ত বাংলায় উত্তর দাও। তথ্য নিশ্চিত না হলে সেটা পরিষ্কারভাবে বলো।",

        input: message

      })

    }
  );


  const data =
    await response.json();


  if (!response.ok) {

    console.error(
      "OpenAI Error:",
      data
    );

    throw new Error(
      data?.error?.message ||
      "AI response পাওয়া যায়নি"
    );

  }


  let answer = "";


  if (data.output_text) {

    answer =
      data.output_text;

  } else if (data.output) {

    for (
      const item of data.output
    ) {

      if (
        item.type === "message" &&
        Array.isArray(item.content)
      ) {

        for (
          const content of item.content
        ) {

          if (
            content.type === "output_text"
          ) {

            answer +=
              content.text || "";

          }

        }

      }

    }

  }


  if (!answer.trim()) {

    answer =
      "দুঃখিত, এখন কোনো উত্তর পাওয়া যায়নি।";

  }


  return answer.trim();

}


const server =
  http.createServer(
    async (req, res) => {

      /* =========================
         CORS OPTIONS
      ========================= */

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


      /* =========================
         HOME
      ========================= */

      if (
        req.method === "GET" &&
        (req.url === "/" ||
         req.url === "/index.html")
      ) {

        sendHTML(res);

        return;

      }


      /* =========================
         HEALTH
      ========================= */

      if (
        req.method === "GET" &&
        req.url === "/health"
      ) {

        sendJSON(res, 200, {
          status: "ok",
          app: "Moyna Pakhi"
        });

        return;

      }


      /* =========================
         AI
      ========================= */

      if (
        req.method === "POST" &&
        req.url === "/api/ai"
      ) {

        let body = "";

        req.on(
          "data",
          chunk => {

            body += chunk;

            if (
              body.length >
              100000
            ) {

              req.destroy();

            }

          }
        );


        req.on(
          "end",
          async () => {

            try {

              const data =
                JSON.parse(body);


              const message =
                String(
                  data.message || ""
                ).trim();


              if (!message) {

                sendJSON(
                  res,
                  400,
                  {
                    error:
                      "বার্তা পাওয়া যায়নি"
                  }
                );

                return;

              }


              const answer =
                await askAI(message);


              sendJSON(
                res,
                200,
                {
                  answer
                }
              );


            } catch (error) {

              console.error(error);


              sendJSON(
                res,
                500,
                {
                  error:
                    error.message ||
                    "Server error"
                }
              );

            }

          }
        );


        return;

      }


      /* =========================
         404
      ========================= */

      sendJSON(
        res,
        404,
        {
          error:
            "Not Found"
        }
      );

    }
  );


server.listen(
  PORT,
  () => {

    console.log(
      `Moyna Pakhi server started on port ${PORT}`
    );

  }
);