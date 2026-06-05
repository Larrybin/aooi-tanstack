import * as backgroundRemoverRuntimeContractNamespace from '../../src/domains/background-remover/domain/runtime-contract.ts';
import * as removerRuntimeContractNamespace from '../../src/domains/remover/domain/runtime-contract.ts';
import * as textToSpeechGeneratorRuntimeContractNamespace from '../../src/domains/text-to-speech-generator/domain/runtime-contract.ts';

const removerRuntimeContractModule =
  removerRuntimeContractNamespace.default ?? removerRuntimeContractNamespace;
const { AI_REMOVER_RUNTIME_CONTRACT } = removerRuntimeContractModule;
const backgroundRemoverRuntimeContractModule =
  backgroundRemoverRuntimeContractNamespace.default ??
  backgroundRemoverRuntimeContractNamespace;
const { BACKGROUND_REMOVER_RUNTIME_CONTRACT } =
  backgroundRemoverRuntimeContractModule;
const textToSpeechGeneratorRuntimeContractModule =
  textToSpeechGeneratorRuntimeContractNamespace.default ??
  textToSpeechGeneratorRuntimeContractNamespace;
const { TEXT_TO_SPEECH_GENERATOR_RUNTIME_CONTRACT } =
  textToSpeechGeneratorRuntimeContractModule;

const PRODUCT_RUNTIME_CONTRACTS = Object.freeze([
  AI_REMOVER_RUNTIME_CONTRACT,
  BACKGROUND_REMOVER_RUNTIME_CONTRACT,
  TEXT_TO_SPEECH_GENERATOR_RUNTIME_CONTRACT,
]);

export function getProductRuntimeContractsForSite(siteKey) {
  return PRODUCT_RUNTIME_CONTRACTS.filter(
    (contract) => contract.siteKey === siteKey
  );
}
