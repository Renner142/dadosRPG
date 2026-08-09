// =======================================================
// 1. INICIALIZAÇÃO E VARIÁVEIS GLOBAIS
// =======================================================
const supabaseClient = window.supabase.createClient(
  'https://eglmqjoqmnipcfnhdcyl.supabase.co',
  'sb_publishable_1mVT1wJ14LpEb7xYEoQmvA_fYna-o-Y'
);

let personagemAtual = null;

// =======================================================
// 2. NAVEGAÇÃO DE TELAS E SELEÇÃO DE PERSONAGEM
// =======================================================
function selecionarCampanha(nomeCampanha) {
  console.log("Campanha selecionada:", nomeCampanha);
  const screenCampaign = document.getElementById("screen-campaign");
  const screenCharacter = document.getElementById("screen-character");
  
  if (screenCampaign) screenCampaign.classList.remove("active");
  if (screenCharacter) screenCharacter.classList.add("active");
}

// Executa assim que a página carrega para recuperar os testes salvos no navegador
document.addEventListener("DOMContentLoaded", () => {
  carregarHistoricoLocal();
});

function rolarDadoLocal() {
  const nomeTeste = document.getElementById("local-nome-teste").value.trim() || "Teste Geral";
  const qtdDados = parseInt(document.getElementById("local-qtd-dados").value) || 1;
  const facesDado = parseInt(document.getElementById("local-faces-dado").value) || 20;
  const tipoCalculo = document.getElementById("local-tipo-calculo").value;
  const modificador = parseInt(document.getElementById("local-modificador").value) || 0;

  let resultados = [];
  for (let i = 0; i < qtdDados; i++) {
    resultados.push(Math.floor(Math.random() * facesDado) + 1);
  }

  let total = 0;
  if (tipoCalculo === "maior") {
    total = Math.max(...resultados) + modificador;
  } else {
    total = resultados.reduce((a, b) => a + b, 0) + modificador;
  }

  const modTexto = modificador >= 0 ? `+${modificador}` : `${modificador}`;
  const hora = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const novaRolagem = {
    nomeTeste,
    detalhes: `${qtdDados}d${facesDado} (${modTexto}) [${tipoCalculo.toUpperCase()}]`,
    resultados: `[${resultados.join(", ")}]`,
    total,
    hora
  };

  // Salva no localStorage
  let historicoLocal = JSON.parse(localStorage.getItem("historico_local_rpg") || "[]");
  historicoLocal.unshift(novaRolagem); // Adiciona no início da lista
  localStorage.setItem("historico_local_rpg", JSON.stringify(historicoLocal));

  // Atualiza a tela
  renderizarHistoricoLocal(historicoLocal);
}

function carregarHistoricoLocal() {
  const historicoLocal = JSON.parse(localStorage.getItem("historico_local_rpg") || "[]");
  renderizarHistoricoLocal(historicoLocal);
}

function renderizarHistoricoLocal(lista) {
  const ul = document.getElementById("local-historico-list");
  if (!ul) return;

  if (lista.length === 0) {
    ul.innerHTML = `<li class="empty-msg">Nenhuma rolagem feita ainda.</li>`;
    return;
  }

  ul.innerHTML = lista.map(item => `
    <li style="border-bottom: 1px solid #333; padding: 6px 0; font-size: 13px;">
      <strong style="color: #ff9f43;">${item.nomeTeste}</strong> 
      <small style="color: #888;">${item.detalhes}</small> - 
      <span style="color: #2ed573; font-weight: bold;">➡️ ${item.total}</span>
      <small style="color: #555; display: block;">${item.resultados} às ${item.hora}</small>
    </li>
  `).join("");
}

function voltarParaCampanhas() {
  const screenCampaign = document.getElementById("screen-campaign");
  const screenCharacter = document.getElementById("screen-character");
  
  if (screenCharacter) screenCharacter.classList.remove("active");
  if (screenCampaign) screenCampaign.classList.add("active");
}

function trocarPersonagem() {
  const screenGameboard = document.getElementById("screen-gameboard");
  const screenCharacter = document.getElementById("screen-character");
  
  if (screenGameboard) screenGameboard.classList.remove("active");
  if (screenCharacter) screenCharacter.classList.add("active");
}

