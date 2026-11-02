const matchDialog = document.querySelector("#match-dialog");
const matchForm = document.querySelector("#match-form");
const matchBody = document.querySelector("#matches-body");
const emptyState = document.querySelector("#empty-state");
const formError = document.querySelector("#form-error");
const toast = document.querySelector("#toast");
let matches = [];
let chart;
let toastTimer;

document.querySelector("#today-label").textContent = new Intl.DateTimeFormat("ko-KR", {
  year: "numeric", month: "long", day: "numeric", weekday: "short",
}).format(new Date());

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("visible"), 2400);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]);
}

async function request(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { "Content-Type": "application/json", ...options.headers },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.detail || "요청을 처리하지 못했습니다.");
  }
  return response.status === 204 ? null : response.json();
}

function renderMatches() {
  const query = document.querySelector("#search-input").value.trim().toLocaleLowerCase();
  const filtered = matches.filter((match) => match.game_name.toLocaleLowerCase().includes(query));
  matchBody.innerHTML = filtered.map((match) => `
    <tr>
      <td><span class="game-cell"><span class="game-mark">${escapeHtml(match.game_name.slice(0, 1).toUpperCase())}</span>${escapeHtml(match.game_name)}</span></td>
      <td>${escapeHtml(match.played_on)}</td>
      <td><span class="result-badge ${match.result === "loss" ? "loss" : ""}">${match.result === "win" ? "승리" : "패배"}</span></td>
      <td class="kda-cell">${match.kills} <span class="kda-separator">/</span> ${match.deaths} <span class="kda-separator">/</span> ${match.assists}</td>
      <td class="action-cell"><button class="row-action" data-action="edit" data-id="${match.id}">수정</button><button class="row-action delete" data-action="delete" data-id="${match.id}">삭제</button></td>
    </tr>`).join("");
  emptyState.classList.toggle("visible", filtered.length === 0);
  document.querySelector("#record-count").textContent = `총 ${matches.length}경기`;
}

function renderChart(daily) {
  const canvas = document.querySelector("#performance-chart");
  if (typeof Chart === "undefined") {
    document.querySelector("#chart-wrap").innerHTML = '<p class="chart-fallback">그래프를 불러오지 못했습니다. 인터넷 연결을 확인해 주세요.</p>';
    return;
  }
  if (chart) chart.destroy();
  chart = new Chart(canvas, {
    type: "line",
    data: {
      labels: daily.map((item) => item.played_on.slice(5)),
      datasets: [
        { label: "승리", data: daily.map((item) => item.wins), borderColor: "#b9ef68", backgroundColor: "#b9ef681a", pointBackgroundColor: "#b9ef68", tension: 0.3, fill: true },
        { label: "패배", data: daily.map((item) => item.matches - item.wins), borderColor: "#ff8178", backgroundColor: "#ff81780d", pointBackgroundColor: "#ff8178", tension: 0.3, fill: true },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: { intersect: false, mode: "index" },
      plugins: { legend: { display: false }, tooltip: { backgroundColor: "#111713", titleColor: "#e8eee9", bodyColor: "#b7c2ba", borderColor: "#3a463e", borderWidth: 1, padding: 10 } },
      scales: {
        x: { grid: { display: false }, border: { display: false }, ticks: { color: "#78857c", maxTicksLimit: 8, font: { family: "DM Mono", size: 9 } } },
        y: { beginAtZero: true, suggestedMax: 3, grid: { color: "#ffffff0c" }, border: { display: false }, ticks: { color: "#78857c", precision: 0, stepSize: 1, font: { family: "DM Mono", size: 9 } } },
      },
    },
  });
}

async function refreshDashboard() {
  const [nextMatches, stats] = await Promise.all([request("/api/matches"), request("/api/stats")]);
  matches = nextMatches;
  document.querySelector("#total-matches").innerHTML = `${stats.total_matches}<span class="stat-unit"> 경기</span>`;
  document.querySelector("#win-rate").innerHTML = `${stats.win_rate}<span class="stat-unit">%</span>`;
  document.querySelector("#win-count").textContent = `${stats.wins}승`;
  document.querySelector("#loss-count").textContent = `${stats.total_matches - stats.wins}패`;
  document.querySelector("#avg-kills").textContent = stats.avg_kills.toFixed(1);
  document.querySelector("#avg-deaths").textContent = stats.avg_deaths.toFixed(1);
  document.querySelector("#avg-assists").textContent = stats.avg_assists.toFixed(1);
  renderMatches();
  renderChart(stats.daily);
}

function openNewMatch() {
  matchForm.reset();
  document.querySelector("#match-id").value = "";
  document.querySelector("#played-on").value = new Date().toLocaleDateString("sv-SE");
  document.querySelector("#dialog-title").textContent = "새 전적 기록";
  document.querySelector("#submit-match").textContent = "저장하기";
  formError.textContent = "";
  matchDialog.showModal();
}

document.querySelector("#new-match-button").addEventListener("click", openNewMatch);
document.querySelector("#empty-add-button").addEventListener("click", openNewMatch);
document.querySelector("#close-dialog").addEventListener("click", () => matchDialog.close());
document.querySelector("#cancel-dialog").addEventListener("click", () => matchDialog.close());
document.querySelector("#search-input").addEventListener("input", renderMatches);

matchForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(matchForm);
  const match = Object.fromEntries(formData.entries());
  for (const field of ["kills", "deaths", "assists"]) match[field] = Number(match[field]);
  const id = document.querySelector("#match-id").value;
  try {
    await request(id ? `/api/matches/${id}` : "/api/matches", {
      method: id ? "PUT" : "POST", body: JSON.stringify(match),
    });
    matchDialog.close();
    await refreshDashboard();
    showToast(id ? "전적을 수정했어요." : "새 전적을 기록했어요.");
  } catch (error) {
    formError.textContent = error.message;
  }
});

matchBody.addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  const match = matches.find((item) => item.id === Number(button.dataset.id));
  if (!match) return;
  if (button.dataset.action === "edit") {
    document.querySelector("#match-id").value = match.id;
    document.querySelector("#game-name").value = match.game_name;
    document.querySelector("#played-on").value = match.played_on;
    document.querySelector(`input[name="result"][value="${match.result}"]`).checked = true;
    for (const field of ["kills", "deaths", "assists"]) document.querySelector(`#${field}`).value = match[field];
    document.querySelector("#dialog-title").textContent = "전적 수정";
    document.querySelector("#submit-match").textContent = "수정 저장";
    formError.textContent = "";
    matchDialog.showModal();
    return;
  }
  if (!confirm(`${match.game_name} 전적을 삭제할까요?`)) return;
  try {
    await request(`/api/matches/${match.id}`, { method: "DELETE" });
    await refreshDashboard();
    showToast("전적을 삭제했어요.");
  } catch (error) {
    showToast(error.message);
  }
});

refreshDashboard().catch((error) => {
  document.querySelector("#empty-state").classList.add("visible");
  document.querySelector("#empty-state strong").textContent = "데이터를 불러오지 못했습니다";
  document.querySelector("#empty-state span:not(.empty-mark)").textContent = error.message;
});