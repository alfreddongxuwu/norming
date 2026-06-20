export const DATAPIPE_EXPERIMENT_ID = "RPkcoguw3w0u";
export const DATA_SCHEMA_VERSION = "1.0.0";

export const PROLIFIC_PARAMETER_NAMES = Object.freeze([
  "PROLIFIC_PID",
  "STUDY_ID",
  "SESSION_ID",
]);

const FNV_OFFSET_BASIS_64 = 0xcbf29ce484222325n;
const FNV_PRIME_64 = 0x100000001b3n;
const FNV_64_MASK = 0xffffffffffffffffn;

const ACCEPTED_SAVE_MESSAGES = new Set([
  "Success",
  "Data received. OSF upload will be retried automatically.",
]);

export function prolificParametersFromSearch(search) {
  const query = search instanceof URLSearchParams ? search : new URLSearchParams(search);

  return {
    prolificPid: query.get("PROLIFIC_PID")?.trim() ?? "",
    studyId: query.get("STUDY_ID")?.trim() ?? "",
    sessionId: query.get("SESSION_ID")?.trim() ?? "",
  };
}

export function hasAnyProlificParameter(parameters) {
  return Object.values(parameters).some((value) => value !== "");
}

export function isCompleteProlificSession(parameters) {
  return Object.values(parameters).every((value) => value !== "");
}

export function submissionIdFromProlificParameters(parameters) {
  if (!isCompleteProlificSession(parameters)) {
    return undefined;
  }

  const submissionKey = [
    parameters.prolificPid,
    parameters.studyId,
    parameters.sessionId,
  ].join("\u001f");

  return `prolific_${fnv1a64(submissionKey)}`;
}

export function conditionIdFromPipeResult(result, conditionCount) {
  return Number.isInteger(result) && result >= 0 && result < conditionCount
    ? result
    : undefined;
}

export function isAcceptedSaveResult(result) {
  if (!result || typeof result !== "object") {
    return false;
  }

  if (result.error === "OSF_FILE_EXISTS") {
    return true;
  }

  return result.error == null && ACCEPTED_SAVE_MESSAGES.has(result.message);
}

export function saveErrorCode(result) {
  return typeof result?.error === "string" ? result.error : "NETWORK_OR_UNKNOWN_ERROR";
}

export function dataFilename(submissionId) {
  return `norming_${submissionId}.json`;
}

function fnv1a64(value) {
  let hash = FNV_OFFSET_BASIS_64;

  for (const character of value) {
    hash ^= BigInt(character.codePointAt(0));
    hash = (hash * FNV_PRIME_64) & FNV_64_MASK;
  }

  return hash.toString(16).padStart(16, "0");
}

export function buildParticipantRecord(trials) {
  const consent = trials.find((trial) => trial.trial_kind === "consent");
  const instructions = trials.find((trial) => trial.trial_kind === "instructions");
  const rating = trials.find((trial) => trial.trial_kind === "rating");
  const demographics = trials.find((trial) => trial.trial_kind === "demographics");
  const metadata = rating ?? demographics ?? consent ?? {};
  const demographicResponse = demographics?.response ?? {};
  const age = Number(demographicResponse.age);

  return {
    data_schema_version: DATA_SCHEMA_VERSION,
    participant_uuid: metadata.participant_uuid ?? null,
    study_version: metadata.study_version ?? null,
    collection_mode: metadata.collection_mode ?? null,
    prolific_pid: metadata.prolific_pid ?? null,
    prolific_study_id: metadata.prolific_study_id ?? null,
    prolific_session_id: metadata.prolific_session_id ?? null,
    assignment_source: metadata.assignment_source ?? null,
    condition_id: metadata.condition_id ?? null,
    item: metadata.item ?? null,
    prior: metadata.prior ?? null,
    consent_given: consent?.consent_given ?? null,
    consent_rt_ms: consent?.rt ?? null,
    instructions_rt_ms: instructions?.rt ?? null,
    rating_rt_ms: rating?.rt ?? null,
    completion_rating: rating?.completion_rating ?? null,
    try_rating: rating?.try_rating ?? null,
    question_order: rating?.question_order ?? null,
    demographics_rt_ms: demographics?.rt ?? null,
    age: Number.isFinite(age) ? age : null,
    gender: demographicResponse.gender ?? null,
    education: demographicResponse.education ?? null,
    native_language: demographicResponse.native_language ?? null,
    country: demographicResponse.country ?? null,
  };
}