function selecionarPersonagem(idPersonagem) {
  personagemAtual = idPersonagem;
  console.log("Personagem ativo selecionado:", personagemAtual);

  // 1. Reorganiza quem é o destaque e quem é aliado na tela
  renderizarMesa();

  // 2. Limpa a flag 'data-bound' para obrigar os novos botões a registrarem os cliques
  document.querySelectorAll(".roll-btn").forEach(btn => {
    delete btn.dataset.bound;
  });

  // 3. Re-inicializa os eventos nos inputs e botões do novo card ativo
  if (typeof inicializarEventosDeDigitacao === "function") inicializarEventosDeDigitacao();
  if (typeof inicializarBotoesDeRolagem === "function") inicializarBotoesDeRolagem();

  // 4. Recarrega o histórico filtrando apenas as rolagens do novo personagem
  carregarHistorico();

  // 5. Faz a troca visual de telas
  const screenCharacter = document.getElementById("screen-character");
  const screenGameboard = document.getElementById("screen-gameboard");

  if (screenCharacter) screenCharacter.classList.remove("active");
  if (screenGameboard) screenGameboard.classList.add("active");
}

function renderizarMesa() {
  const featuredSlot = document.getElementById("featured-slot");
  const alliesGrid = document.getElementById("allies-grid");
  const storage = document.getElementById("players-storage");
  const tituloModo = document.getElementById("titulo-modo-jogo");
  const dashboard = document.querySelector(".dashboard-layout");

  if (!featuredSlot || !alliesGrid) return;

  // 1. Resgata todos os cards de jogadores
  const todosOsPlayers = Array.from(document.querySelectorAll(".player"));

  // 2. Devolve para o storage oculto antes de organizar
  if (storage) {
    todosOsPlayers.forEach(p => storage.appendChild(p));
  }

  featuredSlot.innerHTML = "";
  alliesGrid.innerHTML = "";

  const idAtualNormalizado = (personagemAtual || "").toString().trim().toLowerCase();

  // ==========================================
  // VISÃO DO MESTRE (LADO ESQUERDO, CENTRO, LADO DIREITO)
  // ==========================================
  if (idAtualNormalizado === "mestre") {
    if (dashboard) dashboard.classList.add("modo-mestre");
    if (tituloModo) tituloModo.innerText = "Visão Geral (Mestre)";
    
    featuredSlot.style.display = "flex";

    // Divide os jogadores igualmente entre Esquerda (featuredSlot) e Direita (alliesGrid)
    const metade = Math.ceil(todosOsPlayers.length / 2);

    todosOsPlayers.forEach((player, index) => {
      if (index < metade) {
        featuredSlot.appendChild(player); // Vai para o lado Esquerdo
      } else {
        alliesGrid.appendChild(player);   // Vai para o lado Direito
      }
    });

  // ==========================================
  // VISÃO NORMAL DO JOGADOR
  // ==========================================
  } else {
    if (dashboard) dashboard.classList.remove("modo-mestre");
    featuredSlot.style.display = "block";

    todosOsPlayers.forEach(p => {
      const pId = (p.getAttribute("data-player") || "").toString().trim().toLowerCase();

      if (pId === idAtualNormalizado) {
        featuredSlot.appendChild(p); // Card ativo no topo da esquerda
        if (tituloModo) {
          const nomeEl = p.querySelector("h2");
          tituloModo.innerText = `Jogando como: ${nomeEl ? nomeEl.innerText : pId}`;
        }
      } else {
        alliesGrid.appendChild(p);   // Outros na coluna da direita
      }
    });
  }

  // Re-vincula os eventos dos inputs e botões
  if (typeof inicializarEventosDeDigitacao === "function") inicializarEventosDeDigitacao();
  if (typeof inicializarBotoesDeRolagem === "function") inicializarBotoesDeRolagem();
}

// =======================================================
// 3. CONTROLE DE HISTÓRICO DE DADOS (GERAL E PESSOAL)
// =======================================================
function formatarHora(dateString) {
  const d = dateString ? new Date(dateString) : new Date();
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  const s = String(d.getSeconds()).padStart(2, "0");
  return `${h}:${m}:${s}`;
}

