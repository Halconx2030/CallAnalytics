import { describe, expect, it } from 'vitest';

import {
  ESTADOS_LINEA,
  LineaTelefonica,
  TIPOS_USO,
  type CrearLineaTelefonicaInput,
} from '../../../src/domain/entities/LineaTelefonica.js';
import {
  InvalidCostoError,
  InvalidPhoneNumberError,
  ValidationError,
} from '../../../src/domain/errors/DomainError.js';
import { CostoMensual } from '../../../src/domain/value-objects/CostoMensual.js';

const AHORA = new Date('2026-11-04T12:00:00.000Z');
const DESPUES = new Date('2026-11-05T08:30:00.000Z');
const CENTRO_ID = '11111111-1111-1111-1111-111111111111';
const LINEA_ID = '22222222-2222-2222-2222-222222222222';
const MOVIL_NORMALIZADO = '+56912345678';

const base: CrearLineaTelefonicaInput = {
  numero: '9 1234 5678',
  centroCosteId: CENTRO_ID,
};

function crear(
  cambios: Partial<CrearLineaTelefonicaInput> = {},
  ahora: Date = AHORA
): LineaTelefonica {
  return LineaTelefonica.crearLineaTelefonica({ ...base, ...cambios }, ahora);
}

describe('LineaTelefonica — defaults de creación', () => {
  it('normaliza el número y aplica todos los valores por defecto', () => {
    const linea = crear();

    expect(linea.id).toBeNull();
    expect(linea.numero).toBe(MOVIL_NORMALIZADO);
    expect(linea.numeroOriginal).toBe('9 1234 5678');
    expect(linea.proveedor).toBe('');
    expect(linea.centroCosteId).toBe(CENTRO_ID);
    expect(linea.fechaAsignacion).toBe('2026-11-04');
    expect(linea.costoMensual).toBeInstanceOf(CostoMensual);
    expect(linea.costoMensual.valor).toBe(0);
    expect(linea.costoMensual.aString()).toBe('0.00');
    expect(linea.tipoLinea).toBe('movil');
    expect(linea.empleado).toBeNull();
    expect(linea.estado).toBe('pendiente');
    expect(linea.tipoUso).toBe('personal');
    expect(linea.version).toBe(1);
    expect(linea.createdAt).toBe(AHORA);
    expect(linea.updatedAt).toBe(AHORA);
    expect(linea.deletedAt).toBeNull();
    expect(linea.estaDadaDeBaja()).toBe(false);
  });

  it('infiere tipo_linea fijo para Santiago', () => {
    expect(crear({ numero: '2 1234 5678' }).tipoLinea).toBe('fijo');
  });

  it('infiere tipo_linea fijo para regiones', () => {
    const linea = crear({ numero: '32 1234 5678' });

    expect(linea.numero).toBe('+563212345678');
    expect(linea.tipoLinea).toBe('fijo');
  });

  it('respeta el número original recibido', () => {
    const linea = crear({
      numero: '+56 9 1234 5678',
      numeroOriginal: '  +56 9 1234 5678  ',
    });

    expect(linea.numero).toBe(MOVIL_NORMALIZADO);
    expect(linea.numeroOriginal).toBe('  +56 9 1234 5678  ');
  });

  it('aplica los valores entregados explícitamente', () => {
    const linea = crear({
      proveedor: '  Entel  ',
      fechaAsignacion: '2026-01-15',
      costoMensual: '12345.678',
      empleado: '  Ana Pérez  ',
      estado: 'activa',
      tipoUso: 'geovictoria',
      tipoLinea: 'fijo',
    });

    expect(linea.proveedor).toBe('Entel');
    expect(linea.fechaAsignacion).toBe('2026-01-15');
    expect(linea.costoMensual.valor).toBe(12345.68);
    expect(linea.empleado).toBe('Ana Pérez');
    expect(linea.estado).toBe('activa');
    expect(linea.tipoUso).toBe('geovictoria');
    expect(linea.tipoLinea).toBe('fijo');
  });

  it('trata un empleado vacío como null', () => {
    expect(crear({ empleado: '   ' }).empleado).toBeNull();
    expect(crear({ empleado: null }).empleado).toBeNull();
  });

  it('marca deletedAt si se crea directamente en estado baja', () => {
    const linea = crear({ estado: 'baja' });

    expect(linea.estado).toBe('baja');
    expect(linea.deletedAt).toBe(AHORA);
    expect(linea.estaDadaDeBaja()).toBe(true);
  });

  it('expone los enums de estados y tipos de uso', () => {
    expect(ESTADOS_LINEA).toEqual(['activa', 'baja', 'pendiente', 'portabilidad']);
    expect(TIPOS_USO).toEqual(['personal', 'geovictoria']);
  });
});

