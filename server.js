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
  DEMO BUSINESS
  Used only when the browser has not supplied a business profile.
  This keeps the public LAVI demo functional.
*/
const defaultBusiness = {
  name: "LAVI Hotel",
  type: "Hotel & Hospitality",
  services: "Hotel rooms, restaurant, airport transfers",
  hours: "24 hours",
  faq: "Do you offer airport transfers? Yes."
};

function normalize(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

app.post("/chat", async (req, res) => {
  try {
    const message = String(req.body.message || "").trim();

    if (!message) {
      return res.status(400).json({
        error: "Message is required"
      });
    }

    /*
      Use the business supplied by the frontend.
      If none is supplied, use the public demo business.
    */
    const incomingBusiness = req.body.business || {};

    const hasBusinessData =
      incomingBusiness.name ||
      incomingBusiness.type ||
      incomingBusiness.services ||
      incomingBusiness.hours ||
      incomingBusiness.faq;

    const business = hasBusinessData
      ? {
          name: String(incomingBusiness.name || ""),
          type: String(incomingBusiness.type || ""),
          services: String(incomingBusiness.services || ""),
          hours: String(incomingBusiness.hours || ""),
          faq: String(incomingBusiness.faq || "")
        }
      : defaultBusiness;

    const question = normalize(message);
    const faqText = normalize(business.faq);
    const servicesText = normalize(business.services);

    /*
      AIRPORT SERVICES
      Understand common customer wording.
    */
    const airportQuestion =
      question.includes("airport") &&
      (
        question.includes("transfer") ||
        question.includes("transport") ||
        question.includes("pickup") ||
        question.includes("pick up") ||
        question.includes("drop off") ||
        question.includes("dropoff") ||
        question.includes("shuttle")
      );

    const airportServiceProvided =
      (
        faqText.includes("airport") &&
        (
          faqText.includes("transfer") ||
          faqText.includes("transport") ||
          faqText.includes("pickup") ||
          faqText.includes("pick up") ||
          faqText.includes("shuttle")
        ) &&
        /\byes\b/.test(faqText)
      ) ||
      (
        servicesText.includes("airport") &&
        (
          servicesText.includes("transfer") ||
          servicesText.includes("transport") ||
          servicesText.includes("pickup") ||
          servicesText.includes("pick up") ||
          servicesText.includes("shuttle")
        )
      );

    if (airportQuestion && airportServiceProvided) {
      return res.json({
        reply: "Yes, we do offer airport transfers."
      });
    }

    /*
      HOTEL ROOMS
    */
    const roomQuestion =
      question.includes("room") ||
      question.includes("rooms") ||
      question.includes("accommodation") ||
      question.includes("stay");

    const roomsProvided =
      servicesText.includes("room") ||
      servicesText.includes("rooms") ||
      servicesText.includes("accommodation") ||
      faqText.includes("room") ||
      faqText.includes("rooms") ||
      faqText.includes("accommodation");

    if (roomQuestion && roomsProvided) {
      return res.json({
        reply: `Yes — ${business.name || "the business"} offers rooms.`
      });
    }

    /*
      BUSINESS INFORMATION
    */
    const businessInfo = `
BUSINESS INFORMATION — ONLY SOURCE OF TRUTH

Business name:
${business.name || "Not provided"}

Business type:
${business.type || "Not provided"}

Products & Services:
${business.services || "Not provided"}

Opening hours:
${business.hours || "Not provided"}

Frequently Asked Questions:
${business.faq || "Not provided"}
`;

    /*
      OPENAI RESPONSE
    */
    const response = await client.responses.create({
      model: "gpt-5-mini",

      instructions: `
You are LAVI AI, the official customer-support assistant for this business.

STRICT RULES:

1. Use ONLY the business information provided below.
2. Never invent business information.
3. Never invent prices.
4. Never invent availability.
5. Never invent booking requirements.
6. Never invent locations.
7. Never invent policies.
8. Never claim that a booking or availability check has been completed unless a connected system actually confirms it.
9. If the information clearly answers the customer's question, answer directly.
10. Keep responses short, professional and natural.
11. If the business has not provided the requested information, say:
"The business has not provided that information."
12. Do not behave like a generic hotel booking assistant.

${businessInfo}
`,

      input: message
    });

    return res.json({
      reply: response.output_text
    });

  } catch (error) {
    console.error("OpenAI error:", error.message);

    return res.status(500).json({
      error: "LAVI AI could not generate a response."
    });
  }
});

app.get("/health", (req, res) => {
  res.json({
    online: true,
    openaiConfigured: Boolean(process.env.OPENAI_API_KEY)
  });
});

app.listen(PORT, () => {
  console.log(`LAVI AI running on port ${PORT}`);
});