function montarTextoHistorico(roll) {
  const resultados = Array.isArray(roll.results) ? roll.results : [];
  const hora = formatarHora(roll.created_at);
  const nome = roll.nome_rolagem || "Dados";
  const mod = roll.modificador || 0;
  
  const textoMod = mod > 0 
    ? ` <span style="color: #2ed573; font-weight: bold;">+${mod}</span>` 
    : mod < 0 
      ? ` <span style="color: #ff4757; font-weight: bold;">${mod}</span>` 
      : "";

  const modoTag = roll.tipo_calculo === "maior" 
    ? `<span style="color: #ff4757; font-weight: bold; font-size: 10px; background: rgba(255,71,87,0.15); padding: 2px 6px; border-radius: 4px; border: 1px solid rgba(255,71,87,0.3); display: inline-block;">MAIOR</span>` 
    : `<span style="color: #2ed573; font-weight: bold; font-size: 10px; background: rgba(46,213,115,0.15); padding: 2px 6px; border-radius: 4px; border: 1px solid rgba(46,213,115,0.3); display: inline-block;">SOMA</span>`;
  
  // Imagem do avatar ou um placeholder caso não exista
  const avatarUrl = roll.avatar_url || 'https://via.placeholder.com/40';

  return `
    <div style="display: flex; align-items: flex-start; gap: 10px; width: 100%; padding: 8px 0; border-bottom: 1px solid #2a2a2a;">
      <img src="${avatarUrl}" alt="${roll.player}" style="width: 38px; height: 38px; border-radius: 6px; object-fit: cover; border: 1px solid #444; flex-shrink: 0; margin-top: 2px;">
      
      <div style="display: flex; flex-direction: column; width: 100%; gap: 3px;">
        <div style="display: flex; align-items: center; justify-content: space-between;">
          <span style="color: #aaa; font-size: 11px; font-weight: bold; text-transform: uppercase;">${roll.player || ''}</span>
          <span style="color: #555; font-size: 11px;">${hora}</span>
        </div>
        <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
          <strong style="color: #ff9f43; font-size: 14px;">${nome}</strong> 
          <span style="color: #888; font-size: 11px;">(${roll.qtd}d${roll.faces})${textoMod}</span> 
          ${modoTag}
        </div>
        
        <div style="display: flex; align-items: center; gap: 8px; margin-top: 2px;">
          <span style="color: #666; font-size: 12px;">➔</span>
          <strong style="color: #00ffff; font-size: 16px; text-shadow: 0 0 6px rgba(0,255,255,0.5);">${roll.total}</strong>
          <span style="color: #666; font-size: 11px;">[${resultados.join(", ")}]</span>
        </div>
      </div>
    </div>
  `;
}

function adicionarRolagemNaInterface(roll) {
  const listaGeral = document.getElementById("historico-geral-list");
  const listaPessoal = document.getElementById("historico-pessoal-list");

  // 1. Histórico Geral da Mesa
  if (listaGeral) {
    const liGeral = document.createElement("li");
    liGeral.style.listStyle = "none";
    liGeral.innerHTML = montarTextoHistorico(roll);
    listaGeral.prepend(liGeral);

    if (listaGeral.children.length > 30) {
      listaGeral.removeChild(listaGeral.lastChild);
    }
  }

  // 2. Histórico Pessoal do Jogador Ativo
  const jogadorRolagem = (roll.player || "").toLowerCase();
  const jogadorAtivo = (personagemAtual || "").toLowerCase();

  if (personagemAtual && personagemAtual !== "mestre" && jogadorRolagem === jogadorAtivo && listaPessoal) {
    const emptyMsg = listaPessoal.querySelector(".empty-msg");
    if (emptyMsg) emptyMsg.remove();

    const liPessoal = document.createElement("li");
    liPessoal.style.listStyle = "none";
    liPessoal.innerHTML = montarTextoHistorico(roll);
    listaPessoal.prepend(liPessoal);

    if (listaPessoal.children.length > 20) {
      listaPessoal.removeChild(listaPessoal.lastChild);
    }
  }
}

async function carregarHistorico() {
  const { data, error } = await supabaseClient
    .from("rolls")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Erro ao carregar histórico:", error);
    return;
  }

  const listaGeral = document.getElementById("historico-geral-list");
  const listaPessoal = document.getElementById("historico-pessoal-list");

  if (listaGeral) listaGeral.innerHTML = "";
  if (listaPessoal) listaPessoal.innerHTML = '<li class="empty-msg">Nenhuma rolagem pessoal ainda.</li>';

  if (data) {
    data.forEach(roll => {
      adicionarRolagemNaInterface(roll);
    });
  }
}

function ligarRealtimeDeDados() {
  supabaseClient
    .channel("rolls-realtime")
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "rolls" },
      (payload) => {
        adicionarRolagemNaInterface(payload.new);
      }
    )
    .subscribe();
}

