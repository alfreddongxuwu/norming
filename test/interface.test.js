import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [mainSource, stylesSource, pluginSource] = await Promise.all([
  readFile(new URL("../src/main.js", import.meta.url), "utf8"),
  readFile(new URL("../src/styles.css", import.meta.url), "utf8"),
  readFile(new URL("../src/plugins/two-slider-response.js", import.meta.url), "utf8"),
]);

test("the slider uses the requested endpoint labels", () => {
  assert.match(stylesSource, /justify-content:\s*space-between/);
  const labelRule = stylesSource.match(/\.slider-end-labels\s*\{([^}]*)\}/)?.[1];
  assert.match(labelRule, /font-weight:\s*400/);
});

test("the experiment column is centered in the middle third and text is left aligned", () => {
  assert.match(stylesSource, /width:\s*min\(33\.333vw,\s*42rem\)/);
  assert.match(stylesSource, /text-align:\s*left/);
  assert.match(stylesSource, /align-items:\s*center/);
  assert.match(stylesSource, /justify-content:\s*center/);
});

test("both sliders must be moved before submission", () => {
  assert.match(pluginSource, /disabled/);
  assert.match(pluginSource, /moved\.size === inputs\.length/);
});

test("the rating page records one total response time", () => {
  assert.match(pluginSource, /rt: Math\.round\(performance\.now\(\) - startTime\)/);
  assert.doesNotMatch(pluginSource, /completion_rt|try_rt|firstMovementRt/);
});

test("the two rating questions are randomized once and shown in one trial", () => {
  assert.match(mainSource, /randomization\.shuffle/);
  assert.match(mainSource, /combinedRatingStimulus\(selectedCondition, questionOrder\)/);
  assert.doesNotMatch(mainSource, /ratingTrials/);
});

test("rating and demographic submit buttons have added space above them", () => {
  assert.match(stylesSource, /#two-slider-next,\s*#jspsych-survey-html-form-next\s*\{\s*margin-top:\s*2rem/);
});

test("demographic validation uses experiment-controlled English messages", () => {
  assert.match(mainSource, /form\.noValidate = true/);
  assert.match(mainSource, /Please enter your age in years\./);
  assert.match(mainSource, /Please enter an age between 18 and 120\./);
  assert.match(mainSource, /Please select an option\./);
});

test("the demographics payment reassurance emphasizes not", () => {
  assert.match(
    mainSource,
    /Your answers on this page will <strong>not<\/strong> affect your payment/,
  );
});

test("ordinary study text uses the question font size", () => {
  assert.match(stylesSource, /--study-font-size:\s*1\.08rem/);
  assert.match(stylesSource, /\.scenario-text\s*\{[\s\S]*?font-size:\s*var\(--study-font-size\)/);
  assert.match(stylesSource, /\.consent-screen p\s*\{[\s\S]*?font-size:\s*var\(--study-font-size\)/);
  assert.match(stylesSource, /\.slider-end-labels\s*\{[\s\S]*?font-size:\s*var\(--study-font-size\)/);
});

test("the reading instruction is regular while the scenario text is bold", () => {
  const readingInstructionRule = stylesSource.match(
    /\.reading-instruction\s*\{([^}]*)\}/,
  )?.[1];
  assert.match(stylesSource, /\.scenario-text\s*\{[\s\S]*?font-weight:\s*700/);
  assert.doesNotMatch(readingInstructionRule, /font-weight:\s*700/);
});

test("consent emphasizes the duration number and the quoted affirmative choice", () => {
  assert.match(mainSource, /about <strong>5 minutes<\/strong>/);
  assert.match(
    mainSource,
    /selecting <strong>“Yes, I agree to participate”<\/strong> and continuing/,
  );
});

test("consent response choices have visible space between them", () => {
  assert.match(
    stylesSource,
    /#jspsych-html-button-response-btngroup\s*\{[^}]*column-gap:\s*1\.25rem/s,
  );
});

test("the experiment ends on one static completion screen without a redundant Finish step", () => {
  assert.doesNotMatch(mainSource, /const completion =|choices: \["Finish"\]/);
  assert.doesNotMatch(mainSource, /<h1>Thank you<\/h1>/);
  assert.equal(
    mainSource.match(
      /Thank you for completing this study\. Your response has been recorded\./g,
    )?.length,
    1,
  );
  assert.doesNotMatch(mainSource, /Preview complete\. No responses were saved\./);
  assert.doesNotMatch(mainSource, /You may now close this window\./);
  assert.match(mainSource, /You should be redirected to Prolific automatically\./);
  assert.match(stylesSource, /\.completion-screen p,[\s\S]*?font-size:\s*1\.35rem/);
});

test("data saving is restricted to complete Prolific sessions", () => {
  assert.match(mainSource, /isCompleteProlificSession\(prolific\)/);
  assert.match(mainSource, /conditional_function: \(\) => isDataCollectionSession/);
  assert.match(mainSource, /collection_mode: isDataCollectionSession \? "main" : "preview"/);
});

test("responses are saved before the recorded completion screen", () => {
  assert.ok(mainSource.indexOf("const saveData =") < mainSource.indexOf("jsPsych.run"));
  assert.match(
    mainSource,
    /demographics,\s*saveLoop,\s*\]\);/,
  );
  assert.match(mainSource, /JSON\.stringify\(buildParticipantRecord/);
  assert.match(mainSource, /Saving your responses\. Please do not close this page\./);
  assert.match(mainSource, /Your response has not been recorded\./);
});

test("complete Prolific sessions reuse one anonymized save target across repeats", () => {
  assert.match(mainSource, /submissionIdFromProlificParameters\(prolific\)/);
  assert.match(mainSource, /filename:\s*dataFilename\(submissionId\)/);
  assert.match(mainSource, /localStorage/);
  assert.match(mainSource, /storedSession\?\.saveAccepted/);
  assert.match(mainSource, /renderStaticScreen\(recordedCompletionContent\(\)\)/);
  assert.match(mainSource, /parsed\?\.prolificPid === prolific\.prolificPid/);
  assert.match(mainSource, /parsed\?\.sessionId === prolific\.sessionId/);
});

test("the repeat-session storage key is initialized before stored sessions are read", () => {
  assert.ok(
    mainSource.indexOf("let submissionId =") <
      mainSource.indexOf("let storedSession = readStoredSession()"),
  );
});

test("completion screens redirect to the matching Prolific target", () => {
  assert.match(
    mainSource,
    /PROLIFIC_COMPLETION_URL\s*=\s*\n\s*"https:\/\/app\.prolific\.com\/submissions\/complete\?cc=C1GHDDD8"/,
  );
  assert.match(mainSource, /PROLIFIC_PREVIEW_URL\s*=\s*"https:\/\/www\.prolific\.com\/"/);
  assert.match(mainSource, /PROLIFIC_REDIRECT_DELAY_MS\s*=\s*1200/);
  assert.match(mainSource, /Return to Prolific/);
  assert.match(mainSource, /isDataCollectionSession \? PROLIFIC_COMPLETION_URL : PROLIFIC_PREVIEW_URL/);
  assert.match(mainSource, /window\.location\.assign\(prolificReturnUrl\(\)\)/);
  assert.match(mainSource, /consentGiven && saveAccepted/);
  assert.match(stylesSource, /\.return-to-prolific\s*\{[\s\S]*?display:\s*inline-block/);
});
