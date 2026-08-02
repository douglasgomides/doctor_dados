import pool from "@/lib/db";
import bcrypt from "bcryptjs";

// Conteúdo e helpers compartilhados pela geração de dados de exemplo
// (/api/admin/seed-exemplos/*). Cada peça de conteúdo é validada em uma
// requisição HTTP separada (uma chamada de IA por requisição, igual às
// rotas normais de Roteiros/Reuniões/Comercial que já funcionam bem em
// produção) — gerar tudo numa única função serverless com várias chamadas
// de IA em série ou até em paralelo ainda estourava o tempo limite.

export const TAG = "[EXEMPLO]";

export const EXAMPLE_AUTHORS = [
  { email: "exemplo.ana@doctorcreator.internal", name: "Ana Beatriz (exemplo)" },
  { email: "exemplo.rafael@doctorcreator.internal", name: "Rafael Costa (exemplo)" },
  { email: "exemplo.juliana@doctorcreator.internal", name: "Juliana Martins (exemplo)" },
] as const;

export const EXAMPLE_CLIENT_NAMES = [
  "Dr. Ricardo Almeida (demonstração)",
  "Dra. Fernanda Cruz (demonstração)",
  "Dr. Marcelo Tavares (demonstração)",
  "Dra. Beatriz Nogueira (demonstração)",
  "Dr. Henrique Sousa (demonstração)",
] as const;

// E-mail/nome usados numa versão anterior (um único autor/cliente
// genérico) — mantidos só pra limpeza funcionar mesmo se essa versão
// antiga já tiver rodado antes.
export const LEGACY_AUTHOR_EMAIL = "exemplo.demo@doctorcreator.internal";
export const LEGACY_CLIENT_NAME = "Dr. Exemplo (demonstração)";

export async function getOrCreateExampleAuthor(index: number): Promise<{ id: string; name: string }> {
  const { email, name } = EXAMPLE_AUTHORS[index];
  const existing = await pool.query("SELECT id, name FROM dash_users WHERE email = $1", [email]);
  if (existing.rows.length > 0) {
    return { id: existing.rows[0].id, name: existing.rows[0].name };
  }

  const randomPassword = await bcrypt.hash(crypto.randomUUID(), 10);
  const inserted = await pool.query(
    `INSERT INTO dash_users (email, name, password, role)
     VALUES ($1, $2, $3, 'team')
     RETURNING id, name`,
    [email, name, randomPassword]
  );
  return { id: inserted.rows[0].id, name: inserted.rows[0].name };
}

export const ROTEIRO_REEL_BOM = `GANCHO: Você sabia que a dieta anti-inflamatória pode ajudar a controlar crises de rinite e sinusite?

Muitos pacientes chegam no consultório achando que só remédio resolve, mas a alimentação também tem um papel importante no processo inflamatório do corpo.

Alguns alimentos que costumo recomendar incluir na rotina: peixes ricos em ômega-3, como salmão e sardinha, azeite de oliva extra virgem, frutas vermelhas e vegetais folhosos verde-escuros. E alguns que vale reduzir: açúcar refinado, frituras e ultraprocessados, que tendem a intensificar o processo inflamatório.

Isso não substitui o tratamento médico, mas pode ser um aliado importante no dia a dia.

Se você tem crises frequentes de rinite ou sinusite e quer entender melhor o que pode estar contribuindo, manda mensagem aqui que a gente agenda uma consulta pra avaliar o seu caso com calma.`;

export const ROTEIRO_CARROSSEL_AJUSTAR = `Slide 1: Clareamento dental é a melhor solução para esse problema que atrapalha sua autoestima
Slide 2: Muita gente sofre com dentes amarelados e não sabe o que fazer
Slide 3: Aqui na clínica usamos a técnica mais avançada do mercado, com resultado garantido
Slide 4: São só algumas sessões e o sorriso fica perfeito
Slide 5: Não deixe pra depois, sua autoestima merece`;

