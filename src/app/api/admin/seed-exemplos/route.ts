import { NextResponse } from "next/server";
import pool from "@/lib/db";
import bcrypt from "bcryptjs";
import { validateRoteiro } from "@/lib/roteiro-validator";
import { validateReuniao } from "@/lib/reuniao-validator";
import { validateComercial } from "@/lib/comercial-validator";
import { findOrCreateClienteId } from "@/lib/clientes";

// Popula/limpa dados de exemplo em todas as telas (Roteiros, Reuniões,
// Comercial, Performance, Visão Geral, Clientes), pra dar pra equipe uma
// demonstração real de como a ferramenta entrega antes de ter volume de
// dados de produção. Roda os validadores de IA de verdade (não é conteúdo
// fabricado na mão) — só o conteúdo de entrada é fictício, marcado com um
// autor, cliente e prefixo "[EXEMPLO]" dedicados, fáceis de identificar e
// remover de uma vez (DELETE nesta mesma rota).

const EXAMPLE_AUTHOR_EMAIL = "exemplo.demo@doctorcreator.internal";
const EXAMPLE_AUTHOR_NAME = "Exemplo (demonstração)";
const EXAMPLE_CLIENT_NAME = "Dr. Exemplo (demonstração)";
const TAG = "[EXEMPLO]";

async function getOrCreateExampleAuthor(): Promise<{ id: string; name: string }> {
  const existing = await pool.query("SELECT id, name FROM dash_users WHERE email = $1", [
    EXAMPLE_AUTHOR_EMAIL,
  ]);
  if (existing.rows.length > 0) {
    return { id: existing.rows[0].id, name: existing.rows[0].name };
  }

  const randomPassword = await bcrypt.hash(crypto.randomUUID(), 10);
  const inserted = await pool.query(
    `INSERT INTO dash_users (email, name, password, role)
     VALUES ($1, $2, $3, 'team')
     RETURNING id, name`,
    [EXAMPLE_AUTHOR_EMAIL, EXAMPLE_AUTHOR_NAME, randomPassword]
  );
  return { id: inserted.rows[0].id, name: inserted.rows[0].name };
}

const ROTEIRO_REEL_BOM = `GANCHO: Você sabia que a dieta anti-inflamatória pode ajudar a controlar crises de rinite e sinusite?

Muitos pacientes chegam no consultório achando que só remédio resolve, mas a alimentação também tem um papel importante no processo inflamatório do corpo.

Alguns alimentos que costumo recomendar incluir na rotina: peixes ricos em ômega-3, como salmão e sardinha, azeite de oliva extra virgem, frutas vermelhas e vegetais folhosos verde-escuros. E alguns que vale reduzir: açúcar refinado, frituras e ultraprocessados, que tendem a intensificar o processo inflamatório.

Isso não substitui o tratamento médico, mas pode ser um aliado importante no dia a dia.

Se você tem crises frequentes de rinite ou sinusite e quer entender melhor o que pode estar contribuindo, manda mensagem aqui que a gente agenda uma consulta pra avaliar o seu caso com calma.`;

const ROTEIRO_CARROSSEL_AJUSTAR = `Slide 1: Clareamento dental é a melhor solução para esse problema que atrapalha sua autoestima
Slide 2: Muita gente sofre com dentes amarelados e não sabe o que fazer
Slide 3: Aqui na clínica usamos a técnica mais avançada do mercado, com resultado garantido
Slide 4: São só algumas sessões e o sorriso fica perfeito
Slide 5: Não deixe pra depois, sua autoestima merece`;

const REUNIAO_MENTORIA_BOA = `Consultoria: Bom dia, doutor! Como foram os últimos 15 dias depois da nossa última conversa?
Dr. Exemplo: Bom dia! Foi bem interessante, os Reels sobre prevenção de lesão no joelho tiveram bastante engajamento, tivemos uns comentários pedindo pra falar mais sobre reabilitação pós-cirúrgica.
Consultoria: Que ótimo! Olhando aqui os números, esse Reel específico teve 40% mais alcance que a média do perfil e gerou 12 mensagens diretas perguntando sobre agendamento. Isso é um sinal forte de que reabilitação pós-cirúrgica é um tema que interessa muito o público de vocês, então já vamos priorizar isso no próximo lote de conteúdo.
Dr. Exemplo: Faz sentido, muita gente que eu atendo mesmo é pós-cirúrgica.
Consultoria: Perfeito. Então da nossa parte, vamos entregar até sexta-feira o roteiro de 3 Reels sobre reabilitação pós-cirúrgica de joelho, já pensando nessas dúvidas que apareceram nos comentários.
Dr. Exemplo: Combinado.
Consultoria: E da sua parte, doutor, preciso que grave os vídeos de bastidor que a gente conversou, tirando uns 10 minutos entre uma consulta e outra, até quinta-feira, pra gente já ter material pra próxima semana.
Dr. Exemplo: Consigo sim, vou separar um tempo.
Consultoria: Show. Aí a gente já marca nossa próxima reunião pra daqui a duas semanas, dia 15, mesmo horário, pra revisar como foi a entrega de tudo isso e ver os números.
Dr. Exemplo: Fechado, dia 15 então.`;

