import { useState } from 'react'
import { Badge } from '../../../../shared/ui/atoms/Badge'
import { Button } from '../../../../shared/ui/atoms/Button'
import { CodeIcon, CubeIcon, FileIcon, PhotoIcon, UploadIcon, XrayIcon } from '../../../../shared/ui/atoms/icons'
import { Toolbar } from '../../../../shared/ui/molecules/Toolbar'
import { FILES, FILE_FILTERS } from '../../domain/data'
import styles from './tabs.module.css'

const THUMBS = {
  xray: { Icon: XrayIcon, className: styles.thumbXray },
  photo: { Icon: PhotoIcon, className: styles.thumbPhoto },
  doc: { Icon: FileIcon, className: styles.thumbDoc },
  code: { Icon: CodeIcon, className: styles.thumbCode },
  cube: { Icon: CubeIcon, className: styles.thumbCube },
}

export function FilesTab() {
  const [filter, setFilter] = useState(FILE_FILTERS[0])

  return (
    <div className={styles.main}>
      <Toolbar filters={FILE_FILTERS} selectedFilter={filter} onFilterChange={setFilter}>
        <Button>
          <UploadIcon />
          Subir archivo
        </Button>
      </Toolbar>

      <div className={styles.fileGrid}>
        {FILES.map((file) => {
          const { Icon, className } = THUMBS[file.kind]
          return (
            <article key={file.name} className={styles.file}>
              <div className={`${styles.thumb} ${className}`}>
                <Icon size={34} />
              </div>
              <div className={styles.fileMeta}>
                <span className={styles.fileName}>{file.name}</span>
                <span className={styles.fileFoot}>
                  {file.meta}
                  <span className={styles.spacer} />
                  <Badge tone={file.tone}>{file.scan}</Badge>
                </span>
              </div>
            </article>
          )
        })}
      </div>
    </div>
  )
}
