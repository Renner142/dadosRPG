const supabaseClient = window.supabase.createClient(
  'https://eglmqjoqmnipcfnhdcyl.supabase.co',
  'sb_publishable_1mVT1wJ14LpEb7xYEoQmvA_fYna-o-Y'
);

// =======================================================
// CONTROLE DE HISTÓRICO DE DADOS (CARREGAMENTO INICIAL)
// =======================================================
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

  const primeiroPorPlayer = new Set();

  data.forEach(roll => {
    const playerEl = document.querySelector(`.player[data-player="${roll.player}"]`);
    if (!playerEl) return;

    const historico = playerEl.querySelector(".historico ul");
    const resultados = Array.isArray(roll.results) ? roll.results : [];
    const hora = formatarHora(roll.created_at);
    const texto = `[${hora}] ${roll.qtd}d${roll.faces} → ${roll.total} [${resultados.join(", ")}]`;

    const li = document.createElement("li");
    li.textContent = texto;

    if (!primeiroPorPlayer.has(roll.player)) {
      li.classList.add("latest");
      primeiroPorPlayer.add(roll.player);
    }

    historico.appendChild(li);
  });
}

// =======================================================
// CONTROLE DE BARRAS DE STATUS COM SUPABASE REALTIME
// =======================================================

// 1. Função auxiliar para desenhar a barra na tela de forma visual
function renderizarBarraVisual(row) {
  const atualInput = row.querySelector(".status-atual");
  const maxInput = row.querySelector(".status-max");
  const barFill = row.querySelector(".bar-fill");

  if (!atualInput || !maxInput || !barFill) return;

  let atual = parseInt(atualInput.value) || 0;
  let max = parseInt(maxInput.value) || 0;

  // Se o máximo for zero ou menor, esvazia a barra para evitar erros matemáticos
  if (max <= 0) {
    barFill.style.width = "0%";
    return;
  }
  
  if (atual < 0) atual = 0;

  let porcentagem = (atual / max) * 100;
  if (porcentagem > 100) porcentagem = 100;

  barFill.style.width = `${porcentagem}%`;
}

// 2. Carrega os dados iniciais do banco de dados e aplica nos inputs
async function carregarStatusIniciais() {
  console.log("Tentando buscar dados iniciais da tabela status_players...");
  
  const { data, error } = await supabaseClient
    .from("status_players")
    .select("*");

  if (error) {
    console.error("Erro crítico ao buscar status no Supabase:", error);
    return;
  }

  console.log("Dados brutos recebidos do Supabase:", data);

  if (!data || data.length === 0) {
    console.warn("A tabela do banco de dados retornou vazia! Execute os INSERTS no SQL Editor.");
    return;
  }

  // Preenche cada player com seus respectivos dados salvos
  data.forEach(status => {
    // Busca o bloco do player garantindo que o ID bata (ex: data-player="dick")
    const playerEl = document.querySelector(`.player[data-player="${status.player.toLowerCase().trim()}"]`);
    if (!playerEl) {
      console.warn(`Aviso: Player '${status.player}' está no banco, mas não foi encontrado no HTML.`);
      return;
    }

    // Mapeamento explícito para garantir que o HTML 'sanidade' converse perfeitamente com o banco
    const mapeamento = [
      { tipoHtml: "pv", bancoPrefixo: "pv" },
      { tipoHtml: "sanidade", bancoPrefixo: "sanidade" },
      { tipoHtml: "pe", bancoPrefixo: "pe" }
    ];

    mapeamento.forEach(({ tipoHtml, bancoPrefixo }) => {
      const row = playerEl.querySelector(`.status-row[data-status="${tipoHtml}"]`);
      if (row) {
        const inputAtual = row.querySelector(".status-atual");
        const inputMax = row.querySelector(".status-max");

        if (inputAtual && inputMax) {
          inputAtual.value = status[`${bancoPrefixo}_atual`] ?? 0;
          inputMax.value = status[`${bancoPrefixo}_max`] ?? 0;
          renderizarBarraVisual(row);
        }
      }
    });
  });
  console.log("Renderização inicial das barras concluída com sucesso!");
}

// 3. Monitora os inputs digitados e salva no banco (com timer para não sobrecarregar)
function inicializarEventosDeDigitacao() {
  let timeouts = {};

  document.querySelectorAll(".player").forEach(player => {
    const playerId = player.dataset.player;

    player.querySelectorAll(".status-inputs input").forEach(input => {
      input.addEventListener("input", () => {
        const row = input.closest(".status-row");
        if (!row) return;
        
        const tipoStatus = row.dataset.status; // 'pv', 'sanidade' ou 'pe'

        // Renderiza na tela do usuário imediatamente de forma local
        renderizarBarraVisual(row);

        const atual = parseInt(row.querySelector(".status-atual").value) || 0;
        const max = parseInt(row.querySelector(".status-max").value) || 0;

        // Monta o payload dinâmico para enviar ao banco utilizando o prefixo correto
        let dadosAtualizacao = {};
        dadosAtualizacao[`${tipoStatus}_atual`] = atual;
        dadosAtualizacao[`${tipoStatus}_max`] = max;

        // "Debounce": Espera 500ms após o usuário parar de digitar para salvar
        clearTimeout(timeouts[playerId + tipoStatus]);
        timeouts[playerId + tipoStatus] = setTimeout(async () => {
          console.log(`Enviando atualização para o player [${playerId}] - Status [${tipoStatus}]:`, dadosAtualizacao);
          
          const { error } = await supabaseClient
            .from("status_players")
            .upsert({ 
              player: playerId, 
              ...dadosAtualizacao,
              updated_at: new Date()
            }, { onConflict: 'player' });

          if (error) {
            console.error(`Erro ao salvar dados de ${playerId}:`, error);
          } else {
            console.log(`Dados de ${playerId} salvos com sucesso no Supabase.`);
          }
        }, 500);
      });
    });
  });
}

