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
  DEMO BUSINESS PROFILE
  Used when no complete business profile
  has been provided by the frontend.
*/
const defaultBusiness = {
  name: "LAVI Hotel",
  type: "Hotel & Hospitality",
  services: "Hotel rooms, restaurant, airport transfers",
  hours: "24 hours",
  faq: "Do you offer airport transfers? Yes."
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
  AI CHAT
*/
app.post("/chat", async (req, res) => {
  try {
    const message = String(req.body.message || "").trim();

    if (!message) {
      return res.status(400).json({
        error: "Message is required"
      });
    }

    let business = req.body.business || {};

    /*
      If the frontend sends no useful business information,
      use the demo business profile.
    */
    const hasBusinessData =
      business.name ||
      business.type ||
      business.services ||
      business.hours ||
      business.faq;

    if (!hasBusinessData) {
      business = defaultBusiness;
    }

    const faq = String(business.faq || "");
    const services = String(business.services || "");

    const question = message.toLowerCase().trim();
    const faqText = faq.toLowerCase();
    const servicesText = services.toLowerCase();


    /*
      DIRECT BUSINESS FACTS
      These rules take priority over the AI.
    */

    const askingAboutAirportTransfer =
      (
        question.includes("airport") &&
        (
          question.includes("transfer") ||
          question.includes("transport") ||
          question.includes("pickup") ||
          question.includes("pick up") ||
          question.includes("drop off") ||
          question.includes("drop-off") ||
          question.includes("shuttle")
        )
      );

    const businessConfirmsAirportTransfer =
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
        (
          faqText.includes("transfer") ||
          faqText.includes("transport") ||
          faqText.includes("pickup") ||
          faqText.includes("shuttle")
        ) &&
        /\byes\b/.test(faqText)
      );


    if (
      askingAboutAirportTransfer &&
      businessConfirmsAirportTransfer
    ) {
      return res.json({
        reply: "Yes, we do offer airport transfers."
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

    const businessOffersRooms =
      servicesText.includes("room") ||
      servicesText.includes("accommodation") ||
      faqText.includes("room") ||
      faqText.includes("accommodation");


    if (
      askingAboutRooms &&
      businessOffersRooms
    ) {
      return res.json({
        reply: "Yes, we offer accommodation."
      });
    }


    /*
      BUSINESS INFORMATION
    */

    const businessInfo = `
BUSINESS INFORMATION — USE AS THE ONLY SOURCE OF TRUTH

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

CRITICAL RULES:

1. The business information below is the ONLY source of truth.
2. Never invent information.
3. Never assume the business offers a service unless it is explicitly listed.
4. Never invent prices.
5. Never invent availability.
6. Never invent booking requirements.
7. Never invent vehicle types.
8. Never invent policies.
9. Never invent locations.
10. Never claim to check availability or make a booking unless a real connected system confirms it.
11. If the business information answers the customer's question, answer directly.
12. Do not add unnecessary questions or procedures.
13. If information is missing, say:
"The business has not provided that information."
14. Keep answers short, professional and natural.
15. Do NOT behave like a generic hotel booking assistant.

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