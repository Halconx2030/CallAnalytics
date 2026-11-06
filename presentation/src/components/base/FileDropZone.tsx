import { useRef, useState } from 'react';

export interface FileDropZoneProps {
  readonly accept?: string;
  readonly onArchivo: (archivo: File) => void;
  readonly disabled?: boolean;
  readonly texto?: string;
  readonly error?: string | undefined;
}

/** Zona de arrastre y soltar para cargar un archivo CSV/XLSX. */
export function FileDropZone({
  accept = '.csv,.xlsx,.xls',
  onArchivo,
  disabled = false,
  texto = 'Arrastra el archivo aquí o haz clic para seleccionarlo',
  error,
}: FileDropZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [arrastrando, setArrastrando] = useState(false);

  const entregar = (archivo: File | undefined) => {
    if (archivo !== undefined && !disabled) {
      onArchivo(archivo);
    }
  };

  return (
    <div
      className={`dropzone${arrastrando ? ' dropzone--activo' : ''}`}
      role="button"
      tabIndex={0}
      onClick={() => {
        if (!disabled) {
          inputRef.current?.click();
        }
      }}
      onKeyDown={(evento) => {
        if (evento.key === 'Enter' || evento.key === ' ') {
          evento.preventDefault();
          if (!disabled) {
            inputRef.current?.click();
          }
        }
      }}
      onDragOver={(evento) => {
        evento.preventDefault();
        setArrastrando(true);
      }}
      onDragLeave={() => {
        setArrastrando(false);
      }}
      onDrop={(evento) => {
        evento.preventDefault();
        setArrastrando(false);
        entregar(evento.dataTransfer.files[0]);
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="dropzone__input"
        disabled={disabled}
        onChange={(evento) => {
          entregar(evento.target.files?.[0]);
          evento.target.value = '';
        }}
      />
      <p className="dropzone__texto">{texto}</p>
      <p className="dropzone__ayuda">Formatos aceptados: CSV y Excel (.xlsx)</p>
      {error !== undefined && <p className="campo__error">{error}</p>}
    </div>
  );
}