// 4. Se conecta ao Canal Realtime para ouvir mudanças vindas de outras telas
function ligarRealtimeDeStatus() {
  supabaseClient
    .channel("mudancas-status")
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "status_players" },
      (payload) => {
        console.log("Mudança em tempo real detectada na tabela status_players:", payload);
        const status = payload.new;
        
        const playerEl = document.querySelector(`.player[data-player="${status.player.toLowerCase().trim()}"]`);
        if (!playerEl) return;

        const mapeamento = [
          { tipoHtml: "pv", bancoPrefixo: "pv" },
          { tipoHtml: "sanidade", bancoPrefixo: "sanidade" },
          { tipoHtml: "pe", bancoPrefixo: "pe" }
        ];

        mapeamento.forEach(({ tipoHtml, bancoPrefixo }) => {
          const row = playerEl.querySelector(`.status-row[data-status="${tipoHtml}"]`);
          if (row) {
            const inputAtual = row.querySelector(".status-atual");
            const inputMax = row.querySelector(".status-max");

            // Só altera o input se o usuário não estiver com o cursor focado nele no momento
            if (inputAtual && document.activeElement !== inputAtual) {
              inputAtual.value = status[`${bancoPrefixo}_atual`] ?? 0;
            }
            if (inputMax && document.activeElement !== inputMax) {
              inputMax.value = status[`${bancoPrefixo}_max`] ?? 0;
            }
            
            renderizarBarraVisual(row);
          }
        });
      }
    )
    .subscribe((status) => {
      console.log("Inscrição no canal Realtime de status:", status);
    });
}
// =======================================================
// ESCUTA REALTIME DE NOVAS ROLAGENS DE DADOS
// =======================================================
function ligarRealtimeDeDados() {
  supabaseClient
    .channel("rolls-realtime")
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "rolls" },
      (payload) => {
        const roll = payload.new;
        const playerEl = document.querySelector(`.player[data-player="${roll.player}"]`);
        if (!playerEl) return;

        const historico = playerEl.querySelector(".historico ul");
        const resultados = Array.isArray(roll.results) ? roll.results : [];
        const hora = roll.created_at ? formatarHora(roll.created_at) : formatarHora(new Date());
        const texto = `[${hora}] ${roll.qtd}d${roll.faces} → ${roll.total} [${resultados.join(", ")}]`;

        const li = document.createElement("li");
        li.textContent = texto;

        historico.querySelectorAll("li").forEach(el => {
          el.classList.remove("latest");
        });

        li.classList.add("latest");
        historico.prepend(li);

        if (historico.children.length > 10) {
          historico.removeChild(historico.lastChild);
        }
      }
    )
    .subscribe();
}

// =======================================================
// EVENTO DE CLIQUE DO BOTÃO DE ROLAR DADOS DOS JOGADORES
// =======================================================
function inicializarBotoesDeRolagem() {
  document.querySelectorAll(".player").forEach(player => {
    const btn = player.querySelector(".roll-btn");
    const resultadoEl = player.querySelector(".resultado");

    btn.addEventListener("click", async () => {
      console.log("Botão clicado!");

      const qtd = parseInt(player.querySelector(".qtd").value) || 1;
      const faces = parseInt(player.querySelector(".faces").value) || 20;

      let resultados = [];
      let soma = 0;

      for (let i = 0; i < qtd; i++) {
        const roll = Math.floor(Math.random() * faces) + 1;
        resultados.push(roll);
        soma += roll;
      }

      const agora = new Date();
      const hora = formatarHora(agora);
      const texto = `${qtd}d${faces} → ${soma} [${resultados.join(", ")}]`;
      resultadoEl.textContent = texto;

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
}

// =======================================================
// CARREGADOR ÚNICO INICIAL DA PÁGINA (CORREÇÃO CONFLITOS)
// =======================================================
window.addEventListener("DOMContentLoaded", () => {
  carregarHistorico();
  carregarStatusIniciais();
  inicializarEventosDeDigitacao();
  inicializarBotoesDeRolagem();
  ligarRealtimeDeStatus();
  ligarRealtimeDeDados();
});

// Função utilitária de horas
function formatarHora(dateString) {
  const d = new Date(dateString);
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  const s = String(d.getSeconds()).padStart(2, "0");
  return `${h}:${m}:${s}`;
}
