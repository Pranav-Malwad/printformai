// Ultra-lightweight fallback function - no OpenAI API calls
// Just returns a generic response to ensure it completes within the timeout

exports.handler = async function(event, context) {
  try {
    console.log('Ultra-lightweight fallback function called');
    
    // Return a generic response immediately
    return {
      statusCode: 200,
      body: JSON.stringify({ 
        answer: "I apologize, but I'm currently experiencing technical limitations. Printform Manufacturing Company provides custom parts manufacturing services including CNC Machining, Injection Molding, Sheet Metal Fabrication, Cast Urethane, and 3D Printing. Please try asking a more specific question about these services.",
        threadId: null,
        fallback: true
      })
    };
  } catch (error) {
    console.error('Error in fallback function:', error);
    
    // Return a generic response for any errors
    return {
      statusCode: 200,
      body: JSON.stringify({ 
        answer: "I apologize, but I'm currently experiencing technical limitations. Please try again with a simpler question about Printform's manufacturing services.",
        threadId: null,
        fallback: true
      })
    };
  }
};