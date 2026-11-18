// Banco SQL de verdade (SQLite compilado para WebAssembly) rodando no aparelho.
import initSqlJs, { type SqlJsStatic } from 'sql.js';
import { LOJA_SQL } from '../data/lessons/backend';

let SQL: Promise<SqlJsStatic> | null = null;
export function loadSql() {
  if (!SQL) SQL = initSqlJs({ locateFile: (f: string) => 'vendor/' + f });
  return SQL;
}

export type Cell = string | number | null;
export interface SqlResult { columns: string[]; rows: Cell[][]; error?: string; changes?: number }

export async function runSql(query: string, setup: string = 'loja'): Promise<SqlResult> {
  const S = await loadSql();
  const db = new S.Database();
  try {
    db.run(setup === 'loja' ? LOJA_SQL : setup);
    const res = db.exec(query);
    const last = res[res.length - 1];
    return { columns: last?.columns ?? [], rows: (last?.values as Cell[][]) ?? [], changes: db.getRowsModified() };
  } catch (e: any) {
    return { columns: [], rows: [], error: String(e?.message ?? e) };
  } finally {
    db.close();
  }
}

const norm = (c: Cell) => (typeof c === 'number' ? Math.round(c * 1e6) / 1e6 : c);
export function sameRows(got: Cell[][], expected: Cell[][], ordered = false): boolean {
  if (got.length !== expected.length) return false;
  const a = got.map((r) => JSON.stringify(r.map(norm)));
  const b = expected.map((r) => JSON.stringify(r.map(norm)));
  if (!ordered) { a.sort(); b.sort(); }
  return a.every((x, i) => x === b[i]);
}

export function explainSqlError(msg: string): string | null {
  const rules: [RegExp, string][] = [
    [/no such table: (\w+)/, 'A tabela "$1" não existe. Tabelas disponíveis: clientes, produtos, pedidos, itens.'],
    [/no such column: ([\w.]+)/, 'A coluna "$1" não existe. Confira o nome e de qual tabela ela é (use tabela.coluna em JOINs).'],
    [/syntax error/, 'Erro de escrita no SQL. Confira vírgulas entre colunas, aspas simples em textos e a ordem: SELECT → FROM → JOIN → WHERE → GROUP BY → ORDER BY → LIMIT.'],
    [/ambiguous column name: (\w+)/, 'A coluna "$1" existe em mais de uma tabela do JOIN. Escreva tabela.$1.'],
    [/UNIQUE constraint failed/, 'Já existe uma linha com esse valor único (ex.: id repetido).'],
    [/NOT NULL constraint failed: ([\w.]+)/, 'A coluna $1 é obrigatória e ficou vazia.'],
  ];
  for (const [re, txt] of rules) { const m = msg.match(re); if (m) return txt.replace(/\$1/g, m[1] ?? ''); }
  return null;
}
