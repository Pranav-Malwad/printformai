/**
 * Command Prompting Utility for Printform Support Agent
 * 
 * This utility helps structure commands for the AI agent to perform specific actions
 * related to Printform manufacturing processes and support.
 */

// Define command types
export enum CommandType {
  LOOKUP_MATERIAL = 'lookup_material',
  CHECK_PROCESS = 'check_process',
  ESTIMATE_TIME = 'estimate_time',
  CALCULATE_COST = 'calculate_cost',
  TROUBLESHOOT = 'troubleshoot',
  EXPLAIN_PROCESS = 'explain_process',
  COMPARE_METHODS = 'compare_methods',
  FIND_RESOURCE = 'find_resource',
}

// Interface for command parameters
interface CommandParams {
  [key: string]: string | number | boolean;
}

// Command structure
export interface Command {
  type: CommandType;
  params: CommandParams;
  description: string;
}

/**
 * Parse a command string into a structured command
 * Format: /command param1=value1 param2=value2
 */
export function parseCommand(commandStr: string): Command | null {
  if (!commandStr.startsWith('/')) {
    return null;
  }

  const parts = commandStr.trim().split(' ');
  const commandTypeStr = parts[0].substring(1).toLowerCase(); // Remove the / and convert to lowercase
  
  // Map string to CommandType
  let type: CommandType | undefined;
  
  switch (commandTypeStr) {
    case 'material':
    case 'lookup_material':
      type = CommandType.LOOKUP_MATERIAL;
      break;
    case 'process':
    case 'check_process':
      type = CommandType.CHECK_PROCESS;
      break;
    case 'time':
    case 'estimate_time':
      type = CommandType.ESTIMATE_TIME;
      break;
    case 'cost':
    case 'calculate_cost':
      type = CommandType.CALCULATE_COST;
      break;
    case 'troubleshoot':
      type = CommandType.TROUBLESHOOT;
      break;
    case 'explain':
    case 'explain_process':
      type = CommandType.EXPLAIN_PROCESS;
      break;
    case 'compare':
    case 'compare_methods':
      type = CommandType.COMPARE_METHODS;
      break;
    case 'resource':
    case 'find_resource':
      type = CommandType.FIND_RESOURCE;
      break;
    default:
      return null;
  }

  // Parse parameters
  const params: CommandParams = {};
  for (let i = 1; i < parts.length; i++) {
    const paramParts = parts[i].split('=');
    if (paramParts.length === 2) {
      const [key, value] = paramParts;
      
      // Try to convert to number if possible
      const numValue = Number(value);
      params[key] = !isNaN(numValue) ? numValue : value;
    }
  }

  // Generate description based on command type and parameters
  let description = '';
  switch (type) {
    case CommandType.LOOKUP_MATERIAL:
      description = `Looking up information about material: ${params.name || 'specified material'}`;
      break;
    case CommandType.CHECK_PROCESS:
      description = `Checking manufacturing process: ${params.name || 'specified process'}`;
      break;
    case CommandType.ESTIMATE_TIME:
      description = `Estimating production time for ${params.process || 'manufacturing process'}`;
      break;
    case CommandType.CALCULATE_COST:
      description = `Calculating estimated cost for ${params.item || 'production'}`;
      break;
    case CommandType.TROUBLESHOOT:
      description = `Troubleshooting issue: ${params.issue || 'specified issue'}`;
      break;
    case CommandType.EXPLAIN_PROCESS:
      description = `Explaining process: ${params.name || 'specified process'}`;
      break;
    case CommandType.COMPARE_METHODS:
      description = `Comparing manufacturing methods: ${params.method1 || 'method 1'} vs ${params.method2 || 'method 2'}`;
      break;
    case CommandType.FIND_RESOURCE:
      description = `Finding resources about: ${params.topic || 'specified topic'}`;
      break;
  }

  return {
    type,
    params,
    description,
  };
}

/**
 * Process a command and generate a response
 */
export async function processCommand(command: Command): Promise<string> {
  // In a real implementation, this would call specific APIs or services
  // For this demo, we'll just return structured information based on the command
  
  switch (command.type) {
    case CommandType.LOOKUP_MATERIAL:
      return generateMaterialInfo(command.params);
    case CommandType.CHECK_PROCESS:
      return generateProcessInfo(command.params);
    case CommandType.ESTIMATE_TIME:
      return generateTimeEstimate(command.params);
    case CommandType.CALCULATE_COST:
      return generateCostEstimate(command.params);
    case CommandType.TROUBLESHOOT:
      return generateTroubleshootingSteps(command.params);
    case CommandType.EXPLAIN_PROCESS:
      return generateProcessExplanation(command.params);
    case CommandType.COMPARE_METHODS:
      return generateMethodComparison(command.params);
    case CommandType.FIND_RESOURCE:
      return generateResourceInfo(command.params);
    default:
      return "Unknown command type";
  }
}

