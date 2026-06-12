// Pure-async processors for the 3 LLM-backed file types, designed for
// Promise.all dispatch after PCBA parse. They take all dependencies as
// arguments (no React state, no useEffect, no side effects) so they are
// trivially testable and trivially parallelizable.

export type MaterialLLMResult = {
  materialNameByStaticField: Record<string, string>;
  materialNameByEmmcSize: Record<string, string>;
  materialNameByDdrSize: Record<string, string>;
};

export interface ProcessMaterialInput {
  emmcSizes: string[];
  ddrSizes: string[];
  llmCall: (args: { emmcSizes: string[]; ddrSizes: string[] }) => Promise<MaterialLLMResult>;
}

export async function processMaterialFile(
  input: ProcessMaterialInput,
): Promise<MaterialLLMResult> {
  return input.llmCall({
    emmcSizes: input.emmcSizes,
    ddrSizes: input.ddrSizes,
  });
}

export interface ProcessKeyMaterialInput {
  category2List: string[];
  llmCall: (list: string[]) => Promise<Record<string, string>>;
}

export async function processKeyMaterialFile(
  input: ProcessKeyMaterialInput,
): Promise<Record<string, string>> {
  return input.llmCall(input.category2List);
}

export interface SampleSheet {
  rowNames: string[];
}

export interface ProcessSampleInput {
  sheets: SampleSheet[];
  llmCall: (names: string[]) => Promise<Record<string, string>>;
}

export async function processSampleFile(
  input: ProcessSampleInput,
): Promise<Record<string, string>> {
  const allRowNames = Array.from(new Set(input.sheets.flatMap((s) => s.rowNames)));
  return input.llmCall(allRowNames);
}
