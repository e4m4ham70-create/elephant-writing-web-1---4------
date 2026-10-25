const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const { initializeApp } = require("firebase-admin/app");
const OpenAI = require("openai");

initializeApp();

const OPENAI_API_KEY = defineSecret("OPENAI_API_KEY");

function client() {
  return new OpenAI({ apiKey: OPENAI_API_KEY.value() });
}

exports.checkWriting = onCall(
  { region: "asia-northeast3", secrets: [OPENAI_API_KEY], timeoutSeconds: 120 },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "로그인이 필요합니다.");
    const draft = String(request.data?.draft || "").trim();
    if (!draft || draft.length > 5000) throw new HttpsError("invalid-argument", "초안 길이를 확인하세요.");

    const prompt = `
You are an English writing checker for Korean middle-school Grade 1 students.

RULES:
- Never add new ideas or facts.
- Keep the student's intended meaning.
- Use easy, age-appropriate English.
- Correct only grammar, word choice, spelling, and unnatural expressions.
- Do not rewrite the whole essay as a polished essay.
- Review sentence by sentence.
- If a sentence is already clear and correct, keep the suggestion very close to the original.
- Return ONLY valid JSON. No markdown.

Return this exact JSON shape:
{
  "sentences": [
    {
      "original": "student sentence",
      "suggestion": "suggested sentence",
      "changes": ["Grammar", "Word", "Expression", "Spelling"]
    }
  ]
}

Only include change labels that actually apply.

STUDENT DRAFT:
${draft}
`;

    const openai = client();
    const response = await openai.responses.create({
      model: "gpt-5.6",
      input: prompt
    });

    let parsed;
    try {
      parsed = JSON.parse(response.output_text);
    } catch (e) {
      throw new HttpsError("internal", "AI 응답을 JSON으로 읽지 못했습니다.");
    }
    if (!Array.isArray(parsed.sentences)) throw new HttpsError("internal", "AI 응답 형식이 올바르지 않습니다.");
    return { sentences: parsed.sentences.slice(0, 20) };
  }
);

exports.generateWritingImage = onCall(
  { region: "asia-northeast3", secrets: [OPENAI_API_KEY], timeoutSeconds: 300, memory: "1GiB" },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "로그인이 필요합니다.");
    const finalDraft = String(request.data?.finalDraft || "").trim();
    const extraIdea = String(request.data?.extraIdea || "").trim();
    if (!finalDraft || finalDraft.length > 5000) throw new HttpsError("invalid-argument", "최종 글 길이를 확인하세요.");

    const openai = client();

    // 1) 학생의 글에만 근거한 간결한 그림 프롬프트 생성
    const promptResponse = await openai.responses.create({
      model: "gpt-5.6",
      input: `Create one concise image prompt from the student's writing below.
Do not add story facts that are not in the writing.
Make it appropriate for a Grade 1 middle-school worksheet:
friendly educational illustration, clear elephants, villagers, forest/farms, and any technology actually mentioned.
No text labels in the image.
Extra student request (use only if consistent with the writing): ${extraIdea || "(none)"}

Student writing:
${finalDraft}

Return only the image prompt.`
    });
    const imagePrompt = promptResponse.output_text.trim();

    // 2) 단일 이미지 생성
    const result = await openai.images.generate({
      model: "gpt-image-2",
      prompt: imagePrompt,
      size: "1024x1024",
      quality: "medium"
    });

    const b64 = result.data?.[0]?.b64_json;
    if (!b64) throw new HttpsError("internal", "이미지 데이터를 받지 못했습니다.");
    return {
      prompt: imagePrompt,
      imageDataUrl: `data:image/png;base64,${b64}`
    };
  }
);