// Helper functions to generate responses for each command type
function generateMaterialInfo(params: CommandParams): string {
  const materialName = params.name || params.material || '';
  
  // Sample material information
  const materials: {[key: string]: string} = {
    'abs': 'ABS (Acrylonitrile Butadiene Styrene) is a common thermoplastic polymer. Properties: Strong, lightweight, and slightly flexible. Used for: Automotive parts, consumer goods, and electronic housings.',
    'pla': 'PLA (Polylactic Acid) is a biodegradable thermoplastic. Properties: Rigid, easy to print with, environmentally friendly. Used for: Prototypes, consumer products, and medical implants.',
    'aluminum': 'Aluminum is a lightweight metal. Properties: Excellent strength-to-weight ratio, corrosion resistant, good thermal conductivity. Used for: Aerospace components, automotive parts, and consumer electronics.',
    'steel': 'Steel is an alloy of iron and carbon. Properties: High strength, durability, and heat resistance. Used for: Structural components, tools, and machinery parts.',
  };
  
  const materialKey = String(materialName).toLowerCase();
  
  if (materialKey in materials) {
    return materials[materialKey];
  } else {
    return `Information about ${materialName} is not available in our database. Please contact our materials specialist for more information.`;
  }
}

function generateProcessInfo(params: CommandParams): string {
  const processName = params.name || params.process || '';
  
  // Sample process information
  const processes: {[key: string]: string} = {
    'cnc': 'CNC Machining at Printform: Computer Numerical Control machining removes material from a solid block to create precise parts. We offer 3-5 axis CNC machining for both metals and plastics with tolerances as tight as ±0.001".',
    'injection': 'Injection Molding at Printform: Process involves injecting molten material into a mold cavity. Ideal for high-volume production runs (1,000+ parts). We offer both prototype tooling and production tooling options.',
    'sheet metal': 'Sheet Metal Fabrication at Printform: Process includes cutting, bending, and assembling metal sheets. We offer laser cutting, punching, bending, and welding services with standard tolerances of ±0.005".',
    '3d printing': '3D Printing at Printform: Additive manufacturing process building parts layer by layer. We offer SLA, SLS, and FDM technologies for prototypes and small production runs with typical tolerances of ±0.005".',
  };
  
  const processKey = String(processName).toLowerCase();
  
  if (processKey in processes) {
    return processes[processKey];
  } else {
    return `Information about the ${processName} process is not available in our database. Please contact our manufacturing specialist for more information.`;
  }
}

function generateTimeEstimate(params: CommandParams): string {
  const process = String(params.process || '').toLowerCase();
  const quantity = Number(params.quantity || 1);
  const complexity = String(params.complexity || 'medium').toLowerCase();
  
  let baseTime = 0;
  let processName = '';
  
  // Base time estimates in days
  switch (process) {
    case 'cnc':
      baseTime = 5;
      processName = 'CNC Machining';
      break;
    case 'injection':
      baseTime = 15; // Includes tooling time
      processName = 'Injection Molding';
      break;
    case 'sheet':
      baseTime = 3;
      processName = 'Sheet Metal Fabrication';
      break;
    case '3d':
    case '3dprint':
      baseTime = 2;
      processName = '3D Printing';
      break;
    default:
      return 'Please specify a valid manufacturing process (cnc, injection, sheet, 3d) to get a time estimate.';
  }
  
  // Adjust for complexity
  let complexityMultiplier = 1;
  switch (complexity) {
    case 'low':
      complexityMultiplier = 0.8;
      break;
    case 'medium':
      complexityMultiplier = 1;
      break;
    case 'high':
      complexityMultiplier = 1.5;
      break;
    default:
      complexityMultiplier = 1;
  }
  
  // Adjust for quantity
  let quantityAdjustment = 0;
  if (process === 'injection') {
    // Injection molding gets faster per part as quantity increases
    quantityAdjustment = Math.log10(quantity) * 0.5;
  } else {
    // Other processes scale more linearly with quantity
    quantityAdjustment = Math.ceil(quantity / 10);
  }
  
  const totalTime = Math.ceil(baseTime * complexityMultiplier + quantityAdjustment);
  
  return `Estimated production time for ${quantity} ${complexity} complexity parts using ${processName}: approximately ${totalTime} business days. This is an estimate only; please contact our sales team for a precise quote.`;
}

