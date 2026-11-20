const $ = (id) => document.getElementById(id);
let register = false,
  questions = [];
let token = sessionStorage.getItem("quiz_token");
const esc = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
async function api(path, body) {
  const r = await fetch("/quiz/api" + path, {
    method: body ? "POST" : "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + token,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const d = await r.json();
  if (!r.ok) {
    if (r.status === 401 && path != "/login") {
      sessionStorage.removeItem("quiz_token");
      token = null;
      show();
    }
    throw Error(d.message || "请求失败");
  }
  return d;
}
function show() {
  $("auth").hidden = !!token;
  $("workspace").hidden = !token;
  $("logout").hidden = !token;
  $("welcome").textContent = "题目练习";
}
function notice(e) {
  $("notice").textContent = e.message || e;
}
$("logout").onclick = () => {
  sessionStorage.clear();
  token = null;
  location.reload();
};
$("toggle").onclick = () => {
  register = !register;
  $("authTitle").textContent = register ? "用户注册" : "用户登录";
  $("authSubmit").textContent = register ? "注册" : "登录";
  $("toggle").textContent = register ? "已有账号" : "创建账号";
  $("password").autocomplete = register ? "new-password" : "current-password";
};
$("authForm").onsubmit = async (e) => {
  e.preventDefault();
  $("authSubmit").disabled = true;
  try {
    const body = {
      username: $("username").value,
      password: $("password").value,
    };
    if (register) {
      await api("/register", body);
      register = true;
      $("toggle").click();
      notice("注册成功，请登录");
    } else {
      const d = await api("/login", body);
      token = d.token;
      sessionStorage.setItem("quiz_token", token);
      notice("");
      show();
    }
  } catch (e) {
    notice(e);
  } finally {
    $("authSubmit").disabled = false;
  }
};
$("start").onclick = async () => {
  try {
    questions = await api("/questions");
    $("result").hidden = true;
    $("quizForm").innerHTML =
      questions
        .map(
          (q, i) =>
            `<section class="card"><small>第 ${i + 1} 题</small><h2>${esc(q.text)}</h2>${["a", "b", "c", "d"].map((k, j) => `<label class="option"><input required type="radio" name="q${q.id}" value="${j}"><span>${"ABCD"[j]}. ${esc(q[k])}</span></label>`).join("")}</section>`,
        )
        .join("") +
      (questions.length
        ? '<button id="submit">提交并查看结果</button>'
        : "<p>暂无题目，请联系管理员添加。</p>");
    notice("");
  } catch (e) {
    notice(e);
  }
};
$("quizForm").onsubmit = async (e) => {
  e.preventDefault();
  $("submit").disabled = true;
  try {
    const answers = {};
    new FormData(e.target).forEach((v, k) => (answers[k.slice(1)] = Number(v)));
    const d = await api("/submit", { answers });
    $("result").hidden = false;
    $("result").innerHTML =
      `<div class="muted">练习报告</div><div class="score">${d.score}<small> / 100</small></div><p>答对 ${d.correct} / ${d.total} 题</p>${d.results.map((q, i) => `<p>${i + 1}. ${esc(q.text)} · ${q.correct ? "正确" : "错误，正确答案：" + "ABCD"[q.answer]}</p>`).join("")}`;
    $("result").scrollIntoView({ behavior: "smooth" });
  } catch (e) {
    notice(e);
  } finally {
    $("submit").disabled = false;
  }
};
show();
