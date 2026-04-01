export type NotebookCell = {
  cell_type: 'code' | 'markdown' | 'raw'
  source: string | string[]
  metadata?: Record<string, unknown>
  outputs?: unknown[]
}

export type Notebook = {
  cells: NotebookCell[]
  metadata?: Record<string, unknown>
  nbformat?: number
  nbformat_minor?: number
}
export type NotebookContent = any;
export type NotebookCellSourceOutput = any;
export type NotebookOutputImage = any;
export type NotebookCellType = any;
export type NotebookCellOutput = any;
