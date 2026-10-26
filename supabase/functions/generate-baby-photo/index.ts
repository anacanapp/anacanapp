import { createClient } from "npm:@supabase/supabase-js@2";
import { callVertex, isVertexConfigured } from "../_shared/vertex-ai.ts";
import { checkBabyPhotoshootLimit, limitExceededResponse } from "../_shared/usage-limit.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};


interface CustomizationOptions {
  gender: "boy" | "girl" | "keep";
  eyeColor: string;
  hairColor: string;
  hairStyle: string;
  outfit: string;
  imageStyle?: string;
}

interface RequestBody {
  backgroundTheme: string;
  sourceImageBase64: string;
  customization: CustomizationOptions;
}

// ═══════════════════════════════════════════════════════════════════════════════
// BACKGROUND SCENE DESCRIPTIONS - Detailed, immersive environments
// ═══════════════════════════════════════════════════════════════════════════════
const backgroundPrompts: Record<string, string> = {
  // Studio & Professional
  studio_white: "luxurious professional photography studio with seamless white infinity backdrop, multiple softbox lights creating perfect diffused illumination, clean minimalist aesthetic",
  
  // Nursery Themes
  nursery_blue: "cozy baby nursery with soft powder blue walls, elegant white wooden crib with flowing sheer canopy, plush cloud-shaped pillows, gentle natural light streaming through gauze curtains",
  nursery_pink: "enchanting nursery with delicate blush pink walls, ornate white French-style furniture, cascading tulle canopy with fairy lights, rose gold accents, dreamy soft focus background",
  
  // Garden & Nature
  garden_natural: "sun-dappled garden meadow with lush emerald grass, wildflowers swaying gently, soft golden hour sunlight filtering through leafy trees, peaceful serene atmosphere",
  garden_flowers: "magnificent flower garden bursting with pink peonies, white roses, and lavender blooms, delicate butterflies dancing, romantic impressionist painting atmosphere",
  cherry_blossom: "magical Japanese garden with cascading pink sakura petals floating gracefully, soft morning mist, tranquil koi pond reflection, zen peaceful ambiance",
  spring_flowers: "vibrant spring meadow with colorful tulips, sunny daffodils, fresh green grass, playful butterflies, cheerful warm natural lighting",
  
  // Bohemian Aesthetic
  boho_neutral: "bohemian sanctuary with tall dried pampas grass arrangements, handwoven macrame wall art, organic cotton and linen textures in cream and sand tones, warm earthy atmosphere",
  boho_floral: "romantic boho setting with preserved eucalyptus and blush dried florals, delicate lace fabrics, vintage brass elements, soft rose gold sunset lighting",
  
  // Minimalist & Modern
  minimalist_cream: "Scandinavian minimalist space with organic cream cashmere blanket, simple wooden elements, neutral earth palette, soft diffused natural light, serene clean aesthetic",
  blush_dreamy: "ethereal dreamscape with flowing blush pink tulle, scattered pearl beads, soft rose petals, romantic backlighting creating magical glow",
  
  // Vintage & Rustic
  vintage_rustic: "charming farmhouse setting with weathered barnwood backdrop, vintage lace and burlap textures, antique props, warm sepia-toned golden hour light",
  vintage_lace: "timeless elegant setup with heirloom antique lace, ivory silk fabrics, vintage pearl jewelry, soft candlelight ambiance, classic portrait aesthetic",
  
  // Adventure & Fantasy
  adventure_explorer: "whimsical explorer's study with vintage world maps, leather-bound books, antique compass and binoculars, warm amber desk lamp glow, expedition adventure theme",
  space_astronaut: "cosmic space adventure scene with twinkling stars, colorful nebulas, friendly planets, silver spacecraft, magical purple and blue cosmic lighting",
  superhero: "dynamic comic book cityscape at sunset, bold primary colors, dramatic heroic lighting, urban skyline silhouette, action-packed atmosphere",
  pirate_ship: "swashbuckling pirate ship deck with polished wooden planks, treasure chest overflowing with gold, nautical ropes, ocean horizon at golden sunset",
  
  // Fairy Tale & Princess
  princess_castle: "grand royal palace interior with crystal chandeliers, rich velvet purple and gold drapes, marble columns, magical sparkles floating in air",
  fairy_garden: "enchanted fairy hollow with glowing mushrooms, tiny lanterns, magical fireflies, iridescent flower petals, mystical purple and pink woodland mist",
  mermaid_ocean: "underwater mermaid paradise with iridescent seashells, pearl strings, colorful coral reef, swimming tropical fish, magical teal and turquoise ocean light",
  unicorn_rainbow: "magical unicorn kingdom with cotton candy clouds, brilliant rainbow arch, sparkling stars, pastel pink and lavender atmosphere, glittery magical ambiance",
  
  // Seasonal
  autumn_leaves: "cozy autumn scene with vibrant maple leaves in orange, crimson and gold, rustic pumpkins, chunky knit blanket, warm golden hour sunlight",
  winter_snow: "magical winter wonderland with fresh powdery snow, frosted pine branches, cozy cream cable-knit blanket, silver and white decorations, sparkling snowflake bokeh",
  
  // Celebration
  flowers: "breathtaking flower field with lavender rows, golden sunflowers, colorful wildflowers in full bloom, butterflies and bees, warm impressionist summer lighting",
  balloons: "joyful celebration with dozens of colorful helium balloons floating upward, rainbow confetti, bright blue sky with fluffy white clouds, festive happy atmosphere",
  rainbow: "magical scene with vibrant rainbow arching across bright sky, cotton candy pastel clouds, sparkles and glitter floating, cheerful whimsical atmosphere",
  castle: "fairy-tale castle great hall with crystal chandeliers, royal purple velvet, gold gilded frames, magical fairy dust floating, regal majestic ambiance",
  toys: "charming nursery playroom with cuddly teddy bears, soft plush toys, colorful building blocks, vintage wooden rocking horse, warm cozy atmosphere",
};

