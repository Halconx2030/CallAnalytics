import { useEffect, useState } from 'react';

import { Button } from '../base/Button';
import { Input } from '../base/Input';
import { Modal } from '../base/Modal';
import { Select } from '../base/Select';
import { CentroCosteCombobox } from './CentroCosteCombobox';

import type { CentroCosteSeleccion } from './CentroCosteCombobox';
import type { DatosLinea, Linea } from '../../types/api';

export interface LineaFormModalProps {
  readonly abierto: boolean;
  readonly linea: Linea | null;
  readonly guardando: boolean;
  readonly error: string | null;
  readonly onCerrar: () => void;
  readonly onGuardar: (datos: DatosLinea) => void;
}

interface Errores {
  numero?: string;
  centro_coste_id?: string;
  costo_mensual?: string;
}

/** Copia mutable de `DatosLinea` para construir el cuerpo por partes. */
type DatosLineaMutables = { -readonly [K in keyof DatosLinea]: DatosLinea[K] };

/**
 * Etiqueta (`código · nombre`) del centro de coste de una línea.
 *
 * Se usa al editar: el buscador no tiene por qué devolver el centro ya
 * seleccionado entre sus resultados.
 */
function etiquetaCentroCoste(linea: Linea | null): CentroCosteSeleccion | null {
  if (linea === null || linea.centro_coste_id === '') {
    return null;
  }

  const partes = [linea.centro_coste_codigo ?? '', linea.centro_coste_nombre ?? ''].filter(
    (parte) => parte !== ''
  );

  return { id: linea.centro_coste_id, texto: partes.join(' · ') };
}

