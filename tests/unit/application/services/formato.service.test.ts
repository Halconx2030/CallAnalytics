import { beforeEach, describe, expect, it } from 'vitest';
import { mock, type MockProxy } from 'vitest-mock-extended';

import { Formato } from '@domain/entities/Formato.js';
import { ConflictError, DuplicateError, NotFoundError } from '@domain/errors/DomainError.js';

import type { CentroCosteRepository } from '@application/ports/repositories/CentroCosteRepository.js';
import type { FormatoRepository } from '@application/ports/repositories/FormatoRepository.js';
import { FormatoService } from '@application/services/formato.service.js';

const ID_FORMATO = '11111111-1111-1111-1111-111111111111';

function formatoPersistido(nombre = 'SMU'): Formato {
  return Formato.crearFormato({ nombre }).conId(ID_FORMATO);
}

describe('FormatoService', () => {
  let formatos: MockProxy<FormatoRepository>;
  let centrosCoste: MockProxy<CentroCosteRepository>;
  let service: FormatoService;

  beforeEach(() => {
    formatos = mock<FormatoRepository>();
    centrosCoste = mock<CentroCosteRepository>();
    service = new FormatoService(formatos, centrosCoste);
  });

  describe('crear', () => {
    it('guarda el formato y devuelve el DTO', async () => {
      const persistido = formatoPersistido('SMU');
      formatos.buscarPorNombre.mockResolvedValue(null);
      formatos.crear.mockResolvedValue(persistido);

      const resultado = await service.crear({ nombre: ' SMU ' });

      expect(resultado).toEqual({
        id: ID_FORMATO,
        nombre: 'SMU',
        version: 1,
        createdAt: persistido.createdAt.toISOString(),
        updatedAt: persistido.updatedAt.toISOString(),
      });
      expect(formatos.crear).toHaveBeenCalledTimes(1);
    });

    it('rechaza nombres duplicados con DuplicateError', async () => {
      formatos.buscarPorNombre.mockResolvedValue(formatoPersistido('SMU'));

      await expect(service.crear({ nombre: 'SMU' })).rejects.toBeInstanceOf(DuplicateError);
      expect(formatos.crear).not.toHaveBeenCalled();
    });

    it('rechaza nombres vacíos', async () => {
      formatos.buscarPorNombre.mockResolvedValue(null);

      await expect(service.crear({ nombre: '   ' })).rejects.toThrow();
      expect(formatos.crear).not.toHaveBeenCalled();
    });
  });

  describe('listar', () => {
    it('mapea los formatos de la página', async () => {
      formatos.listar.mockResolvedValue({
        items: [formatoPersistido('SMU')],
        nextCursor: 'cursor-1',
        hasNextPage: true,
      });

      const pagina = await service.listar({ limit: 20 });

      expect(pagina.items).toHaveLength(1);
      expect(pagina.items[0]?.nombre).toBe('SMU');
      expect(pagina.nextCursor).toBe('cursor-1');
      expect(pagina.hasNextPage).toBe(true);
    });
  });

  describe('obtener', () => {
    it('devuelve NotFoundError si el formato no existe', async () => {
      formatos.buscarPorId.mockResolvedValue(null);

      await expect(service.obtener(ID_FORMATO)).rejects.toBeInstanceOf(NotFoundError);
    });

    it('devuelve el formato encontrado', async () => {
      formatos.buscarPorId.mockResolvedValue(formatoPersistido());

      const resultado = await service.obtener(ID_FORMATO);

      expect(resultado.nombre).toBe('SMU');
    });
  });

  describe('actualizar', () => {
    it('renombra el formato', async () => {
      const persistido = formatoPersistido('SMU');
      formatos.buscarPorId.mockResolvedValue(persistido);
      formatos.actualizar.mockResolvedValue(formatoPersistido('FALABELLA'));

      const resultado = await service.actualizar(ID_FORMATO, { nombre: 'FALABELLA' });

      expect(resultado.nombre).toBe('FALABELLA');
      expect(formatos.actualizar).toHaveBeenCalledTimes(1);
    });

    it('rechaza una versión desactualizada con ConflictError', async () => {
      formatos.buscarPorId.mockResolvedValue(formatoPersistido());

      await expect(
        service.actualizar(ID_FORMATO, { nombre: 'FALABELLA' }, 7)
      ).rejects.toBeInstanceOf(ConflictError);
      expect(formatos.actualizar).not.toHaveBeenCalled();
    });

    it('rechaza con ConflictError si la fila cambia entre lectura y escritura', async () => {
      formatos.buscarPorId.mockResolvedValue(formatoPersistido());
      formatos.actualizar.mockResolvedValue(null);

      await expect(service.actualizar(ID_FORMATO, { nombre: 'FALABELLA' })).rejects.toBeInstanceOf(
        ConflictError
      );
    });

    it('devuelve NotFoundError si el formato no existe', async () => {
      formatos.buscarPorId.mockResolvedValue(null);

      await expect(service.actualizar(ID_FORMATO, { nombre: 'FALABELLA' })).rejects.toBeInstanceOf(
        NotFoundError
      );
      expect(formatos.actualizar).not.toHaveBeenCalled();
    });
  });

  describe('eliminar', () => {
    it('elimina un formato sin centros de coste asociados', async () => {
      formatos.buscarPorId.mockResolvedValue(formatoPersistido());
      centrosCoste.contarPorFormato.mockResolvedValue(0);
      formatos.eliminar.mockResolvedValue(true);

      await service.eliminar(ID_FORMATO);

      expect(formatos.eliminar).toHaveBeenCalledWith(ID_FORMATO, undefined);
    });

    it('elimina aplicando la versión esperada (RF-OPT-1.1)', async () => {
      formatos.buscarPorId.mockResolvedValue(formatoPersistido());
      centrosCoste.contarPorFormato.mockResolvedValue(0);
      formatos.eliminar.mockResolvedValue(true);

      await service.eliminar(ID_FORMATO, 1);

      expect(formatos.eliminar).toHaveBeenCalledWith(ID_FORMATO, 1);
    });

    it('rechaza con ConflictError una versión desactualizada y no borra (RF-OPT-1.3)', async () => {
      formatos.buscarPorId.mockResolvedValue(formatoPersistido());

      await expect(service.eliminar(ID_FORMATO, 99)).rejects.toBeInstanceOf(ConflictError);
      expect(formatos.eliminar).not.toHaveBeenCalled();
    });

    it('rechaza con ConflictError si el borrado condicional no afecta filas (RF-OPT-1.3)', async () => {
      formatos.buscarPorId.mockResolvedValue(formatoPersistido());
      centrosCoste.contarPorFormato.mockResolvedValue(0);
      formatos.eliminar.mockResolvedValue(false);

      await expect(service.eliminar(ID_FORMATO, 1)).rejects.toBeInstanceOf(ConflictError);
    });

    it('rechaza con ConflictError si tiene centros de coste asociados', async () => {
      formatos.buscarPorId.mockResolvedValue(formatoPersistido());
      centrosCoste.contarPorFormato.mockResolvedValue(3);

      await expect(service.eliminar(ID_FORMATO)).rejects.toBeInstanceOf(ConflictError);
      expect(formatos.eliminar).not.toHaveBeenCalled();
    });

    it('devuelve NotFoundError si el formato no existe', async () => {
      formatos.buscarPorId.mockResolvedValue(null);

      await expect(service.eliminar(ID_FORMATO)).rejects.toBeInstanceOf(NotFoundError);
    });

    it('devuelve NotFoundError si la eliminación no afecta ninguna fila', async () => {
      formatos.buscarPorId.mockResolvedValue(formatoPersistido());
      centrosCoste.contarPorFormato.mockResolvedValue(0);
      formatos.eliminar.mockResolvedValue(false);

      await expect(service.eliminar(ID_FORMATO)).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe('exportar', () => {
    it('devuelve todos los formatos', async () => {
      formatos.listarTodos.mockResolvedValue([
        formatoPersistido('SMU'),
        formatoPersistido('FALABELLA'),
      ]);

      const resultado = await service.exportar();

      expect(resultado).toHaveLength(2);
      expect(resultado.map((formato) => formato.nombre)).toEqual(['SMU', 'FALABELLA']);
    });
  });
});