function generateCostEstimate(params: CommandParams): string {
  // This would typically connect to a pricing API or database
  // For demo purposes, we'll return a generic response
  
  const item = params.item || 'product';
  const process = String(params.process || '').toLowerCase();
  const quantity = Number(params.quantity || 1);
  const material = String(params.material || '').toLowerCase();
  
  let basePrice = 0;
  let processName = '';
  
  // Very rough base price estimates
  switch (process) {
    case 'cnc':
      basePrice = 150;
      processName = 'CNC Machining';
      break;
    case 'injection':
      basePrice = 5000; // Includes tooling cost
      processName = 'Injection Molding';
      break;
    case 'sheet':
      basePrice = 100;
      processName = 'Sheet Metal Fabrication';
      break;
    case '3d':
    case '3dprint':
      basePrice = 75;
      processName = '3D Printing';
      break;
    default:
      return 'Please specify a valid manufacturing process (cnc, injection, sheet, 3d) to get a cost estimate.';
  }
  
  // Material cost multiplier
  let materialMultiplier = 1;
  if (material) {
    switch (material) {
      case 'aluminum':
        materialMultiplier = 1.2;
        break;
      case 'steel':
        materialMultiplier = 1.5;
        break;
      case 'titanium':
        materialMultiplier = 3;
        break;
      case 'abs':
      case 'pla':
        materialMultiplier = 0.8;
        break;
      default:
        materialMultiplier = 1;
    }
  }
  
  // Calculate total cost
  let totalCost = 0;
  
  if (process === 'injection') {
    // Injection molding has high tooling cost but low per-part cost
    const toolingCost = basePrice;
    const perPartCost = 2 * materialMultiplier;
    totalCost = toolingCost + (perPartCost * quantity);
  } else {
    // Other processes scale more linearly
    totalCost = basePrice * materialMultiplier * Math.sqrt(quantity);
  }
  
  return `Estimated cost for ${quantity} ${material || ''} ${item} using ${processName}: approximately $${Math.ceil(totalCost)}. This is a rough estimate only; please contact our sales team for a precise quote based on your specific requirements.`;
}

function generateTroubleshootingSteps(params: CommandParams): string {
  const issue = String(params.issue || '').toLowerCase();
  
  // Sample troubleshooting guides
  const troubleshootingGuides: {[key: string]: string} = {
    'warping': `Troubleshooting Warping Issues in 3D Printing:
1. Increase bed temperature by 5-10°C
2. Use a brim or raft for better adhesion
3. Ensure proper cooling settings
4. Check for drafts in the printing environment
5. Consider using an enclosure
6. Try a different material or brand`,
    
    'tolerance': `Troubleshooting Tolerance Issues in CNC Machining:
1. Verify CAD model dimensions and tolerances
2. Check for proper tool selection and condition
3. Ensure machine calibration is up to date
4. Consider thermal effects on material
5. Review fixturing and workholding setup
6. Adjust cutting parameters (speed, feed rate)
7. Contact our engineering team for assistance with tight tolerance requirements`,
    
    'surface finish': `Troubleshooting Surface Finish Issues:
1. Check cutting tool condition (replace if worn)
2. Adjust cutting speed and feed rate
3. Consider different tool geometry
4. Review coolant application
5. For 3D printing, adjust layer height and print speed
6. For injection molding, check mold surface condition
7. Contact our quality team for specific surface finish requirements`,
  };
  
  // Find the most relevant guide
  for (const key in troubleshootingGuides) {
    if (issue.includes(key)) {
      return troubleshootingGuides[key];
    }
  }
  
  return `No specific troubleshooting guide found for "${issue}". Please contact our technical support team at support@printform.com with details about your issue for personalized assistance.`;
}

