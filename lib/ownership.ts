import { apiClient } from './api';

export interface OwnershipData {
  templateIds: Set<number>;
  variantsByTemplate: Map<number, Set<string>>; // key = "QUALITY-ENHANCEMENT"
  loaded: boolean;
}

export function variantKey(quality?: string, enhancement?: string) {
  if (!quality || !enhancement) return '';
  return `${quality}-${enhancement}`;
}

export async function loadOwnership(): Promise<OwnershipData> {
  const data = await apiClient.getCollection();
  const items: any[] = data.items || [];

  const templateIds = new Set<number>();
  const variantsByTemplate = new Map<number, Set<string>>();

  for (const item of items) {
    const templateId = item.card_template_id;
    if (templateId == null) continue;

    templateIds.add(templateId);
    if (!variantsByTemplate.has(templateId)) {
      variantsByTemplate.set(templateId, new Set());
    }
    variantsByTemplate.get(templateId)!.add(
      variantKey(item.quality, item.enhancement)
    );
  }

  return { templateIds, variantsByTemplate, loaded: true };
}