// ═══════════════════════════════════════════════════════════════════════════════
// PHYSICAL TRAIT DESCRIPTIONS - Detailed, natural-looking modifications
// ═══════════════════════════════════════════════════════════════════════════════
const eyeColorDescriptions: Record<string, string> = {
  keep: "",
  blue: "captivating bright blue eyes like a clear summer sky, with natural light reflections",
  green: "beautiful emerald green eyes with subtle golden flecks, sparkling with life",
  brown: "warm chocolate brown eyes with honey highlights, deep and expressive",
  hazel: "enchanting hazel eyes with swirling green and golden amber tones",
  gray: "striking silver-gray eyes like morning mist over the ocean",
  amber: "stunning warm amber eyes like golden honey in sunlight",
  violet: "mesmerizing violet purple eyes with a magical ethereal shimmer",
};

const hairColorDescriptions: Record<string, string> = {
  keep: "",
  blonde: "silky golden blonde hair with natural sun-kissed highlights",
  brown: "soft chestnut brown hair with warm caramel undertones",
  black: "shiny jet black hair with natural blue-black sheen",
  red: "beautiful auburn red hair with copper and ginger highlights",
  strawberry: "lovely strawberry blonde hair with peachy rose tones",
  white: "adorable platinum white-blonde baby hair like soft cotton",
  platinum: "shimmering platinum silver-blonde hair, light and airy",
  auburn: "rich deep auburn hair with warm reddish-brown tones",
  chestnut: "warm chestnut hair with deep reddish-brown undertones",
};

const hairStyleDescriptions: Record<string, string> = {
  keep: "",
  curly: "with adorable natural bouncy ringlet curls",
  straight: "with smooth silky straight hair",
  wavy: "with gentle soft flowing waves",
  pixie: "in a sweet short pixie style",
  ponytail: "styled in a cute ponytail with a satin ribbon bow",
  braids: "with darling little braids adorned with tiny flower clips",
};

const outfitDescriptions: Record<string, string> = {
  keep: "",
  theme: "wearing an adorable outfit that perfectly complements the scene's theme and colors",
  princess: "wearing a beautiful sparkly princess gown with a delicate tiara crown",
  prince: "wearing a dapper royal prince outfit with tiny gold crown",
  fairy: "wearing a magical fairy costume with delicate iridescent gossamer wings",
  angel: "wearing a pure white angel outfit with soft feathered wings and golden halo",
  flower: "wearing a precious outfit decorated with fresh flower petals and greenery",
  sailor: "wearing a classic navy blue sailor outfit with gold anchor buttons",
  casual: "wearing comfy cute casual clothes in soft coordinating pastel colors",
  festive: "wearing festive celebration outfit with sparkly sequin accents",
};

