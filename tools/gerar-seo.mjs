// Gera a parte de SEO do site a partir dos dados que já estão no index.html.
//
//   node tools/gerar-seo.mjs
//
// - index.html: cards dos passeios, linha do tempo, galeria, rodapé, FAQ e schema
//   em HTML estático (entre os marcadores <!--gen:...-->), para buscadores e IAs
//   que não rodam JavaScript. Os links de WhatsApp ganham o href real.
// - passeios/<slug>/index.html: uma página por passeio.
// - sitemap.xml, robots.txt e llms.txt.
//
// Rode de novo sempre que mudar um passeio no array PASSEIOS do index.html.

import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const SITE = "https://lencoismtur.com.br";
// data da última mudança real de conteúdo: troque à mão quando mudar roteiro, preço ou texto
const ATUALIZADO = "2026-11-04";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const INDEX = path.join(ROOT, "index.html");

let html = fs.readFileSync(INDEX, "utf8");

// ------------------------------------------------------------- dados
const bloco = html.slice(html.indexOf("const WHATSAPP"), html.indexOf("// -------------------------------------------------------------\n// Render"));
const { WHATSAPP, MSG_PADRAO, PASSEIOS, BENTO } = vm.runInNewContext(`${bloco};({ WHATSAPP, MSG_PADRAO, PASSEIOS, BENTO })`);
const waHref = (msg) => `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(msg || MSG_PADRAO)}`;

// como cada passeio é chamado numa frase ("o Circuito Betânia é um passeio de dia inteiro")
// onde: substitui "pelos Lençóis Maranhenses, saindo de Santo Amaro" quando o passeio é fora das dunas
// indicado: resposta completa para "para quem é indicado?", só com fatos que já estão no site
const FRASE = {
  betania: { tipo: "de dia inteiro", busca: true,
    indicado: "Para quem quer um dia inteiro de lagoas saindo de Santo Amaro: trilha curta pelas dunas, banho em três lagoas, almoço no Povoado de Betânia e descanso em redes sobre o Rio Alegre." },
  emendadas: { tipo: "de tarde e noite",
    indicado: "Para quem quer ver o pôr do sol do alto de uma duna e voltar caminhando à noite sob as estrelas, numa área de preservação onde veículos não entram." },
  andorinhas: { nome: "Circuito Andorinhas e Gaivota", tipo: "de meio período, de manhã ou à tarde",
    indicado: "Para quem tem só uma manhã ou uma tarde em Santo Amaro e quer aventura: são 2 ou 3 lagoas com rali de 4x4 pelas dunas, e dá para fazer de quadriciclo." },
  "ponta-verde": { tipo: "de dia inteiro", busca: true,
    indicado: "Para quem busca tranquilidade: as lagoas da Ponta Verde ficam numa área mais reservada do Parque Nacional e quase sempre estão vazias ou com pouco movimento." },
  america: { tipo: "de barco, de meio período",
    indicado: "Para quem quer um passeio tranquilo depois das aventuras nas dunas: o trajeto é de voadeira pelo encontro do Rio Alegre com o Lago Jangada e termina na Lagoa do América, com sombra e pouco movimento." },
  rancharia: { tipo: "de dia inteiro",
    indicado: "Para quem quer fugir do fluxo turístico principal: a Rancharia é mais distante e pouco frequentada, e a Lagoa da Rancharia é uma das maiores do Parque Nacional." },
  guaras: { tipo: "de barco no fim de tarde", fem: true, selo: "bora ver os guarás!",
    onde: "em Primeira Cruz, cidade vizinha a 15 minutos de Santo Amaro do Maranhão, fora das dunas dos Lençóis",
    indicado: "Para quem quer um passeio diferente das dunas: a revoada dos guarás no manguezal de Primeira Cruz, com o céu vermelho e o pôr do sol." },
  estrelas: { tipo: "noturno", fem: true,
    indicado: "Para quem quer ver os Lençóis Maranhenses à noite, com o céu estrelado sobre as dunas de Santo Amaro." },
  combo: { tipo: "de dia inteiro que junta os dois principais roteiros de Santo Amaro",
    indicado: "Para quem tem pouco tempo em Santo Amaro e quer fazer os dois roteiros principais, Betânia e Emendadas, no mesmo dia." },
};
for (const p of PASSEIOS) {
  const f = FRASE[p.id] || {};
  p.nomeCompleto = f.nome || p.nome;
  p.tipo = f.tipo || "";
  p.onde = f.onde || "pelos Lençóis Maranhenses, saindo de Santo Amaro do Maranhão";
  p.indicado = f.indicado || `${p.ideal}.`;
  p.selo = f.selo || "bora pras dunas!";
  p.busca = !!f.busca;
  p.o = f.fem ? "a" : "o";
  p.do = f.fem ? "da" : "do";
  p.url = `${SITE}/passeios/${p.slug}/`;
}

// largura x altura real de cada .webp (cabeçalho VP8/VP8L/VP8X), para width/height nas <img>
function tamanho(arquivo) {
  const b = fs.readFileSync(path.join(ROOT, "img", arquivo));
  const tipo = b.toString("ascii", 12, 16);
  if (tipo === "VP8X") return [1 + b.readUIntLE(24, 3), 1 + b.readUIntLE(27, 3)];
  if (tipo === "VP8L") { const v = b.readUInt32LE(21); return [1 + (v & 0x3fff), 1 + ((v >> 14) & 0x3fff)]; }
  return [b.readUInt16LE(26) & 0x3fff, b.readUInt16LE(28) & 0x3fff];
}

