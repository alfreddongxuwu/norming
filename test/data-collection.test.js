import test from "node:test";
import assert from "node:assert/strict";
import {
  buildParticipantRecord,
  conditionIdFromPipeResult,
  dataFilename,
  hasAnyProlificParameter,
  isAcceptedSaveResult,
  isCompleteProlificSession,
  prolificParametersFromSearch,
  saveErrorCode,
} from "../src/data-collection.js";

test("raw jsPsych trials are reduced to one participant-level record", () => {
  const shared = {
    participant_uuid: "123e4567-e89b-12d3-a456-426614174000",
    study_version: "norming-0.2.0-pilot",
    collection_mode: "pilot",
    prolific_pid: "participant-1",
    prolific_study_id: "study-2",
    prolific_session_id: "session-3",
    assignment_source: "datapipe-sequential",
    condition_id: 2,
    item: "package",
    prior: "high",
  };

  const record = buildParticipantRecord([
    { ...shared, trial_kind: "consent", consent_given: true, rt: 4100 },
    { ...shared, trial_kind: "instructions", rt: 1800 },
    {
      ...shared,
      trial_kind: "rating",
      rt: 9200,
      completion_rating: 78,
      try_rating: 64,
      question_order: ["try", "completion"],
    },
    {
      ...shared,
      trial_kind: "demographics",
      rt: 13700,
      response: {
        age: "25",
        gender: "woman",
        education: "bachelor",
        native_language: "english-only",
        country: "united-states",
      },
    },
  ]);

  assert.deepEqual(record, {
    data_schema_version: "1.0.0",
    ...shared,
    consent_given: true,
    consent_rt_ms: 4100,
    instructions_rt_ms: 1800,
    rating_rt_ms: 9200,
    completion_rating: 78,
    try_rating: 64,
    question_order: ["try", "completion"],
    demographics_rt_ms: 13700,
    age: 25,
    gender: "woman",
    education: "bachelor",
    native_language: "english-only",
    country: "united-states",
  });
  assert.equal("stimulus" in record, false);
  assert.equal("trial_index" in record, false);
  assert.equal("plugin_version" in record, false);
});

test("Prolific identifiers are read from the standard URL parameters", () => {
  const identifiers = prolificParametersFromSearch(
    "?PROLIFIC_PID=participant-1&STUDY_ID=study-2&SESSION_ID=session-3",
  );

  assert.deepEqual(identifiers, {
    prolificPid: "participant-1",
    studyId: "study-2",
    sessionId: "session-3",
  });
  assert.equal(hasAnyProlificParameter(identifiers), true);
  assert.equal(isCompleteProlificSession(identifiers), true);
});

test("a partial Prolific URL is not treated as a data-collection session", () => {
  const identifiers = prolificParametersFromSearch("?PROLIFIC_PID=participant-1");

  assert.equal(hasAnyProlificParameter(identifiers), true);
  assert.equal(isCompleteProlificSession(identifiers), false);
});

test("an ordinary preview URL does not activate data collection", () => {
  const identifiers = prolificParametersFromSearch("?condition=2");

  assert.equal(hasAnyProlificParameter(identifiers), false);
  assert.equal(isCompleteProlificSession(identifiers), false);
});

test("DataPipe condition results must be valid integer condition IDs", () => {
  assert.equal(conditionIdFromPipeResult(0, 4), 0);
  assert.equal(conditionIdFromPipeResult(3, 4), 3);
  assert.equal(conditionIdFromPipeResult(4, 4), undefined);
  assert.equal(conditionIdFromPipeResult("2", 4), undefined);
  assert.equal(conditionIdFromPipeResult(new Error("offline"), 4), undefined);
});

test("successful, queued, and idempotent saves are accepted", () => {
  assert.equal(isAcceptedSaveResult({ message: "Success" }), true);
  assert.equal(
    isAcceptedSaveResult({
      error: null,
      message: "Data received. OSF upload will be retried automatically.",
    }),
    true,
  );
  assert.equal(
    isAcceptedSaveResult({
      error: "OSF_FILE_EXISTS",
      message: "The OSF file already exists. File names must be unique.",
    }),
    true,
  );
});

test("failed or ambiguous saves are rejected with a safe error code", () => {
  assert.equal(isAcceptedSaveResult({ error: "INVALID_DATA" }), false);
  assert.equal(isAcceptedSaveResult(new Error("offline")), false);
  assert.equal(isAcceptedSaveResult(undefined), false);
  assert.equal(saveErrorCode({ error: "INVALID_DATA" }), "INVALID_DATA");
  assert.equal(saveErrorCode(new Error("offline")), "NETWORK_OR_UNKNOWN_ERROR");
});

test("the OSF filename contains only the generated participant UUID", () => {
  assert.equal(
    dataFilename("123e4567-e89b-12d3-a456-426614174000"),
    "norming_123e4567-e89b-12d3-a456-426614174000.json",
  );
});
