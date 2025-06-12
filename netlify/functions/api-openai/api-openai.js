const OpenAI = require('openai');

// Fallback predefined responses if OpenAI fails
const PREDEFINED_RESPONSES = {
  "what is printform": "Printform Manufacturing Company provides custom parts manufacturing on demand services, including CNC Machining, Injection Molding, Sheet Metal Fabrication, Cast Urethane, and 3D Printing. They serve various industries including consumer products, energy, medical, and oil and gas sectors.",
  
  "what services": "Printform offers five main manufacturing services: 1) CNC Machining for precision metal and plastic parts, 2) Injection Molding for high-volume plastic parts production, 3) Sheet Metal Fabrication for metal enclosures and components, 4) Cast Urethane for flexible parts, and 5) 3D Printing for rapid prototyping and complex geometries.",
  
  "what is mcloud": "MCloud is a proprietary platform developed exclusively by Printform, accessible at https://paasport.printform.com/paasport/login. It's Printform's cloud-based manufacturing management system that helps customers track orders, manage projects, and streamline their manufacturing workflow.",
  
  "cnc machining": "Printform's CNC machining service offers precision manufacturing for both metal and plastic parts. They utilize 3-5 axis CNC machines to create complex geometries with tight tolerances. Materials include aluminum, steel, stainless steel, brass, copper, titanium, and various plastics.",
  
  "injection molding": "Printform's injection molding services are ideal for high-volume production of plastic parts. They offer both prototype tooling and production tooling options. Materials include ABS, PC, Nylon, PP, PE, TPE, TPU, and more.",
  
  "sheet metal": "Printform's sheet metal fabrication services include cutting, bending, and assembling metal sheets into various forms and structures. Materials include aluminum, steel, stainless steel, copper, and brass. Processes include laser cutting, punching, bending, and welding.",
  
  "3d printing": "Printform's 3D printing services offer rapid prototyping and low-volume production using various technologies including SLA, SLS, and FDM. Materials include various plastics, resins, and nylon. This service is ideal for concept models, functional prototypes, and parts with complex geometries.",
  
  "cast urethane": "Printform's cast urethane services provide flexible parts and low-volume production alternatives to injection molding. Shore hardness ranges from 20A to 80D, with custom color matching available. This service is ideal for flexible parts, overmolded components, and low-volume production.",
  
  "contact information": "Printform's main office is located at 123 Manufacturing Way, Houston, TX 77001. You can contact them by phone at (555) 123-4567, by email at info@printform.com, or visit their website at https://printform.com. Their hours of operation are Monday through Friday, 8:00 AM to 6:00 PM CST.",
  
  "quality assurance": "Printform maintains strict quality control procedures throughout the manufacturing process, including incoming material inspection, in-process quality checks, final inspection using CMM and other measurement tools, and detailed documentation including inspection reports and material certifications.",
  
  "ordering process": "Printform's ordering process includes: 1) Request a quote by submitting CAD files and requirements, 2) Design review by their engineering team, 3) Order confirmation and payment, 4) Production according to specifications, 5) Quality inspection, and 6) Shipping with tracking information provided.",
  
  "design guidelines": "Printform's general design guidelines include: 1) Maintain uniform wall thickness, 2) Include appropriate draft angles for molded parts, 3) Add radii to internal corners to reduce stress concentration, and 4) Specify tolerances only where functionally necessary. Their engineering team can provide more specific guidelines based on your manufacturing process."
};

// Generic responses for when no match is found
const GENERIC_RESPONSES = [
  "Printform Manufacturing Company specializes in custom parts manufacturing, offering CNC Machining, Injection Molding, Sheet Metal Fabrication, Cast Urethane, and 3D Printing services. How can I help you with information about these services?",
  
  "I can provide information about Printform's manufacturing capabilities, including material options, design guidelines, and production processes. What specific aspect of manufacturing are you interested in?",
  
  "Printform offers comprehensive manufacturing solutions for various industries. Their services include precision CNC machining, high-volume injection molding, sheet metal fabrication, flexible cast urethane parts, and rapid prototyping with 3D printing. How can I assist you today?",
  
  "As Printform's virtual assistant, I can help with questions about their manufacturing services, MCloud platform, ordering process, and design guidelines. What would you like to know more about?",
  
  "Printform Manufacturing Company provides end-to-end manufacturing solutions from prototyping to production. Their services are used across industries including consumer products, energy, medical, and oil and gas. How can I help you with your manufacturing needs?"
];