describe('LineaTelefonica — validaciones de creación', () => {
  it('rechaza números inválidos', () => {
    expect(() => crear({ numero: '1234567' })).toThrow(InvalidPhoneNumberError);
  });

  it('rechaza costo mensual negativo', () => {
    expect(() => crear({ costoMensual: -1 })).toThrow(InvalidCostoError);
  });

  it('rechaza costo mensual NaN', () => {
    expect(() => crear({ costoMensual: Number.NaN })).toThrow(InvalidCostoError);
  });

  it.each(['invalido', 'ACTIVA', ''])('rechaza estado inválido %j', (estado) => {
    expect(() => crear({ estado: estado as 'activa' })).toThrow(ValidationError);
  });

  it.each(['empresa', 'PERSONAL', ''])('rechaza tipo_uso inválido %j', (tipoUso) => {
    expect(() => crear({ tipoUso: tipoUso as 'personal' })).toThrow(ValidationError);
  });

  it('rechaza tipo_linea inválido', () => {
    expect(() => crear({ tipoLinea: 'satelital' as 'movil' })).toThrow(ValidationError);
  });

  it('rechaza centro de coste vacío', () => {
    expect(() => crear({ centroCosteId: '   ' })).toThrow(ValidationError);
  });

  it.each(['2026-02-30', '2026-13-01', '04-11-2026', '2026-1-4', ''])(
    'rechaza fecha_asignacion inválida %j',
    (fechaAsignacion) => {
      expect(() => crear({ fechaAsignacion })).toThrow(ValidationError);
    }
  );

  it('rechaza strings demasiado largos para la BD', () => {
    expect(() => crear({ proveedor: 'x'.repeat(101) })).toThrow(ValidationError);
    expect(() => crear({ empleado: 'x'.repeat(101) })).toThrow(ValidationError);
  });
});

describe('LineaTelefonica — baja lógica', () => {
  it('darDeBaja cambia estado y setea deletedAt sin mutar la instancia original', () => {
    const original = crear({ estado: 'activa' });
    const dadaDeBaja = original.darDeBaja(DESPUES);

    expect(dadaDeBaja).not.toBe(original);
    expect(dadaDeBaja.estado).toBe('baja');
    expect(dadaDeBaja.deletedAt).toBe(DESPUES);
    expect(dadaDeBaja.updatedAt).toBe(DESPUES);
    expect(dadaDeBaja.estaDadaDeBaja()).toBe(true);
    expect(original.estado).toBe('activa');
    expect(original.deletedAt).toBeNull();
    expect(original.estaDadaDeBaja()).toBe(false);
  });

  it('darDeBaja es idempotente', () => {
    const dadaDeBaja = crear({ estado: 'activa' }).darDeBaja(AHORA);
    const segundaVez = dadaDeBaja.darDeBaja(DESPUES);

    expect(segundaVez.estado).toBe('baja');
    expect(segundaVez.deletedAt).toBe(AHORA);
    expect(segundaVez.updatedAt).toBe(AHORA);
  });

  it('cambiarEstado("baja") equivale a darDeBaja', () => {
    const dadaDeBaja = crear({ estado: 'activa' }).cambiarEstado('baja', DESPUES);

    expect(dadaDeBaja.estado).toBe('baja');
    expect(dadaDeBaja.deletedAt).toBe(DESPUES);
  });

  it('reactivar desde baja limpia deletedAt', () => {
    const dadaDeBaja = crear({ estado: 'activa' }).darDeBaja(AHORA);
    const reactivada = dadaDeBaja.cambiarEstado('activa', DESPUES);

    expect(reactivada.estado).toBe('activa');
    expect(reactivada.deletedAt).toBeNull();
    expect(reactivada.updatedAt).toBe(DESPUES);
    expect(reactivada.estaDadaDeBaja()).toBe(false);
    expect(dadaDeBaja.deletedAt).toBe(AHORA);
  });

  it('permite transiciones libres entre estados no baja', () => {
    const portabilidad = crear({ estado: 'activa' }).cambiarEstado('portabilidad', DESPUES);

    expect(portabilidad.estado).toBe('portabilidad');
    expect(portabilidad.deletedAt).toBeNull();
  });

  it('rechaza cambiar a un estado inválido', () => {
    expect(() => crear().cambiarEstado('eliminada' as 'baja', DESPUES)).toThrow(ValidationError);
  });
});