function generateProcessExplanation(params: CommandParams): string {
  const processName = String(params.name || params.process || '').toLowerCase();
  
  // Sample process explanations
  const explanations: {[key: string]: string} = {
    'cnc': `CNC Machining Process at Printform:

1. Design Phase: CAD model is created or provided by the customer
2. CAM Programming: Our engineers convert the CAD model into machine instructions
3. Material Selection: Appropriate material block is selected based on requirements
4. Setup: Material is secured in the CNC machine
5. Machining: Computer-controlled cutting tools remove material to create the part
6. Quality Control: Parts are inspected to ensure they meet specifications
7. Finishing: Secondary operations like deburring, polishing, or anodizing are performed as needed
8. Final Inspection: Comprehensive quality check before shipping

Printform's CNC capabilities include 3-5 axis machining for complex geometries with tolerances as tight as ±0.001".`,
    
    'injection molding': `Injection Molding Process at Printform:

1. Design Phase: Part and mold design with consideration for manufacturability
2. Mold Creation: CNC machining of mold cavities and cores
3. Material Selection: Appropriate thermoplastic resin is selected
4. Setup: Mold is installed in the injection molding machine
5. Injection: Molten plastic is injected into the mold cavity under high pressure
6. Cooling: Material solidifies in the shape of the mold cavity
7. Ejection: Mold opens and parts are ejected
8. Quality Control: Parts are inspected for defects
9. Finishing: Secondary operations like trimming or assembly are performed as needed

Printform offers both prototype tooling (for 100-1,000 parts) and production tooling (1,000+ parts) with a variety of thermoplastic materials.`,
    
    '3d printing': `3D Printing Process at Printform:

1. Design Phase: CAD model is created or provided by the customer
2. File Preparation: Model is sliced into layers and support structures are added
3. Material Selection: Appropriate material is selected based on requirements
4. Printer Setup: Material is loaded and printer is calibrated
5. Printing: Material is deposited or cured layer by layer
6. Post-Processing: Support removal, cleaning, and curing (if applicable)
7. Finishing: Sanding, painting, or other finishing operations as needed
8. Quality Control: Final inspection before shipping

Printform offers multiple 3D printing technologies:
- SLA (Stereolithography): High detail, smooth finish
- SLS (Selective Laser Sintering): Strong functional parts, no supports needed
- FDM (Fused Deposition Modeling): Cost-effective, variety of materials`,
  };
  
  // Find the most relevant explanation
  for (const key in explanations) {
    if (processName.includes(key) || key.includes(processName)) {
      return explanations[key];
    }
  }
  
  return `No detailed explanation found for "${processName}". Please contact our engineering team for information about this specific process.`;
}

function generateMethodComparison(params: CommandParams): string {
  const method1 = String(params.method1 || '').toLowerCase();
  const method2 = String(params.method2 || '').toLowerCase();
  
  // Define comparison pairs
  const comparisons: {[key: string]: string} = {
    'cnc_3dprinting': `Comparison: CNC Machining vs. 3D Printing

Cost:
- CNC: Higher setup cost, more economical for medium volumes
- 3D Printing: Lower setup cost, economical for very low volumes

Speed:
- CNC: Faster for simple geometries and multiple parts
- 3D Printing: Faster for complex geometries and one-off parts

Accuracy:
- CNC: Higher precision (±0.001")
- 3D Printing: Good precision (±0.005")

Materials:
- CNC: Wide range of metals and plastics
- 3D Printing: Limited to specific plastics, resins, and some metals

Design Freedom:
- CNC: Limited by tool access and fixturing
- 3D Printing: Excellent for complex internal features

Surface Finish:
- CNC: Excellent surface finish
- 3D Printing: May show layer lines, requires post-processing

Best For:
- CNC: Functional parts, production parts, metal components
- 3D Printing: Prototypes, complex geometries, low-volume production`,
    
    'injection_cnc': `Comparison: Injection Molding vs. CNC Machining

Cost:
- Injection Molding: High upfront tooling cost, very low per-part cost
- CNC: Lower setup cost, higher per-part cost

Volume:
- Injection Molding: Ideal for high volumes (1,000+ parts)
- CNC: Ideal for low to medium volumes (1-500 parts)

Speed:
- Injection Molding: Slow to start (tooling time), then very fast production
- CNC: Faster to start, consistent production time per part

Materials:
- Injection Molding: Limited to thermoplastics and some thermosets
- CNC: Wide range of metals, plastics, and composites

Design Considerations:
- Injection Molding: Requires draft angles, uniform wall thickness
- CNC: Limited by tool access and fixturing

Surface Finish:
- Injection Molding: Excellent, consistent finish
- CNC: Very good, may show tool marks

Best For:
- Injection Molding: High-volume production, consistent parts
- CNC: Low-volume production, metal parts, rapid turnaround`,
    
    'sheet_3dprinting': `Comparison: Sheet Metal Fabrication vs. 3D Printing

Cost:
- Sheet Metal: Lower setup cost, economical for simple designs
- 3D Printing: Higher cost for large parts, economical for complex designs

Speed:
- Sheet Metal: Fast for simple parts
- 3D Printing: Time increases with part size

Strength:
- Sheet Metal: Excellent structural strength
- 3D Printing: Variable depending on material and print orientation

Materials:
- Sheet Metal: Various metals (aluminum, steel, stainless steel)
- 3D Printing: Primarily plastics and resins, limited metals

Design Freedom:
- Sheet Metal: Limited to bent and formed shapes
- 3D Printing: Excellent for complex geometries

Thickness:
- Sheet Metal: Limited by available sheet thicknesses
- 3D Printing: Can vary thickness throughout part

Best For:
- Sheet Metal: Enclosures, brackets, panels, structural components
- 3D Printing: Complex parts, prototypes, custom fixtures`,
  };
  
  // Create comparison key by combining methods
  const key1 = `${method1}_${method2}`;
  const key2 = `${method2}_${method1}`;
  
  if (comparisons[key1]) {
    return comparisons[key1];
  } else if (comparisons[key2]) {
    return comparisons[key2];
  } else {
    return `No detailed comparison found between "${method1}" and "${method2}". Please contact our engineering team for a customized comparison based on your specific requirements.`;
  }
}

