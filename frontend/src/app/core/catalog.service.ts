import { inject, Injectable } from '@angular/core';
import { Api, Catalog } from './api';

/** Name of a department/unit by id, or undefined while the catalog is not loaded or the id is unknown. */
export function catalogName(list: Catalog[], id: number | null | undefined): string | undefined {
  return list.find((item) => item.id === id)?.name;
}

/**
 * Departments and organization units, loaded once per session and shared by every screen.
 * The Promise itself is cached (`??=`), so two components asking at the same time share one request.
 */
@Injectable({ providedIn: 'root' })
export class CatalogService {
  private readonly api = inject(Api);
  private departments?: Promise<Catalog[]>;
  private units?: Promise<Catalog[]>;

  getDepartments(): Promise<Catalog[]> {
    this.departments ??= this.api.request<Catalog[]>('/catalog/departments').catch((error) => {
      this.departments = undefined; // a failed request is not cached: the next call tries again
      throw error;
    });
    return this.departments;
  }

  getUnits(): Promise<Catalog[]> {
    this.units ??= this.api.request<Catalog[]>('/catalog/organization-units').catch((error) => {
      this.units = undefined; // a failed request is not cached: the next call tries again
      throw error;
    });
    return this.units;
  }
}
