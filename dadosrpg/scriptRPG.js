const supabaseClient = window.supabase.createClient(
  'https://eglmqjoqmnipcfnhdcyl.supabase.co',
  'sb_publishable_1mVT1wJ14LpEb7xYEoQmvA_fYna-o-Y'
);







async function carregarHistorico() {

  const { data, error } = await supabaseClient
    .from("rolls")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Erro ao carregar histórico:", error);
    return;
  }

  document.querySelectorAll(".historico ul").forEach(ul => {
    ul.innerHTML = "";
  });

  // 🧠 controla o primeiro de cada player
  const primeiroPorPlayer = new Set();

  data.forEach(roll => {

    const playerEl = document.querySelector(
      `.player[data-player="${roll.player}"]`
    );

    if (!playerEl) return;

    const historico = playerEl.querySelector(".historico ul");

    const resultados = Array.isArray(roll.results) ? roll.results : [];

    const hora = formatarHora(roll.created_at);

    const texto = `[${hora}] ${roll.qtd}d${roll.faces} → ${roll.total} [${resultados.join(", ")}]`;

    const li = document.createElement("li");
    li.textContent = texto;

    // 🟢 marca apenas o mais recente de cada player
    if (!primeiroPorPlayer.has(roll.player)) {
      li.classList.add("latest");
      primeiroPorPlayer.add(roll.player);
    }

    historico.appendChild(li);

  });
}


supabaseClient
  .channel("rolls-realtime")
  .on(
    "postgres_changes",
    {
      event: "INSERT",
      schema: "public",
      table: "rolls"
    },
    (payload) => {

      const roll = payload.new;

      const playerEl = document.querySelector(
        `.player[data-player="${roll.player}"]`
      );

      if (!playerEl) return;

      const historico = playerEl.querySelector(".historico ul");

      const resultados = Array.isArray(roll.results) ? roll.results : [];

      const hora = roll.created_at
        ? formatarHora(roll.created_at)
        : formatarHora(new Date());

      const texto = `[${hora}] ${roll.qtd}d${roll.faces} → ${roll.total} [${resultados.join(", ")}]`;

      const li = document.createElement("li");
      li.textContent = texto;

      // 🧠 remove destaque antigo
      historico.querySelectorAll("li").forEach(el => {
        el.classList.remove("latest");
      });

      // 🟢 marca novo como destaque
      li.classList.add("latest");

      historico.prepend(li);

      if (historico.children.length > 10) {
        historico.removeChild(historico.lastChild);
      }
    }
  )
  .subscribe();



document.querySelectorAll(".player").forEach(player => {

  const btn = player.querySelector(".roll-btn");
  const resultadoEl = player.querySelector(".resultado");
  const historico = player.querySelector(".historico ul");

  btn.addEventListener("click", async () => {
    console.log("Botão clicado!");

    const qtd = parseInt(player.querySelector(".qtd").value);
    const faces = parseInt(player.querySelector(".faces").value);

    let resultados = [];
    let soma = 0;

    for (let i = 0; i < qtd; i++) {
      const roll = Math.floor(Math.random() * faces) + 1;
      resultados.push(roll);
      soma += roll;
    }

    // 👇 MOSTRA COMPLETO
    const agora = new Date();
const hora = formatarHora(agora);

const texto = `${qtd}d${faces} → ${soma} [${resultados.join(", ")}]`;
    resultadoEl.textContent = texto;


    // 🔥 SALVA NO SUPABASE
    const playerId = player.dataset.player;

await supabaseClient.from("rolls").insert({
  player: playerId,
  qtd,
  faces,
  results: resultados,
  total: soma
});

  });

});





window.addEventListener("DOMContentLoaded", () => {
  carregarHistorico();
});





function formatarHora(dateString) {
  const d = new Date(dateString);

  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  const s = String(d.getSeconds()).padStart(2, "0");

  return `${h}:${m}:${s}`;
}