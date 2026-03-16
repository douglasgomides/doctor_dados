import { CampaignRow } from "@/types";

const SPREADSHEET_ID = "1f9dFqKGQJnH0dSqvTkPfSoA22TfAyQnZUiNGQs280Pw";
const GID = "0";

const CSV_URL = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/export?format=csv&gid=${GID}`;

function parseCSV(csv: string): string[][] {
  const rows: string[][] = [];
  let current = "";
  let inQuotes = false;
  let row: string[] = [];

  for (let i = 0; i < csv.length; i++) {
    const char = csv[i];
    if (inQuotes) {
      if (char === '"' && csv[i + 1] === '"') {
        current += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ",") {
        row.push(current.trim());
        current = "";
      } else if (char === "\n" || (char === "\r" && csv[i + 1] === "\n")) {
        row.push(current.trim());
        current = "";
        rows.push(row);
        row = [];
        if (char === "\r") i++;
      } else {
        current += char;
      }
    }
  }
  if (current || row.length > 0) {
    row.push(current.trim());
    rows.push(row);
  }
  return rows;
}

function parseBRL(value: string): number {
  if (!value) return 0;
  const cleaned = value.replace("R$", "").replace(/\s/g, "").replace(".", "").replace(",", ".");
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : Math.round(num * 100) / 100;
}

function parseDate(value: string): string {
  // Input: DD/MM/YYYY → Output: YYYY-MM-DD
  if (!value) return "";
  const parts = value.split("/");
  if (parts.length !== 3) return value;
  return `${parts[2]}-${parts[1].padStart(2, "0")}-${parts[0].padStart(2, "0")}`;
}

function parseNumber(value: string): number {
  if (!value) return 0;
  const cleaned = value.replace(/\s/g, "").replace(".", "").replace(",", ".");
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : Math.round(num * 100) / 100;
}

export async function fetchSheetData(): Promise<CampaignRow[]> {
  const response = await fetch(CSV_URL);
  if (!response.ok) {
    throw new Error(`Erro ao buscar planilha: ${response.status}`);
  }
  const csv = await response.text();
  const rows = parseCSV(csv);

  // Skip header row
  const dataRows = rows.slice(1).filter((row) => row.length >= 2 && row[1]);

  return dataRows.map((cols, index) => ({
    rowIndex: index + 2, // +2 because row 1 is header, and Sheets is 1-indexed
    dia: parseDate(cols[1] || ""),
    status: cols[2] || "",
    acoes: cols[3] || "",
    contaDeAnuncio: cols[4] || "",
    nomeDaCampanha: cols[5] || "",
    linkDoPost: cols[6] || "",
    tipo: cols[7] || "",
    orcamento: parseBRL(cols[8]),
    valorInvestido: parseBRL(cols[9]),
    seguidoresNovos: parseNumber(cols[10]),
    custoPorSeguidor: parseBRL(cols[11]),
    mensagensIniciadas: parseNumber(cols[12]),
    custoPorMensagem: parseBRL(cols[13]),
    impressoes: parseNumber(cols[14]),
    alcance: parseNumber(cols[15]),
    cliquesNoLink: parseNumber(cols[16]),
    cliquesUnicos: parseNumber(cols[17]),
    visualizacaoDaPagina: parseNumber(cols[18]),
    checkouts: parseNumber(cols[19]),
  }));
}