const REUNIAO_MENTORIA_AJUSTAR = `Consultoria: Oi doutor, tudo bem? Vamos revisar rapidinho aqui os números do mês. Você teve 3200 seguidores novos, alcance de 45 mil pessoas, e um engajamento de 6%. Isso é um resultado bom pro seu nicho, a média do mercado costuma ficar em torno de 3 a 4%. Também vi que o story de bastidores do consultório teve bastante visualização, mais de 2 mil views. E o Reel sobre check-up anual também performou bem, ficou entre os top 3 conteúdos do mês. De modo geral eu acho que o mês foi positivo, os números estão evoluindo de forma consistente e é importante manter esse ritmo de postagem que a gente vem tendo, porque isso é o que sustenta o crescimento a longo prazo, então vamos continuar assim.
Dr. Exemplo: Legal, entendi.
Consultoria: Show, então é isso, qualquer coisa você me chama.`;

const COMERCIAL_TITULO = `${TAG} Call comercial — Dr. Exemplo (demonstração)`;
const COMERCIAL_PARTICIPANTES = ["Vendedor Exemplo", "Dr. Exemplo (demonstração)"];
const COMERCIAL_CONTEUDO = `Vendedor: Boa tarde, doutor! Como o senhor está? Vi que preencheu o formulário perguntando sobre gestão de redes sociais, pode me contar um pouco do que está buscando hoje?
Dr. Exemplo: Boa tarde! Então, hoje eu posto sozinho, meio sem estratégia, às vezes fico duas semanas sem postar nada.
Vendedor: Entendi. E isso te incomoda mais por qual motivo — é mais a questão de aparecer pouco, ou o senhor sente que está perdendo pacientes por conta disso?
Dr. Exemplo: Um pouco dos dois, mas principalmente eu vejo outros colegas crescendo e eu meio que parado.
Vendedor: Faz sentido. Deixa eu te perguntar uma coisa, hoje o senhor tem quanto tempo por semana pra dedicar a isso, ou pretende terceirizar tudo?
Dr. Exemplo: Praticamente zero tempo, eu preciso terceirizar mesmo.
Vendedor: Show, isso ajuda bastante a entender. Pelo que o senhor me contou, faz sentido a gente te mostrar como funciona nosso acompanhamento completo, com produção de conteúdo e consultoria mensal. Não posso garantir um número exato de pacientes novos, isso depende de vários fatores, mas o que a gente entrega é constância e estratégia, que é o que tá faltando hoje pro senhor.
Dr. Exemplo: Entendi, e como funciona o valor?
Vendedor: Vou te mandar a proposta detalhada por e-mail ainda hoje, com os valores e o que está incluso. Fico de te ligar quinta-feira às 15h pra tirar dúvidas e ver se faz sentido seguir. Pode ser?
Dr. Exemplo: Pode sim, fico no aguardo.
Vendedor: Perfeito, obrigado pelo tempo, doutor, falo com o senhor quinta.`;

