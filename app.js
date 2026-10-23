const $ = (s) => document.querySelector(s);
const messagesEl = $("#messages");
const welcomeEl = $("#welcome");
const promptEl = $("#prompt");
const sendBtn = $("#send");
let history = [];
let mode = "panel";
let busy = false;

async function loadStatus() {
  try {
    const response = await fetch("/api/status");
    const data = await response.json();
    const list = $("#provider-list");
    const configured = data.providers.filter(p => p.configured).length;
    $("#provider-count").textContent = `${configured}/${data.providers.length}`;
    list.innerHTML = data.providers.map(p => `<div class="provider-row"><i class="${p.configured ? "ready" : ""}"></i><span>${escapeHtml(p.label)}</span><em>${p.configured ? "pregătit" : "neconfigurat"}</em></div>`).join("");
  } catch {
    $("#provider-list").innerHTML = '<span class="muted">Server indisponibil</span>';
  }
}
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}
function addMessage(role, text) {
  welcomeEl.hidden = true;
  const item = document.createElement("div");
  item.className = `message ${role}`;
  item.innerHTML = `<div class="avatar">${role === "user" ? "U" : "D"}</div><div class="message-body"><div class="message-label">${role === "user" ? "TU" : "𝕯𝕬𝕽𝕶 AI"}</div><div class="message-content"></div></div>`;
  item.querySelector(".message-content").textContent = text;
  messagesEl.appendChild(item);
  item.scrollIntoView({ behavior: "smooth", block: "end" });
  return item.querySelector(".message-content");
}
function addStatus(text) {
  const el = document.createElement("div");
  el.className = "status-line";
  el.textContent = text;
  messagesEl.appendChild(el);
  el.scrollIntoView({ behavior: "smooth", block: "end" });
  return el;
}
async function sendMessage(text) {
  if (busy || !text.trim()) return;
  busy = true;
  sendBtn.disabled = true;
  promptEl.disabled = true;
  addMessage("user", text.trim());
  history.push({ role: "user", content: text.trim() });
  const status = addStatus(mode === "panel" ? "Modelele analizează în paralel și compară ideile..." : "Căutăm primul răspuns disponibil...");
  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: mode === "fast" ? history.slice(-2) : history })
    });
    const data = await response.json();
    status.remove();
    if (!response.ok) throw new Error(data.error || "A apărut o eroare.");
    const details = data.providers?.map(p => p.ok ? p.label : `${p.label}: indisponibil`).join(" · ") || "";
    const answer = addMessage("assistant", data.answer || "Nu am primit un răspuns.");
    history.push({ role: "assistant", content: data.answer || "" });
    const info = document.createElement("div");
    info.className = "message-label";
    info.style.marginTop = "10px";
    info.textContent = `${data.successfulCount || 0} AI-uri au răspuns${data.synthesisUsed ? " · răspuns coordonat" : " · răspuns direct"}${details ? " · " + details : ""}`;
    answer.parentElement.appendChild(info);
  } catch (error) {
    status.remove();
    addMessage("assistant", `⚠ ${error.message}`);
  } finally {
    busy = false;
    sendBtn.disabled = false;
    promptEl.disabled = false;
    promptEl.focus();
    loadStatus();
  }
}
$("#chat-form").addEventListener("submit", e => {
  e.preventDefault();
  const text = promptEl.value;
  promptEl.value = "";
  promptEl.style.height = "auto";
  sendMessage(text);
});
promptEl.addEventListener("keydown", e => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    $("#chat-form").requestSubmit();
  }
});
promptEl.addEventListener("input", () => {
  promptEl.style.height = "auto";
  promptEl.style.height = `${Math.min(promptEl.scrollHeight, 180)}px`;
});
$("#new-chat").addEventListener("click", () => {
  history = [];
  messagesEl.innerHTML = "";
  welcomeEl.hidden = false;
  promptEl.focus();
  $(".sidebar").classList.remove("open");
});
document.querySelectorAll(".mode").forEach(btn => btn.addEventListener("click", () => {
  document.querySelectorAll(".mode").forEach(b => b.classList.remove("active"));
  btn.classList.add("active");
  mode = btn.dataset.mode;
}));
document.querySelectorAll("[data-prompt]").forEach(btn => btn.addEventListener("click", () => {
  promptEl.value = btn.dataset.prompt;
  promptEl.focus();
  promptEl.style.height = "auto";
  promptEl.style.height = `${promptEl.scrollHeight}px`;
}));
$("#mobile-menu").addEventListener("click", () => $(".sidebar").classList.toggle("open"));
loadStatus();