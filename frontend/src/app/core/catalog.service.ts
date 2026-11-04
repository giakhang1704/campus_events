import { inject, Injectable } from '@angular/core';
import { Api, Catalog } from './api';

/** Cached public catalogs (departments, organization units) for read-only screens. */
@Injectable({ providedIn: 'root' })
export class CatalogService {
  private readonly api = inject(Api);
  private departments?: Promise<Catalog[]>;
  private units?: Promise<Catalog[]>;

  getDepartments(): Promise<Catalog[]> {
    this.departments ??= this.api.request<Catalog[]>('/catalog/departments').catch((e) => {
      this.departments = undefined;
      throw e;
    });
    return this.departments;
  }

  getUnits(): Promise<Catalog[]> {
    this.units ??= this.api.request<Catalog[]>('/catalog/organization-units').catch((e) => {
      this.units = undefined;
      throw e;
    });
    return this.units;
  }
}