export async function POST() {
  try {
    const author = await getOrCreateExampleAuthor();
    const clientId = await findOrCreateClienteId(EXAMPLE_CLIENT_NAME);
    await pool.query(
      `UPDATE clientes SET responsavel_id = $1, roteiros_por_semana = 2, reunioes_por_mes = 1, ativo = true WHERE id = $2`,
      [author.id, clientId]
    );

    const [roteiroBom, roteiroAjustar] = await Promise.all([
      validateRoteiro("reel", ROTEIRO_REEL_BOM),
      validateRoteiro("carrossel", ROTEIRO_CARROSSEL_AJUSTAR),
    ]);
    const [reuniaoBoa, reuniaoAjustar] = await Promise.all([
      validateReuniao("mentoria", REUNIAO_MENTORIA_BOA),
      validateReuniao("mentoria", REUNIAO_MENTORIA_AJUSTAR),
    ]);
    const comercial = await validateComercial(COMERCIAL_CONTEUDO);

    await pool.query(
      `INSERT INTO roteiros (author_id, author_name, client_id, client_name, format, title, content, status, score, issues)
       VALUES ($1,$2,$3,$4,'reel',$5,$6,$7,$8,$9)`,
      [
        author.id,
        author.name,
        clientId,
        EXAMPLE_CLIENT_NAME,
        `${TAG} Reel sobre alimentação anti-inflamatória`,
        ROTEIRO_REEL_BOM,
        roteiroBom.status,
        roteiroBom.score,
        JSON.stringify(roteiroBom.issues),
      ]
    );
    await pool.query(
      `INSERT INTO roteiros (author_id, author_name, client_id, client_name, format, title, content, status, score, issues)
       VALUES ($1,$2,$3,$4,'carrossel',$5,$6,$7,$8,$9)`,
      [
        author.id,
        author.name,
        clientId,
        EXAMPLE_CLIENT_NAME,
        `${TAG} Carrossel sobre clareamento dental`,
        ROTEIRO_CARROSSEL_AJUSTAR,
        roteiroAjustar.status,
        roteiroAjustar.score,
        JSON.stringify(roteiroAjustar.issues),
      ]
    );

    await pool.query(
      `INSERT INTO reunioes (author_id, author_name, client_id, client_name, tipo, content, status, score, issues, suggested_agenda, suggested_content_ideas)
       VALUES ($1,$2,$3,$4,'mentoria',$5,$6,$7,$8,$9,$10)`,
      [
        author.id,
        author.name,
        clientId,
        EXAMPLE_CLIENT_NAME,
        REUNIAO_MENTORIA_BOA,
        reuniaoBoa.status,
        reuniaoBoa.score,
        JSON.stringify(reuniaoBoa.issues),
        JSON.stringify(reuniaoBoa.suggestedAgenda),
        JSON.stringify(reuniaoBoa.suggestedContentIdeas),
      ]
    );
    await pool.query(
      `INSERT INTO reunioes (author_id, author_name, client_id, client_name, tipo, content, status, score, issues, suggested_agenda, suggested_content_ideas)
       VALUES ($1,$2,$3,$4,'mentoria',$5,$6,$7,$8,$9,$10)`,
      [
        author.id,
        author.name,
        clientId,
        EXAMPLE_CLIENT_NAME,
        REUNIAO_MENTORIA_AJUSTAR,
        reuniaoAjustar.status,
        reuniaoAjustar.score,
        JSON.stringify(reuniaoAjustar.issues),
        JSON.stringify(reuniaoAjustar.suggestedAgenda),
        JSON.stringify(reuniaoAjustar.suggestedContentIdeas),
      ]
    );

    await pool.query(
      `INSERT INTO comercial_analises (titulo, participantes, content, status, score, issues, pontos_fortes, pontos_melhoria)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [
        COMERCIAL_TITULO,
        JSON.stringify(COMERCIAL_PARTICIPANTES),
        COMERCIAL_CONTEUDO,
        comercial.status,
        comercial.score,
        JSON.stringify(comercial.issues),
        JSON.stringify(comercial.pontosFortes),
        JSON.stringify(comercial.pontosMelhoria),
      ]
    );

    return NextResponse.json({
      success: true,
      criados: { roteiros: 2, reunioes: 2, comercial: 1 },
      resumo: {
        roteiros: [
          { titulo: "Reel sobre alimentação anti-inflamatória", status: roteiroBom.status, score: roteiroBom.score },
          { titulo: "Carrossel sobre clareamento dental", status: roteiroAjustar.status, score: roteiroAjustar.score },
        ],
        reunioes: [
          { status: reuniaoBoa.status, score: reuniaoBoa.score },
          { status: reuniaoAjustar.status, score: reuniaoAjustar.score },
        ],
        comercial: { status: comercial.status, score: comercial.score },
      },
    });
  } catch (error) {
    console.error("Erro ao gerar dados de exemplo:", error);
    return NextResponse.json({ error: "Erro ao gerar dados de exemplo." }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    await pool.query(`DELETE FROM comercial_analises WHERE titulo LIKE $1`, [`${TAG}%`]);
    await pool.query(`DELETE FROM dash_users WHERE email = $1`, [EXAMPLE_AUTHOR_EMAIL]);
    await pool.query(`DELETE FROM clientes WHERE nome = $1`, [EXAMPLE_CLIENT_NAME]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Erro ao remover dados de exemplo:", error);
    return NextResponse.json({ error: "Erro ao remover dados de exemplo." }, { status: 500 });
  }
}
