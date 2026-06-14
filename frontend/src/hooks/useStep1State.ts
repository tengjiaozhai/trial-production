import { useState } from 'react';
import type { ProjectInfo, Template } from '../types';

export function useStep1State() {
  const [name, setName] = useState('');
  const [customer, setCustomer] = useState<Template | ''>('');
  const [stage, setStage] = useState('');
  const [files, setFiles] = useState<ProjectInfo['files']>([]);
  const [step1Errors, setStep1Errors] = useState<Record<string, boolean>>({});
  const [manualPcbaInput, setManualPcbaInput] = useState('');
  return {
    name, setName,
    customer, setCustomer,
    stage, setStage,
    files, setFiles,
    step1Errors, setStep1Errors,
    manualPcbaInput, setManualPcbaInput,
  };
}
