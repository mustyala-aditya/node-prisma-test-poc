export interface APIResponse<T> {
    data: T[];
    links: {
      next?: string; 
    };
  }