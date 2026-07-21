import OpenAI from "openai";

const DEFAULT_ORIGIN = "https://shtomi-tech.github.io";
const MAX_SENTENCE_LENGTH = 280;

function allowedOrigins() {
  return String(process.env.APP_ORIGIN || DEFAULT_ORIGIN)
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function isAllowedOrigin(origin) {
  return !origin || allowedOrigins().includes(origin);
}

function headers(origin) {
  const allowOrigin = origin && isAllowedOrigin(origin) ? origin : DEFAULT_ORIGIN;
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Cache-Control": "no-store",
    "Content-Type": "application/json; charset=utf-8",
    Vary: "Origin",
  };
}

function json(body, status, origin) {
  return new Response(JSON.stringify(body), { status, headers: headers(origin) });
}

function normalize(value, maxLength = 600) {
  return String(value || "").trim().slice(0, maxLength);
}

function targetIsUsed(sentence, word) {
  return sentence.toLocaleLowerCase().includes(word.toLocaleLowerCase());
}

function normalizeFeedback(raw) {
  const source = raw && typeof raw === "object" ? raw : {};
  const grammar = source.grammar && typeof source.grammar === "object" ? source.grammar : {};
  return {
    verdict: source.verdict === "ok" ? "ok" : "revise",
    meaningFit: source.meaningFit === "good" ? "good" : "review",
    grammar: {
      status: grammar.status === "ok" ? "ok" : "review",
      issues: Array.isArray(grammar.issues) ? grammar.issues.map((issue) => normalize(issue, 240)).filter(Boolean).slice(0, 3) : [],
    },
    naturalness: source.naturalness === "good" ? "good" : "review",
    explanationJa: normalize(source.explanationJa, 800),
    suggestedSentence: normalize(source.suggestedSentence, MAX_SENTENCE_LENGTH) || null,
    nextHint: normalize(source.nextHint, 300),
  };
}

export default async function handler(request) {
  const origin = request.headers.get("origin") || "";
  if (!isAllowedOrigin(origin)) return json({ error: "origin_not_allowed" }, 403, origin);
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: headers(origin) });
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405, origin);

  let input;
  try {
    input = await request.json();
  } catch (error) {
    return json({ error: "invalid_json" }, 400, origin);
  }

  const word = normalize(input?.word, 120);
  const meaning = normalize(input?.meaning, 240);
  const partOfSpeech = normalize(input?.partOfSpeech, 80);
  const sentence = normalize(input?.sentence, MAX_SENTENCE_LENGTH);
  const learnerLevel = normalize(input?.learnerLevel, 40);
  if (!word || !meaning || !sentence) return json({ error: "word_meaning_sentence_required" }, 400, origin);
  if (sentence.length > MAX_SENTENCE_LENGTH) return json({ error: "sentence_too_long" }, 400, origin);
  if (!targetIsUsed(sentence, word)) return json({ error: "target_word_missing" }, 400, origin);

  try {
    const client = new OpenAI();
    const completion = await client.chat.completions.create({
      model: process.env.AI_MODEL || "gpt-4o-mini",
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: [
            "あなたは日本人英語学習者向けの英文チェック補助です。英検の公式採点や合否判定はしません。",
            "対象語が指定された意味・品詞で使われているか、文法と自然さを確認してください。",
            "学習者の英文を勝手に別の内容へ書き換えず、問題がある場合だけ短い修正版を示してください。",
            "必ずJSONだけを返してください。verdictはokまたはrevise、meaningFitとnaturalnessはgoodまたはreview、grammar.statusはokまたはreviewです。",
            "JSON schema: {verdict,meaningFit,grammar:{status,issues:[]},naturalness,explanationJa,suggestedSentence,nextHint}",
          ].join("\n"),
        },
        {
          role: "user",
          content: JSON.stringify({ word, meaning, partOfSpeech, sentence, learnerLevel }),
        },
      ],
    });
    const content = completion.choices?.[0]?.message?.content || "";
    const feedback = normalizeFeedback(JSON.parse(content));
    return json({ feedback }, 200, origin);
  } catch (error) {
    console.error("check-sentence failed", error);
    return json({ error: "ai_check_failed" }, 502, origin);
  }
}

export const config = {
  path: "/api/check-sentence",
};