// ------------------------------------------------------------- helpers
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const strip = (s) => s.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
const brl = (n) => `R$ ${n.toLocaleString("pt-BR")}`;
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
// "a, b e c"; se o último item já tem " e " ("cadeiras e guarda-sol"), fica só com vírgulas
const juntar = (l) => l.length < 2 ? l.join("") : / e /.test(l.at(-1)) ? l.join(", ") : `${l.slice(0, -1).join(", ")} e ${l.at(-1)}`;
// itens do meio da frase em minúscula, menos nomes próprios ("Betânia", "Via Láctea", "Lagoa da Rancharia")
const PROPRIO = /^(Betânia|Emendadas|Via Láctea|Lagoa d|Lago |Rio |Primeira Cruz|Santo Amaro|Ponta Verde|Rancharia)/;
const lista = (xs) => juntar(xs.map((x) => PROPRIO.test(x) ? x : x.charAt(0).toLowerCase() + x.slice(1)));
const jsonld = (obj) => `<script type="application/ld+json">\n${JSON.stringify(obj, null, 2).replace(/<\//g, "<\\/")}\n</script>`;
const trocar = (src, nome, conteudo) => {
  const re = new RegExp(`(<!--gen:${nome}-->)[\\s\\S]*?(<!--/gen:${nome}-->)`);
  if (!re.test(src)) throw new Error(`marcador gen:${nome} não encontrado`);
  return src.replace(re, `$1${conteudo}$2`);
};
const LARGURAS = [480, 960, 1280, 1920];
const srcset = (base, pre = "") => LARGURAS.map((w) => `${pre}img/${base}-${w}.webp ${w}w`).join(", ");
const dims = (base) => { const [w, h] = tamanho(`${base}-960.webp`); return `width="${w}" height="${h}"`; };
const pic = (base, alt, sizes, pre = "") =>
  `<img src="${pre}img/${base}-480.webp" srcset="${srcset(base, pre)}" sizes="${sizes}" ${dims(base)} alt="${esc(alt)}" loading="lazy" decoding="async">`;

// "R$ 180 por pessoa ou R$ 1.300 no privado para até 5 pessoas"
const precoTexto = ({ preco: q }) => [
  q.pessoa && `${brl(q.pessoa)} por pessoa`,
  q.privado && `${brl(q.privado)} no ${q.pessoa ? "" : "passeio "}privado${q.ate ? ` para até ${q.ate} pessoas` : ", valor do grupo"}`,
].filter(Boolean).join(" ou ");

const resposta = (p) =>
  `${cap(p.o)} ${p.nomeCompleto} é um passeio ${p.tipo} ${p.onde}. ` +
  `Horário: ${p.horarios || p.horario}. Transporte: ${p.transporte}. Valor: ${precoTexto(p)}. ${p.curta}`;

const msgReserva = (p) =>
  `Olá! Vim pelo site e quero reservar o ${p.nome} com a Lençóis MTur. Data: ___ · Pessoas: ___${p.preco.pessoa ? " · Por pessoa ou privado: ___" : " (privado)"}`;

// selo do card: o menor valor que a pessoa vai encontrar
const tag = ({ preco: q }) => q.pessoa
  ? `<small>a partir de</small>${brl(q.pessoa)}<small>/pessoa</small>`
  : `<small>privado</small>${brl(q.privado)}<small>${q.ate ? `até ${q.ate} pessoas` : "o grupo"}</small>`;

const card = (p, i, pre, largo = p.largo, comIn = true) => `
  <a class="tour${largo ? " wide" : ""}" href="${pre}passeios/${p.slug}/" data-open="${p.id}" data-p="${p.periodo}"${comIn ? ` data-in style="--d:${(i % 4) * 60}ms"` : ""}>
    ${pic(p.fotos[0][0], p.fotos[0][1], largo ? "100vw" : "(min-width:1024px) 25vw, (min-width:640px) 50vw, 100vw", pre)}
    <span class="when"><svg><use href="#i-clock"/></svg>${p.horario}</span>
    <div class="tour-txt">
      <span class="cat">${p.categoria}</span>
      <h3>${p.nome}</h3>
      <p>${p.curta}</p>
      <span class="tag">${tag(p)}</span>
      <span class="more"><i><svg><use href="#i-arrow"/></svg></i>Ver roteiro</span>
    </div>
  </a>`;

const footItem = (pre) => (p) => `<li><a href="${pre}passeios/${p.slug}/" data-open="${p.id}">${p.nome.replace("Circuito ", "")}</a></li>`;
const meio = Math.ceil(PASSEIOS.length / 2);

