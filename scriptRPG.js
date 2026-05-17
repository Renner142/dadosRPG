const supabaseClient = window.supabase.createClient(
  'https://eglmqjoqmnipcfnhdcyl.supabase.co',
  'sb_publishable_1mVT1wJ14LpEb7xYEoQmvA_fYna-o-Y'
);

// =======================================================
// CONTROLE DE HISTÓRICO DE DADOS (CARREGAMENTO INICIAL)
// =======================================================
function montarTextoHistorico(roll) {
  const resultados = Array.isArray(roll.results) ? roll.results : [];
  const hora = roll.created_at ? formatarHora(roll.created_at) : formatarHora(new Date());
  const nome = roll.nome_rolagem || "";
  
  // Tag estilizada do Modo de Cálculo
  const modoTag = roll.tipo_calculo === "maior" 
    ? `<span style="color: #ff4757; font-weight: bold; font-size: 10px; background: rgba(255,71,87,0.15); padding: 2px 6px; border-radius: 4px; border: 1px solid rgba(255,71,87,0.3); display: inline-block;">MAIOR</span>` 
    : `<span style="color: #2ed573; font-weight: bold; font-size: 10px; background: rgba(46,213,115,0.15); padding: 2px 6px; border-radius: 4px; border: 1px solid rgba(46,213,115,0.3); display: inline-block;">SOMA</span>`;
  
  // RETORNO ATUALIZADO: Estrutura em caixinha com o horário na direita embaixo
  return `
    <div style="display: flex; flex-direction: column; width: 100%; gap: 4px; padding: 4px 0; text-align: left;">
      <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
        <strong style="color: #ff9f43; font-size: 16px;">${nome}</strong> 
        <span style="color: #888; font-size: 11px;">(${roll.qtd}d${roll.faces})</span> 
        ${modoTag}
      </div>
      
      <div style="display: flex; justify-content: space-between; align-items: flex-end; width: 100%;">
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="color: #666; font-size: 12px;">➔</span>
          <strong style="color: #00ffff; font-size: 16px; text-shadow: 0 0 6px rgba(0,255,255,0.5);">${roll.total}</strong>
          <span style="color: #666; font-size: 11px;">[${resultados.join(", ")}]</span>
        </div>
        
        <div style="color: #444; font-size: 15px; padding-left: 10px; padding-right: 10px; user-select: none;">
          ${hora}
        </div>
      </div>
    </div>
  `;
}

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
    const li = document.createElement("li");
    
    // Configurado com innerHTML para aceitar o estilo visual
    li.innerHTML = montarTextoHistorico(roll);

    if (!primeiroPorPlayer.has(roll.player)) {
      li.classList.add("latest");
      primeiroPorPlayer.add(roll.player);
    }

    historico.appendChild(li);
  });
}

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
        const li = document.createElement("li");
        
        // Configurado com innerHTML para o tempo real também ficar bonito
        li.innerHTML = montarTextoHistorico(roll);

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
// CONTROLE DE BARRAS DE STATUS COM SUPABASE REALTIME
// =======================================================
function renderizarBarraVisual(row) {
  const atualInput = row.querySelector(".status-atual");
  const maxInput = row.querySelector(".status-max");
  const barFill = row.querySelector(".bar-fill");

  if (!atualInput || !maxInput || !barFill) return;

  let atual = parseInt(atualInput.value) || 0;
  let max = parseInt(maxInput.value) || 0;

  if (max <= 0) {
    barFill.style.width = "0%";
    return;
  }
  
  if (atual < 0) atual = 0;

  let porcentagem = (atual / max) * 100;
  if (porcentagem > 100) porcentagem = 100;

  barFill.style.width = `${porcentagem}%`;
}

async function carregarStatusIniciais() {
  const { data, error } = await supabaseClient
    .from("status_players")
    .select("*");

  if (error) {
    console.error("Erro crítico ao buscar status no Supabase:", error);
    return;
  }

  data.forEach(status => {
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

        if (inputAtual && inputMax) {
          inputAtual.value = status[`${bancoPrefixo}_atual`] ?? 0;
          inputMax.value = status[`${bancoPrefixo}_max`] ?? 0;
          renderizarBarraVisual(row);
        }
      }
    });
  });
}

