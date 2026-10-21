import { AnalysisResult } from '../types';
import { analyzeImageWithGemini } from './geminiService';


// --- Shared Optimization Utilities ---
function deduplicateProducts(products: any[]): any[] {
    if (!products || products.length === 0) return [];
    const uniqueMap = new Map();
    
    for (let i = 0; i < products.length; i++) {
        const p = products[i];
        // Fast key generation - avoids mapping over prices if possible
        let priceKey = '';
        if (p.prices && p.prices.length > 0) {
            for (let j = 0; j < p.prices.length; j++) {
                priceKey += (j > 0 ? '-' : '') + p.prices[j].value;
            }
        }
        
        const key = `${p.name}_${p.type || 'product'}_${priceKey}`;
        if (!uniqueMap.has(key)) {
            uniqueMap.set(key, p);
        }
    }
    return Array.from(uniqueMap.values());
}

export interface ImageAnalysisStrategy {
    analyze(
        base64Image: string, 
        userPromptText: string, 
        systemInstructionText: string,
        modelName?: string,
        userPromptId?: string,
        systemPromptId?: string,
        mimeType?: string
    ): Promise<AnalysisResult>;
}

export class SingleImagePipeline implements ImageAnalysisStrategy {
    async analyze(
        base64Image: string, 
        userPromptText: string, 
        systemInstructionText: string,
        modelName: string = 'gemini-3.1-flash-lite',
        userPromptId?: string,
        systemPromptId?: string,
        mimeType: string = 'image/jpeg'
    ): Promise<AnalysisResult> {
        return analyzeImageWithGemini(
            base64Image, 
            userPromptText, 
            systemInstructionText, 
            modelName,
            userPromptId,
            systemPromptId,
            mimeType
        );
    }
}

export class WideShelfPipeline implements ImageAnalysisStrategy {
    private basePipeline: ImageAnalysisStrategy;

    constructor(basePipeline: ImageAnalysisStrategy = new SingleImagePipeline()) {
        this.basePipeline = basePipeline;
    }

    async analyze(
        base64Image: string, 
        userPromptText: string, 
        systemInstructionText: string,
        modelName: string = 'gemini-3.1-flash-lite',
        userPromptId?: string,
        systemPromptId?: string,
        mimeType: string = 'image/jpeg'
    ): Promise<AnalysisResult> {
        console.log("[WideShelfPipeline] Pre-processing wide shelf image...");
        
        // 1. Adapter/Decorator Logic: Pre-process inputs
        const enhancedSystemInstruction = `
[WIDE SHELF PRE-PROCESSING MODE ACTIVE]
The provided image is a panoramic or wide-shelf photo stitched from multiple segments or a video feed.
CRITICAL INSTRUCTIONS FOR WIDE FORMAT:
1. Scan the shelf methodically from LEFT to RIGHT.
2. Be extremely careful to identify products on the far edges which might be partially cut off.
3. Ignore duplicate products that appear due to overlapping stitching errors (identify unique physical items only).
4. Pay attention to POS materials that span across multiple shelf segments.
` + systemInstructionText;

        const enhancedUserPromptText = `
[CRITICAL WIDE SHELF REQUIREMENT]
You are analyzing a panoramic or wide-shelf photo of a retail aisle.
Crucially, you MUST analyze ALL SHELVES vertically. Do not just look at the middle shelf. 
You must explicitly scan and list products found on the:
- TOP SHELVES
- MIDDLE SHELVES
- BOTTOM SHELVES / FLOOR DISPLAYS
Do not miss any row or shelf. Count every distinct facing of every product across all shelves.
` + userPromptText;

        // 2. Delegate to existing Gemini system
        const result = await this.basePipeline.analyze(
            base64Image,
            enhancedUserPromptText,
            enhancedSystemInstruction,
            modelName,
            userPromptId,
            systemPromptId,
            mimeType
        );

        console.log("[WideShelfPipeline] Post-processing results, deduplicating overlaps...");
        if (result.products) {
            result.products = deduplicateProducts(result.products);
        }

        return result;
    }
}


export class VideoPipeline implements ImageAnalysisStrategy {
    private basePipeline: ImageAnalysisStrategy;

    constructor(basePipeline: ImageAnalysisStrategy = new SingleImagePipeline()) {
        this.basePipeline = basePipeline;
    }

    async analyze(
        base64Image: string, 
        userPromptText: string, 
        systemInstructionText: string,
        modelName: string = 'gemini-3.1-flash-lite',
        userPromptId?: string,
        systemPromptId?: string,
        mimeType: string = 'image/jpeg'
    ): Promise<AnalysisResult> {
        console.log("[VideoPipeline] Pre-processing video feed / sequence...");
        
        // 1. Adapter/Decorator Logic: Pre-process inputs
        const enhancedSystemInstruction = `
[SEQUENCE ANALYSIS MODE ACTIVE]
The provided image is a frame extracted from a video walk-through of a retail aisle.
CRITICAL INSTRUCTIONS FOR THIS FRAME:
1. ANALYZE ALL SHELVES & ROWS: You MUST actively scan the image vertically (from the top shelf down to the bottom floor level) and horizontally. Do not just focus on the middle shelf. Look at the top shelves, middle shelves, and bottom shelves.
2. EXHAUSTIVE ENUMERATION: You must process the ENTIRE frame. Identify EVERY single promotional tag, price tag, or product that is visible on ANY shelf.
3. CORRELATE PRICES: Carefully correlate the price tags with the correct products positioned above or below them.
4. POS MATERIALS: Watch out for wobblers, stoppers, and floor stands.
5. BOUNDING BOXES (b): You MUST output accurate bounding boxes for EVERY physical item in this frame. Do NOT use 0,0,0,0. Use the exact format 'ymin,xmin,ymax,xmax' ranging from 0 to 999, without any brackets. If there are multiple items, separate them with a pipe character '|' (e.g., '100,200,300,400|500,600,700,800').
6. DO NOT UNDERCOUNT: It is extremely important that you capture the true total volume (Share of Shelf) of every product visible in this specific frame.
` + systemInstructionText;

        const enhancedUserPromptText = `
[CRITICAL FRAME REQUIREMENT]
You are analyzing a static frame extracted from a retail aisle video.
Crucially, you MUST analyze ALL SHELVES vertically. Do not just look at the middle shelf. 
You must explicitly scan and list products found on the:
- TOP SHELVES
- MIDDLE SHELVES
- BOTTOM SHELVES / FLOOR DISPLAYS
Do not miss any row or shelf. Count every distinct facing of every product visible in this frame and provide accurate bounding boxes.
` + userPromptText;

        // 2. Delegate to existing Gemini system
        const result = await this.basePipeline.analyze(
            base64Image,
            enhancedUserPromptText,
            enhancedSystemInstruction,
            modelName,
            userPromptId,
            systemPromptId,
            mimeType
        );

        console.log("[VideoPipeline] Video analysis complete. Returned raw tracking results.");

        return result;
    }
}

export class PipelineFactory {
    static getPipeline(isWideShelf: boolean, isVideoMode: boolean = false): ImageAnalysisStrategy {
        let pipeline: ImageAnalysisStrategy = new SingleImagePipeline();
        
        // Decorator pattern: we can chain them or use them independently
        if (isWideShelf) {
            pipeline = new WideShelfPipeline(pipeline);
        }
        if (isVideoMode) {
            pipeline = new VideoPipeline(pipeline);
        }
        
        return pipeline;
    }
}
