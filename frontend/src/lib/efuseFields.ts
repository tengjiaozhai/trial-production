export const EFUSE_FIELD_IDS = new Set([
  'ce_cert',
  'customer_sample_req',
  'hw_eng',
  'hw_test',
  'sw_eng',
  'sw_test',
  'struct_eng',
  'reliability',
  'reliability_eng',
  'image_eng',
  'npm',
  'ux',
  'parts',
]);

export function supportsEfuseLabel(fieldId: string): boolean {
  return EFUSE_FIELD_IDS.has(fieldId);
}

export function formatFieldLabelWithEfuse(args: {
  fieldId: string;
  fieldLabel: string;
  efuseConfigs?: Record<string, string>;
}): string {
  const suffix = args.efuseConfigs?.[args.fieldId]?.trim();
  if (!suffix || !supportsEfuseLabel(args.fieldId)) return args.fieldLabel;
  return `${args.fieldLabel}(${suffix})`;
}