// =======================================================
// 4. BARRAS DE STATUS COM SUPABASE REALTIME
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
    console.error("Erro ao buscar status:", error);
    return;
  }

  if (!data) return;

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

        // 1. Faz a barra andar
        renderizarBarraVisual(row);

        // 2. Faz o card piscar na sua tela imediatamente ao digitar!
        notificarAlteracaoStatus(player, tipoStatus);

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
        // Localiza o card do personagem pelo data-player (ferreira, malu, simon, oliver)
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

            const valorAntigo = parseInt(inputAtual?.value || 0);
            const valorNovo = status[`${bancoPrefixo}_atual`] ?? 0;

            // Se o valor mudou em relação ao que estava na tela, faz o card piscar!
            if (valorAntigo !== valorNovo) {
              notificarAlteracaoStatus(playerEl, tipoHtml);
            }

            if (inputAtual && document.activeElement !== inputAtual) {
              inputAtual.value = valorNovo;
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

function notificarAlteracaoStatus(playerElement, tipoStatus) {
  if (!playerElement) return;

  let classePiscar = "";
  if (tipoStatus === "pv") classePiscar = "piscar-pv";
  else if (tipoStatus === "sanitude" || tipoStatus === "sanidade") classePiscar = "piscar-sanidade";
  else if (tipoStatus === "pe") classePiscar = "piscar-pe";

  if (!classePiscar) return;

  playerElement.classList.remove("piscar-pv", "piscar-sanidade", "piscar-pe");
  void playerElement.offsetWidth; // Força reinício da animação CSS

  playerElement.classList.add(classePiscar);

  setTimeout(() => {
    playerElement.classList.remove(classePiscar);
  }, 2000);
}

// =======================================================
// 5. BOTÕES DE ROLAGEM DE DADOS DOS PLAYERS
// =======================================================
function inicializarBotoesDeRolagem() {
  document.querySelectorAll(".player").forEach(player => {
    const btn = player.querySelector(".roll-btn");
    if (!btn || btn.dataset.bound) return;
    btn.dataset.bound = "true";

    btn.addEventListener("click", async () => {
      const qtdEl = player.querySelector(".qtd-dados") || player.querySelector(".qtd");
      const facesEl = player.querySelector(".faces-dado") || player.querySelector(".faces");
      
      const qtd = parseInt(qtdEl ? qtdEl.value : 1) || 1;
      const faces = parseInt(facesEl ? facesEl.value : 20) || 20;
      const nomeRolagem = player.querySelector(".nome-rolagem") ? player.querySelector(".nome-rolagem").value.trim() : "";
      const tipoCalculo = player.querySelector(".tipo-calculo") ? player.querySelector(".tipo-calculo").value : "maior";

      const modTexto = player.querySelector(".modificador") ? player.querySelector(".modificador").value.replace("+", "").trim() : "";
      const modificador = parseInt(modTexto) || 0;

      // Busca a imagem do avatar no card do jogador
      const imgEl = player.querySelector(".avatar-quadrado img");
      const avatarUrl = imgEl ? imgEl.src : "";

      let resultados = [];
      for (let i = 0; i < qtd; i++) {
        resultados.push(Math.floor(Math.random() * faces) + 1);
      }

      let baseCalculo = (tipoCalculo === "maior") ? Math.max(...resultados) : resultados.reduce((a, b) => a + b, 0);
      const totalFinal = baseCalculo + modificador;
      const playerId = player.dataset.player;

      // Envia para o Supabase incluindo a foto do perfil
      await supabaseClient.from("rolls").insert({
        player: playerId,
        qtd,
        faces,
        results: resultados,
        total: totalFinal,
        nome_rolagem: nomeRolagem,
        tipo_calculo: tipoCalculo,
        modificador: modificador,
        avatar_url: avatarUrl // Salva a foto no banco!
      });
    });
  });
}

// =======================================================
// 6. ÁREA DE TESTES LOCAL (SE HOUVER NA TELA)
// =======================================================
function inicializarRolagemLocal() {
  const btnLocal = document.querySelector(".roll-btn-local");
  if (!btnLocal || btnLocal.dataset.bound) return;
  btnLocal.dataset.bound = "true";

  btnLocal.addEventListener("click", () => {
    const container = document.querySelector(".test-zone-container");
    if (!container) return;

    const qtd = parseInt(container.querySelector(".qtd-local")?.value || 1);
    const faces = parseInt(container.querySelector(".faces-local")?.value || 20);
    const nome = container.querySelector(".nome-rolagem-local")?.value.trim() || "Teste Local";
    const tipo = container.querySelector(".tipo-calculo-local")?.value || "maior";
    const mod = parseInt(container.querySelector(".modificador-local")?.value || 0);

    let resultados = [];
    for (let i = 0; i < qtd; i++) {
      resultados.push(Math.floor(Math.random() * faces) + 1);
    }

    let base = (tipo === "maior") ? Math.max(...resultados) : resultados.reduce((a, b) => a + b, 0);
    const total = base + mod;

    const ul = container.querySelector(".local-historico ul");
    if (ul) {
      const li = document.createElement("li");
      li.style.listStyle = "none";
      li.innerHTML = montarTextoHistorico({
        player: "Local",
        qtd,
        faces,
        results: resultados,
        total,
        nome_rolagem: nome,
        tipo_calculo: tipo,
        modificador: mod,
        created_at: new Date()
      });
      ul.prepend(li);
    }
  });
}

// =======================================================
// 7. CARREGADOR INICIAL
// =======================================================
window.addEventListener("DOMContentLoaded", () => {
  carregarHistorico();
  carregarStatusIniciais();
  inicializarEventosDeDigitacao();
  inicializarBotoesDeRolagem();
  inicializarRolagemLocal();
  ligarRealtimeDeStatus();
  ligarRealtimeDeDados();
});