// ------------------------------------------------------------- schema base
const AGENCIA = `${SITE}/#agencia`;
const MAITON = `${SITE}/#maiton`;
const agencia = {
  "@type": ["TravelAgency", "LocalBusiness"],
  "@id": AGENCIA,
  name: "Lençóis MTur",
  url: `${SITE}/`,
  logo: `${SITE}/img/lencois-mtur-logo.png`,
  image: [`${SITE}/img/og/home.jpg`, ...PASSEIOS.map((p) => `${SITE}/img/og/${p.slug}.jpg`)],
  description:
    "Agência de passeios nos Lençóis Maranhenses com saída de Santo Amaro do Maranhão (MA), fundada pelo guia nativo Maiton. " +
    "Faz 9 roteiros em 4x4, barco e quadriciclo: Circuito Betânia, Emendadas, Andorinhas e Gaivota, Ponta Verde, América, Rancharia, " +
    "Revoada dos Guarás, Contemplação das Estrelas e o Combo Betânia + Emendadas.",
  telephone: "+55-98-99241-7329",
  priceRange: `${brl(Math.min(...PASSEIOS.filter((p) => p.preco.pessoa).map((p) => p.preco.pessoa)))} a ${brl(Math.max(...PASSEIOS.filter((p) => p.preco.pessoa).map((p) => p.preco.pessoa)))} por pessoa`,
  currenciesAccepted: "BRL",
  address: { "@type": "PostalAddress", addressLocality: "Santo Amaro do Maranhão", addressRegion: "MA", addressCountry: "BR" },
  areaServed: [
    { "@type": "City", name: "Santo Amaro do Maranhão", sameAs: "https://pt.wikipedia.org/wiki/Santo_Amaro_do_Maranh%C3%A3o" },
    { "@type": "TouristDestination", name: "Parque Nacional dos Lençóis Maranhenses", sameAs: "https://pt.wikipedia.org/wiki/Parque_Nacional_dos_Len%C3%A7%C3%B3is_Maranhenses" },
  ],
  founder: { "@id": MAITON },
  knowsLanguage: "pt-BR",
  contactPoint: { "@type": "ContactPoint", telephone: "+55-98-99241-7329", contactType: "reservations", availableLanguage: "Portuguese", url: waHref() },
  sameAs: ["https://instagram.com/lencoismtur"],
};
const maiton = {
  "@type": "Person",
  "@id": MAITON,
  name: "Maiton",
  jobTitle: "Guia e condutor de turismo nos Lençóis Maranhenses",
  description: "Nativo de Santo Amaro do Maranhão, fundador da Lençóis MTur. Atua profissionalmente como guia e condutor de turismo nos Lençóis Maranhenses desde 2018.",
  homeLocation: { "@type": "City", name: "Santo Amaro do Maranhão" },
  worksFor: { "@id": AGENCIA },
};
const viagem = (p) => ({
  "@type": "TouristTrip",
  "@id": `${p.url}#passeio`,
  name: p.nomeCompleto,
  url: p.url,
  description: resposta(p),
  image: p.fotos.map(([f]) => `${SITE}/img/${f}-1920.webp`),
  provider: { "@id": AGENCIA },
  offers: [
    p.preco.pessoa && {
      "@type": "Offer", name: "Por pessoa", price: p.preco.pessoa, priceCurrency: "BRL", url: p.url,
      priceSpecification: { "@type": "UnitPriceSpecification", price: p.preco.pessoa, priceCurrency: "BRL", referenceQuantity: { "@type": "QuantitativeValue", value: 1, unitText: "pessoa" } },
    },
    p.preco.privado && {
      "@type": "Offer", name: p.preco.ate ? `Privado, até ${p.preco.ate} pessoas` : "Privado", price: p.preco.privado, priceCurrency: "BRL", url: p.url,
      priceSpecification: { "@type": "UnitPriceSpecification", price: p.preco.privado, priceCurrency: "BRL", referenceQuantity: { "@type": "QuantitativeValue", value: 1, unitText: "grupo" } },
      ...(p.preco.ate && { eligibleQuantity: { "@type": "QuantitativeValue", maxValue: p.preco.ate, unitText: "pessoas" } }),
    },
  ].filter(Boolean),
});
const faqSchema = (qas, id) => ({
  "@type": "FAQPage",
  "@id": id,
  mainEntity: qas.map(([q, a]) => ({ "@type": "Question", name: strip(q), acceptedAnswer: { "@type": "Answer", text: strip(a) } })),
});

// ------------------------------------------------------------- home
const H0 = 8, H1 = 22, pct = (h) => +(((h - H0) / (H1 - H0)) * 100).toFixed(4);
const hora = (h) => `${Math.floor(h)}h${h % 1 ? String(Math.round((h % 1) * 60)).padStart(2, "0") : ""}`;
const hours = Array.from({ length: (H1 - H0) / 2 + 1 }, (_, i) => H0 + i * 2).map((h) => `<li style="left:${pct(h)}%">${h}h</li>`).join("");
const rows = PASSEIOS.map((p) => `
  <div class="row">
    <button data-open="${p.id}">${p.nome.replace("Circuito ", "")}</button>
    <div class="track">${p.janelas.map(([a, b, t, aberta], i) => `
      <span class="bar ${t === "day" ? "" : t} ${aberta ? "open" : ""}" style="left:${pct(a)}%;width:${+(pct(b) - pct(a)).toFixed(4)}%"
        title="${p.horarios || p.horario}">${t === "day" || i === 0 ? (aberta ? `a partir das ${hora(a)}` : hora(a)) : ""}</span>`).join("")}
    </div>
  </div>`).join("");
const bentoSizes = { t: "(min-width:768px) 25vw, 50vw", w: "(min-width:768px) 50vw, 100vw", "": "(min-width:768px) 25vw, 50vw" };
const bento = BENTO.map(([b, legenda, f], i) =>
  `<figure class="${f}" data-in style="--d:${(i % 4) * 50}ms">${pic(b, legenda, bentoSizes[f])}<figcaption>${legenda}</figcaption></figure>`).join("");

const faqPasseios = `
      <details class="qa">
        <summary>Quais passeios saem de Santo Amaro do Maranhão?<i><svg><use href="#i-plus"/></svg></i></summary>
        <p>A Lençóis MTur faz ${PASSEIOS.length} passeios saindo de Santo Amaro do Maranhão: ${juntar(PASSEIOS.map((p) =>
          `<a href="passeios/${p.slug}/">${p.nomeCompleto}</a> (${p.categoria.split(" · ")[0].toLowerCase()}, ${p.preco.pessoa ? `${brl(p.preco.pessoa)} por pessoa` : `${brl(p.preco.privado)} privado`})`))}.</p>
      </details>`;