function generateResourceInfo(params: CommandParams): string {
  const topic = String(params.topic || '').toLowerCase();
  
  // Sample resource information
  const resources: {[key: string]: string} = {
    'design guidelines': `Design Guidelines Resources:

1. Printform Design Guide Library:
   - CNC Design Guidelines: https://printform.com/resources/cnc-design-guide
   - Injection Molding Design Guidelines: https://printform.com/resources/injection-molding-guide
   - Sheet Metal Design Guidelines: https://printform.com/resources/sheet-metal-guide
   - 3D Printing Design Guidelines: https://printform.com/resources/3d-printing-guide

2. CAD Files:
   - Templates and example files: https://printform.com/resources/cad-templates
   - Material-specific design examples: https://printform.com/resources/material-examples

3. Webinars and Training:
   - Monthly design for manufacturing webinars: https://printform.com/webinars
   - On-demand training videos: https://printform.com/training

Contact our engineering team at engineering@printform.com for custom design reviews and assistance.`,
    
    'materials': `Material Resources:

1. Material Data Sheets:
   - Complete material library: https://printform.com/materials
   - Comparison charts: https://printform.com/material-comparison

2. Material Selection Guides:
   - Application-specific guides: https://printform.com/material-selection
   - Industry-specific recommendations: https://printform.com/industry-materials

3. Testing and Certification:
   - Material testing capabilities: https://printform.com/testing
   - Certification processes: https://printform.com/certification

4. Specialty Materials:
   - Medical-grade materials: https://printform.com/medical-materials
   - High-performance materials: https://printform.com/high-performance

Contact our materials team at materials@printform.com for specific material recommendations.`,
    
    'quality': `Quality Assurance Resources:

1. Quality Processes:
   - Quality management system overview: https://printform.com/quality-system
   - Inspection procedures: https://printform.com/inspection

2. Certifications:
   - ISO 9001:2015 certification: https://printform.com/iso9001
   - Industry-specific certifications: https://printform.com/certifications

3. Testing Capabilities:
   - Dimensional inspection: https://printform.com/dimensional-testing
   - Functional testing: https://printform.com/functional-testing
   - Material testing: https://printform.com/material-testing

4. Quality Documentation:
   - Sample inspection reports: https://printform.com/sample-reports
   - Certificate of conformance: https://printform.com/conformance

Contact our quality team at quality@printform.com for specific quality requirements.`,
  };
  
  // Find the most relevant resource
  for (const key in resources) {
    if (topic.includes(key) || key.includes(topic)) {
      return resources[key];
    }
  }
  
  return `No specific resources found for "${topic}". Please visit our main resource center at https://printform.com/resources or contact our support team for assistance finding the information you need.`;
}

/**
 * Check if a message contains a command
 */
export function containsCommand(message: string): boolean {
  return message.trim().startsWith('/');
}

/**
 * Process a user message and handle any commands
 */
export async function processUserMessage(message: string): Promise<string> {
  if (containsCommand(message)) {
    const command = parseCommand(message);
    if (command) {
      return processCommand(command);
    } else {
      return `Unknown command. Available commands: 
- /material [name=material_name]
- /process [name=process_name]
- /time [process=process_name] [quantity=number] [complexity=low|medium|high]
- /cost [process=process_name] [quantity=number] [material=material_name]
- /troubleshoot [issue=issue_description]
- /explain [process=process_name]
- /compare [method1=method_name] [method2=method_name]
- /resource [topic=topic_name]`;
    }
  }
  
  // Not a command, return null to indicate regular message processing
  return '';
}