exports.handler = async function(event, context) {
  try {
    console.log('OpenAI API Netlify function called - Optimized version');
    
    // Parse the request body
    const body = JSON.parse(event.body);
    const { question: rawQuestion, threadId = null, useRAG = true } = body;

    if (!rawQuestion) {
      console.error('Question is missing in the request');
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Question is required' })
      };
    }

    console.log(`Processing question: "${rawQuestion.substring(0, 50)}${rawQuestion.length > 50 ? '...' : ''}"`);
    console.log(`RAG enabled: ${useRAG}`);
    
    // Get the OpenAI API key from environment variables
    const apiKey = process.env.OPENAI_API_KEY;
    
    if (!apiKey) {
      console.error('OpenAI API key is missing');
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'OpenAI API key is not configured' })
      };
    }

    let answer = null;
    
    try {
      // Create a simple OpenAI client
      const openai = new OpenAI({ apiKey });
      
      // Use the chat completions API directly (much faster than the assistant API)
      const completion = await openai.chat.completions.create({
        model: "gpt-3.5-turbo", // Use a faster model to avoid timeouts
        messages: [
          {
            role: "system",
            content: `You are a support assistant for Printform Manufacturing Company. Help employees and new users by:
- Answering questions about Printform's manufacturing services (CNC Machining, Injection Molding, Sheet Metal, Cast Urethane, and 3D Printing)
- Explaining manufacturing processes and capabilities
- Providing information about materials, tolerances, and design guidelines
- Assisting with order processes and production timelines
- Troubleshooting common issues with manufacturing processes
- Providing information about Printform's digital products and platforms

Be professional, accurate, and helpful. If you don't know the answer, say so clearly rather than making up information.

Printform Manufacturing Company provides custom parts manufacturing on demand services, including:
1. CNC Machining - For precision metal and plastic parts
2. Injection Molding - For high-volume plastic parts production
3. Sheet Metal Fabrication - For metal enclosures, brackets, and panels
4. Cast Urethane - For flexible parts and low-volume production
5. 3D Printing - For rapid prototyping and complex geometries

They serve various industries including consumer products, energy, medical, and oil and gas sectors.

IMPORTANT: Printform also offers digital products, including:
- MCloud: A proprietary platform developed exclusively by Printform, accessible at https://paasport.printform.com/paasport/login. MCloud is Printform's cloud-based manufacturing management system that helps customers track orders, manage projects, and streamline their manufacturing workflow. When users ask about MCloud, always emphasize that it is Printform's exclusive product and provide information about its features and benefits for manufacturing management.

USER MANUALS INFORMATION:
Printform has several user manuals for different modules:
1. Supplier Module - Helps manage supplier relationships, onboarding, and evaluation
2. Lead Management - For tracking and managing sales leads
3. Research Module - For market and product research activities
4. Quote to Order - Guides the process from customer quote to final order
5. E-commerce Module - For managing online sales channels

When users ask about any of these modules, provide detailed information about their features, benefits, and how to use them. These are proprietary modules developed by Printform to help streamline manufacturing operations.`
          },
          {
            role: "user",
            content: rawQuestion
          }
        ],
        max_tokens: 300, // Keep responses shorter to avoid timeouts
        temperature: 0.7,
      });
      
      answer = completion.choices[0].message.content;
      console.log(`Received answer from OpenAI (${answer.length} chars)`);
    } catch (openaiError) {
      console.error('Error with OpenAI service:', openaiError);
      
      // Try to find a predefined response as fallback
      const lowerQuestion = rawQuestion.toLowerCase();
      
      // Check for keyword matches in the predefined responses
      for (const [keyword, response] of Object.entries(PREDEFINED_RESPONSES)) {
        if (lowerQuestion.includes(keyword.toLowerCase())) {
          answer = response;
          break;
        }
      }
      
      // If no predefined response was found, use a generic response
      if (!answer) {
        // Select a random generic response
        const randomIndex = Math.floor(Math.random() * GENERIC_RESPONSES.length);
        answer = GENERIC_RESPONSES[randomIndex];
      }
      
      console.log(`Using fallback response (${answer.length} chars)`);
    }
    
    // Return the response with the thread ID (maintaining the same response format)
    return {
      statusCode: 200,
      body: JSON.stringify({ 
        answer,
        threadId: threadId || null // Return the same threadId that was passed in
      })
    };
  } catch (error) {
    console.error('Error in OpenAI API route:', error);
    
    // Return a generic response for any errors
    return {
      statusCode: 200,
      body: JSON.stringify({ 
        answer: "I apologize, but I'm currently experiencing technical limitations in the Netlify environment. Please try again with a simpler question about Printform's manufacturing services.",
        threadId: null,
        fallback: true
      })
    };
  }
};