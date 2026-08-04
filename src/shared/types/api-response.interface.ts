export interface ApiResponse<T> {
  succeeded: boolean;
  message: string;
  errors?: string[];
  data?: T | null;
}

export interface PagedApiResponse<T> extends ApiResponse<T[]> {
  pageNumber: number;
  pageSize: number;
  totalPages: number;
  totalRecords: number;
  firstPage: string | null;
  lastPage: string | null;
  nextPage: string | null;
  previousPage: string | null;
}