html = trocar(html, "tours", PASSEIOS.map((p, i) => card(p, i, "")).join("") + "\n    ");
html = trocar(html, "hours", hours);
html = trocar(html, "rows", rows + "\n        ");
html = trocar(html, "bento", bento);
html = trocar(html, "footA", PASSEIOS.slice(0, meio).map(footItem("")).join(""));
html = trocar(html, "footB", PASSEIOS.slice(meio).map(footItem("")).join(""));
html = trocar(html, "faq", faqPasseios + "\n      ");
// links de WhatsApp com o endereço real, sem depender de JavaScript
html = html.replace(/<a ([^>]*)>/g, (tag, attrs) => /\bdata-wa\b/.test(attrs) ? tag.replace(/href="[^"]*"/, `href="${esc(waHref())}"`) : tag);

const qasHome = [...html.matchAll(/<details class="qa">\s*<summary>([\s\S]*?)<i>[\s\S]*?<\/summary>\s*<p>([\s\S]*?)<\/p>/g)].map((m) => [m[1], m[2]]);
html = trocar(html, "schema", "\n" + jsonld({
  "@context": "https://schema.org",
  "@graph": [
    { "@type": "WebSite", "@id": `${SITE}/#site`, url: `${SITE}/`, name: "Lençóis MTur", inLanguage: "pt-BR", publisher: { "@id": AGENCIA } },
    { "@type": "WebPage", "@id": `${SITE}/#pagina`, url: `${SITE}/`, name: strip(html.match(/<title>([\s\S]*?)<\/title>/)[1]), isPartOf: { "@id": `${SITE}/#site` }, about: { "@id": AGENCIA },
      primaryImageOfPage: { "@type": "ImageObject", url: `${SITE}/img/og/home.jpg`, width: 1200, height: 630 }, inLanguage: "pt-BR", dateModified: ATUALIZADO },
    // os preços completos ficam no TouristTrip de cada página de passeio, onde aparecem no texto
    { ...agencia, makesOffer: PASSEIOS.map((p) => ({ "@type": "Offer", itemOffered: { "@type": "TouristTrip", "@id": `${p.url}#passeio`, name: p.nomeCompleto, url: p.url } })) },
    maiton,
    { "@type": "ItemList", "@id": `${SITE}/#passeios`, name: "Passeios saindo de Santo Amaro do Maranhão",
      itemListElement: PASSEIOS.map((p, i) => ({ "@type": "ListItem", position: i + 1, name: p.nomeCompleto, url: p.url })) },
    faqSchema(qasHome, `${SITE}/#faq`),
  ],
}) + "\n");
fs.writeFileSync(INDEX, html);

// ------------------------------------------------------------- páginas dos passeios
const estilo = html.match(/<style>([\s\S]*?)<\/style>/)[1];
const sprite = html.match(/<svg width="0" height="0"[\s\S]*?<\/svg>/)[0];
const contato = html.match(/<section id="contato">[\s\S]*?<\/section>/)[0].replace(/src="img\//g, 'src="../../img/');

const CSS_PAGINA = `
  /* ---------------------------------------------------------- Página do passeio */
  .tp-hero{position:relative;isolation:isolate;overflow:hidden;min-height:min(88svh,860px);display:flex;align-items:flex-end;color:#fff}
  .tp-hero>img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;z-index:-2}
  .tp-hero::before{content:"";position:absolute;inset:0;z-index:-1;background:linear-gradient(180deg,rgb(3 49 75 / 35%) 0%,rgb(3 49 75 / 0%) 26%,rgb(3 49 75 / 72%) 60%,rgb(3 49 75 / 95%) 100%)}
  .tp-hero-in{width:100%;padding:120px var(--gutter) 44px}
  @media (min-width:900px){.tp-hero-in{padding-bottom:64px}}
  .crumbs ol{list-style:none;margin:0;padding:0;display:flex;flex-wrap:wrap;gap:.35rem;font-size:.85rem;font-weight:600;color:rgb(255 255 255 / 78%)}
  .crumbs li+li::before{content:"/";margin-right:.35rem;opacity:.55}
  .crumbs a:hover{color:#fff;text-decoration:underline}
  .tp-cat{display:inline-block;margin-top:1.4rem;font-size:.78rem;font-weight:700;text-transform:uppercase;letter-spacing:.12em;color:#9FE3DF}
  .tp-hero h1{margin-top:.5rem;max-width:15ch;font-size:clamp(2.7rem,7.2vw,6rem);font-weight:800;line-height:.92;letter-spacing:-.045em;text-wrap:balance}
  .tp-lead{margin-top:1.2rem;max-width:44rem;font-size:1.06rem;color:rgb(255 255 255 / 90%);text-wrap:pretty}
  .tp-hero .btn-ghost{background:rgb(255 255 255 / 14%);color:#fff;border:1.5px solid rgb(255 255 255 / 40%);backdrop-filter:blur(6px)}
  .tp-hero .btn-ghost:hover{background:rgb(255 255 255 / 24%)}
  .tp-main{display:grid;gap:44px}
  @media (min-width:1000px){.tp-main{grid-template-columns:minmax(0,1fr) 360px;gap:72px;align-items:start}}
  .tp-body{max-width:780px}
  .tp-body h2{margin-top:64px;font-size:clamp(1.75rem,3.4vw,2.5rem);font-weight:800;color:var(--deep);text-wrap:balance}
  .tp-body h2 .lag{color:var(--lagoon)}
  .tp-body>h2:first-child{margin-top:0}
  .tp-body .facts,.tp-body .prices,.tp-body .ticks,.tp-faq{margin-top:1.2rem}
  .tp-byline{margin-top:1.4rem;display:flex;flex-wrap:wrap;align-items:baseline;gap:.4rem .7rem;color:var(--muted);font-size:.9rem;font-weight:600}
  .tp-byline .hand{font-size:1.9rem;color:var(--deep);line-height:1}
  .tp-body .story p{margin-top:1rem;font-size:1.04rem;color:#34505F;line-height:1.75;text-wrap:pretty}
  .tp-answer{margin-top:1rem;font-size:1.08rem;color:var(--text);line-height:1.7;text-wrap:pretty}
  .tp-note{margin-top:.9rem;font-size:.92rem;color:var(--muted)}
  .tp-pic{margin:1.75rem 0 0;border-radius:var(--r-lg);overflow:hidden;aspect-ratio:16/10}
  .tp-pic img{width:100%;height:100%;object-fit:cover}
  .book{border-radius:var(--r-lg);background:var(--deep);color:#fff;padding:26px;box-shadow:0 30px 60px -30px rgb(3 49 75 / 70%)}
  @media (min-width:1000px){.book{position:sticky;top:110px}}
  .book .hand{font-size:1.6rem;color:#FFB08F;line-height:1}
  .book .from{margin-top:.6rem;font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.12em;color:#5FD3CE}
  .book .val{font-family:var(--title);font-weight:800;font-size:2.6rem;letter-spacing:-.04em;line-height:1}
  .book .val small{font-family:var(--body);font-size:.9rem;font-weight:600;letter-spacing:0;color:rgb(255 255 255 / 70%)}
  .book dl{margin:1.2rem 0;display:grid;gap:.7rem;padding:1rem 0;border-block:1px dashed rgb(255 255 255 / 22%)}
  .book dt{font-size:.68rem;font-weight:700;text-transform:uppercase;letter-spacing:.12em;color:rgb(255 255 255 / 60%)}
  .book dd{margin:.15rem 0 0;font-weight:600;font-size:.95rem}
  .book .btn{width:100%}
  .book .note{margin-top:.8rem;font-size:.85rem;color:rgb(255 255 255 / 65%);text-align:center}
  .tp-all{margin-top:28px;text-align:center}
`;

const topo = (pre) => `
<div class="topbar">
  <div class="wrap">
    <div class="pill">
      <a href="${pre}" class="logo" aria-label="Lençóis MTur, início"><img src="${pre}img/lencois-mtur-logo-horizontal.svg" alt="Lençóis MTur" width="151" height="38"></a>
      <nav aria-label="Seções">
        <a href="${pre}#sobre">Quem somos</a>
        <a href="${pre}#passeios">Passeios</a>
        <a href="${pre}#seu-dia">Monte seu dia</a>
        <a href="${pre}#reservar">Como reservar</a>
        <a href="${pre}#duvidas">Dúvidas</a>
      </nav>
      <div class="pill-actions">
        <a class="btn btn-wa" href="${esc(waHref())}" target="_blank" rel="noopener"><svg><use href="#i-wa"/></svg><span>Reservar</span></a>
        <button class="menu-btn" id="openMenu" aria-label="Abrir menu" aria-controls="sheet" aria-expanded="false"><svg><use href="#i-menu"/></svg></button>
      </div>
    </div>
  </div>
</div>

<div class="sheet" id="sheet" aria-hidden="true">
  <div class="sheet-bg" data-close-menu></div>
  <div class="sheet-card" role="dialog" aria-modal="true" aria-label="Menu">
    <div class="sheet-head">
      <img src="${pre}img/lencois-mtur-logo-horizontal.svg" alt="Lençóis MTur" width="127" height="32">
      <button class="menu-btn" data-close-menu aria-label="Fechar menu" style="display:inline-flex"><svg><use href="#i-x"/></svg></button>
    </div>
    <nav aria-label="Seções">
      <a href="${pre}#sobre">Quem somos</a>
      <a href="${pre}#passeios">Passeios</a>
      <a href="${pre}#seu-dia">Monte seu dia</a>
      <a href="${pre}#reservar">Como reservar</a>
      <a href="${pre}#duvidas">Dúvidas</a>
      <a href="${pre}#galeria">Galeria</a>
    </nav>
    <a class="btn btn-wa" href="${esc(waHref())}" target="_blank" rel="noopener"><svg><use href="#i-wa"/></svg>Chamar no WhatsApp</a>
  </div>
</div>`;

const rodape = (pre) => `
<footer>
  <div class="wrap">
    <div class="foot">
      <div>
        <img src="${pre}img/lencois-mtur-logo.svg" alt="Lençóis MTur" width="204" height="86" loading="lazy">
        <p>Passeios pelos Lençóis Maranhenses saindo de Santo Amaro do Maranhão (MA), com o guia nativo Maiton.</p>
      </div>
      <div>
        <h4>Contato</h4>
        <ul>
          <li><a href="${esc(waHref())}" target="_blank" rel="noopener">WhatsApp 98 99241-7329</a></li>
          <li><a href="tel:+5598992417329">Telefone (98) 99241-7329</a></li>
          <li><a href="https://instagram.com/lencoismtur" target="_blank" rel="noopener">Instagram @lencoismtur</a></li>
          <li>Santo Amaro do Maranhão, MA</li>
        </ul>
      </div>
      <div>
        <h4>Passeios</h4>
        <ul>${PASSEIOS.slice(0, meio).map(footItem(pre)).join("")}</ul>
      </div>
      <div>
        <h4>&nbsp;</h4>
        <ul>${PASSEIOS.slice(meio).map(footItem(pre)).join("")}</ul>
      </div>
    </div>
    <div class="legal">
      <p>© ${ATUALIZADO.slice(0, 4)} Lençóis MTur</p>
      <p>Site por <a href="https://logostecnologias.com" target="_blank" rel="noopener">Logos Tecnologias</a></p>
    </div>
  </div>
</footer>`;

const SCRIPT_PAGINA = `
<script>
const sheet = document.getElementById("sheet"), openBtn = document.getElementById("openMenu");
const setMenu = (open) => {
  sheet.classList.toggle("open", open);
  sheet.setAttribute("aria-hidden", !open);
  openBtn.setAttribute("aria-expanded", open);
  document.body.classList.toggle("locked", open);
};
openBtn.addEventListener("click", () => setMenu(true));
sheet.addEventListener("click", (e) => { if (e.target.closest("[data-close-menu]")) setMenu(false); });
addEventListener("keydown", (e) => { if (e.key === "Escape" && sheet.classList.contains("open")) setMenu(false); });
const fab = document.getElementById("fab");
const onScroll = () => fab.classList.toggle("show", scrollY > innerHeight * 0.6);
onScroll();
addEventListener("scroll", onScroll, { passive: true });
document.querySelectorAll("[data-in]").forEach((el) => (el.dataset.in = "1"));
</script>`;

const ticks = (items, icon, cls = "") =>
  `<ul class="ticks ${cls}">${items.map((x) => `<li><svg><use href="#${icon}"/></svg>${x}</li>`).join("")}</ul>`;
const priceCard = (rotulo, valor, unidade, inclui, cls = "") => `
        <div class="price ${cls}">
          <small>${rotulo}</small><b>${brl(valor)}</b><em>${unidade}</em>
          ${inclui ? `<ul>${inclui.map((x) => `<li><svg><use href="#i-check"/></svg>${x}</li>`).join("")}</ul>` : ""}
        </div>`;

// horário em frase: "das 09h às 18h", "de manhã, das 09h às 12h, ou à tarde, das 14h às 18h", "a partir das 16h"
function quando(p) {
  const h = p.horarios || p.horario;
  if (h.startsWith("Manhã:")) return h.replace("Manhã:", "de manhã, das").replace(" · Tarde:", ", ou à tarde, das");
  if (h.startsWith("A partir")) return "a" + h.slice(1);
  if (h.includes(" · ")) return h.replace(/^(\S+) · (.*)$/, "a partir das $1, com duração de $2");
  return `das ${h}`;
}

function faqDoPasseio(p) {
  const q = p.preco;
  const qas = [];
  const no = p.o === "a" ? "na" : "no";
  qas.push([`Qual o horário ${p.do} ${p.nomeCompleto}?`,
    `${cap(p.o)} ${p.nomeCompleto} acontece ${quando(p)}, com transporte em ${p.transporte.charAt(0).toLowerCase() + p.transporte.slice(1)}. ` +
    (p.busca ? "O 4x4 busca você na hospedagem em Santo Amaro no início do passeio." : "O ponto de encontro é combinado na reserva pelo WhatsApp.")]);
  const inclui = [
    q.pessoaInclui && `no passeio por pessoa estão inclusos ${lista(q.pessoaInclui)}`,
    q.privadoInclui && `no passeio privado estão inclusos ${lista(q.privadoInclui)}`,
  ].filter(Boolean);
  if (inclui.length) qas.push([`O que está incluso ${no} ${p.nomeCompleto}?`, `${cap(p.nomeCompleto)}: ${inclui.join("; ")}.`]);
  if (p.naoIncluso.length) qas.push([`O que não está incluso ${no} ${p.nomeCompleto}?`, `Não estão inclusos ${no} ${p.nomeCompleto}: ${lista(p.naoIncluso.map((x) => x.replace(/: R\$/, " de R$")))}.`]);
  qas.push([`Para quem ${p.o} ${p.nomeCompleto} é indicad${p.o}?`, p.indicado]);
  qas.push([`Como reservar ${p.o} ${p.nomeCompleto}?`,
    `Pelo WhatsApp (98) 99241-7329. Mande o nome do passeio, a data e quantas pessoas vão${q.pessoa && q.privado ? ", e se prefere por pessoa ou privado" : ""}. A Lençóis MTur responde com o valor, o horário e o ponto de encontro.`]);
  return qas;
}

function pagina(p) {
  const pre = "../../";
  const qas = faqDoPasseio(p);
  const precoQ = [`Quanto custa ${p.o} ${p.nomeCompleto}?`, `${cap(p.o)} ${p.nomeCompleto} custa ${precoTexto(p)}.${p.naoIncluso.some((x) => /taxa/i.test(x)) ? " A taxa municipal de Santo Amaro, de R$ 10,00 por pessoa e válida por 3 dias, é cobrada à parte." : ""}`];
  const outros = [...PASSEIOS.filter((x) => x.id !== p.id && x.periodo === p.periodo), ...PASSEIOS.filter((x) => x.id !== p.id && x.periodo !== p.periodo)].slice(0, 4);
  const titulo = `${p.nomeCompleto} em Santo Amaro, Lençóis Maranhenses`;
  let desc = `${p.curta} ${p.horarios || p.horario}. ${cap(precoTexto(p))}. Reserve pelo WhatsApp.`;
  if (desc.length > 200) desc = `${p.curta} ${cap(precoTexto(p))}. Reserve pelo WhatsApp.`;
  const q = p.preco;
  const schema = {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "WebPage", "@id": `${p.url}#pagina`, url: p.url, name: titulo, description: desc, inLanguage: "pt-BR",
        isPartOf: { "@id": `${SITE}/#site` }, about: { "@id": `${p.url}#passeio` }, primaryImageOfPage: { "@type": "ImageObject", url: `${SITE}/img/og/${p.slug}.jpg`, width: 1200, height: 630 },
        author: { "@id": MAITON }, datePublished: "2026-11-04", dateModified: ATUALIZADO, breadcrumb: { "@id": `${p.url}#trilha` } },
      { "@type": "BreadcrumbList", "@id": `${p.url}#trilha`, itemListElement: [
        { "@type": "ListItem", position: 1, name: "Início", item: `${SITE}/` },
        { "@type": "ListItem", position: 2, name: "Passeios", item: `${SITE}/#passeios` },
        { "@type": "ListItem", position: 3, name: p.nomeCompleto, item: p.url },
      ] },
      viagem(p),
      { "@type": ["TravelAgency", "LocalBusiness"], "@id": AGENCIA, name: agencia.name, url: agencia.url, telephone: agencia.telephone, address: agencia.address, logo: agencia.logo },
      maiton,
      faqSchema([precoQ, ...qas], `${p.url}#faq`),
    ],
  };

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(titulo)}</title>
<meta name="description" content="${esc(desc)}">
<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1">
<link rel="canonical" href="${p.url}">
<meta name="theme-color" content="#0FA3A3">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Lençóis MTur">
<meta property="og:url" content="${p.url}">
<meta property="og:title" content="${esc(p.nomeCompleto)} – Lençóis MTur">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:image" content="${SITE}/img/og/${p.slug}.jpg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${esc(p.fotos[0][1])}">
<meta property="og:locale" content="pt_BR">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="${pre}img/lencois-mtur-simbolo.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="${pre}img/apple-touch-icon.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400..800&family=Caveat:wght@500;700&family=DM+Sans:opsz,wght@9..40,400..700&display=swap" rel="stylesheet">
<link rel="preload" as="image" href="${pre}img/${p.fotos[0][0]}-1280.webp" imagesrcset="${srcset(p.fotos[0][0], pre)}" imagesizes="100vw" fetchpriority="high">
${jsonld(schema)}
<style>${estilo}${CSS_PAGINA}</style>
</head>
<body>

