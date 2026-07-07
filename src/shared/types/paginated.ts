/** Forma estándar de una respuesta paginada del backend qleo-api. */
export interface Paginated<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}