export const REUNIAO_MENTORIA_BOA = `Consultoria: Bom dia, doutor! Como foram os últimos 15 dias depois da nossa última conversa?
Dr. Marcelo Tavares: Bom dia! Foi bem interessante, os Reels sobre prevenção de lesão no joelho tiveram bastante engajamento, tivemos uns comentários pedindo pra falar mais sobre reabilitação pós-cirúrgica.
Consultoria: Que ótimo! Olhando aqui os números, esse Reel específico teve 40% mais alcance que a média do perfil e gerou 12 mensagens diretas perguntando sobre agendamento. Isso é um sinal forte de que reabilitação pós-cirúrgica é um tema que interessa muito o público de vocês, então já vamos priorizar isso no próximo lote de conteúdo.
Dr. Marcelo Tavares: Faz sentido, muita gente que eu atendo mesmo é pós-cirúrgica.
Consultoria: Perfeito. Então da nossa parte, vamos entregar até sexta-feira o roteiro de 3 Reels sobre reabilitação pós-cirúrgica de joelho, já pensando nessas dúvidas que apareceram nos comentários.
Dr. Marcelo Tavares: Combinado.
Consultoria: E da sua parte, doutor, preciso que grave os vídeos de bastidor que a gente conversou, tirando uns 10 minutos entre uma consulta e outra, até quinta-feira, pra gente já ter material pra próxima semana.
Dr. Marcelo Tavares: Consigo sim, vou separar um tempo.
Consultoria: Show. Aí a gente já marca nossa próxima reunião pra daqui a duas semanas, dia 15, mesmo horário, pra revisar como foi a entrega de tudo isso e ver os números.
Dr. Marcelo Tavares: Fechado, dia 15 então.`;

export const REUNIAO_MENTORIA_AJUSTAR = `Consultoria: Oi doutora, tudo bem? Vamos revisar rapidinho aqui os números do mês. Você teve 3200 seguidores novos, alcance de 45 mil pessoas, e um engajamento de 6%. Isso é um resultado bom pro seu nicho, a média do mercado costuma ficar em torno de 3 a 4%. Também vi que o story de bastidores do consultório teve bastante visualização, mais de 2 mil views. E o Reel sobre check-up anual também performou bem, ficou entre os top 3 conteúdos do mês. De modo geral eu acho que o mês foi positivo, os números estão evoluindo de forma consistente e é importante manter esse ritmo de postagem que a gente vem tendo, porque isso é o que sustenta o crescimento a longo prazo, então vamos continuar assim.
Dra. Beatriz Nogueira: Legal, entendi.
Consultoria: Show, então é isso, qualquer coisa você me chama.`;

export const COMERCIAL_TITULO = `${TAG} Call comercial — Dr. Henrique Sousa (demonstração)`;
export const COMERCIAL_PARTICIPANTES = ["Rafael Costa (exemplo)", "Dr. Henrique Sousa (demonstração)"];
export const COMERCIAL_CONTEUDO = `Rafael: Boa tarde, doutor! Como o senhor está? Vi que preencheu o formulário perguntando sobre gestão de redes sociais, pode me contar um pouco do que está buscando hoje?
Dr. Henrique Sousa: Boa tarde! Então, hoje eu posto sozinho, meio sem estratégia, às vezes fico duas semanas sem postar nada.
Rafael: Entendi. E isso te incomoda mais por qual motivo — é mais a questão de aparecer pouco, ou o senhor sente que está perdendo pacientes por conta disso?
Dr. Henrique Sousa: Um pouco dos dois, mas principalmente eu vejo outros colegas crescendo e eu meio que parado.
Rafael: Faz sentido. Deixa eu te perguntar uma coisa, hoje o senhor tem quanto tempo por semana pra dedicar a isso, ou pretende terceirizar tudo?
Dr. Henrique Sousa: Praticamente zero tempo, eu preciso terceirizar mesmo.
Rafael: Show, isso ajuda bastante a entender. Pelo que o senhor me contou, faz sentido a gente te mostrar como funciona nosso acompanhamento completo, com produção de conteúdo e consultoria mensal. Não posso garantir um número exato de pacientes novos, isso depende de vários fatores, mas o que a gente entrega é constância e estratégia, que é o que tá faltando hoje pro senhor.
Dr. Henrique Sousa: Entendi, e como funciona o valor?
Rafael: Vou te mandar a proposta detalhada por e-mail ainda hoje, com os valores e o que está incluso. Fico de te ligar quinta-feira às 15h pra tirar dúvidas e ver se faz sentido seguir. Pode ser?
Dr. Henrique Sousa: Pode sim, fico no aguardo.
Rafael: Perfeito, obrigado pelo tempo, doutor, falo com o senhor quinta.`;