${sprite}
${topo(pre)}

<main>
<section class="tp-hero">
  <img src="${pre}img/${p.fotos[0][0]}-1280.webp" srcset="${srcset(p.fotos[0][0], pre)}" sizes="100vw" ${dims(p.fotos[0][0])} alt="${esc(p.fotos[0][1])}" fetchpriority="high">
  <div class="tp-hero-in">
    <nav class="crumbs" aria-label="Você está em">
      <ol><li><a href="${pre}">Início</a></li><li><a href="${pre}#passeios">Passeios</a></li><li aria-current="page">${p.nome}</li></ol>
    </nav>
    <span class="tp-cat">${p.categoria} · Santo Amaro do Maranhão</span>
    <h1>${p.nomeCompleto}</h1>
    <p class="tp-lead">${p.curta}</p>
    <div class="hero-ctas">
      <a href="${esc(waHref(msgReserva(p)))}" class="btn btn-wa" target="_blank" rel="noopener"><svg><use href="#i-wa"/></svg>Reservar pelo WhatsApp</a>
      <a href="#valores" class="btn btn-ghost">Ver valores <svg><use href="#i-arrow"/></svg></a>
    </div>
  </div>
</section>

<section class="sec">
  <div class="wrap tp-main">
    <article class="tp-body">
      <h2>Resumo do passeio</h2>
      <p class="tp-answer">${resposta(p)}</p>
      <div class="facts">
        <div class="fact"><small>Horário</small><b>${p.horarios || p.horario}</b></div>
        <div class="fact"><small>Transporte</small><b>${p.transporte}</b></div>
        <div class="fact"><small>Ideal para</small><b>${p.ideal}</b></div>
      </div>
      ${p.obs ? `<p class="callout">${p.obs}</p>` : ""}
      <p class="tp-byline"><span class="hand">Maiton</span> guia nativo de Santo Amaro desde 2018 · roteiro atualizado em ${new Date(ATUALIZADO + "T12:00").toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}</p>

      <h2 id="valores">${precoQ[0]}</h2>
      <div class="prices ${q.pessoa && q.privado ? "two" : ""}">${[
        q.pessoa && priceCard("Por pessoa", q.pessoa, "valor por pessoa", q.pessoaInclui),
        q.privado && priceCard(q.pessoa ? "Privado" : "Somente privado", q.privado, q.ate ? `para o grupo, até ${q.ate} pessoas` : "valor do grupo", q.privadoInclui, "priv"),
      ].filter(Boolean).join("")}
      </div>
      <p class="tp-note">${precoQ[1]}</p>

      <h2>Como é o roteiro ${p.do} ${p.nomeCompleto}?</h2>
      <div class="story">${p.sobre.map((t) => `<p>${t}</p>`).join("")}</div>
      <figure class="tp-pic">${pic(p.fotos[1][0], p.fotos[1][1], "(min-width:1000px) 780px, 100vw", pre)}</figure>

      <h2>Destaques</h2>
      ${ticks(p.destaques, "i-check")}
      ${p.naoIncluso.length ? `<h2>Não incluso</h2>\n      ${ticks(p.naoIncluso, "i-minus", "out")}` : ""}

      <h2>Dúvidas sobre ${p.o} ${p.nomeCompleto}</h2>
      <div class="tp-faq">${qas.map(([qq, a]) => `
        <details class="qa">
          <summary>${qq}<i><svg><use href="#i-plus"/></svg></i></summary>
          <p>${a}</p>
        </details>`).join("")}
      </div>
    </article>

    <aside class="book" aria-label="Reservar">
      <span class="hand">${p.selo}</span>
      <p class="from">${q.pessoa ? "a partir de" : "passeio privado"}</p>
      <p class="val">${brl(q.pessoa || q.privado)} <small>${q.pessoa ? "por pessoa" : q.ate ? `até ${q.ate} pessoas` : "o grupo"}</small></p>
      <dl>
        <div><dt>Saída</dt><dd>Santo Amaro do Maranhão</dd></div>
        <div><dt>Horário</dt><dd>${p.horarios || p.horario}</dd></div>
        <div><dt>Transporte</dt><dd>${p.transporte}</dd></div>
      </dl>
      <a href="${esc(waHref(msgReserva(p)))}" class="btn btn-wa" target="_blank" rel="noopener"><svg><use href="#i-wa"/></svg>Reservar ${p.nome.replace("Circuito ", "")}</a>
      <p class="note">Resposta pelo WhatsApp (98) 99241-7329</p>
    </aside>
  </div>
