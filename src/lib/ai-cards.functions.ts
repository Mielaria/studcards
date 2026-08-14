import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const InputSchema = z.object({
  count: z.number().int().min(1).max(10),
  text: z.string().max(8000).optional(),
  imageDataUrl: z.string().max(6_000_000).optional(),
  hint: z.string().max(500).optional(),
});

export type GeneratedCard = {
  question: string;
  options: [string, string, string, string];
  correctIndex: 0 | 1 | 2 | 3;
  explanation: string;
};

const SYSTEM = `Eres un asistente que crea flashcards de estudio de opción múltiple en español.
Cada carta debe tener: una pregunta clara y autocontenida, exactamente 4 opciones plausibles y sólo UNA correcta.
Las opciones incorrectas deben ser verosímiles pero inequívocamente incorrectas.
Basa las cartas ESTRICTAMENTE en el material proporcionado (imagen o texto). No inventes datos.
Además, cada carta debe incluir una explicación breve (2-4 frases) que justifique por qué la opción correcta es la correcta, coherente con la pregunta y el material.
Devuelve SOLO JSON válido con la forma exacta:
{"cards":[{"question":"...","options":["a","b","c","d"],"correctIndex":0,"explanation":"..."}]}
El índice correcto es un entero 0-3.`;

export const generateCards = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => InputSchema.parse(d))
  .handler(async ({ data }) => {
    const key = process.env.studcards;
    if (!key) throw new Error("Falta el secret studcards");

    if (!data.text && !data.imageDataUrl)
      throw new Error("Aporta texto o imagen");

    const userText =
      `Genera exactamente ${data.count} flashcards de opción múltiple.` +
      (data.hint ? ` Enfócate en: ${data.hint}.` : "") +
      (data.text ? `\n\nMaterial:\n${data.text}` : "");

    const content: unknown[] = [{ type: "text", text: userText }];
    if (data.imageDataUrl)
      content.push({
        type: "image_url",
        image_url: { url: data.imageDataUrl },
      });

    // Modelo al que tiene acceso el proyecto de la API key studcards.
    const model = process.env.STUDCARDS_MODEL || "gpt-4o";

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content },
        ],
        response_format: { type: "json_object" },
      }),
    });




    if (res.status === 429)
      throw new Error("Límite de uso alcanzado. Intenta en unos minutos.");
    if (res.status === 402)
      throw new Error(
        "Créditos de IA agotados. Agrega créditos en tu workspace.",
      );
    if (!res.ok) {
      const t = await res.text();
      throw new Error(`Error IA (${res.status}): ${t.slice(0, 200)}`);
    }

    const json = (await res.json()) as {
      choices: { message: { content: string } }[];
    };
    const raw = json.choices?.[0]?.message?.content ?? "{}";
    let parsed: { cards?: GeneratedCard[] };
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error("La IA devolvió un formato inválido");
    }
    const cards = (parsed.cards ?? []).filter(
      (c) =>
        c &&
        typeof c.question === "string" &&
        Array.isArray(c.options) &&
        c.options.length === 4 &&
        c.options.every((o) => typeof o === "string" && o.trim()) &&
        Number.isInteger(c.correctIndex) &&
        c.correctIndex >= 0 &&
        c.correctIndex <= 3,
    ).map((c) => ({
      ...c,
      explanation: typeof c.explanation === "string" ? c.explanation : "",
    }));
    if (cards.length === 0) throw new Error("No se generaron cartas válidas");
    return { cards };
  });
