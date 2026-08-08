export interface SeedCurso {
  id: string;
  nombre: string;
  semestre: number;
  area: string;
  ordenDentroSemestre: number;
  esElectivo?: boolean;
  electivoCategoria?: string;
}
