import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { requireAdmin } from "../_shared/auth.ts";
import { callGeminiSmart } from "../_shared/vertex-ai.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Admin-only: blog content generation.
    const adminCheck = await requireAdmin(req);
    if (adminCheck.error) return adminCheck.error;

    const { title, category } = await req.json();

    if (!title) {
      return new Response(
        JSON.stringify({ error: "Başlıq tələb olunur" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // AI handled by callGeminiSmart (Vertex AI if configured, else Gemini API)

    const systemPrompt = `Sən Azərbaycan dilində hamiləlik və ana-uşaq mövzularında məqalə yazan peşəkar yazarsan.

Qaydalar:
- Məqalə azərbaycanca yazılmalıdır
- Tibbi məlumatlar doğru və etibarlı olmalıdır
- Warm, caring tone istifadə et - hamilə qadınlara dəstək verici
- Praktik tövsiyələr ver
- Paraqraflar arasında boşluq qoy
- Başlıqlar üçün ** istifadə et
- Məqalə 800-1200 söz uzunluğunda olmalıdır
- Sonda qısa bir nəticə/xülasə əlavə et`;

    const userPrompt = `"${title}" başlığı üçün ${category || 'hamiləlik'} mövzusunda geniş bir bloq məqaləsi yaz.

Məqalə strukturu:
1. Giriş (mövzuya qısa giriş)
2. Əsas hissə (3-4 yarımbaşlıq ilə detallı məlumat)
3. Praktik tövsiyələr
4. Nəticə

Həmçinin, məqalə üçün:
- Qısa excerpt (2 cümlə)
- 5-7 müvafiq etiket (tags)
- Oxuma müddəti təxmini (dəqiqə)

JSON formatında cavab ver:
{
  "content": "Tam məqalə mətni",
  "excerpt": "Qısa təsvir",
  "tags": ["etiket1", "etiket2"],
  "reading_time": 5
}`;

    // Use direct Gemini API
    const response = await callGeminiSmart("gemini-2.5-flash", {
      contents: [
        {
          role: "user",
          parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }]
        }
      ],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 8192,
      },
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Çox sayda sorğu. Zəhmət olmasa bir az gözləyin." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("Gemini API error:", response.status, errorText);
      throw new Error("Gemini API error");
    }

    const data = await response.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!content) {
      throw new Error("No content generated");
    }

    // Try to parse JSON from response
    let result;
    try {
      // Extract JSON from markdown code block if present
      const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/) || content.match(/```\s*([\s\S]*?)\s*```/);
      const jsonStr = jsonMatch ? jsonMatch[1] : content;
      result = JSON.parse(jsonStr);
    } catch {
      // If parsing fails, use the content as-is
      result = {
        content: content,
        excerpt: title,
        tags: [],
        reading_time: 5
      };
    }

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error generating blog content:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
