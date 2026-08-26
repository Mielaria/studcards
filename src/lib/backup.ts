// JSON export/import helpers. Import resets SRS progression to Stage 1.
import { supabase } from "@/integrations/supabase/client";
import { fetchAllRows } from "@/lib/fetch-all";
import { mapBatched } from "@/lib/batch";
import {
  CARD_BUCKET,
  downloadAsDataUrl,
  isStoragePath,
  uploadDataUrl,
} from "@/lib/card-images";

/** Convierte rutas de Storage en base64 para que el JSON sea autocontenido. */
async function embedImages(cards: BackupCard[]): Promise<BackupCard[]> {
  return mapBatched(cards, async (c) => {
    if (!isStoragePath(c.image_url)) return c;
    const dataUrl = await downloadAsDataUrl(CARD_BUCKET, c.image_url!);
    return { ...c, image_url: dataUrl };
  });
}


export interface BackupCard {
  question: string;
  options: [string, string, string, string];
  correct_option: 1 | 2 | 3 | 4;
  explanation?: string | null;
  image_url?: string | null;
}
export interface BackupSubject {
  name: string;
  icon?: string;
  cards: BackupCard[];
}
export interface BackupFile {
  app: "studcards";
  version: 1;
  exported_at: string;
  subjects: BackupSubject[];
}

export async function exportBackup(): Promise<BackupFile> {
  const { data: subjects, error: sErr } = await supabase
    .from("subjects")
    .select("id, name, icon")
    .order("created_at");
  if (sErr) throw sErr;
  const { data: cards, error: cErr } = await supabase
    .from("flashcards")
    .select(
      "subject_id, question, option_1, option_2, option_3, option_4, correct_option, explanation, image_url",
    );
  if (cErr) throw cErr;
  const grouped: BackupSubject[] = await Promise.all(
    (subjects ?? []).map(async (s) => ({
      name: s.name,
      icon: s.icon,
      cards: await embedImages(
        (cards ?? [])
          .filter((c) => c.subject_id === s.id)
          .map((c) => ({
            question: c.question,
            options: [c.option_1, c.option_2, c.option_3, c.option_4] as [
              string,
              string,
              string,
              string,
            ],
            correct_option: c.correct_option as 1 | 2 | 3 | 4,
            explanation: c.explanation ?? null,
            image_url: c.image_url,
          })),
      ),
    })),
  );
  return {
    app: "studcards",
    version: 1,
    exported_at: new Date().toISOString(),
    subjects: grouped,
  };
}

export async function exportSubjectBackup(
  subjectId: string,
): Promise<BackupFile> {
  const { data: subject, error: sErr } = await supabase
    .from("subjects")
    .select("id, name, icon")
    .eq("id", subjectId)
    .single();
  if (sErr) throw sErr;
  const { data: cards, error: cErr } = await supabase
    .from("flashcards")
    .select(
      "question, option_1, option_2, option_3, option_4, correct_option, explanation, image_url",
    )
    .eq("subject_id", subjectId)
    .order("created_at");
  if (cErr) throw cErr;
  const exportedCards = await embedImages(
    (cards ?? []).map((c) => ({
      question: c.question,
      options: [c.option_1, c.option_2, c.option_3, c.option_4] as [
        string,
        string,
        string,
        string,
      ],
      correct_option: c.correct_option as 1 | 2 | 3 | 4,
      explanation: c.explanation ?? null,
      image_url: c.image_url,
    })),
  );
  return {
    app: "studcards",
    version: 1,
    exported_at: new Date().toISOString(),
    subjects: [
      {
        name: subject.name,
        icon: subject.icon,
        cards: exportedCards,
      },
    ],
  };
}

export async function listSubjects(): Promise<
  { id: string; name: string; count: number }[]
