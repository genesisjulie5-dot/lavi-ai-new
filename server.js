require("dotenv").config();

const express = require("express");
const path = require("path");
const OpenAI = require("openai");

const app = express();
const PORT = process.env.PORT || 3000;

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));


/*
  DEMO BUSINESS INFORMATION
*/
const defaultBusiness = {
  name: "LAVI Hotel",
  type: "Hotel & Hospitality",
  services: "Hotel rooms, restaurant, airport transfers",
  hours: "24 hours",
  faq: "Do you offer airport transfers? Yes. Do you offer restaurant services? Yes."
};


/*
  HEALTH CHECK
*/
app.get("/health", (req, res) => {
  res.json({
    online: true,
    openaiConfigured: !!process.env.OPENAI_API_KEY
  });
});


/*
  CHAT
*/
app.post("/chat", async (req, res) => {
  try {
    const message = String(req.body.message || "").trim();

    if (!message) {
      return res.status(400).json({
        error: "Message is required"
      });
    }

    const incomingBusiness = req.body.business || {};


    /*
      Use frontend business information when available.
      Use the demo information for empty fields.
    */
    const business = {
      name:
        String(incomingBusiness.name || "").trim() ||
        defaultBusiness.name,

      type:
        String(incomingBusiness.type || "").trim() ||
        defaultBusiness.type,

      services:
        String(incomingBusiness.services || "").trim() ||
        defaultBusiness.services,

      hours:
        String(incomingBusiness.hours || "").trim() ||
        defaultBusiness.hours,

      faq:
        String(incomingBusiness.faq || "").trim() ||
        defaultBusiness.faq
    };


    const question = message.toLowerCase();

    const servicesText =
      business.services.toLowerCase();

    const faqText =
      business.faq.toLowerCase();


    /*
      AIRPORT TRANSFERS
    */
    const askingAboutAirport =
      question.includes("airport") &&
      (
        question.includes("transfer") ||
        question.includes("transport") ||
        question.includes("pickup") ||
        question.includes("pick up") ||
        question.includes("drop off") ||
        question.includes("drop-off") ||
        question.includes("shuttle")
      );

    const airportAvailable =
      (
        servicesText.includes("airport") &&
        (
          servicesText.includes("transfer") ||
          servicesText.includes("transport") ||
          servicesText.includes("pickup") ||
          servicesText.includes("shuttle")
        )
      ) ||
      (
        faqText.includes("airport") &&
        /\byes\b/.test(faqText)
      );

    if (askingAboutAirport && airportAvailable) {
      return res.json({
        reply: "Yes, we do offer airport transfers."
      });
    }


    /*
      RESTAURANT
    */
    const askingAboutRestaurant =
      question.includes("restaurant") ||
      question.includes("food") ||
      question.includes("dining");

    const restaurantAvailable =
      servicesText.includes("restaurant") ||
      faqText.includes("restaurant");

    if (askingAboutRestaurant && restaurantAvailable) {
      return res.json({
        reply: "Yes, we offer restaurant services."
      });
    }


    /*
      ROOMS / ACCOMMODATION
    */
    const askingAboutRooms =
      question.includes("room") ||
      question.includes("rooms") ||
      question.includes("accommodation") ||
      question.includes("stay");

    const roomsAvailable =
      servicesText.includes("room") ||
      servicesText.includes("accommodation") ||
      faqText.includes("room") ||
      faqText.includes("accommodation");

    if (askingAboutRooms && roomsAvailable) {
      return res.json({
        reply: "Yes, we offer accommodation."
      });
    }


    /*
      BUSINESS INFORMATION
    */
    const businessInfo = `
BUSINESS INFORMATION — ONLY SOURCE OF TRUTH

Business name:
${business.name}

Business type:
${business.type}

Products & Services:
${business.services}

Opening hours:
${business.hours}

Frequently Asked Questions:
${business.faq}
`;


    /*
      OPENAI
    */
    const response = await client.responses.create({
      model: "gpt-5-mini",

      instructions: `
You are LAVI AI, the official customer-support assistant for this business.

RULES:

1. Use ONLY the business information provided below.
2. Never invent prices.
3. Never invent availability.
4. Never invent locations.
5. Never invent policies.
6. Never invent services.
7. Never invent booking requirements.
8. Never claim that a booking has been made.
9. Answer directly when the information is available.
10. Keep answers short, professional and natural.
11. If the information is genuinely missing, say:
"The business has not provided that information."

${businessInfo}
`,

      input: message
    });


    res.json({
      reply: response.output_text
    });

  } catch (error) {
    console.error("OpenAI error:", error.message);

    res.status(500).json({
      error: "LAVI AI could not generate a response."
    });
  }
});


/*
  START SERVER
*/
app.listen(PORT, () => {
  console.log(`LAVI AI running at http://localhost:${PORT}`);
});