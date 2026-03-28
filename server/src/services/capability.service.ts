import { db } from '../db';
import type { AppCapabilitySchema } from '@obligate/shared';

export const capabilityService = {
  async syncSchemas(appId: number, schemas: AppCapabilitySchema[]): Promise<void> {
    const declaredKeys = schemas.map(s => s.key);
    await db('app_capability_schemas')
      .where({ app_id: appId })
      .whereNotIn('key', declaredKeys)
      .del();

    for (const s of schemas) {
      await db('app_capability_schemas')
        .insert({
          app_id: appId,
          key: s.key,
          label: s.label,
          description: s.description ?? null,
          sort_order: s.sortOrder,
        })
        .onConflict(['app_id', 'key'])
        .merge({
          label: s.label,
          description: s.description ?? null,
          sort_order: s.sortOrder,
        });
    }
  },

  async getSchemasForApp(appId: number): Promise<AppCapabilitySchema[]> {
    const rows = await db('app_capability_schemas')
      .where({ app_id: appId })
      .orderBy('sort_order') as Array<{
        key: string; label: string; description: string | null; sort_order: number;
      }>;
    return rows.map(r => ({
      key: r.key,
      label: r.label,
      description: r.description,
      sortOrder: r.sort_order,
    }));
  },
};
