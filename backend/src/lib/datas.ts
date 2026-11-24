import { config } from '../config';

const DATA_RE = /^\d{4}-\d{2}-\d{2}$/;
const HORA_RE = /^\d{2}:\d{2}$/;

export const isData = (v: unknown): v is string =>
  typeof v === 'string' && DATA_RE.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`));

export const isHora = (v: unknown): v is string => typeof v === 'string' && HORA_RE.test(v);

/** Data e hora atuais no fuso da barbearia, no formato YYYY-MM-DD e HH:MM. */
export function agoraLocal(agora = new Date()): { data: string; hora: string } {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: config.fusoHorario,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(agora);
  const p = (t: string) => partes.find((x) => x.type === t)?.value ?? '00';
  return { data: `${p('year')}-${p('month')}-${p('day')}`, hora: `${p('hour')}:${p('minute')}` };
}

export function diaDaSemana(data: string): number {
  return new Date(`${data}T12:00:00Z`).getUTCDay();
}

export function diferencaEmDias(de: string, ate: string): number {
  return Math.round((Date.parse(`${ate}T00:00:00Z`) - Date.parse(`${de}T00:00:00Z`)) / 86_400_000);
}

/** Todos os horários de atendimento de um dia, ex.: 09:00, 09:30, ..., 17:30. */
export function gradeDeHorarios(): string[] {
  const horarios: string[] = [];
  for (let min = config.horaAbertura * 60; min < config.horaFechamento * 60; min += config.intervaloMinutos) {
    horarios.push(`${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`);
  }
  return horarios;
}
