'use server';

import { mkdir,  writeFile, access } from 'fs/promises';
import { join } from 'path';
import { constants } from 'fs';

// Initialize storage directories
export async function initializeStorage() {
  const storageDir = join(process.cwd(), 'storage');
  const documentsDir = join(storageDir, 'documents');
  
  try {
    // Create storage directory
    await mkdir(storageDir, { recursive: true });
    
    // Create documents directory
    await mkdir(documentsDir, { recursive: true });
    
    // Check if sample document exists and copy it if not
    const sampleDocPath = join(process.cwd(), 'storage', 'documents', 'printform_info.txt');
    const sampleDocExists = await access(sampleDocPath, constants.F_OK)
      .then(() => true)
      .catch(() => false);
    
    if (!sampleDocExists) {
      // Create a sample document with Printform information
      const sampleContent = `# Printform Manufacturing Company

## Company Overview

Printform is a leading custom parts manufacturing company that specializes in on-demand production services. We serve a diverse range of industries including consumer products, energy, medical, and oil and gas sectors. Our state-of-the-art facilities and experienced team enable us to deliver high-quality parts with quick turnaround times.

## Manufacturing Services

### CNC Machining

Our CNC machining services offer precision manufacturing for both metal and plastic parts. We utilize 3-5 axis CNC machines to create complex geometries with tight tolerances.

**Capabilities:**
- Materials: Aluminum, Steel, Stainless Steel, Brass, Copper, Titanium, and various plastics
- Tolerances: As tight as ±0.001"
- Maximum part size: 24" x 36" x 18"
- Typical lead time: 3-10 business days

### Injection Molding

Our injection molding services are ideal for high-volume production of plastic parts. We offer both prototype tooling and production tooling options.

**Capabilities:**
- Materials: ABS, PC, Nylon, PP, PE, TPE, TPU, and more
- Tolerances: ±0.005"
- Part size: Up to 24" in the largest dimension
- Production volume: From 100 to 100,000+ parts

### Sheet Metal Fabrication

Our sheet metal fabrication services include cutting, bending, and assembling metal sheets into various forms and structures.

**Capabilities:**
- Materials: Aluminum, Steel, Stainless Steel, Copper, Brass
- Thickness range: 0.020" to 0.25"
- Tolerances: ±0.005"
- Processes: Laser cutting, punching, bending, welding`;
      
      await writeFile(sampleDocPath, sampleContent, 'utf-8');
      console.log('Created sample document at:', sampleDocPath);
    }
    
    return { success: true };
  } catch (error) {
    console.error('Error initializing storage directories:', error);
    return { success: false, error };
  }
}