// ═══════════════════════════════════════════════════════════════════════════════
// IMAGE STYLE SYSTEM - Different artistic rendering approaches
// ═══════════════════════════════════════════════════════════════════════════════
const imageStyleConfig: Record<string, { style: string; faceNote: string }> = {
  realistic: {
    style: "ultra-realistic professional photography, magazine-quality, natural skin texture, studio-grade lighting, 1K resolution",
    faceNote: "ABSOLUTE RULE: The baby's face from the source photo MUST be transferred 1:1, pixel-faithful. Do NOT modify, retouch, smooth, beautify, age, or stylize the face in any way. Keep the EXACT same eye shape and spacing, eyebrow shape, nose shape and nostrils, mouth shape and lip thickness, chin, jawline, cheek fat, ears, skin tone, skin texture, birthmarks, freckles, and natural expression. Treat the source face as a locked reference — only the body, clothing, hair styling (if requested), and surrounding scene may change.",
  },
  "3d_render": {
    style: "high-quality 3D render with smooth textures, professional studio lighting, subtle stylization",
    faceNote: "Keep the baby's face as close to the source photo as possible — same eye shape, nose, mouth, face shape, skin tone and expression. Apply only minimal 3D shading; do NOT redesign the face.",
  },
  "3d_disney": {
    style: "3D Disney Pixar animation style, adorable big expressive eyes, soft rounded features, magical warm lighting, heartwarming atmosphere",
    faceNote: "Stylize toward Pixar/Disney while keeping the baby instantly recognizable — preserve source eye shape, nose, mouth, face proportions, skin tone and hair. Do NOT replace with a generic Pixar baby.",
  },
  "3d_pixar": {
    style: "Pixar movie quality 3D animation, endearing character design, vibrant rich colors, cinematic lighting, emotional depth",
    faceNote: "Stylize toward Pixar while keeping the baby instantly recognizable — preserve source eye shape, nose, mouth, face proportions, skin tone and hair. Do NOT replace with a generic Pixar baby.",
  },
  anime: {
    style: "beautiful Japanese anime illustration style, large sparkling expressive eyes, soft delicate features, warm color palette",
    faceNote: "Render anime style while keeping the baby's unique features clearly recognizable — same face shape, nose, mouth, hair, skin tone.",
  },
  illustration: {
    style: "elegant digital illustration, hand-painted storybook quality, soft watercolor-like colors, artistic brushwork",
    faceNote: "Illustrate while preserving the baby's exact facial features, proportions and expression.",
  },
  "2d_simpsons": {
    style: "The Simpsons cartoon style, 2D animation, characteristic yellow skin, simple bold features",
    faceNote: "Adapt to Simpsons style while keeping recognizable features (hair, eye placement, mouth shape) from the source.",
  },
  "3d_simpsons": {
    style: "3D rendered Simpsons style, yellow skin tone, cartoon proportions, smooth 3D surfaces",
    faceNote: "Transform to 3D Simpsons aesthetic while keeping recognizable features from the source.",
  },
  watercolor: {
    style: "delicate watercolor painting, soft color washes, artistic brushstrokes, dreamy ethereal quality",
    faceNote: "Paint in watercolor while preserving the baby's exact facial features and expression.",
  },
  oil_painting: {
    style: "classical oil painting portrait style, rich textured brushwork, Renaissance-inspired lighting, museum quality",
    faceNote: "Paint in classical style while preserving the baby's exact facial features and expression.",
  },
  clay_art: {
    style: "adorable claymation stop-motion style, handcrafted clay figure aesthetic, warm tactile textures",
    faceNote: "Sculpt clay figure while keeping baby's recognizable features (face shape, eyes, nose, mouth) from the source.",
  },
  pop_art: {
    style: "vibrant pop art style, bold primary colors, comic book halftone dots, Andy Warhol inspired",
    faceNote: "Transform to pop art while maintaining baby's facial structure and recognizable features from the source.",
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// MASTER PROMPT BUILDER - Creates the perfect generation prompt
// ═══════════════════════════════════════════════════════════════════════════════
async function buildMasterPrompt(
  backgroundTheme: string,
  customization: CustomizationOptions,
  supabase: any
): Promise<string> {
  // Try hardcoded first, then fetch from DB
  let background = backgroundPrompts[backgroundTheme];
  if (!background) {
    try {
      const { data } = await supabase
        .from('photoshoot_backgrounds')
        .select('prompt_template')
        .eq('theme_id', backgroundTheme)
        .eq('is_active', true)
        .single();
      if (data?.prompt_template) {
        background = data.prompt_template;
      }
    } catch (e) {
      console.error('Failed to fetch background from DB:', e);
    }
  }
  if (!background) background = backgroundPrompts.garden_natural;
  const styleId = customization.imageStyle || "realistic";
  const styleConfig = imageStyleConfig[styleId] || imageStyleConfig.realistic;
  
  // Build customization instructions
  const customizations: string[] = [];
  
  // Gender
  if (customization.gender === "boy") {
    customizations.push("Style the baby as a charming baby boy");
  } else if (customization.gender === "girl") {
    customizations.push("Style the baby as an adorable baby girl");
  }
  
  // Eye color
  if (customization.eyeColor !== "keep" && eyeColorDescriptions[customization.eyeColor]) {
    customizations.push(`Give the baby ${eyeColorDescriptions[customization.eyeColor]}`);
  }
  
  // Hair
  const hairColor = customization.hairColor !== "keep" && hairColorDescriptions[customization.hairColor] 
    ? hairColorDescriptions[customization.hairColor] : "";
  const hairStyle = customization.hairStyle !== "keep" && hairStyleDescriptions[customization.hairStyle]
    ? hairStyleDescriptions[customization.hairStyle] : "";
  
  if (hairColor || hairStyle) {
    customizations.push(`Give the baby ${hairColor} ${hairStyle}`.trim());
  }
  
  // Outfit — make replacement explicit
  const outfitChangeRequested = customization.outfit !== "keep" && outfitDescriptions[customization.outfit];
  if (outfitChangeRequested) {
    customizations.push(
      `REPLACE the baby's current clothing entirely with a new outfit: ${outfitDescriptions[customization.outfit]}. The new outfit must fit naturally on the baby's body, with realistic fabric, folds, and lighting that matches the scene. Do NOT keep any part of the original clothing visible.`
    );
  } else {
    customizations.push("Keep the baby's original clothing from the source photo unchanged.");
  }

  const customizationText = customizations.length > 0
    ? `\n\n**CUSTOMIZATION REQUESTS:**\n${customizations.map((c, i) => `${i + 1}. ${c}`).join("\n")}`
    : "";

  return `You are an award-winning professional baby portrait photographer and digital artist. Create a BREATHTAKING masterpiece portrait.

**═══════════════════════════════════════════════════════════════════════════**
**ABSOLUTE PRIORITY #1: FACIAL IDENTITY PRESERVATION (NON-NEGOTIABLE)**
**═══════════════════════════════════════════════════════════════════════════**

${styleConfig.faceNote}

The parents must instantly recognize THIS specific baby. Never invent a new face, never blend with another baby, never "improve" the face. If there is ANY conflict between facial preservation and any other instruction (style, customization, background), facial preservation WINS.

Forbidden face changes: altering eye color/shape/spacing, changing nose shape, changing mouth/lips, slimming or fattening cheeks, reshaping chin/jaw, smoothing skin texture, removing birthmarks/freckles, changing skin tone, changing expression.

**═══════════════════════════════════════════════════════════════════════════**
**SCENE & BACKGROUND**
**═══════════════════════════════════════════════════════════════════════════**

Build this environment AROUND the baby (the baby stays as photographed; only the surroundings change):
${background}

Background rules:
• Clean, tidy, well-composed — no visual clutter, no random floating objects, no duplicated elements, no text or watermarks.
• Cohesive color palette that complements the baby without overpowering them.
• Soft, natural depth-of-field blur on the background so the baby remains the clear focal point.
• Lighting on the baby must match the scene's light direction, color temperature, and intensity for a believable composite.
• No extra people, no extra babies, no extra hands or limbs anywhere in the frame.

**═══════════════════════════════════════════════════════════════════════════**
**ARTISTIC STYLE**
**═══════════════════════════════════════════════════════════════════════════**

${styleConfig.style}
${customizationText}

**═══════════════════════════════════════════════════════════════════════════**
**TECHNICAL REQUIREMENTS**
**═══════════════════════════════════════════════════════════════════════════**

• Resolution: High quality 1K output
• Composition: Baby centered, rule of thirds for background elements
• Lighting: Professional, flattering, matching the scene mood
• Focus: Sharp on baby's face, soft artistic blur on background
• Colors: Rich, vibrant, harmonious palette
• Anatomy: Correct number of fingers/toes, natural proportions, no deformities

**═══════════════════════════════════════════════════════════════════════════**
**OUTPUT**
**═══════════════════════════════════════════════════════════════════════════**

Generate ONE stunning, professional-quality baby portrait that:
✓ Keeps the baby's exact face from the source photo (untouched)
✓ Places them beautifully in the described clean, cohesive scene
✓ Applies the requested outfit/customization changes naturally
✓ Creates a cherished keepsake-worthy image`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN SERVER HANDLER
// ═══════════════════════════════════════════════════════════════════════════════
import { checkModerationAccess } from '../_shared/auth.ts';

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const moderationError = await checkModerationAccess(user.id, 'generate-baby-photo');
    if (moderationError) return moderationError;
    // Server-side ömürlük say limiti (bahalı şəkil-generasiya modeli —
    // əvvəllər YALNIZ klient-tərəfi yoxlanılırdı).
    const usage = await checkBabyPhotoshootLimit(user.id);
    if (!usage.allowed) return limitExceededResponse(corsHeaders, usage.limit);

    // Parse request
    const { backgroundTheme, sourceImageBase64, customization }: RequestBody = await req.json();

    if (!backgroundTheme || !sourceImageBase64) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const useVertex = isVertexConfigured();
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!useVertex && !GEMINI_API_KEY) {
      return new Response(JSON.stringify({ error: "AI service not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    console.log(`Image gen backend: ${useVertex ? "Vertex AI" : "Gemini API"}`);

    // Build the master prompt
    const masterPrompt = await buildMasterPrompt(backgroundTheme, customization, supabase);
    console.log("Generated prompt for theme:", backgroundTheme, "style:", customization.imageStyle);

    // Extract base64 data from data URL if present
    let imageBase64 = sourceImageBase64;
    let mimeType = "image/jpeg";

    if (sourceImageBase64.startsWith("data:")) {
      const dataMatch = sourceImageBase64.match(/^data:(image\/\w+);base64,(.+)$/);
      if (dataMatch) {
        mimeType = dataMatch[1];
        imageBase64 = dataMatch[2];
      }
    }

    // Nano Banana 2 (primary) → Nano Banana Pro (fallback).
    // Vertex needs `-preview` suffix and `global` region; Gemini API uses stable IDs.
    const models = useVertex
      ? [
          "gemini-3.1-flash-image-preview",
          "gemini-3-pro-image-preview",
          "gemini-2.5-flash-image",
          "gemini-2.5-flash-image-preview",
        ]
      : [
          "gemini-3.1-flash-image",
          "gemini-3-pro-image",
          "gemini-2.5-flash-image",
        ];


    const requestBody = {
      contents: [
        {
          role: "user",
          parts: [
            { text: masterPrompt },
            {
              inline_data: {
                mime_type: mimeType,
                data: imageBase64,
              },
            },
          ],
        },
      ],
      generationConfig: {
        responseModalities: ["TEXT", "IMAGE"],
      },
    };

    let geminiResponse: Response | null = null;
    let lastError = "";

    for (const model of models) {
      console.log(`Trying model: ${model} (${useVertex ? "Vertex" : "Gemini API"})...`);
      let resp: Response;
      try {
        if (useVertex) {
          resp = await callVertex({ model, body: requestBody });
        } else {
          resp = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(requestBody),
            }
          );
        }
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
        console.error(`Model ${model} request threw:`, lastError);
        continue;
      }

      if (resp.ok) {
        geminiResponse = resp;
        console.log(`Success with model: ${model}`);
        break;
      }

      lastError = await resp.text();
      console.error(`Model ${model} failed (${resp.status}):`, lastError);
      
      // Retry on 503 (unavailable) or 404 (model not in this backend); fail fast on other errors
      if (resp.status !== 503 && resp.status !== 404) {
        return new Response(JSON.stringify({ error: "Image generation failed", details: lastError }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }


    if (!geminiResponse) {
      return new Response(JSON.stringify({ error: "All AI models are currently unavailable. Please try again later.", details: lastError }), {
        status: 503,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const geminiData = await geminiResponse.json();
    console.log("Gemini response received successfully");

    // Extract the generated image from response
    let generatedImageBase64: string | undefined;
    let outputMimeType = "image/png";

    if (geminiData.candidates && geminiData.candidates[0]?.content?.parts) {
      for (const part of geminiData.candidates[0].content.parts) {
        if (part.inlineData) {
          generatedImageBase64 = part.inlineData.data;
          outputMimeType = part.inlineData.mimeType || "image/png";
          break;
        }
      }
    }

    if (!generatedImageBase64) {
      console.error("No image in Gemini response:", JSON.stringify(geminiData));
      return new Response(JSON.stringify({ error: "No image generated", response: geminiData }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const imageFormat = outputMimeType.split("/")[1] || "png";

    // Convert base64 to binary for storage
    const binaryData = Uint8Array.from(atob(generatedImageBase64), (c) => c.charCodeAt(0));

    const fileName = `${user.id}/${Date.now()}-${backgroundTheme}.${imageFormat}`;
    
    // Also save the source (original) image
    let sourceImagePath: string | null = null;
    try {
      const srcBinary = Uint8Array.from(atob(imageBase64), (c) => c.charCodeAt(0));
      const srcFileName = `${user.id}/originals/${Date.now()}-source.${mimeType.split("/")[1] || "jpeg"}`;
      const { error: srcUploadError } = await supabase.storage
        .from("baby-photos")
        .upload(srcFileName, srcBinary, {
          contentType: mimeType,
          upsert: false,
        });
      if (!srcUploadError) {
        sourceImagePath = srcFileName;
      } else {
        console.warn("Source image upload failed:", srcUploadError);
      }
    } catch (srcErr) {
      console.warn("Failed to save source image:", srcErr);
    }

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("baby-photos")
      .upload(fileName, binaryData, {
        contentType: outputMimeType,
        upsert: false,
      });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      return new Response(JSON.stringify({ error: "Failed to save image" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create a signed URL (bucket is private) — needed for reloads
    let signedUrl: string | null = null;
    try {
      const { data: signed } = await supabase.storage
        .from("baby-photos")
        .createSignedUrl(fileName, 60 * 60 * 24);
      signedUrl = signed?.signedUrl ?? null;
    } catch (e) {
      console.warn("Failed to create signed URL:", e);
    }

    // Inline data URL for INSTANT first display (no extra network round-trip)
    const dataUrl = `data:${outputMimeType};base64,${generatedImageBase64}`;
    const displayUrl = dataUrl;

    // Save to database with source image path and customization
    const { data: photoRecord, error: dbError } = await supabase.from("baby_photos").insert({
      user_id: user.id,
      storage_path: fileName,
      background_theme: backgroundTheme,
      prompt: masterPrompt.substring(0, 500),
      source_image_path: sourceImagePath,
      customization: customization || {},
    }).select().single();

    if (dbError) {
      console.error("Database error:", dbError);
    }

    console.log("Photo generated and saved successfully:", fileName);

    return new Response(
      JSON.stringify({
        success: true,
        imageUrl: displayUrl,
        signedUrl,
        storagePath: fileName,
        photo: photoRecord ? {
          id: photoRecord.id,
          url: displayUrl,
          signedUrl,
          theme: backgroundTheme,
          createdAt: photoRecord.created_at,
        } : null,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error generating image:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Unknown error occurred",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