> {
  const { data: subjects, error } = await supabase
    .from("subjects")
    .select("id, name")
    .order("created_at");
  if (error) throw error;
  const { data: cards } = await supabase
    .from("flashcards")
    .select("subject_id");
  return (subjects ?? []).map((s) => ({
    id: s.id,
    name: s.name,
    count: (cards ?? []).filter((c) => c.subject_id === s.id).length,
  }));
}

export function slugify(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function downloadJson(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export async function importBackup(
  file: BackupFile,
): Promise<{ subjectsCreated: number; cardsCreated: number }> {
  if (file.app !== "studcards" || file.version !== 1)
    throw new Error("Archivo no compatible");
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No hay sesión");

  const { data: existing } = await supabase
    .from("subjects")
    .select("id, name");
  const byName = new Map(
    (existing ?? []).map((s) => [s.name.toLowerCase(), s.id]),
  );

  let subjectsCreated = 0;
  let cardsCreated = 0;
  const now = new Date().toISOString();

  for (const s of file.subjects) {
    let subjectId = byName.get(s.name.toLowerCase());
    if (!subjectId) {
      const { data, error } = await supabase
        .from("subjects")
        .insert({
          user_id: user.id,
          name: s.name,
          icon: s.icon ?? "book",
        })
        .select("id")
        .single();
      if (error) throw error;
      subjectId = data.id;
      subjectsCreated++;
      byName.set(s.name.toLowerCase(), subjectId);
    }
    if (s.cards.length === 0) continue;
    const valid = s.cards.filter(
      (c) =>
        c.question &&
        Array.isArray(c.options) &&
        c.options.length === 4 &&
        c.correct_option >= 1 &&
        c.correct_option <= 4,
    );
    // Las imágenes en base64 del JSON se suben a Storage del usuario que importa.
    const rows = await Promise.all(
      valid.map(async (c) => {
        let imageValue: string | null = c.image_url ?? null;
        if (imageValue?.startsWith("data:")) {
          try {
            imageValue = await uploadDataUrl(CARD_BUCKET, imageValue);
          } catch {
            imageValue = null;
          }
        }
        return {
          user_id: user.id,
          subject_id: subjectId!,
          question: c.question,
          option_1: c.options[0],
          option_2: c.options[1],
          option_3: c.options[2],
          option_4: c.options[3],
          correct_option: c.correct_option,
          explanation: c.explanation ?? null,
          image_url: imageValue,
          learning_stage: 1,
          next_review_at: now,
          correct_answers_count: 0,
          is_learned: false,
        };
      }),
    );
    if (rows.length) {
      const { error } = await supabase.from("flashcards").insert(rows);
      if (error) throw error;
      cardsCreated += rows.length;
    }
  }
  return { subjectsCreated, cardsCreated };
}

export async function exportPdf(): Promise<void> {
  const { default: JsPDF } = await import("jspdf");
  const backup = await exportBackup();
  const doc = new JsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 40;
  let y = margin;

  const ensure = (h: number) => {
    if (y + h > pageH - margin) {
      doc.addPage();
      y = margin;
    }
  };
  const write = (text: string, size: number, bold = false) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(size);
    const lines = doc.splitTextToSize(text, pageW - margin * 2);
    ensure(lines.length * (size + 4));
    doc.text(lines, margin, y);
    y += lines.length * (size + 4);
  };

  write("StudCards — Exportación", 20, true);
  write(new Date().toLocaleString(), 10);
  y += 8;

  for (const s of backup.subjects) {
    ensure(30);
    y += 6;
    write(s.name, 15, true);
    if (s.cards.length === 0) {
      write("(sin cartas)", 10);
      continue;
    }
    s.cards.forEach((c, i) => {
      y += 6;
      write(`${i + 1}. ${c.question}`, 11, true);
      c.options.forEach((o, oi) => {
        const marker = oi + 1 === c.correct_option ? "✓" : "•";
        write(`   ${marker} ${o}`, 10);
      });
    });
  }

  doc.save(`studcards-${new Date().toISOString().slice(0, 10)}.pdf`);
}