function inicializarEventosDeDigitacao() {
  let timeouts = {};

  document.querySelectorAll(".player").forEach(player => {
    const playerId = player.dataset.player;

    player.querySelectorAll(".status-inputs input").forEach(input => {
      input.addEventListener("input", () => {
        const row = input.closest(".status-row");
        if (!row) return;
        
        const tipoStatus = row.dataset.status;

        renderizarBarraVisual(row);

        const atual = parseInt(row.querySelector(".status-atual").value) || 0;
        const max = parseInt(row.querySelector(".status-max").value) || 0;

        let dadosAtualizacao = {};
        dadosAtualizacao[`${tipoStatus}_atual`] = atual;
        dadosAtualizacao[`${tipoStatus}_max`] = max;

        clearTimeout(timeouts[playerId + tipoStatus]);
        timeouts[playerId + tipoStatus] = setTimeout(async () => {
          await supabaseClient
            .from("status_players")
            .upsert({ 
              player: playerId, 
              ...dadosAtualizacao,
              updated_at: new Date()
            }, { onConflict: 'player' });
        }, 500);
      });
    });
  });
}

function ligarRealtimeDeStatus() {
  supabaseClient
    .channel("mudancas-status")
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "status_players" },
      (payload) => {
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
      const qtd = parseInt(player.querySelector(".qtd").value) || 1;
      const faces = parseInt(player.querySelector(".faces").value) || 20;
      const nomeRolagem = player.querySelector(".nome-rolagem").value.trim() || "";
      const tipoCalculo = player.querySelector(".tipo-calculo").value;

      let resultados = [];
      for (let i = 0; i < qtd; i++) {
        const roll = Math.floor(Math.random() * faces) + 1;
        resultados.push(roll);
      }

      let totalExibido = 0;
      if (tipoCalculo === "maior") {
        totalExibido = Math.max(...resultados);
      } else {
        totalExibido = resultados.reduce((a, b) => a + b, 0);
      }

      const agora = new Date();
      const hora = formatarHora(agora);
      const rotuloCalculo = tipoCalculo === "maior" ? "Maior Dado" : "Soma Total";
      
      // Injeta a caixinha moderna com visual Neon e o relógio no canto direito inferior
      resultadoEl.innerHTML = `
        <div style="background: rgba(10, 10, 10, 0.7); padding: 10px; border-radius: 6px; border: 1px solid #2a2a2a; border-left: 4px solid #00ffff; margin-top: 8px; text-align: left; position: relative;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
            <span style="color: #ff9f43; font-weight: bold; font-size: 13px;">🎲 ${nomeRolagem}</span>
            <span style="color: #555; font-size: 10px;">${rotuloCalculo} (${qtd}d${faces})</span>
          </div>
          
          <div style="font-size: 22px; font-weight: bold; color: #fff; margin: 4px 0;">
            Total: <span style="color: #00ffff; text-shadow: 0 0 10px rgba(0,255,255,0.6);">${totalExibido}</span>
          </div>
          
          <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-top: 2px;">
            <span style="color: #777; font-size: 11px;">Dados: [ ${resultados.join(" , ")} ]</span>
            <span style="color: #333; font-size: 20px;">${hora}</span>
          </div>
        </div>
      `;

      const playerId = player.dataset.player;

      await supabaseClient.from("rolls").insert({
        player: playerId,
        qtd,
        faces,
        results: resultados,
        total: totalExibido,
        nome_rolagem: nomeRolagem,
        tipo_calculo: tipoCalculo
      });
    });
  });
}

// =======================================================
// CARREGADOR ÚNICO INICIAL DA PÁGINA
// =======================================================
window.addEventListener("DOMContentLoaded", () => {
  carregarHistorico();
  carregarStatusIniciais();
  inicializarEventosDeDigitacao();
  inicializarBotoesDeRolagem();
  ligarRealtimeDeStatus();
  ligarRealtimeDeDados();
});

function formatarHora(dateString) {
  const d = new Date(dateString);
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  const s = String(d.getSeconds()).padStart(2, "0");
  return `${h}:${m}:${s}`;
}
