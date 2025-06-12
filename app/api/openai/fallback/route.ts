import { NextRequest, NextResponse } from 'next/server';
import OpenAI from "openai";

// Simple predefined responses for common questions about Printform
const PREDEFINED_RESPONSES: Record<string, string> = {
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

// Set a timeout for the entire API request
const API_TIMEOUT = 10000; // 10 seconds for the fallback API

export async function POST(request: NextRequest) {
  // Create a controller for the timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT);
  
  try {
    console.log('OpenAI Fallback API route called');
    
    // Parse the request body
    const body = await request.json();
    const { question: rawQuestion } = body;

    if (!rawQuestion) {
      console.error('Question is missing in the request');
      return NextResponse.json(
        { error: 'Question is required' },
        { status: 400 }
      );
    }

    // Limit question length
    const MAX_QUESTION_LENGTH = 500; // Very short for fallback
    const question = rawQuestion.length > MAX_QUESTION_LENGTH 
      ? rawQuestion.substring(0, MAX_QUESTION_LENGTH) + "... [truncated due to length]"
      : rawQuestion;

    console.log(`Processing fallback question: "${question.substring(0, 50)}${question.length > 50 ? '...' : ''}"`);

    // Try to find a predefined response
    const lowerQuestion = question.toLowerCase();
    let answer = null;
    
    // Check for keyword matches in the predefined responses
    for (const [keyword, response] of Object.entries(PREDEFINED_RESPONSES)) {
      if (lowerQuestion.includes(keyword.toLowerCase())) {
        answer = response;
        break;
      }
    }
    
    // If no predefined response was found, try to use OpenAI's completion API
    if (!answer) {
      try {
        // Get the OpenAI API key
        const apiKey = process.env.OPENAI_API_KEY;
        
        if (!apiKey) {
          throw new Error('OpenAI API key is missing');
        }
        
        // Create a simple OpenAI client
        const openai = new OpenAI({ apiKey });
        
        // Create a promise that will be rejected if the controller aborts
        const abortPromise = new Promise<never>((_, reject) => {
          controller.signal.addEventListener('abort', () => {
            reject(new Error('Request timed out after 10 seconds'));
          });
        });
        
        // Use a simpler model and approach for the fallback
        const completion = await Promise.race([
          openai.chat.completions.create({
            model: "gpt-3.5-turbo", // Use a faster model
            messages: [
              {
                role: "system",
                content: "You are a support assistant for Printform Manufacturing Company. Keep your answers brief and focused on Printform's manufacturing services (CNC Machining, Injection Molding, Sheet Metal, Cast Urethane, and 3D Printing). Printform also offers MCloud, a proprietary platform for manufacturing management."
              },
              {
                role: "user",
                content: question
              }
            ],
            max_tokens: 150, // Keep responses short
            temperature: 0.7,
          }),
          abortPromise
        ]);
        
        answer = completion.choices[0].message.content;
      } catch (openaiError) {
        console.error('Error with OpenAI service in fallback:', openaiError);
        
        // Use a generic response if OpenAI fails
        answer = "I'm sorry, but I'm currently experiencing technical limitations in the Netlify environment. I can provide information about Printform's manufacturing services including CNC Machining, Injection Molding, Sheet Metal Fabrication, Cast Urethane, and 3D Printing. Please try asking a more specific question about these services.";
      }
    }
    
    // If we still don't have an answer, use a generic response
    if (!answer) {
      answer = "I'm sorry, but I don't have specific information about that topic. Printform Manufacturing Company provides custom parts manufacturing services including CNC Machining, Injection Molding, Sheet Metal Fabrication, Cast Urethane, and 3D Printing. Is there something specific about these services you'd like to know?";
    }

    // Clear the timeout
    clearTimeout(timeoutId);

    // Return the response
    return NextResponse.json({ 
      answer,
      threadId: null,
      fallback: true
    });
  } catch (error: any) {
    console.error('Error in OpenAI Fallback API route:', error);
    
    // Clear the timeout
    clearTimeout(timeoutId);
    
    // Return a generic response for any errors
    return NextResponse.json({ 
      answer: "I apologize, but I'm currently experiencing technical limitations in the Netlify environment. Please try again with a simpler question about Printform's manufacturing services.",
      threadId: null,
      fallback: true
    });
  }
}