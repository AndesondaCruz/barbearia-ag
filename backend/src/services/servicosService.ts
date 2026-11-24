import { randomUUID } from 'node:crypto';
import { badRequest, forbidden, notFound } from '../lib/http';
import type { Usuario } from '../lib/auth';
import type { Servico, servicosRepository } from '../repositories/servicosRepository';

type ServicosRepo = typeof servicosRepository;

/** Camada de negócios dos serviços (catálogo da barbearia). */
export function criarServicosService(repo: ServicosRepo) {
  return {
    async listar(): Promise<Servico[]> {
      const servicos = await repo.listar();
      return servicos.sort((a, b) => a.precoCentavos - b.precoCentavos);
    },

    async criar(usuario: Usuario, body: Record<string, unknown>): Promise<Servico> {
      if (!usuario.isBarbeiro) throw forbidden('Somente o barbeiro pode cadastrar serviços');

      const nome = typeof body.nome === 'string' ? body.nome.trim() : '';
      const descricao = typeof body.descricao === 'string' ? body.descricao.trim() : '';
      const precoCentavos = body.precoCentavos;

      if (nome.length < 2 || nome.length > 60) throw badRequest('Nome deve ter entre 2 e 60 caracteres');
      if (descricao.length > 200) throw badRequest('Descrição deve ter no máximo 200 caracteres');
      if (!Number.isInteger(precoCentavos) || (precoCentavos as number) <= 0) {
        throw badRequest('precoCentavos deve ser um inteiro positivo (ex.: 3500 = R$ 35,00)');
      }

      const servico: Servico = {
        id: randomUUID(),
        nome,
        descricao,
        precoCentavos: precoCentavos as number,
        duracaoMinutos: 30,
      };
      await repo.criar(servico);
      return servico;
    },

    async remover(usuario: Usuario, id: string): Promise<void> {
      if (!usuario.isBarbeiro) throw forbidden('Somente o barbeiro pode remover serviços');
      const removido = await repo.remover(id);
      if (!removido) throw notFound('Serviço não encontrado');
    },
  };
}
