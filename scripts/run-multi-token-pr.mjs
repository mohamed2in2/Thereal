import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const tokensPath = path.join(__dirname, "..", ".tokens.json");

if (!fs.existsSync(tokensPath)) {
  console.error("❌ ملف .tokens.json غير موجود! تأكد من إنشاء الملف أولاً.");
  process.exit(1);
}

const config = JSON.parse(fs.readFileSync(tokensPath, "utf8"));
const { targetRepo, maintainerToken, tokens } = config;

if (!targetRepo) {
  console.error("❌ targetRepo غير محدد في .tokens.json");
  process.exit(1);
}

const GITHUB_API = "https://api.github.com";

async function ghFetch(url, token, options = {}) {
  const headers = {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "User-Agent": "CodeUP-Token-Automation/1.0",
    "X-GitHub-Api-Version": "2022-11-28",
    ...(options.headers || {}),
  };
  const res = await fetch(url, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

async function run() {
  console.log(`\n🚀 بدء معالجة التوكنز للمستودع: ${targetRepo}\n${"=".repeat(60)}`);

  let successCount = 0;
  let skippedCount = 0;
  let failedCount = 0;

  for (const entry of tokens) {
    const { id, token, branchName, prTitle } = entry;

    if (!token || token.startsWith("ghp_PASTE_")) {
      console.log(`⏩ [Token #${id}]: تم التخطي (لم يتم وضع التوكن بعد).`);
      skippedCount++;
      continue;
    }

    console.log(`\n🔄 [Token #${id}] جارٍ التحقق من الحساب والصلاحيات...`);

    // 1. Get authenticated user
    const userRes = await ghFetch(`${GITHUB_API}/user`, token);
    if (!userRes.ok) {
      console.error(`❌ [Token #${id}]: فشل المصادقة! (${userRes.status}):`, userRes.data?.message || "Invalid token");
      failedCount++;
      continue;
    }

    const username = userRes.data?.login;
    console.log(`  👤 الحساب: @${username}`);

    // 2. Get latest SHA of main branch
    const baseBranchRes = await ghFetch(`${GITHUB_API}/repos/${targetRepo}/git/ref/heads/main`, token);
    if (!baseBranchRes.ok) {
      console.error(`❌ [Token #${id}]: تعذر قراءة فرع main من المستودع (${baseBranchRes.status}):`, baseBranchRes.data?.message);
      failedCount++;
      continue;
    }
    const latestSha = baseBranchRes.data?.object?.sha;

    // 3. Create or update branch
    const branch = branchName || `contrib-${username}-${Date.now()}`;
    const refPath = `refs/heads/${branch}`;
    let branchReady = false;

    // Check if ref already exists
    const checkRef = await ghFetch(`${GITHUB_API}/repos/${targetRepo}/git/ref/heads/${branch}`, token);
    if (checkRef.ok) {
      // Update ref to latest main
      const updateRef = await ghFetch(`${GITHUB_API}/repos/${targetRepo}/git/refs/heads/${branch}`, token, {
        method: "PATCH",
        body: JSON.stringify({ sha: latestSha, force: true }),
      });
      branchReady = updateRef.ok;
    } else {
      // Create new ref
      const createRef = await ghFetch(`${GITHUB_API}/repos/${targetRepo}/git/refs`, token, {
        method: "POST",
        body: JSON.stringify({ ref: refPath, sha: latestSha }),
      });
      branchReady = createRef.ok;
    }

    if (!branchReady) {
      console.error(`❌ [Token #${id}]: تعذر إنشاء أو تحديث الفرع '${branch}'. قد لا يمتلك التوكن صلاحية الكتابة المباشرة.`);
      failedCount++;
      continue;
    }

    // 4. Create a commit on this branch
    const syncFilePath = `.github/sync-logs/token-${id}.json`;
    const syncFileUrl = `${GITHUB_API}/repos/${targetRepo}/contents/${syncFilePath}`;
    const existingFile = await ghFetch(`${syncFileUrl}?ref=${branch}`, token);
    const fileSha = existingFile.ok ? existingFile.data?.sha : undefined;

    const fileContent = JSON.stringify({
      tokenId: id,
      user: username,
      timestamp: new Date().toISOString(),
      syncMessage: `Sync contribution #${id} by @${username}`,
    }, null, 2);

    const commitRes = await ghFetch(syncFileUrl, token, {
      method: "PUT",
      body: JSON.stringify({
        message: `chore: contribution sync #${id} [skip ci]`,
        content: Buffer.from(fileContent).toString("base64"),
        branch,
        ...(fileSha ? { sha: fileSha } : {}),
      }),
    });

    if (!commitRes.ok) {
      console.error(`❌ [Token #${id}]: تعذر إنشاء الـ commit على الفرع:`, commitRes.data?.message);
      failedCount++;
      continue;
    }

    // 5. Open Pull Request
    const title = prTitle || `chore: automated contribution sync #${id}`;
    const prRes = await ghFetch(`${GITHUB_API}/repos/${targetRepo}/pulls`, token, {
      method: "POST",
      body: JSON.stringify({
        title,
        head: branch,
        base: "main",
        body: `Automated PR created for token #${id} (@${username}).`,
      }),
    });

    let prNumber;
    if (prRes.ok) {
      prNumber = prRes.data?.number;
      console.log(`  🎉 تم إنشاء الـ PR بنجاح: #${prNumber} (${prRes.data?.html_url})`);
    } else if (prRes.data?.errors?.[0]?.message?.includes("A pull request already exists")) {
      // Find existing open PR
      const listPrs = await ghFetch(`${GITHUB_API}/repos/${targetRepo}/pulls?head=${targetRepo.split("/")[0]}:${branch}&state=open`, token);
      prNumber = listPrs.data?.[0]?.number;
      console.log(`  ℹ️ تم العثور على PR مفتوح مسبقاً: #${prNumber}`);
    } else {
      console.error(`❌ [Token #${id}]: تعذر فتح الـ PR:`, prRes.data?.message || prRes.data);
      failedCount++;
      continue;
    }

    // 6. Merge Pull Request
    // Try with PR token first, fallback to maintainerToken
    const mergeToken = (!maintainerToken || maintainerToken.startsWith("ghp_PASTE_")) ? token : maintainerToken;
    const mergeRes = await ghFetch(`${GITHUB_API}/repos/${targetRepo}/pulls/${prNumber}/merge`, mergeToken, {
      method: "PUT",
      body: JSON.stringify({
        commit_title: `Merge pull request #${prNumber} from ${branch}`,
        merge_method: "merge",
      }),
    });

    if (mergeRes.ok) {
      console.log(`  ✅ تم دمج الـ PR #${prNumber} بنجاح!`);
      successCount++;
    } else {
      console.error(`  ⚠️ تعذر دمج الـ PR #${prNumber} (${mergeRes.status}):`, mergeRes.data?.message || "No merge permissions. Provide maintainerToken in .tokens.json to merge.");
      failedCount++;
    }
  }

  console.log(`\n${"=".repeat(60)}`);
  console.log(`📊 النتيجة النهائية:`);
  console.log(`  - مكتمل ومدمج: ${successCount}`);
  console.log(`  - تم التخطي (فارغ): ${skippedCount}`);
  console.log(`  - فشل: ${failedCount}`);
  console.log(`${"=".repeat(60)}\n`);
}

run().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