describe('LineaTelefonica — actualizar', () => {
  it('permite cambiar todos los campos menos id y numero', () => {
    const original = crear({ estado: 'activa' }).conId(LINEA_ID);
    const actualizada = original.actualizar(
      {
        numeroOriginal: ' 9 1234 5678 (original) ',
        proveedor: 'Movistar',
        centroCosteId: '33333333-3333-3333-3333-333333333333',
        fechaAsignacion: '2026-03-01',
        costoMensual: 5000,
        tipoLinea: 'movil',
        empleado: 'Juan Soto',
        estado: 'portabilidad',
        tipoUso: 'geovictoria',
      },
      DESPUES
    );

    expect(actualizada.id).toBe(LINEA_ID);
    expect(actualizada.numero).toBe(MOVIL_NORMALIZADO);
    expect(actualizada.numeroOriginal).toBe(' 9 1234 5678 (original) ');
    expect(actualizada.proveedor).toBe('Movistar');
    expect(actualizada.centroCosteId).toBe('33333333-3333-3333-3333-333333333333');
    expect(actualizada.fechaAsignacion).toBe('2026-03-01');
    expect(actualizada.costoMensual.valor).toBe(5000);
    expect(actualizada.empleado).toBe('Juan Soto');
    expect(actualizada.estado).toBe('portabilidad');
    expect(actualizada.tipoUso).toBe('geovictoria');
    expect(actualizada.updatedAt).toBe(DESPUES);
    expect(actualizada.createdAt).toBe(AHORA);
    expect(original.updatedAt).toBe(AHORA);
    expect(original.proveedor).toBe('');
  });

  it('mantiene los valores no incluidos en el cambio', () => {
    const original = crear({ proveedor: 'Entel', costoMensual: 1000 });
    const actualizada = original.actualizar({ empleado: 'Ana' }, DESPUES);

    expect(actualizada.proveedor).toBe('Entel');
    expect(actualizada.costoMensual.valor).toBe(1000);
    expect(actualizada.empleado).toBe('Ana');
  });

  it('setea deletedAt al pasar a baja y lo limpia al reactivar', () => {
    const dadaDeBaja = crear({ estado: 'activa' }).actualizar({ estado: 'baja' }, DESPUES);

    expect(dadaDeBaja.estado).toBe('baja');
    expect(dadaDeBaja.deletedAt).toBe(DESPUES);

    const reactivada = dadaDeBaja.actualizar({ estado: 'activa' }, DESPUES);

    expect(reactivada.deletedAt).toBeNull();
  });

  it('valida los mismos campos que la creación', () => {
    const linea = crear();

    expect(() => linea.actualizar({ costoMensual: -5 }, DESPUES)).toThrow(InvalidCostoError);
    expect(() => linea.actualizar({ centroCosteId: '  ' }, DESPUES)).toThrow(ValidationError);
    expect(() => linea.actualizar({ empleado: 'x'.repeat(101) }, DESPUES)).toThrow(ValidationError);
    expect(() => linea.actualizar({ estado: 'otro' as 'baja' }, DESPUES)).toThrow(ValidationError);
  });

  it('no permite reasignar numero ni id (inmutable en runtime)', () => {
    const linea = crear().conId(LINEA_ID);

    expect(Reflect.set(linea, 'numero', '+56900000000')).toBe(false);
    expect(Reflect.set(linea, 'id', 'otro-id')).toBe(false);
    expect(linea.numero).toBe(MOVIL_NORMALIZADO);
    expect(linea.id).toBe(LINEA_ID);
  });
});

