import { useRef, useState } from 'react'
import { INPUT_ACCEPT } from '../image/formats'

interface Props { onFile(file: File): void; compact?: boolean; busy?: boolean }

export function DropZone({ onFile, compact = false, busy = false }: Props) {
  const input = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const choose = (files: FileList | null) => { if (files?.[0]) onFile(files[0]) }
  return (
    <div
      className={`drop-zone ${compact ? 'compact' : ''} ${dragging ? 'dragging' : ''}`}
      onDragOver={(event) => { event.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => { event.preventDefault(); setDragging(false); choose(event.dataTransfer.files) }}
    >
      <input ref={input} className="visually-hidden" type="file" aria-hidden="true" tabIndex={-1} accept={INPUT_ACCEPT}
        onChange={(event) => choose(event.target.files)} />
      <button className={compact ? 'ghost-button' : 'primary-button'} type="button" disabled={busy}
        onClick={() => input.current?.click()}>{busy ? '正在读取…' : compact ? '换一张' : '选择照片'}</button>
      {!compact && <p>或把照片拖到这里</p>}
    </div>
  )
}