/** Modal de alta y edición de líneas (RF-UI-LIN-1.3 y RF-UI-LIN-1.4). */
export function LineaFormModal({
  abierto,
  linea,
  guardando,
  error,
  onCerrar,
  onGuardar,
}: LineaFormModalProps) {
  const editando = linea !== null;

  const [numero, setNumero] = useState('');
  const [numeroOriginal, setNumeroOriginal] = useState('');
  const [proveedor, setProveedor] = useState('');
  const [centroCosteId, setCentroCosteId] = useState('');
  const [centroCoste, setCentroCoste] = useState<CentroCosteSeleccion | null>(null);
  const [fechaAsignacion, setFechaAsignacion] = useState('');
  const [costoMensual, setCostoMensual] = useState('0');
  const [tipoLinea, setTipoLinea] = useState('');
  const [empleado, setEmpleado] = useState('');
  const [estado, setEstado] = useState('pendiente');
  const [tipoUso, setTipoUso] = useState('personal');
  const [errores, setErrores] = useState<Errores>({});

  useEffect(() => {
    if (!abierto) {
      return;
    }

    setNumero(linea?.numero ?? '');
    setNumeroOriginal(linea?.numero_original ?? '');
    setProveedor(linea?.proveedor ?? '');
    setCentroCosteId(linea?.centro_coste_id ?? '');
    setCentroCoste(etiquetaCentroCoste(linea));
    setFechaAsignacion(linea?.fecha_asignacion ?? '');
    setCostoMensual(linea?.costo_mensual ?? '0');
    setTipoLinea(linea?.tipo_linea ?? '');
    setEmpleado(linea?.empleado ?? '');
    setEstado(linea?.estado ?? 'pendiente');
    setTipoUso(linea?.tipo_uso ?? 'personal');
    setErrores({});
  }, [abierto, linea]);

  const validar = (): boolean => {
    const nuevos: Errores = {};

    if (!editando && numero.trim().length === 0) {
      nuevos.numero = 'El número es obligatorio';
    }

    if (centroCosteId.trim().length === 0) {
      nuevos.centro_coste_id = 'Selecciona un centro de coste';
    }

    if (costoMensual.trim().length > 0 && Number(costoMensual) < 0) {
      nuevos.costo_mensual = 'El costo no puede ser negativo';
    }

    setErrores(nuevos);

    return Object.keys(nuevos).length === 0;
  };

  const enviar = () => {
    if (!validar()) {
      return;
    }

    const datos: DatosLineaMutables = {};

    if (!editando) {
      datos.numero = numero.trim();
      datos.numero_original = numeroOriginal.trim() === '' ? numero.trim() : numeroOriginal.trim();
    } else if (numeroOriginal.trim() !== (linea?.numero_original ?? '')) {
      datos.numero_original = numeroOriginal.trim();
    }

    if (proveedor.trim() !== (linea?.proveedor ?? '')) {
      datos.proveedor = proveedor.trim();
    }

    if (centroCosteId !== (linea?.centro_coste_id ?? '')) {
      datos.centro_coste_id = centroCosteId;
    }

    if (fechaAsignacion !== (linea?.fecha_asignacion ?? '')) {
      datos.fecha_asignacion = fechaAsignacion;
    }

    if (costoMensual.trim() !== (linea?.costo_mensual ?? '0')) {
      datos.costo_mensual = costoMensual.trim() === '' ? '0' : costoMensual.trim();
    }

    if (tipoLinea !== (linea?.tipo_linea ?? '')) {
      datos.tipo_linea = tipoLinea;
    }

    if (empleado.trim() !== (linea?.empleado ?? '')) {
      datos.empleado = empleado.trim() === '' ? null : empleado.trim();
    }

    if (estado !== (linea?.estado ?? 'pendiente')) {
      datos.estado = estado;
    }

    if (tipoUso !== (linea?.tipo_uso ?? 'personal')) {
      datos.tipo_uso = tipoUso;
    }

    onGuardar(datos);
  };

  return (
    <Modal
      abierto={abierto}
      titulo={editando ? `Editar línea ${linea?.numero ?? ''}` : 'Nueva línea'}
      onCerrar={onCerrar}
      ancho="grande"
      pie={
        <>
          <Button variante="secundario" onClick={onCerrar}>
            Cancelar
          </Button>
          <Button cargando={guardando} onClick={enviar}>
            {editando ? 'Guardar cambios' : 'Crear línea'}
          </Button>
        </>
      }
    >
      <div className="formulario">
        {error !== null && <p className="estado estado--error">{error}</p>}

        <div className="formulario__grid">
          <Input
            etiqueta="Número *"
            name="numero"
            placeholder="+56912345678"
            disabled={editando}
            error={errores.numero}
            value={numero}
            onChange={(evento) => {
              setNumero(evento.target.value);
            }}
          />

          <Input
            etiqueta="Número original"
            name="numero_original"
            placeholder="9 1234 5678"
            value={numeroOriginal}
            onChange={(evento) => {
              setNumeroOriginal(evento.target.value);
            }}
          />

          <Input
            etiqueta="Proveedor"
            name="proveedor"
            placeholder="Entel"
            value={proveedor}
            onChange={(evento) => {
              setProveedor(evento.target.value);
            }}
          />

          {/* El formulario exige un centro único: no se ofrece el modo
              "todos los centros que coincidan" (no se entrega `onSeleccionMultiple`). */}
          <CentroCosteCombobox
            etiqueta="Centro de coste *"
            name="centro_coste_id"
            placeholder="Buscar por código o nombre"
            error={errores.centro_coste_id}
            seleccion={centroCoste}
            onSeleccion={(seleccion) => {
              setCentroCoste(seleccion);
              setCentroCosteId(seleccion?.id ?? '');
            }}
          />

          <Input
            etiqueta="Fecha de asignación"
            type="date"
            name="fecha_asignacion"
            value={fechaAsignacion}
            onChange={(evento) => {
              setFechaAsignacion(evento.target.value);
            }}
          />

          <Input
            etiqueta="Costo mensual"
            type="number"
            min="0"
            step="0.01"
            name="costo_mensual"
            error={errores.costo_mensual}
            value={costoMensual}
            onChange={(evento) => {
              setCostoMensual(evento.target.value);
            }}
          />

          <Select
            etiqueta="Tipo de línea"
            name="tipo_linea"
            placeholder="Inferir del número"
            value={tipoLinea}
            opciones={[
              { valor: 'movil', etiqueta: 'Móvil' },
              { valor: 'fijo', etiqueta: 'Fijo' },
            ]}
            onChange={(evento) => {
              setTipoLinea(evento.target.value);
            }}
          />

          <Input
            etiqueta="Empleado"
            name="empleado"
            placeholder="Nombre y apellido"
            value={empleado}
            onChange={(evento) => {
              setEmpleado(evento.target.value);
            }}
          />

          <Select
            etiqueta="Estado"
            name="estado"
            value={estado}
            opciones={[
              { valor: 'pendiente', etiqueta: 'Pendiente' },
              { valor: 'activa', etiqueta: 'Activa' },
              { valor: 'portabilidad', etiqueta: 'Portabilidad' },
              { valor: 'baja', etiqueta: 'Baja' },
            ]}
            onChange={(evento) => {
              setEstado(evento.target.value);
            }}
          />

          <Select
            etiqueta="Tipo de uso"
            name="tipo_uso"
            value={tipoUso}
            opciones={[
              { valor: 'personal', etiqueta: 'Personal' },
              { valor: 'geovictoria', etiqueta: 'Geovictoria' },
            ]}
            onChange={(evento) => {
              setTipoUso(evento.target.value);
            }}
          />
        </div>
      </div>
    </Modal>
  );
}