describe('LineaTelefonica — conId y reconstitución', () => {
  const fila = {
    id: LINEA_ID,
    numero: MOVIL_NORMALIZADO,
    numeroOriginal: '9 1234 5678',
    proveedor: 'Entel',
    centroCosteId: CENTRO_ID,
    fechaAsignacion: '2026-01-15',
    costoMensual: '12345.60',
    tipoLinea: 'movil',
    empleado: null,
    estado: 'activa',
    tipoUso: 'personal',
    version: 4,
    createdAt: AHORA,
    updatedAt: AHORA,
    deletedAt: null,
  };

  it('conId devuelve una copia con id asignado', () => {
    const linea = crear().conId(LINEA_ID);

    expect(linea.id).toBe(LINEA_ID);
    expect(crear().id).toBeNull();
    expect(() => crear().conId('   ')).toThrow(ValidationError);
  });

  it('reconstituye una fila de persistencia completa', () => {
    const linea = LineaTelefonica.reconstituirLineaTelefonica({
      ...fila,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-02-01T00:00:00.000Z',
    });

    expect(linea.id).toBe(LINEA_ID);
    expect(linea.numero).toBe(MOVIL_NORMALIZADO);
    expect(linea.numeroOriginal).toBe('9 1234 5678');
    expect(linea.proveedor).toBe('Entel');
    expect(linea.centroCosteId).toBe(CENTRO_ID);
    expect(linea.fechaAsignacion).toBe('2026-01-15');
    expect(linea.costoMensual).toBeInstanceOf(CostoMensual);
    expect(linea.costoMensual.aString()).toBe('12345.60');
    expect(linea.tipoLinea).toBe('movil');
    expect(linea.empleado).toBeNull();
    expect(linea.estado).toBe('activa');
    expect(linea.tipoUso).toBe('personal');
    expect(linea.version).toBe(4);
    expect(linea.createdAt).toEqual(new Date('2026-01-01T00:00:00.000Z'));
    expect(linea.updatedAt).toEqual(new Date('2026-02-01T00:00:00.000Z'));
    expect(linea.deletedAt).toBeNull();
    expect(linea.estaDadaDeBaja()).toBe(false);
  });

  it('reconstituye una línea dada de baja', () => {
    const linea = LineaTelefonica.reconstituirLineaTelefonica({
      ...fila,
      estado: 'baja',
      deletedAt: '2026-02-01T00:00:00.000Z',
    });

    expect(linea.estado).toBe('baja');
    expect(linea.deletedAt).toEqual(new Date('2026-02-01T00:00:00.000Z'));
    expect(linea.estaDadaDeBaja()).toBe(true);
  });

  it('rechaza filas con datos inválidos', () => {
    expect(() =>
      LineaTelefonica.reconstituirLineaTelefonica({ ...fila, estado: 'desconocido' })
    ).toThrow(ValidationError);
    expect(() => LineaTelefonica.reconstituirLineaTelefonica({ ...fila, tipoUso: 'otro' })).toThrow(
      ValidationError
    );
    expect(() =>
      LineaTelefonica.reconstituirLineaTelefonica({ ...fila, tipoLinea: 'satelital' })
    ).toThrow(ValidationError);
    expect(() =>
      LineaTelefonica.reconstituirLineaTelefonica({ ...fila, costoMensual: '-1' })
    ).toThrow(InvalidCostoError);
    expect(() =>
      LineaTelefonica.reconstituirLineaTelefonica({ ...fila, numero: '1234567' })
    ).toThrow(InvalidPhoneNumberError);
    expect(() =>
      LineaTelefonica.reconstituirLineaTelefonica({ ...fila, fechaAsignacion: '2026-02-30' })
    ).toThrow(ValidationError);
  });
});