</section>

<section class="sec tint">
  <div class="wrap">
    <div class="head">
      <h2>Outros passeios <span class="lag">saindo de Santo Amaro.</span></h2>
    </div>
    <div class="tours">${outros.map((x, i) => card(x, i, pre, false, false)).join("")}
    </div>
    <p class="tp-all"><a class="btn btn-outline" href="${pre}#passeios">Ver os ${PASSEIOS.length} passeios <svg><use href="#i-arrow"/></svg></a></p>
  </div>
</section>

${contato.replace(/<a ([^>]*)>/g, (t, a) => /\bdata-wa\b/.test(a) ? t.replace(/href="[^"]*"/, `href="${esc(waHref(msgReserva(p)))}"`) : t)}
</main>
${rodape(pre)}

<a class="wa-fab" id="fab" href="${esc(waHref(msgReserva(p)))}" target="_blank" rel="noopener" aria-label="Reservar pelo WhatsApp"><svg><use href="#i-wa"/></svg>Reservar</a>
${SCRIPT_PAGINA}
</body>
</html>
`;
}

for (const p of PASSEIOS) {
  const dir = path.join(ROOT, "passeios", p.slug);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "index.html"), pagina(p));
}

// 404: página enxuta, com CSS próprio. Links absolutos porque ela pode ser servida em qualquer caminho.
const icone = sprite.match(/<symbol id="i-wa"[\s\S]*?<\/symbol>/)[0].replace(/<symbol id="i-wa" (viewBox="[^"]*")>([\s\S]*)<\/symbol>/, '<svg $1 aria-hidden="true">$2</svg>');
fs.writeFileSync(path.join(ROOT, "404.html"), `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Página não encontrada | Lençóis MTur</title>
<meta name="robots" content="noindex">
<meta name="theme-color" content="#0FA3A3">
<link rel="icon" href="/img/lencois-mtur-simbolo.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,800&family=Caveat:wght@700&family=DM+Sans:wght@400;700&display=swap" rel="stylesheet">
<style>
  *{box-sizing:border-box}
  body{margin:0;min-height:100svh;display:grid;place-items:center;padding:32px 20px;background:#E5F4F2;color:#0E2A3A;font:16.5px/1.6 "DM Sans",system-ui,sans-serif}
  main{width:100%;max-width:640px}
  img{display:block;height:40px;width:auto}
  .hand{display:block;margin-top:48px;font:700 1.8rem/1 Caveat,cursive;color:#C94A1E}
  h1{margin:.4rem 0 0;font:800 clamp(2.6rem,9vw,4.4rem)/.95 "Bricolage Grotesque",system-ui,sans-serif;letter-spacing:-.045em;color:#03314B}
  p{margin:1rem 0 0;color:#557080}
  .ctas{margin-top:1.75rem;display:flex;flex-wrap:wrap;gap:.7rem}
  a.btn{display:inline-flex;align-items:center;gap:.55rem;padding:1rem 1.35rem;border-radius:14px;font-weight:700;font-size:.95rem;text-decoration:none;color:#fff}
  .sun{background:#F26B3A}.wa{background:#25D366}
  .btn svg{width:1.15rem;height:1.15rem}
  ul{margin:2.5rem 0 0;padding:1.25rem 0 0;border-top:1.5px solid #CDEBE7;list-style:none;display:flex;flex-wrap:wrap;gap:.4rem 1.2rem;font-size:.92rem}
  ul a{color:#087A7D;font-weight:700}
  @media (max-width:520px){.ctas{display:grid}a.btn{justify-content:center}}
</style>
</head>
<body>
<main>
  <a href="/" aria-label="Lençóis MTur, início"><img src="/img/lencois-mtur-logo-horizontal.svg" alt="Lençóis MTur" width="151" height="38"></a>
  <span class="hand">ops, essa duna não existe</span>
  <h1>Página não encontrada.</h1>
  <p>O endereço pode ter mudado. Veja os passeios saindo de Santo Amaro do Maranhão ou fale com a gente pelo WhatsApp.</p>
  <div class="ctas">
    <a class="btn sun" href="/#passeios">Ver os ${PASSEIOS.length} passeios</a>
    <a class="btn wa" href="${esc(waHref())}" target="_blank" rel="noopener">${icone}Chamar no WhatsApp</a>
  </div>
  <ul>${PASSEIOS.map((p) => `<li><a href="/passeios/${p.slug}/">${p.nome.replace("Circuito ", "")}</a></li>`).join("")}</ul>
</main>
</body>
</html>
`);

// ------------------------------------------------------------- sitemap, robots, llms
const imgTag = (f) => `\n    <image:image><image:loc>${SITE}/img/${f}-1920.webp</image:loc></image:image>`;
fs.writeFileSync(path.join(ROOT, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
  <url>
    <loc>${SITE}/</loc>
    <lastmod>${ATUALIZADO}</lastmod>${["aerea-lagoas-dunas", ...BENTO.map(([b]) => b)].filter((v, i, a) => a.indexOf(v) === i).map(imgTag).join("")}
  </url>
${PASSEIOS.map((p) => `  <url>
    <loc>${p.url}</loc>
    <lastmod>${ATUALIZADO}</lastmod>${p.fotos.map(([f]) => imgTag(f)).join("")}
  </url>`).join("\n")}
</urlset>
`);

fs.writeFileSync(path.join(ROOT, "robots.txt"), `# Lençóis MTur
# Buscadores e assistentes de IA podem ler e citar o site inteiro.

User-agent: *
Allow: /
Disallow: /tools/

# Busca e citação em assistentes de IA
User-agent: OAI-SearchBot
User-agent: ChatGPT-User
User-agent: Claude-SearchBot
User-agent: Claude-User
User-agent: PerplexityBot
User-agent: Perplexity-User
# Treino de modelos (liberado: quanto mais as IAs conhecem a marca, melhor)
User-agent: GPTBot
User-agent: ClaudeBot
User-agent: Google-Extended
User-agent: Applebot-Extended
Allow: /
Disallow: /tools/

Sitemap: ${SITE}/sitemap.xml
`);

fs.writeFileSync(path.join(ROOT, "llms.txt"), `# Lençóis MTur

> Agência de passeios nos Lençóis Maranhenses com saída de Santo Amaro do Maranhão (MA, Brasil), fundada pelo guia nativo Maiton, que atua como guia e condutor de turismo na região desde 2018. Faz ${PASSEIOS.length} roteiros em 4x4, barco e quadriciclo. Reservas pelo WhatsApp (98) 99241-7329.

## Fatos principais

- Saída: Santo Amaro do Maranhão, uma das portas de entrada do Parque Nacional dos Lençóis Maranhenses.
- Valores por pessoa: de ${brl(Math.min(...PASSEIOS.filter((p) => p.preco.pessoa).map((p) => p.preco.pessoa)))} a ${brl(Math.max(...PASSEIOS.filter((p) => p.preco.pessoa).map((p) => p.preco.pessoa)))}. Passeio privado para o grupo: de ${brl(Math.min(...PASSEIOS.map((p) => p.preco.privado)))} a ${brl(Math.max(...PASSEIOS.map((p) => p.preco.privado)))}.
- Santo Amaro cobra uma taxa municipal de R$ 10,00 por pessoa, válida por 3 dias, à parte dos passeios.
- Horários do dia inteiro, das 9h às 22h: passeios de manhã, de tarde, com pôr do sol e noturnos.
- Contato: WhatsApp ${waHref()} · Instagram https://instagram.com/lencoismtur

## Passeios

${PASSEIOS.map((p) => `- [${p.nomeCompleto}](${p.url}): ${p.categoria}. ${p.horarios || p.horario}. ${p.transporte}. ${cap(precoTexto(p))}. ${p.curta}`).join("\n")}

## Páginas

- [Página inicial](${SITE}/): todos os passeios, horários, como reservar e perguntas frequentes.
`);

console.log(`ok: index.html, ${PASSEIOS.length} páginas em passeios/, sitemap.xml, robots.txt, llms.txt`);
